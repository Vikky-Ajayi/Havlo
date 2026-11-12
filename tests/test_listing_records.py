"""Recording every Rightmove listing and agent seen in a search
(listing_records.py), and the branch track records worked out from them."""
from __future__ import annotations

import asyncio
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.models import MarketListing
from app.services import listing_records as lr

NOW = datetime.now(timezone.utc)


def prop(rm_id="1", *, status="", price=300000, listed_days_ago=30, branch=10, agency="Smith & Co"):
    return {
        "id": int(rm_id), "bedrooms": 3, "bathrooms": 1, "numberOfImages": 20, "numberOfFloorplans": 1,
        "numberOfVirtualTours": 0, "displayAddress": "Hoo Road, Kidderminster, DY10", "countryCode": "GB",
        "location": {"latitude": 52.3, "longitude": -2.2}, "propertySubType": "Semi-Detached",
        "tenure": {"tenureType": "FREEHOLD"}, "price": {"amount": price, "displayPrices": [
            {"displayPrice": f"£{price:,}", "displayPriceQualifier": "Offers Over"}]},
        "featuredProperty": False, "premiumListing": False, "customer": {
            "branchId": branch, "brandTradingName": agency, "branchDisplayName": f"{agency}, Kidderminster"},
        "firstVisibleDate": (NOW - timedelta(days=listed_days_ago)).isoformat().replace("+00:00", "Z"),
        "displaySize": "898 sq. ft.", "displayStatus": status, "commercial": False, "auction": False,
        "development": False,
    }


class RowTests(unittest.TestCase):
    def test_a_search_result_becomes_a_row(self):
        row = lr.row_from_search(prop(status="Sold STC"))
        self.assertEqual(row["rightmove_id"], "1")
        self.assertEqual((row["branch_id"], row["agency"]), ("10", "Smith & Co"))
        self.assertEqual((row["outcode"], row["area"]), ("DY10", "DY"))
        self.assertEqual(row["status"], "sold_stc")
        self.assertEqual(row["size_sqft"], 898)
        self.assertEqual(row["tenure"], "freehold")
        self.assertEqual(row["price_qualifier"], "Offers Over")

    def test_commercial_and_overseas_are_skipped(self):
        self.assertIsNone(lr.row_from_search({**prop(), "commercial": True}))
        self.assertIsNone(lr.row_from_search({**prop(), "countryCode": "ES"}))

    def test_observe_never_raises(self):
        self.assertEqual(lr.observe([None, {"id": None}, "junk"], includes_agreed=True), 0)


class OutcomeTests(unittest.TestCase):
    def test_agreed_within_180_days(self):
        listed = NOW - timedelta(days=100)
        o = lr.outcome({"first_listed_at": listed, "agreed_at": listed + timedelta(days=60),
                        "last_on_market_at": listed + timedelta(days=55)})
        self.assertEqual(o, {"within": True, "days": 60})

    def test_still_for_sale_after_180_days_in_a_tracked_search(self):
        listed = NOW - timedelta(days=200)
        self.assertFalse(lr.outcome({"first_listed_at": listed, "tracked_on_market_at": NOW})["within"])

    def test_inventory_scans_alone_never_decide(self):
        # Seen for sale at day 200 only by a search that hides sold STC homes:
        # a sale would have been invisible to it, so no verdict.
        listed = NOW - timedelta(days=200)
        self.assertIsNone(lr.outcome({"first_listed_at": listed, "last_on_market_at": NOW})["within"])

    def test_days_only_when_seen_for_sale_shortly_before(self):
        listed = NOW - timedelta(days=100)
        o = lr.outcome({"first_listed_at": listed, "agreed_at": listed + timedelta(days=60),
                        "last_on_market_at": listed + timedelta(days=20)})
        self.assertEqual(o, {"within": True, "days": None})


class WriteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.addCleanup(os.unlink, self.tmp.name)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.addCleanup(lambda: asyncio.run(self.engine.dispose()))

        async def create():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: MarketListing.__table__.create(c))
        asyncio.run(create())

    def _write(self, props, seen, tracked=True):
        async def run():
            async with self.Session() as db:
                items = {r["rightmove_id"]: (r, seen, tracked) for r in map(lr.row_from_search, props)}
                out = await lr.write(db, items)
                await db.commit()
                return out
        return asyncio.run(run())

    def _get(self, rm_id):
        async def run():
            async with self.Session() as db:
                return (await db.execute(select(MarketListing).where(MarketListing.rightmove_id == rm_id))).scalar_one()
        return asyncio.run(run())

    def test_a_listing_is_followed_from_for_sale_to_sold(self):
        self.assertEqual(self._write([prop(price=300000)], NOW - timedelta(days=20)), {"added": 1, "updated": 0})
        self.assertEqual(self._write([prop(price=290000)], NOW - timedelta(days=10)), {"added": 0, "updated": 1})
        self._write([prop(price=290000, status="Under offer")], NOW - timedelta(days=5))
        self._write([prop(price=290000, status="Sold STC")], NOW)
        r = self._get("1")
        self.assertEqual((r.first_price, r.price, r.lowest_price, r.reductions), (300000, 290000, 290000, 1))
        self.assertEqual(r.status, "sold_stc")
        self.assertIsNotNone(r.under_offer_at)
        self.assertIsNotNone(r.sold_stc_at)
        self.assertEqual(r.agreed_at.replace(tzinfo=timezone.utc).date(), (NOW - timedelta(days=5)).date())
        self.assertEqual(r.times_seen, 4)

    def test_back_on_the_market_counts_as_fallen_through(self):
        self._write([prop(status="Under offer")], NOW - timedelta(days=5))
        self._write([prop()], NOW)
        r = self._get("1")
        self.assertEqual((r.status, r.fell_through), ("on_market", 1))

    def test_only_tracked_searches_set_tracked_on_market(self):
        self._write([prop()], NOW, tracked=False)
        self.assertIsNone(self._get("1").tracked_on_market_at)
        self._write([prop()], NOW, tracked=True)
        self.assertIsNotNone(self._get("1").tracked_on_market_at)


class TrackRecordTests(unittest.TestCase):
    def _row(self, i, branch, *, within):
        listed = NOW - timedelta(days=300)
        row = {"rightmove_id": str(i), "branch_id": branch, "agency": f"Agency {branch}", "branch_name": "x",
               "outcode": "DY10", "property_type": "Semi-Detached", "bedrooms": 3, "price": 300000,
               "first_listed_at": listed, "last_seen_at": NOW, "first_seen_at": listed, "status": "on_market",
               "virtual_tours": 0, "reductions": 0, "fell_through": 0}
        if within:
            row.update(agreed_at=listed + timedelta(days=50), last_on_market_at=listed + timedelta(days=45),
                       status="sold_stc")
        else:
            row.update(tracked_on_market_at=NOW, last_on_market_at=NOW)
        return row

    def test_branches_are_ranked_by_share_agreed_within_180_days(self):
        rows = [self._row(i, "A", within=i < 8) for i in range(10)]  # 80%
        rows += [self._row(100 + i, "B", within=i < 3) for i in range(10)]  # 30%
        rows += [self._row(200 + i, "C", within=True) for i in range(4)]  # too few to rank
        out = lr.compute(rows)
        self.assertEqual([b["branch_id"] for b in out["branches"]], ["A", "B", "C"])
        a = out["branches"][0]
        self.assertEqual((a["decided"], a["agreed_within_180"], a["share_within_180"]), (10, 8, 80.0))
        self.assertEqual(a["median_days_to_agree"], 50)
        self.assertFalse(out["branches"][2]["ranked"])
        self.assertEqual(out["totals"]["ranked_branches"], 2)

    def test_filters(self):
        rows = [self._row(1, "A", within=True), {**self._row(2, "B", within=True), "property_type": "Flat"}]
        self.assertEqual([b["branch_id"] for b in lr.compute(rows, property_type="flat")["branches"]], ["B"])
        self.assertEqual(lr.compute(rows, min_price=400000)["totals"]["listings"], 0)


if __name__ == "__main__":
    unittest.main()
