"""The prospects console's Follow Up list shows who has paid for an add-on
(Listing Rewrite, Relaunch Strategy): a filter, a count and each order."""
from __future__ import annotations

import asyncio
import json
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

from app.routers import stale_listings


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


if __name__ == "__main__":
    unittest.main()
