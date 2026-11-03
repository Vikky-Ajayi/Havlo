"""The prospects console's Follow Up list shows who has paid for an add-on
(Listing Rewrite, Relaunch Strategy): a filter, a count and each order."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles

from app.routers import stale_listings


# SQLite has no ARRAY type; store the Postgres array columns as JSON text.
@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)


def _order(pid, names, amount, **extra):
    return SimpleNamespace(prospect_id=pid, items_json=json.dumps([{"key": n.lower(), "name": n} for n in names]),
                           amount=amount, currency="GBP", payment_method=extra.get("method", "card"),
                           reference=extra.get("reference"), paid_at=extra.get("paid_at"),
                           created_at=datetime(2026, 11, 3, 9, tzinfo=timezone.utc),
                           team_emailed_at=extra.get("emailed"))


class PaidAddonOrdersTests(unittest.TestCase):
    def test_each_prospects_paid_orders_are_listed(self) -> None:
        a, b = uuid.uuid4(), uuid.uuid4()
        paid = datetime(2026, 11, 3, 10, 30, tzinfo=timezone.utc)
        rows = [_order(a, ["Listing Rewrite", "Relaunch Strategy"], 498.0, paid_at=paid, emailed=paid, reference="AO-1"),
                _order(b, ["Relaunch Strategy"], 0.0, method="promo")]
        result = mock.Mock()
        result.scalars.return_value.all.return_value = rows
        db = mock.AsyncMock()
        db.execute.return_value = result
        got = asyncio.run(stale_listings._paid_addon_orders(db, [a, b]))
        self.assertEqual(got[a], [{"items": ["Listing Rewrite", "Relaunch Strategy"], "amount": 498.0, "currency": "GBP",
                                   "payment_method": "card", "reference": "AO-1", "paid_at": paid.isoformat(),
                                   "team_emailed_at": paid.isoformat()}])
        self.assertEqual(got[b][0]["payment_method"], "promo")
        self.assertIsNone(got[b][0]["team_emailed_at"])
        self.assertEqual(got[b][0]["paid_at"], "2026-11-03T09:00:00+00:00")  # falls back to when it was placed

    def test_an_empty_page_asks_nothing(self) -> None:
        db = mock.AsyncMock()
        self.assertEqual(asyncio.run(stale_listings._paid_addon_orders(db, [])), {})
        db.execute.assert_not_awaited()

    def test_the_filter_is_paid_orders_only(self) -> None:
        sql = str(stale_listings._addons_paid_filter().compile(compile_kwargs={"literal_binds": True}))
        self.assertIn("stale_prospect_addon_orders", sql)
        self.assertIn("'completed'", sql)


class ReconcileOrdersTests(unittest.TestCase):
    """An add-on paid at SumUp is confirmed (and the team told) even when the
    customer never comes back to the Next Steps page."""

    def setUp(self) -> None:
        import os
        import tempfile

        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.models.models import StaleListingProspect, StaleProspectAddonOrder

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.addCleanup(os.unlink, self.tmp.name)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.Order, self.Prospect = StaleProspectAddonOrder, StaleListingProspect

        async def seed():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: [m.__table__.create(c) for m in (StaleListingProspect, StaleProspectAddonOrder)])
            async with self.Session() as db:
                prospect = StaleListingProspect(property_code="4821", qr_token_hash="h", property_address="1 Test Road",
                                                country="UK", rightmove_url="https://example.com/1")
                db.add(prospect)
                await db.flush()
                items = json.dumps([{"key": "listing_rewrite", "name": "Listing Rewrite", "price": 199.0}])
                db.add_all([
                    StaleProspectAddonOrder(prospect_id=prospect.id, items_json=items, amount=199.0, status="pending",
                                            sumup_checkout_id="paid-1", reference="SLA-1"),
                    StaleProspectAddonOrder(prospect_id=prospect.id, items_json=items, amount=199.0, status="pending",
                                            sumup_checkout_id="open-2", reference="SLA-2"),
                ])
                await db.commit()

        asyncio.run(seed())
        self.addCleanup(lambda: asyncio.run(self.engine.dispose()))

    def _run(self, sent: bool = True) -> dict:
        from app.db import database
        from app.services import email_service, stale_prospect_addons, sumup_service

        async def status(checkout_id):
            return {"status": "PAID" if checkout_id.startswith("paid") else "PENDING"}

        with mock.patch.object(database, "AsyncSessionLocal", self.Session), \
                mock.patch.object(sumup_service, "get_checkout_status", status), \
                mock.patch.object(email_service, "send_admin_notification", mock.AsyncMock(return_value=sent)):
            return asyncio.run(stale_prospect_addons.reconcile_orders())

    def _orders(self) -> dict:
        from sqlalchemy import select

        async def read():
            async with self.Session() as db:
                return {o.reference: o for o in (await db.execute(select(self.Order))).scalars().all()}
        return asyncio.run(read())

    def test_a_paid_order_is_confirmed_and_the_team_emailed(self) -> None:
        stats = self._run()
        self.assertEqual(stats, {"checked": 2, "confirmed": 1, "team_emailed": 1})
        orders = self._orders()
        self.assertEqual(orders["SLA-1"].status, "completed")
        self.assertIsNotNone(orders["SLA-1"].paid_at)
        self.assertIsNotNone(orders["SLA-1"].team_emailed_at)
        self.assertEqual(orders["SLA-2"].status, "pending")  # not paid yet: left as it is
        self.assertEqual(self._run()["team_emailed"], 0)  # told once

    def test_a_failed_team_email_is_tried_again(self) -> None:
        self.assertEqual(self._run(sent=False)["team_emailed"], 0)
        self.assertIsNone(self._orders()["SLA-1"].team_emailed_at)
        self.assertEqual(self._run(sent=True)["team_emailed"], 1)


if __name__ == "__main__":
    unittest.main()
