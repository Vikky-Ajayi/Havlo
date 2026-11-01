"""A pasted Zoopla link goes through the existing Zoopla reader; if that
can't read the page, the visitor is asked for the address and asking price
and the assessment runs from those. The reader itself is faked here."""
from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest import mock

from app.services import ads_funnel

ZOOPLA = "https://www.zoopla.co.uk/for-sale/details/68123456/"
READ_OK = {
    "address": "5 Hoo Road, Kidderminster, DY10 1NB", "price": "£250,000", "description": "A semi.",
    "bedrooms": "3", "images": ["https://img/1.jpg"], "image": "https://img/1.jpg", "platform": "zoopla",
}
BLOCKED = {"blocked": True, "address": "", "price": "", "platform": "zoopla"}


class ZooplaLinkTests(unittest.TestCase):
    def test_zoopla_property_pages_are_cleaned_to_one_address(self) -> None:
        for raw in (
            "https://www.zoopla.co.uk/for-sale/details/68123456/?search_identifier=abc&utm_source=x",
            "zoopla.co.uk/for-sale/details/68123456",
            "https://www.zoopla.co.uk/for-sale/details/new-homes/68123456/",
        ):
            self.assertEqual(ads_funnel.clean_listing_url(raw), ZOOPLA, raw)

    def test_rightmove_links_still_work_and_other_pages_are_refused(self) -> None:
        self.assertEqual(
            ads_funnel.clean_listing_url("https://www.rightmove.co.uk/properties/93138003#/?channel=RES_BUY"),
            "https://www.rightmove.co.uk/properties/93138003",
        )
        with self.assertRaises(ads_funnel.ListingLinkError):
            ads_funnel.clean_listing_url("https://www.zoopla.co.uk/for-sale/houses/leeds/")
        with self.assertRaises(ads_funnel.ListingLinkError):
            ads_funnel.clean_listing_url("https://www.onthemarket.com/details/123456/")

    def test_typed_details_are_checked(self) -> None:
        self.assertIsNone(ads_funnel.manual_listing_details("", None))
        self.assertEqual(ads_funnel.manual_listing_details(" 1 Test Road,  Leeds ", "£450,000"), ("1 Test Road, Leeds", 450000.0))
        for address, price in (("1 Test Road, Leeds", None), ("", 450000), ("1 Test Road, Leeds", 12), ("1 Test Road, Leeds", 9e12)):
            with self.assertRaises(ads_funnel.ListingLinkError, msg=(address, price)):
                ads_funnel.manual_listing_details(address, price)


class CreateFromZooplaTests(unittest.TestCase):
    def _create(self, scraped, manual=None, url=ZOOPLA):
        captured = {}

        async def fake_create(db, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(lead_source=None), "tok", ""

        reader = mock.AsyncMock(return_value=scraped)
        with mock.patch.object(ads_funnel, "scrape_single_listing", reader), \
                mock.patch.object(ads_funnel.sps, "create_prospect_from_listing_snapshot", fake_create):
            prospect = asyncio.run(ads_funnel._create_owner_prospect(None, url, "sell_seller", manual))
        return prospect, captured, reader

    def test_a_page_the_reader_can_read_needs_nothing_more(self) -> None:
        prospect, got, _ = self._create(READ_OK)
        self.assertEqual(got["property_address"], READ_OK["address"])
        self.assertEqual(got["asking_price"], 250000.0)
        self.assertEqual(got["rightmove_url"], ZOOPLA)
        self.assertEqual(got["listing_snapshot"]["platform"], "Zoopla")
        self.assertNotIn("manual_details", got["listing_snapshot"])
        self.assertEqual(prospect.lead_source, "sell_seller")

    def test_a_blocked_page_asks_for_the_address_and_price(self) -> None:
        with self.assertRaises(ads_funnel.ManualDetailsNeeded) as ctx:
            self._create(BLOCKED)
        self.assertEqual(ctx.exception.code, "manual_details_needed")
        self.assertIn("address", str(ctx.exception))

    def test_typed_details_run_the_assessment_without_asking_the_reader_again(self) -> None:
        _, got, reader = self._create(BLOCKED, manual=("1 Test Road, Leeds LS1 4AB", 450000.0))
        reader.assert_not_awaited()
        self.assertEqual(got["property_address"], "1 Test Road, Leeds LS1 4AB")
        self.assertEqual(got["asking_price"], 450000.0)
        snapshot = got["listing_snapshot"]
        self.assertTrue(snapshot["manual_details"])
        self.assertEqual(snapshot["postcode"], "LS1 4AB")
        self.assertEqual(snapshot["price"], "£450,000")
        # Its own link: nobody else pasting this Zoopla link inherits these details.
        self.assertTrue(got["rightmove_url"].startswith(ZOOPLA + "#manual-"))

    def test_rightmove_still_fails_without_a_fallback(self) -> None:
        url = "https://www.rightmove.co.uk/properties/93138003"
        with self.assertRaises(ads_funnel.ListingLinkError) as ctx:
            self._create(BLOCKED, url=url)
        self.assertNotIsInstance(ctx.exception, ads_funnel.ManualDetailsNeeded)


if __name__ == "__main__":
    unittest.main()
