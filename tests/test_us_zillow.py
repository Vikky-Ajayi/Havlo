"""Zillow parsing, US eligibility rules, band splitting, and US localisation."""
from __future__ import annotations

import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from app.services import us_stale_discovery as us
from app.services import zillow_scraper as z
from app.services.groq_service import _localize_us, _us_text
from app.services.stale_prospect_service import us_address_lines

# Trimmed from a real Zillow search-results item (__NEXT_DATA__ ->
# searchPageState.cat1.searchResults.listResults[0]).
SEARCH_ITEM = {
    "zpid": "58312593",
    "imgSrc": "https://photos.zillowstatic.com/fp/afe48247edbd24c47179c3328401db51-p_e.jpg",
    "detailUrl": "https://www.zillow.com/homedetails/3618-S-2nd-St-Austin-TX-78704/58312593_zpid/",
    "statusType": "FOR_SALE",
    "statusText": "Active",
    "price": "$625,000",
    "unformattedPrice": 625000,
    "address": "3618 S 2nd St, Austin, TX 78704",
    "addressStreet": "3618 S 2nd St",
    "addressCity": "Austin",
    "addressState": "TX",
    "addressZipcode": "78704",
    "beds": 3,
    "baths": 3,
    "area": 1454,
    "hdpData": {"homeInfo": {"zpid": 58312593, "homeType": "SINGLE_FAMILY", "homeStatus": "FOR_SALE",
                             "daysOnZillow": 214, "timeOnZillow": 535863000, "price": 625000}},
    "brokerName": "LPT Realty LLC - Ascend Group",
    "carouselPhotosComposable": {
        "baseUrl": "https://photos.zillowstatic.com/fp/{photoKey}-p_e.jpg",
        "photoData": [{"photoKey": "afe48247edbd24c47179c3328401db51"}, {"photoKey": "22266ee91547512b53f81c24c744af0f"}],
    },
}


def _search_html(items: list[dict], total: int = 5727, pages: int = 20) -> str:
    data = {"props": {"pageProps": {"searchPageState": {"cat1": {
        "searchResults": {"listResults": items},
        "searchList": {"totalResultCount": total, "totalPages": pages},
    }}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></html>'


def _detail_html(prop: dict) -> str:
    cache = json.dumps({"ForSaleShopperPlatformFullRenderQuery{...}": {"property": prop}})
    data = {"props": {"pageProps": {"componentProps": {"gdpClientCache": cache}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script></html>'


class SearchParsingTest(unittest.TestCase):
    def test_search_item_fields(self) -> None:
        page = z.parse_search_results(_search_html([SEARCH_ITEM]))
        self.assertEqual(page.total_results, 5727)
        self.assertEqual(page.total_pages, 20)
        item = page.listings[0]
        self.assertEqual(item.zpid, "58312593")
        self.assertEqual(item.address, "3618 S 2nd St, Austin, TX 78704")
        self.assertEqual(item.price, 625000.0)
        self.assertEqual(item.home_type, "SINGLE_FAMILY")
        self.assertEqual(item.days_on_zillow, 214)
        self.assertEqual(item.zipcode, "78704")
        self.assertEqual(len(item.images), 2)
        self.assertTrue(item.url.endswith("/58312593_zpid/"))

    def test_days_fall_back_to_time_on_zillow(self) -> None:
        item = json.loads(json.dumps(SEARCH_ITEM))
        item["hdpData"]["homeInfo"]["daysOnZillow"] = -1
        self.assertEqual(z.parse_search_results(_search_html([item])).listings[0].days_on_zillow, 6)

    def test_pages_are_capped(self) -> None:
        self.assertEqual(z.parse_search_results(_search_html([SEARCH_ITEM], pages=99)).total_pages, z.MAX_SEARCH_PAGES)

    def test_blocked_page_detected(self) -> None:
        self.assertTrue(z.is_blocked_page('<meta name="description" content="px-captcha"><title>Access to this page has been denied</title>'))
        self.assertFalse(z.is_blocked_page(_search_html([SEARCH_ITEM])))

    def test_no_data_raises(self) -> None:
        with self.assertRaises(ValueError):
            z.parse_search_results("<html>nothing</html>")


class DetailParsingTest(unittest.TestCase):
    PROP = {
        "zpid": 58312593, "streetAddress": "3618 S 2nd St", "city": "Austin", "state": "TX", "zipcode": "78704",
        "price": 625000, "bedrooms": 3, "bathrooms": 3, "livingArea": 1454, "homeType": "SINGLE_FAMILY",
        "homeStatus": "FOR_SALE", "daysOnZillow": 200, "yearBuilt": 1998, "description": "Charming bungalow.",
        "priceHistory": [{"event": "Price change", "priceChangeRate": -0.04}],
        "resoFacts": {"atAGlanceFacts": [{"factLabel": "Year Built", "factValue": "1998"}]},
        "responsivePhotos": [{"mixedSources": {"jpeg": [{"url": "https://p/1-small.jpg", "width": 384},
                                                         {"url": "https://p/1-1024.jpg", "width": 1024},
                                                         {"url": "https://p/1-1536.jpg", "width": 1536}]}}],
    }

    def test_property_extraction(self) -> None:
        scraped = z.parse_listing_page(_detail_html(self.PROP), "https://www.zillow.com/homedetails/x/58312593_zpid/")
        self.assertEqual(scraped["address"], "3618 S 2nd St, Austin, TX 78704")
        self.assertEqual(scraped["price"], "$625,000")
        self.assertEqual(scraped["days_on_zillow"], 200)
        self.assertEqual(scraped["home_type_raw"], "SINGLE_FAMILY")
        self.assertEqual(scraped["property_type"], "Single Family")
        self.assertTrue(scraped["price_reduced"])
        self.assertEqual(scraped["images"], ["https://p/1-1024.jpg"])
        self.assertIn("Year Built: 1998", scraped["features"])

    def test_deep_search_fallback(self) -> None:
        data = {"props": {"pageProps": {"somewhere": {"else": self.PROP}}}}
        html = f'<script id="__NEXT_DATA__">{json.dumps(data)}</script>'
        self.assertEqual(z.parse_listing_page(html, "u")["zpid"], "58312593")


class UrlTest(unittest.TestCase):
    def test_normalize_and_zpid(self) -> None:
        raw = "zillow.com/homedetails/3618-S-2nd-St-Austin-TX-78704/58312593_zpid/?utm=x#frag"
        url = z.normalize_zillow_url(raw)
        self.assertEqual(url, "https://www.zillow.com/homedetails/3618-S-2nd-St-Austin-TX-78704/58312593_zpid/")
        self.assertTrue(z.is_zillow_url(url))
        self.assertEqual(z.zpid_from_url(url), "58312593")
        self.assertFalse(z.is_zillow_url("https://www.rightmove.co.uk/properties/123456"))

    def test_search_url_shape(self) -> None:
        url = z.build_search_url("austin-tx", 3, 500000, 600000)
        self.assertIn("/austin-tx/3_p/", url)
        self.assertIn("searchQueryState=", url)


class EligibilityTest(unittest.TestCase):
    def scraped(self, **over):
        base = {"price": "$625,000", "home_type_raw": "SINGLE_FAMILY", "status": "FOR_SALE", "days_on_zillow": 200}
        base.update(over)
        return base

    def check(self, **over):
        return us.skip_reason(self.scraped(**over), min_price=500000, min_days=180)

    def test_qualifies(self) -> None:
        self.assertIsNone(self.check())

    def test_rejections(self) -> None:
        self.assertEqual(self.check(price="$450,000"), "below_minimum_price_or_unscrapable")
        self.assertEqual(self.check(home_type_raw="CONDO"), "not_target_property_type")
        self.assertEqual(self.check(home_type_raw="TOWNHOUSE"), "not_target_property_type")
        self.assertEqual(self.check(home_type_raw=""), "not_target_property_type")
        self.assertEqual(self.check(status="PENDING"), "not_currently_for_sale")
        self.assertEqual(self.check(days_on_zillow=90), "not_stale_enough_or_unscrapable")
        self.assertEqual(self.check(days_on_zillow=None), "not_stale_enough_or_unscrapable")

    def test_override_skips_only_the_age_check(self) -> None:
        self.assertIsNone(us.skip_reason(self.scraped(days_on_zillow=30), min_price=500000, min_days=180, override_duration_check=True))
        self.assertEqual(
            us.skip_reason(self.scraped(price="$100,000", days_on_zillow=30), min_price=500000, min_days=180, override_duration_check=True),
            "below_minimum_price_or_unscrapable",
        )


class BandTest(unittest.TestCase):
    def test_bands_respect_min_price(self) -> None:
        bands = us.price_bands(700000)
        self.assertEqual(bands[0], (700000, 750000))
        self.assertEqual(bands[-1], (3000000, None))

    def test_split(self) -> None:
        self.assertEqual(us.split_band(500000, 600000), [(500000, 550000), (550001, 600000)])
        self.assertIsNone(us.split_band(500000, 510000))
        lo, hi = us.split_band(3000000, None)[0]
        self.assertEqual((lo, hi), (3000000, 4500000))


class LocalisationTest(unittest.TestCase):
    def test_us_text(self) -> None:
        text = _us_text("Rightmove £625,000 - your estate agent arranged viewings; neighbourhood outreach")
        self.assertEqual(text, "Zillow $625,000 - your real estate agent arranged showings; neighborhood outreach")

    def test_recursive(self) -> None:
        out = _localize_us({"a": ["£1", {"b": "Zoopla"}], "n": 5})
        self.assertEqual(out, {"a": ["$1", {"b": "Redfin"}], "n": 5})

    def test_address_lines(self) -> None:
        self.assertEqual(us_address_lines("3618 S 2nd St, Austin, TX 78704"), ["3618 S 2nd St", "Austin, TX 78704"])
        self.assertEqual(us_address_lines("12 Elm Rd, Apt 4, Austin, TX 78704-1234"), ["12 Elm Rd, Apt 4", "Austin, TX 78704-1234"])
        self.assertEqual(us_address_lines("Somewhere odd"), ["Somewhere odd"])


BLOCKED = (403, '<meta name="description" content="px-captcha">')
OK = (200, "<html>real listing content</html>")


class ZillowSessionTest(unittest.IsolatedAsyncioTestCase):
    """The session-persistence / pacing / circuit-breaker layer added after
    discovering live that PerimeterX challenges a session within a handful
    of requests. These never touch the network -- _get is mocked."""

    def setUp(self) -> None:
        os.environ["ZILLOW_MIN_REQUEST_INTERVAL_SECONDS"] = "0"
        os.environ["ZILLOW_CIRCUIT_BREAKER_BLOCKS"] = "2"

    def tearDown(self) -> None:
        del os.environ["ZILLOW_MIN_REQUEST_INTERVAL_SECONDS"]
        del os.environ["ZILLOW_CIRCUIT_BREAKER_BLOCKS"]

    async def test_circuit_breaker_trips_after_consecutive_blocks(self) -> None:
        session = z.open_session()
        with patch.object(z.ZillowSession, "_raw_request", new=AsyncMock(return_value=BLOCKED)):
            with self.assertRaises(z.ZillowBlockedError):
                await session.fetch_html("https://www.zillow.com/x/", attempts=1)
            self.assertEqual(session.consecutive_blocks, 1)
            with self.assertRaises(z.ZillowCircuitOpenError):
                await session.fetch_html("https://www.zillow.com/x/", attempts=1)
            self.assertEqual(session.consecutive_blocks, 2)
            mock_get = z.ZillowSession._raw_request
            calls_before = mock_get.await_count
            with self.assertRaises(z.ZillowCircuitOpenError):
                await session.fetch_html("https://www.zillow.com/x/", attempts=3)
            # Circuit already open: fetch_html must refuse before ever
            # calling _get again, not burn another request into the block.
            self.assertEqual(mock_get.await_count, calls_before)

    async def test_successful_fetch_resets_consecutive_blocks(self) -> None:
        session = z.open_session()
        with patch.object(z.ZillowSession, "_raw_request", new=AsyncMock(side_effect=[BLOCKED, OK])):
            with self.assertRaises(z.ZillowBlockedError):
                await session.fetch_html("https://www.zillow.com/x/", attempts=1)
            self.assertEqual(session.consecutive_blocks, 1)
            html = await session.fetch_html("https://www.zillow.com/y/", attempts=1)
            self.assertIn("real listing content", html)
            self.assertEqual(session.consecutive_blocks, 0)

    async def test_warm_up_fetches_a_region_at_most_once(self) -> None:
        session = z.open_session()
        with patch.object(z.ZillowSession, "_raw_request", new=AsyncMock(return_value=OK)) as mock_get:
            await session.warm_up("austin-tx")
            await session.warm_up("austin-tx")
            await session.warm_up("dallas-tx")
            self.assertEqual(mock_get.await_count, 2)

    async def test_pacing_enforces_minimum_interval(self) -> None:
        os.environ["ZILLOW_MIN_REQUEST_INTERVAL_SECONDS"] = "0.15"
        session = z.open_session()
        with patch.object(z.ZillowSession, "_raw_request", new=AsyncMock(return_value=OK)):
            loop = __import__("asyncio").get_event_loop()
            start = loop.time()
            await session.fetch_html("https://www.zillow.com/a/", attempts=1)
            await session.fetch_html("https://www.zillow.com/b/", attempts=1)
            elapsed = loop.time() - start
        self.assertGreaterEqual(elapsed, 0.14)

    async def test_not_found_does_not_count_as_a_block(self) -> None:
        session = z.open_session()
        with patch.object(z.ZillowSession, "_raw_request", new=AsyncMock(return_value=(404, "gone"))):
            with self.assertRaises(z.ZillowNotFoundError):
                await session.fetch_html("https://www.zillow.com/x/", attempts=3)
            self.assertEqual(session.consecutive_blocks, 0)


if __name__ == "__main__":
    unittest.main()
