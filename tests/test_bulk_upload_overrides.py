"""Bulk CSV upload: the admin overrides for hand-picked rows."""
from __future__ import annotations

import asyncio
import unittest
from contextlib import asynccontextmanager
from unittest import mock

from app.services import stale_listing_discovery as sld

URL = "https://www.rightmove.co.uk/properties/165794060#/?channel=RES_BUY"
ROW = {"rightmove_url": URL, "address": "The Homestead, Cudham Lane North, Cudham, Sevenoaks TN14 7RB"}


class _NoExisting:
    async def execute(self, *_a, **_k):
        return mock.Mock(first=lambda: None)

    async def commit(self):
        pass


@asynccontextmanager
async def _session():
    yield _NoExisting()


def run_row(scraped, **overrides):
    created = mock.AsyncMock(return_value=(mock.Mock(property_code="1234", id="p1"), "t", "path"))
    with mock.patch.object(sld, "AsyncSessionLocal", _session), \
         mock.patch.object(sld, "scrape_single_listing", mock.AsyncMock(return_value=scraped)), \
         mock.patch.object(sld, "create_prospect_from_listing_snapshot", created), \
         mock.patch.object(sld.google_sheets, "record_stale_listing_address", mock.Mock()):
        return asyncio.run(sld._process_bulk_upload_row(dict(ROW), 1, **overrides)), created


BUNGALOW = {"price": "£895,000", "property_type": "Bungalow", "listed_date": "Reduced on 05/09/2026", "url": URL}


class OverrideTests(unittest.TestCase):
    def test_type_rule_applies_by_default(self):
        result, created = run_row(BUNGALOW, override_duration_check=True)
        self.assertEqual(result["reason"], "not_target_property_type")
        created.assert_not_called()

    def test_type_override_adds_the_row(self):
        result, created = run_row(BUNGALOW, override_duration_check=True, override_type_check=True)
        self.assertEqual(result["outcome"], "created")
        created.assert_called_once()

    def test_price_minimum_still_applies(self):
        result, _ = run_row({**BUNGALOW, "price": "£450,000"}, override_duration_check=True, override_type_check=True)
        self.assertEqual(result["reason"], "below_minimum_price_or_unscrapable")


if __name__ == "__main__":
    unittest.main()


class SameListingTests(unittest.TestCase):
    def test_listing_number_from_any_link(self):
        from app.services.stale_prospect_service import rightmove_listing_id
        for url in (
            "https://www.rightmove.co.uk/properties/172322219#/?channel=RES_BUY",
            "https://www.rightmove.co.uk/properties/172322219?utm_campaign=property-details&utm_source=copytoclipboard",
            "https://www.rightmove.co.uk/properties/172322219",
        ):
            self.assertEqual(rightmove_listing_id(url), "172322219")
        self.assertIsNone(rightmove_listing_id("n/a"))

    def test_condition_matches_by_listing_number(self):
        from sqlalchemy.dialects import postgresql
        from app.services.stale_prospect_service import same_rightmove_listing
        sql = str(same_rightmove_listing("https://www.rightmove.co.uk/properties/172322219#/?channel=RES_BUY").compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        self.assertIn("rightmove_id = '172322219'", sql)
        self.assertIn("/properties/172322219([^0-9]|$)", sql)
