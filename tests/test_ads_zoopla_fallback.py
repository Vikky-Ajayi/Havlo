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


def _prop(rm_id, address, price):
    return {"id": rm_id, "displayAddress": address, "price": {"amount": price}}


class StreetMatchTests(unittest.TestCase):
    """The typed address is matched to Rightmove's display address by street."""

    def test_house_and_flat_numbers_and_towns_are_left_out(self) -> None:
        cases = {
            "12 Thorn Close, Kettering, NN16 9BU": ["thorn cl"],
            "12 Thorn Close Kettering NN16 9BU": ["thorn cl"],
            "Flat 4, Mill House, 20 High Street, Leeds LS1 4AB": ["high st"],
            "Flat B 20 High St, London": ["high st"],
            "Kettering NN16 9BU": [],
        }
        for address, names in cases.items():
            self.assertEqual(ads_funnel.street_names(address), names, address)

    def test_one_home_on_the_street_is_picked(self) -> None:
        rows = [{"id": "1", "address": "Donne Close, Kettering"}, {"id": "2", "address": "Thorn Close. Kettering NN16"},
                {"id": "2", "address": "Thorn Close. Kettering NN16"}]  # featured listings repeat
        self.assertEqual(ads_funnel.pick_listing(rows, "12 Thorn Close, Kettering NN16 9BU")["id"], "2")

    def test_two_homes_on_the_street_or_none_is_no_match(self) -> None:
        rows = [{"id": "1", "address": "Thorn Close, Kettering"}, {"id": "2", "address": "Thorn Close, Kettering"}]
        self.assertIsNone(ads_funnel.pick_listing(rows, "12 Thorn Close, Kettering NN16 9BU"))
        self.assertIsNone(ads_funnel.pick_listing(rows, "4 Mill Road, Kettering NN16 9BU"))

    def test_the_fuller_street_name_wins(self) -> None:
        rows = [{"id": "1", "address": "Hill View Close, Bath"}, {"id": "2", "address": "Hill View Road, Bath"}]
        self.assertEqual(ads_funnel.pick_listing(rows, "7 Hill View Road, Bath BA1 1AA")["id"], "2")


class FindOnRightmoveTests(unittest.TestCase):
    def _find(self, address, price, pages, location="POSTCODE^1168930"):
        urls = []

        async def fake_get(client, url):
            urls.append(url)
            return SimpleNamespace(text=str(len(urls) - 1), raise_for_status=lambda: None)

        from app.services import listing_monitor
        with mock.patch.object(listing_monitor, "resolve_location_id", mock.AsyncMock(return_value=location)), \
                mock.patch.object(listing_monitor, "_get", fake_get), \
                mock.patch.object(listing_monitor, "_parse_next_data", lambda text: pages[int(text)]):
            return asyncio.run(ads_funnel.find_on_rightmove(address, price)), urls

    def test_the_exact_price_on_the_typed_street_is_found(self) -> None:
        pages = [[_prop(94021620, "NN16 - Donne Close, Kettering", 390000), _prop(90521403, "Thorn Close. Kettering NN16", 390000)]]
        found, urls = self._find("12 Thorn Close, Kettering, NN16 9BU", 390000, pages)
        self.assertEqual(found, "https://www.rightmove.co.uk/properties/90521403")
        self.assertEqual(len(urls), 1)
        self.assertIn("minPrice=390000&maxPrice=390000", urls[0])
        self.assertIn("radius=0.25", urls[0])

    def test_a_price_typed_a_little_out_is_found_by_the_second_search(self) -> None:
        pages = [[], [_prop(90521403, "Thorn Close. Kettering NN16", 390000)]]
        found, urls = self._find("12 Thorn Close, Kettering, NN16 9BU", 395000, pages)
        self.assertEqual(found, "https://www.rightmove.co.uk/properties/90521403")
        self.assertIn("minPrice=383150&maxPrice=406850", urls[1])

    def test_no_postcode_or_street_means_no_search(self) -> None:
        for address in ("12 Thorn Close, Kettering", "Kettering NN16 9BU"):
            found, urls = self._find(address, 390000, [[]])
            self.assertIsNone(found)
            self.assertEqual(urls, [])

    def test_a_failed_search_is_no_match(self) -> None:
        from app.services import listing_monitor
        with mock.patch.object(listing_monitor, "resolve_location_id", mock.AsyncMock(side_effect=RuntimeError("down"))):
            self.assertIsNone(asyncio.run(ads_funnel.find_on_rightmove("12 Thorn Close, Kettering NN16 9BU", 390000)))


class StartFromZooplaTests(unittest.TestCase):
    """Typed details for a Zoopla link run on the same home's Rightmove
    listing when it's found there, and on the typed details otherwise."""

    def _start(self, *, matched, manual=True, rightmove_fails=False):
        calls = []

        async def fake_prospect(db, url, audience, channel, manual_details, zoopla_url=None):
            calls.append((url, manual_details, zoopla_url))
            if rightmove_fails and "rightmove" in url:
                raise ads_funnel.ListingLinkError("couldn't read")
            return SimpleNamespace(code_looked_up_at=None, audience="owner", property_code="1234", id="p1")

        finder = mock.AsyncMock(return_value=matched)
        db = mock.AsyncMock()
        with mock.patch.object(ads_funnel, "find_on_rightmove", finder), \
                mock.patch.object(ads_funnel, "_funnel_prospect", fake_prospect), \
                mock.patch.object(ads_funnel, "_grant_access", return_value="tok"):
            asyncio.run(ads_funnel.start_from_listing(
                db, listing_url=ZOOPLA + "?search_identifier=abc", audience="owner", channel="meta",
                manual_address="12 Thorn Close, Kettering NN16 9BU" if manual else None,
                manual_price=390000 if manual else None))
        return calls, finder

    def test_found_on_rightmove_runs_the_full_assessment_of_that_listing(self) -> None:
        rm = "https://www.rightmove.co.uk/properties/90521403"
        calls, finder = self._start(matched=rm)
        finder.assert_awaited_once_with("12 Thorn Close, Kettering NN16 9BU", 390000.0)
        self.assertEqual(calls, [(rm, None, ZOOPLA)])

    def test_not_found_runs_on_the_typed_details(self) -> None:
        calls, _ = self._start(matched=None)
        self.assertEqual(calls, [(ZOOPLA, ("12 Thorn Close, Kettering NN16 9BU", 390000.0), None)])

    def test_an_unreadable_rightmove_match_falls_back_to_the_typed_details(self) -> None:
        calls, _ = self._start(matched="https://www.rightmove.co.uk/properties/90521403", rightmove_fails=True)
        self.assertEqual(calls[-1], (ZOOPLA, ("12 Thorn Close, Kettering NN16 9BU", 390000.0), None))

    def test_the_first_paste_does_not_search_rightmove(self) -> None:
        calls, finder = self._start(matched=None, manual=False)
        finder.assert_not_awaited()
        self.assertEqual(calls, [(ZOOPLA, None, None)])


class TypedDetailsReportTests(unittest.TestCase):
    """A report from typed details never judges a listing nobody has seen."""

    def _facts(self):
        from app.services import report_analysis as ra
        from app.services import report_writer as rw
        from app.services import stale_prospect_service as sps

        snapshot = sps.snapshot_from_scrape({}, ZOOPLA)
        snapshot.update(address="12 Test Road, Leeds LS6 2AB", price="£450,000", postcode="LS6 2AB",
                        platform="Zoopla", manual_details=True)
        analysis = ra.analyse(snapshot, asking_price=450000, country="UK", reduced_days=None, advertised_days=0,
                              sales=[], photo_review=None, intel=None)
        return analysis, rw.factor_facts(analysis)

    def test_no_day_count_or_missing_details_are_invented(self) -> None:
        analysis, facts = self._facts()
        self.assertFalse(analysis["listing_seen"])
        self.assertIsNone(analysis["timing"]["days_advertised"])
        self.assertEqual(analysis["description"]["missing"], [])
        self.assertNotIn("description_missing", facts["buyer_objections"]["data"])

    def test_listing_factors_say_what_to_check_instead(self) -> None:
        from app.services import report_writer as rw

        _, facts = self._facts()
        for key in rw.UNSEEN_FACTORS:
            self.assertEqual(facts[key]["verdict"], "check_with_agent", key)
            self.assertTrue(facts[key]["forced"], key)
            self.assertEqual(set(facts[key]["data"]), {"listing_not_read"}, key)
        # The price factors still have their figures.
        self.assertEqual(facts["asking_price"]["data"]["asking_price"], 450000)

    def test_a_read_listing_is_unchanged(self) -> None:
        from app.services import report_analysis as ra

        analysis = ra.analyse({"description": "A semi.", "media": {"photos": 20, "floorplans": 1}},
                              asking_price=450000, country="UK", advertised_days=30)
        self.assertTrue(analysis["listing_seen"])
        self.assertEqual(analysis["timing"]["days_advertised"], 30)


if __name__ == "__main__":
    unittest.main()
