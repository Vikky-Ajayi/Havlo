from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, patch

from app.services import listing_scraper


def zoopla_html(listing: dict) -> str:
    payload = {"props": {"pageProps": {"listingDetails": {"listing": listing}}}}
    return (
        '<html><head><script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(payload)
        + "</script></head><body></body></html>"
    )


class ZooplaListingScraperTests(unittest.IsolatedAsyncioTestCase):
    async def test_extracts_full_details_from_compact_next_data_page(self):
        url = "https://www.zoopla.co.uk/for-sale/details/12345678/"
        html = zoopla_html({
            "title": "Three bedroom house for sale",
            "displayAddress": {"displayAddress": "12 Example Road, Bristol"},
            "price": {"displayPrices": [{"displayPrice": "£425,000"}]},
            "description": "A bright <b>family home</b> near the park.",
            "numBedrooms": 3,
            "numBathrooms": 2,
            "propertyType": "terraced_house",
            "floorArea": "1,100 sq ft",
            "keyFeatures": [{"text": "Garden"}, "Off street parking"],
            "images": [{"url": "https://images.example.test/house.jpg"}],
            "firstPublishedAt": "2026-10-15T10:00:00Z",
        })

        with patch.object(listing_scraper, "_fetch", new=AsyncMock(return_value=html)):
            result = await listing_scraper.scrape_single_listing(url)

        self.assertEqual(result["platform"], "zoopla")
        self.assertEqual(result["url"], url)
        self.assertEqual(result["title"], "Three bedroom house for sale")
        self.assertEqual(result["address"], "12 Example Road, Bristol")
        self.assertEqual(result["price"], "£425,000")
        self.assertEqual(result["description"], "A bright family home near the park.")
        self.assertEqual(result["bedrooms"], "3")
        self.assertEqual(result["bathrooms"], "2")
        self.assertEqual(result["property_type"], "Terraced House")
        self.assertEqual(result["floor_area"], "1,100 sq ft")
        self.assertEqual(result["features"], ["Garden", "Off street parking"])
        self.assertEqual(result["images"], ["https://images.example.test/house.jpg"])
        self.assertEqual(result["listed_date"], "Added 15 October 2026")
        self.assertFalse(result.get("blocked", False))

    async def test_detects_explicit_cloudflare_challenge(self):
        html = "<html><title>Just a moment...</title><body>__cf_chl_tk</body></html>"
        with patch.object(listing_scraper, "_fetch", new=AsyncMock(return_value=html)):
            result = await listing_scraper.scrape_single_listing(
                "https://www.zoopla.co.uk/for-sale/details/12345678/"
            )
        self.assertTrue(result["blocked"])
        self.assertEqual(result["platform"], "zoopla")


if __name__ == "__main__":
    unittest.main()
