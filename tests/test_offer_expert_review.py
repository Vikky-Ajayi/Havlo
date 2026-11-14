"""The /offer page as an expert-reviewed report (Nov 2026 brief): purchases
held 72 hours like the /review/ pages, the "report ready" link back to /offer,
and the recently-assessed strip on its landing page."""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.models.models import StaleListingProspect
from app.services import analyst_review
from app.services import recent_assessments as ra
from app.services import stale_prospect_service as sps


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


def prospect(lead_source, **kw):
    base = dict(lead_source=lead_source, audience="owner", payment_status="pending", unlocked_at=None,
                analyst_review_due_at=None, report_released_at=None, id="p1", qr_token_hashes=[])
    return SimpleNamespace(**{**base, **kw})


class HoldTests(unittest.TestCase):
    def test_offer_purchases_are_held_72_hours(self):
        p = prospect("meta2_seller")
        analyst_review.mark_paid(p, NOW)
        self.assertEqual(p.analyst_review_due_at, NOW + timedelta(hours=72))
        self.assertTrue(analyst_review.report_on_hold(p))

    def test_review_pages_keep_48_hours_and_others_are_not_held(self):
        p = prospect("review_seller")
        analyst_review.mark_paid(p, NOW)
        self.assertEqual(p.analyst_review_due_at, NOW + timedelta(hours=48))
        for source in ("meta_seller", "rm_seller", "sell_seller"):
            q = prospect(source)
            analyst_review.mark_paid(q, NOW)
            self.assertIsNone(q.analyst_review_due_at)
            self.assertFalse(analyst_review.report_on_hold(q))

    def test_the_report_ready_link_goes_back_to_offer(self):
        with mock.patch.object(analyst_review, "get_settings", return_value=SimpleNamespace(SECRET_KEY="s")), \
                mock.patch("app.services.email_service._frontend_base_url", return_value="https://www.heyhavlo.com"):
            url = analyst_review.report_url(prospect("meta2_seller"))
            self.assertTrue(url.startswith("https://www.heyhavlo.com/offer/seller?token="), url)
            url = analyst_review.report_url(prospect("review_seller"))
            self.assertTrue(url.startswith("https://www.heyhavlo.com/review/seller?token="), url)


def row(address, score=48, **kw):
    report = {"version": 2, "overall_score": score}
    snapshot = {"image": "https://media.rightmove.co.uk/1.jpg"}
    base = dict(payment_status="pending", parent_prospect_id=None, is_manual=False, report_json=json.dumps(report),
                listing_snapshot_json=json.dumps(snapshot), property_address=address)
    return SimpleNamespace(**{**base, **kw})


class StripTests(unittest.TestCase):
    def test_street_and_town_never_show_a_number_or_postcode(self):
        self.assertEqual(ra.street_and_town("12 Bishop Norton Road, Glentham, LN8 2BL"), ("Bishop Norton Road", "Glentham"))
        self.assertEqual(ra.street_and_town("Flat 3, Hoo Road, Kidderminster, DY10"), ("", ""))
        self.assertEqual(ra.street_and_town("Flat 3 Hoo Road, Kidderminster, DY10 1NB"), ("Hoo Road", "Kidderminster"))
        self.assertEqual(ra.street_and_town("Hoo Road, DY10"), ("Hoo Road", ""))

    def test_pick_leaves_out_customers_copies_typed_in_and_repeats(self):
        rows = [
            row("1 Hoo Road, Kidderminster, DY10", score=41),
            row("5 Hoo Road, Kidderminster, DY10"),  # same street
            row("Mill Lane, Leeds, LS6", payment_status="completed"),  # a paying customer
            row("High Street, York, YO1", parent_prospect_id="x"),  # an agency copy
            row("Church Road, Bath, BA1", listing_snapshot_json=json.dumps({"manual_details": True,
                                                                         "image": "https://x/1.jpg"})),
            row("Station Road, Ely, CB7", report_json=json.dumps({"overall_score": 50})),  # older report
            row("Park Avenue, Hull, HU5", listing_snapshot_json=json.dumps({})),  # no photo
            row("Oak Close, Derby, DE1", score=72.4),
        ]
        out = ra.pick(rows)
        self.assertEqual([(i["street"], i["score"]) for i in out], [("Hoo Road", 41), ("Oak Close", 72)])
        self.assertEqual(out[0]["town"], "Kidderminster")
        self.assertNotIn("1 Hoo", json.dumps(out))


class BackgroundPaymentTests(unittest.TestCase):
    """Someone who pays at SumUp and closes the tab still gets their report:
    the payment is confirmed in the background, which starts the review clock."""

    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.addCleanup(os.unlink, self.tmp.name)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.addCleanup(lambda: asyncio.run(self.engine.dispose()))

        async def seed():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: StaleListingProspect.__table__.create(c))
            async with self.Session() as db:
                for code, source, checkout in (("1111", "meta2_seller", "paid-1"), ("2222", "meta_seller", "open-2"),
                                               ("3333", "meta2_seller", None)):
                    db.add(StaleListingProspect(property_code=code, qr_token_hash=code, property_address="x",
                                                country="UK", rightmove_url=f"https://example.com/{code}",
                                                lead_source=source, payment_status="pending", payment_method="card",
                                                sumup_checkout_id=checkout))
                await db.commit()
        asyncio.run(seed())

    def test_a_paid_checkout_is_confirmed_and_held_for_review(self):
        statuses = {"paid-1": {"status": "PAID"}, "open-2": {"status": "PENDING"}}

        async def run():
            with mock.patch.object(sps, "AsyncSessionLocal", self.Session), \
                    mock.patch("app.services.sumup_service.get_checkout_status",
                               new=mock.AsyncMock(side_effect=lambda cid: statuses[cid])), \
                    mock.patch.object(sps, "expand_report_in_background", new=mock.AsyncMock()) as expand:
                out = await sps.reconcile_report_payments()
                await asyncio.sleep(0)
                return out, expand
        out, expand = asyncio.run(run())
        self.assertEqual(out, {"checked": 2, "confirmed": 1, "failed": 0})
        expand.assert_awaited_once()

        async def rows():
            async with self.Session() as db:
                return {p.property_code: p for p in (await db.execute(select(StaleListingProspect))).scalars()}
        got = asyncio.run(rows())
        self.assertEqual(got["1111"].payment_status, "completed")
        self.assertIsNotNone(got["1111"].analyst_review_due_at)  # the 72-hour clock has started
        self.assertEqual(got["2222"].payment_status, "pending")


if __name__ == "__main__":
    unittest.main()
