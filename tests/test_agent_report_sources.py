"""The agent report's own-database fallbacks, against a throwaway SQLite
database: listings near the property from Havlo's records (weekly searches
around monitored listings, listings Havlo found) and Land Registry sales by
postcode sector when the nearby-postcodes lookup doesn't answer."""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import types
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest import mock

from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.db import database
from app.models.models import LandRegistrySale, StaleListingMonitor, StaleListingProspect
from app.services import agent_report as ar
from app.services import land_registry as lr
from app.services import price_paid_data as ppd


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)
NOW = datetime.now(timezone.utc)
TODAY = NOW.date()


class OwnDatabaseSourcesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        asyncio.run(self._seed())
        patcher = mock.patch.object(database, "AsyncSessionLocal", self.Session)
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    def listing(self, code, postcode, **extra):
        values = dict(property_code=code, qr_token_hash=f"h{code}", property_address=f"{code} Road, Cardiff", postcode=postcode,
                      country="UK", rightmove_url=f"https://www.rightmove.co.uk/properties/9{code}", rightmove_id=f"9{code}",
                      asking_price=480000, property_type="Detached house", bedrooms=4, listed_date=NOW - timedelta(days=200),
                      listing_snapshot_json=json.dumps({"listed_date": "Added on 01/03/2026", "images": ["a", "b"]}),
                      agent_brand="Hills", created_at=NOW - timedelta(days=20))
        values.update(extra)
        return StaleListingProspect(**values)

    async def _seed(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: [m.__table__.create(c) for m in (StaleListingProspect, StaleListingMonitor, LandRegistrySale)])
        async with self.Session() as db:
            self.owner = self.listing("1000", "CF23 5PH", agent_brand="Acme Homes")
            monitored = self.listing("1001", "CF23 9AA")
            db.add_all([
                self.owner, monitored,
                self.listing("1002", "CF23 6XY", agent_brand="Moginie James"),
                self.listing("1003", "CF23", agent_brand=None, agent_company_name="Peter Alan Ltd"),
                self.listing("1004", "CF24 1AA"),  # another district
                self.listing("1005", "CF23 6XZ", is_manual=True),  # typed in by hand
                self.listing("1006", "CF23 6XW", created_at=NOW - timedelta(days=400)),  # found long ago
                self.listing("1007", "CF23 6XV", audience="agent"),  # an agency's copy
            ])
            await db.flush()
            db.add(StaleListingMonitor(
                prospect_id=monitored.id, started_at=NOW - timedelta(days=10), ends_at=NOW + timedelta(days=80),
                last_nearby_check_at=NOW - timedelta(days=2),
                nearby_json=json.dumps({"radius": 0.5, "listings": [
                    {"id": "777", "address": "7 Penylan Road", "price": 470000, "status": "sold_stc", "agent": "Peter Alan", "first_listed": "2026-08-01"},
                    {"id": "91002", "address": "dup of a record", "price": 1, "status": "on_market"},
                ]}),
            ))
            for i, (pc, ptype, days) in enumerate([("CF23 5PG", "D", 40), ("CF23 5HB", "D", 200), ("CF23 5AB", "F", 90), ("CF24 1AA", "D", 30)]):
                db.add(LandRegistrySale(transaction_id=uuid.uuid4(), price=470000 + i, sale_date=TODAY - timedelta(days=days),
                                        postcode=pc, property_type=ptype, paon=str(i + 1), saon=None, street="LAKE ROAD"))
            await db.commit()

    def test_recorded_listings_in_the_district(self):
        copy = types.SimpleNamespace(id=uuid.uuid4(), parent_prospect_id=self.owner.id)
        rows = asyncio.run(ar._recorded_nearby(copy, "CF23", {"91000"}))
        by_id = {r["id"]: r for r in rows}
        self.assertEqual(set(by_id), {"777", "91001", "91002", "91003"})
        self.assertEqual(by_id["777"]["source"], "monitor")  # from the weekly search
        # Seen in both: the weekly search's (fresher, live) view of it is kept.
        self.assertEqual(by_id["91002"]["source"], "monitor")
        self.assertEqual(by_id["91001"]["source"], "records")
        self.assertEqual(by_id["91001"]["agent"], "Hills")
        self.assertEqual(by_id["91003"]["agent"], "Peter Alan Ltd")  # no brand: the company
        self.assertEqual(by_id["91001"]["photos"], 2)

    def test_sales_by_postcode_sector_when_postcodes_io_does_not_answer(self):
        async def no_lookup(*_a, **_k):
            raise lr.LookupUnavailable("postcodes.io down")

        with mock.patch.object(ppd, "ready", mock.AsyncMock(return_value=True)), \
                mock.patch.object(lr, "_locate", no_lookup), \
                mock.patch.object(ar, "SALES_MIN", 2):
            sales, area = asyncio.run(ar._area_sales("CF23 5PH", "CF23", TODAY - timedelta(days=365), "9 Lake Road, Cardiff"))
        self.assertEqual(area, "in the CF23 5 postcode sector")
        self.assertEqual(len(sales), 3)  # not the CF24 sale
        self.assertEqual(sales[0]["type"], "Detached")
        self.assertEqual(sales[0]["date"], (TODAY - timedelta(days=40)).isoformat())

    def test_no_sales_claimed_before_the_data_is_loaded(self):
        with mock.patch.object(ppd, "ready", mock.AsyncMock(return_value=False)):
            self.assertEqual(asyncio.run(ar._area_sales("CF23 5PH", "CF23", TODAY, "x")), ([], None))


if __name__ == "__main__":
    unittest.main()
