"""How the agent report gathers its data (agent_report.gather): which source
fills in when another doesn't answer, and how the property's own dates are
worked out. Every outside service is stubbed."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

from app.services import agent_report as ar
from app.services import listing_monitor as lm
from app.services import stale_prospect_service as sps

TODAY = datetime.now(timezone.utc).date()


def row(i, source="rightmove", **extra):
    return {"id": str(i), "address": f"{i} Road", "price": 500000 + i * 1000, "bedrooms": 4, "type": "Detached",
            "status": "on_market", "update": "", "first_listed": (TODAY - timedelta(days=60)).isoformat(),
            "distance": 0.3, "url": "", "agent": "Hills", "source": source, **extra}


def prospect(**overrides):
    base = dict(
        id="p1", parent_prospect_id=None, agent_account_id=None, rightmove_url="https://www.rightmove.co.uk/properties/123",
        property_address="1 Lake Road East, Cardiff", postcode="CF23 5PH", asking_price=495000, listing_duration_days=241,
        listed_date=datetime.now(timezone.utc) - timedelta(days=241), created_at=datetime.now(timezone.utc) - timedelta(days=200),
        bedrooms=4, property_type="Detached house", agent_brand="Acme Homes", agent_branch_id="9",
        listing_snapshot_json=json.dumps({"listed_date": "Added on 04/02/2026"}), report_json="{}", agent_edited_report_json=None,
        sold_comparables_json=None, sold_comparables_at=None,
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


class GatherTests(unittest.TestCase):
    def run_gather(self, p, *, live=None, search=([], None, None), records=(), sales=([], None), comparables=()):
        async def fake_live(url):
            if live is None:
                raise RuntimeError("blocked")
            return live

        async def fake_search(query, own_id):
            self.search_query = query
            return search

        async def fake_records(prospect_, outcode, exclude):
            self.records_outcode = outcode
            return [r for r in records if r["id"] not in exclude]

        async def fake_sales(postcode, outcode, since, address):
            self.sales_args = (postcode, outcode, since)
            return sales

        async def fake_comparables(prospect_):
            return list(comparables)

        with mock.patch.object(lm, "fetch_listing_state", fake_live), \
                mock.patch.object(ar, "_search_nearby", fake_search), \
                mock.patch.object(ar, "_recorded_nearby", fake_records), \
                mock.patch.object(ar, "_area_sales", fake_sales), \
                mock.patch.object(sps, "refresh_sold_comparables", fake_comparables):
            return asyncio.run(ar.gather(p))

    def test_a_thin_search_is_topped_up_from_havlo_records(self):
        data = self.run_gather(prospect(), live={"postcode": "CF23 5PH", "image_count": 14},
                               search=([row(1), row(2)], 0.5, None), records=[row(3, "records"), row(1, "records")])
        self.assertEqual([r["id"] for r in data["nearby"]], ["1", "2", "3"])
        self.assertEqual(data["sources"]["nearby"], "rightmove")
        self.assertEqual(data["sources"]["nearby_area"], "within half a mile and in CF23")
        self.assertEqual(data["radius"], 0.5)
        self.assertEqual(self.search_query, "CF23 5PH")

    def test_when_the_search_fails_the_records_stand_in_for_the_district(self):
        data = self.run_gather(prospect(), records=[row(3, "records"), row(4, "monitor")])
        self.assertEqual(data["sources"]["nearby"], "monitor")
        self.assertEqual(data["sources"]["nearby_area"], "in CF23")
        self.assertIsNone(data["radius"])
        self.assertEqual(data["sources"]["listing"], "saved")

    def test_a_reduced_listing_takes_its_start_from_the_search(self):
        reduced_on = datetime(2026, 7, 14, tzinfo=timezone.utc)
        p = prospect(listed_date=reduced_on, listing_snapshot_json=json.dumps({"listed_date": "Reduced on 14/07/2026"}))
        own = {"id": "123", "first_listed": "2026-02-04"}
        data = self.run_gather(p, search=([row(1)], 0.5, own))
        subject = data["subject"]
        self.assertEqual(subject["reduced_date"], "2026-07-14")
        self.assertEqual(subject["listed_date"], "2026-02-04")
        self.assertEqual(subject["dom"], (TODAY - date(2026, 2, 4)).days)
        # Sales are read from the listing's start, not just the last year.
        self.assertLessEqual(self.sales_args[2], date(2026, 2, 4))

    def test_nothing_answers_and_the_report_is_still_built(self):
        data = self.run_gather(prospect(postcode=None, property_address="Somewhere"))
        intel = ar.compute_intel(data["subject"], data["nearby"], data["sales"], data["report"], data["portfolio"],
                                 radius=data["radius"], today=data["today"], comparables=data["comparables"], sources=data["sources"])
        self.assertEqual(intel["headline"]["vendor_pressure"], "High")
        self.assertEqual(intel["headline"]["dom"], 241)
        self.assertEqual(self.search_query, "")

    def test_land_registry_area_is_recorded(self):
        sale = {"address": "2 Lake Road West, Cardiff, CF23 5PG", "price": 480000, "date": "2026-06-01", "type": "Detached"}
        data = self.run_gather(prospect(), search=([row(i) for i in range(10)], 0.5, None), sales=([sale], "within half a mile"))
        self.assertEqual(data["sources"]["sales"], "land_registry")
        self.assertEqual(data["sources"]["sales_area"], "within half a mile")
        self.assertNotIn("supplemented", data["sources"])


if __name__ == "__main__":
    unittest.main()
