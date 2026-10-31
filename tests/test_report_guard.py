"""Every claim in an AI-written report is checked against the facts we hold
before anyone sees it (report_guard.py). The cases come from a real report
(Hoo Road, Kidderminster, Oct 2026) that cost a sale: an empty living room
called "cluttered", 23 photos called "a handful", our cut of the
description called the seller's, and a price compared with sales the model
had never been given."""
from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services import report_guard
from app.services import stale_prospect_service as sps
from app.services.report_guard import ReportFacts

DESCRIPTION = (
    "Hoo Road offers a practical and appealing layout, with generous living accommodation to the ground floor. "
    "Kitchen The kitchen provides a practical area for food preparation and everyday cooking, with space for the "
    "necessary appliances and storage. Living Room 4m x 3.35m Bedroom 1 4.08m x 3.39m"
)
FACTS = ReportFacts(
    asking_price=250_000, bedrooms=3, bathrooms=2, days_min=38, days_max=45,
    media={"photos": 23, "floorplans": 1, "virtual_tours": 0}, media_given=True,
    sale_prices=[232_000, 241_000, 268_000], sales_given=True,
    source_text="Hoo Road, Kidderminster " + DESCRIPTION,
)
NO_SALES = ReportFacts(**{**FACTS.__dict__, "sale_prices": [], "sales_given": False})
OLD = ReportFacts(  # a report written before the checks: no media or sales given, description cut at 800
    asking_price=250_000, bedrooms=3, days_min=38, days_max=45, source_text=DESCRIPTION, description_cut=True,
)

SUE_FINDING = {
    "title": "Sparse visual storytelling",
    "icon": "photos",
    "type": "issue",
    "description": (
        "The Rightmove gallery contains only a handful of images, each taken from a single angle with limited "
        "natural light. The living room appears cluttered with personal items, the kitchen shows no countertop "
        "finish, and the conservatory is presented without furniture, leaving the space feeling unfinished.\n\n"
        "No virtual tour or 360-degree view is available, limiting remote engagement for out-of-area purchasers."
    ),
}
SUE_DESCRIPTION_FINDING = {
    "title": "Description lacks compelling detail",
    "icon": "description",
    "type": "issue",
    "description": (
        'The property description repeats generic phrases such as "practical area for food preparation" and '
        "stops abruptly mid-sentence after mentioning the conservatory."
    ),
}
SUE_PRICE_FINDING = {
    "title": "Price sits above local absorption",
    "icon": "price",
    "type": "issue",
    "description": (
        "The asking price of £250,000 for a three-bedroom semi-detached house on Hoo Road is roughly 7 percent "
        "higher than the average price per bedroom for recent sales nearby."
    ),
}
DESCRIPTION_FINDING = {
    "title": "Description leans on generic phrases",
    "icon": "description",
    "type": "issue",
    "description": 'The property description repeats generic phrases such as "practical area for food preparation".',
}
TIME_FINDING = {
    "title": "Listing is losing momentum",
    "icon": "timing",
    "type": "issue",
    "description": "The home has been on the market for 38 days, long enough for regular buyers to scroll past it.",
}


def clean(text, facts=FACTS):
    return report_guard.clean_text(text, facts)


class SueReportTests(unittest.TestCase):
    def test_all_three_free_findings_were_wrong(self):
        findings = report_guard.clean_findings([SUE_PRICE_FINDING, SUE_FINDING, SUE_DESCRIPTION_FINDING], OLD)
        self.assertEqual(findings, [])

    def test_genuine_findings_are_untouched(self):
        findings = report_guard.clean_findings([DESCRIPTION_FINDING, TIME_FINDING], OLD)
        self.assertEqual(findings, [DESCRIPTION_FINDING, TIME_FINDING])

    def test_removals_are_recorded_with_their_rule(self):
        removed = []
        report_guard.clean_findings([SUE_PRICE_FINDING, SUE_FINDING, SUE_DESCRIPTION_FINDING], OLD, removed)
        self.assertEqual({r["rule"] for r in removed}, {"market", "unseen_photos", "description_cut", "emptied"})


class PhotoTests(unittest.TestCase):
    def test_what_a_room_or_photo_looks_like_is_never_kept(self):
        for sentence in (
            "The living room appears cluttered with personal items.",
            "The photos show a tired kitchen.",
            "Rooms appear small and cramped.",
            "The lounge looks dated and dark.",
        ):
            self.assertEqual(clean(sentence), "", sentence)

    def test_media_counts_must_match_the_page(self):
        self.assertEqual(clean("The listing has 23 photos and one floor plan."), "The listing has 23 photos and one floor plan.")
        self.assertEqual(clean("The listing has only 6 photos."), "")
        self.assertEqual(clean("There is no virtual tour."), "There is no virtual tour.")
        self.assertEqual(clean("There is no floor plan."), "")  # it has one
        self.assertEqual(clean("The listing has 23 photos.", OLD), "")  # that report was never given the count

    def test_media_findings_need_the_counts(self):
        finding = {"title": "No virtual tour for remote buyers", "icon": "photos", "type": "issue",
                   "description": "There is no virtual tour, which matters for buyers moving from further away."}
        self.assertEqual(report_guard.clean_findings([finding], FACTS), [finding])
        self.assertEqual(report_guard.clean_findings([finding], OLD), [])


class ListingTextTests(unittest.TestCase):
    def test_our_cut_is_never_called_the_sellers(self):
        for sentence in ("The description stops abruptly mid-sentence.", "The listing text is cut off after the kitchen."):
            self.assertEqual(clean(sentence), "", sentence)

    def test_missing_measurements_only_when_the_model_read_it_all(self):
        claim = "The description gives no room sizes or measurements."
        self.assertEqual(clean(claim), claim)
        self.assertEqual(clean(claim, OLD), "")

    def test_quotes_must_be_in_the_listing(self):
        self.assertEqual(clean('It calls the kitchen a "practical area for food preparation".'),
                         'It calls the kitchen a "practical area for food preparation".')
        self.assertEqual(clean('It promises "stunning farmland views" without saying where.'), "")

    def test_asking_price_and_rooms_must_match(self):
        self.assertEqual(clean("The asking price of £250,000 is the first thing buyers see."),
                         "The asking price of £250,000 is the first thing buyers see.")
        self.assertEqual(clean("The asking price of £275,000 is the first thing buyers see."), "")
        self.assertEqual(clean("A four-bedroom home at this price is rare."), "")
        self.assertEqual(clean("A three-bedroom home at this price is rare."), "A three-bedroom home at this price is rare.")

    def test_time_on_the_market_must_fit(self):
        self.assertEqual(clean("It has been on the market for 38 days."), "It has been on the market for 38 days.")
        self.assertEqual(clean("It has been on the market for six weeks."), "It has been on the market for six weeks.")
        self.assertEqual(clean("It has been on the market for 5 months."), "")
        self.assertEqual(clean("Re-launch within 7 days to catch weekend browsers."),
                         "Re-launch within 7 days to catch weekend browsers.")


class MarketTests(unittest.TestCase):
    def test_no_sales_given_means_no_market_comparisons(self):
        self.assertEqual(clean("The price is 7% above recent sales nearby.", NO_SALES), "")
        self.assertEqual(clean("Similar homes nearby sold for less.", NO_SALES), "")
        self.assertEqual(clean("Similar homes nearby are competing for the same buyers.", NO_SALES),
                         "Similar homes nearby are competing for the same buyers.")

    def test_sale_prices_and_percentages_must_check_out(self):
        # Mean of the sales is £247,000: £250,000 is about 1% above it.
        self.assertEqual(clean("A similar home nearby sold for £241,000 in March."),
                         "A similar home nearby sold for £241,000 in March.")
        self.assertEqual(clean("A similar home nearby sold for £199,000 in March."), "")
        self.assertEqual(clean("The asking price sits about 1% above the average sold price nearby."),
                         "The asking price sits about 1% above the average sold price nearby.")
        self.assertEqual(clean("The asking price sits 12% above the average sold price nearby."), "")

    def test_per_bedroom_and_per_square_foot_comparisons_always_go(self):
        self.assertEqual(clean("It is priced above the average price per square foot for comparable flats."), "")
        self.assertEqual(clean("It is 7 percent higher than the average price per bedroom for recent sales."), "")


class LiveExampleTests(unittest.TestCase):
    """Sentences from the live accuracy check (Oct 2026): what must go, and
    what the first version of the checks removed by mistake."""

    def test_kept(self):
        for sentence in (
            "Reduce the asking price to £215,000 to align with market expectations.",
            "In a market where buyers compare energy performance and outdoor space, the omission makes the property "
            "appear less transparent and harder to benchmark against rivals.",
            "This thin copy does not differentiate the bungalow from other listings and leaves the buyer without a "
            "compelling narrative, which can lower the perceived uniqueness of the home in a crowded search result.",
            "The current copy omits lifestyle-focused keywords such as “pet-friendly” and “family-oriented”, which "
            "limits visibility in niche searches.",
        ):
            self.assertEqual(clean(sentence, NO_SALES), sentence, sentence)

    def test_removed(self):
        for sentence, rule in (
            ("At £250,000 the asking price sits roughly £10,000 above the median price for three-bedroom detached "
             "homes in the Beckside Manor area.", "market"),
            ("Local market data shows similar flats selling around £215,000.", "market"),
            ("The asking price of £250,000 for a 573 sq ft two-bed flat sits noticeably above the average price per "
             "square foot for comparable recent sales in the W12 postcode.", "market"),
            ("The description relies on standard phrases such as “generous two-bedroom flat” and “well-appointed "
             "kitchen”.", "quote"),
            ("The asking price of £275,000 puts it in a crowded bracket.", "asking_price"),
        ):
            removed = []
            report_guard.clean_text(sentence, NO_SALES, removed)
            self.assertEqual([r["rule"] for r in removed], [rule], sentence)


class ReportTests(unittest.TestCase):
    def test_action_plan_photography_advice_can_stay(self):
        report = {"key_findings": [TIME_FINDING], "action_plan": [
            {"title": "Book a fresh professional shoot", "description": "A new set of photos can renew interest after a long listing."},
        ]}
        self.assertEqual(report_guard.clean_report(report, FACTS)["action_plan"], report["action_plan"])

    def test_an_analysts_edit_keeps_its_wording(self):
        report = {"key_findings": [SUE_FINDING]}
        self.assertEqual(report_guard.clean_report(report, OLD, ai_written=False)["key_findings"], [SUE_FINDING])


class PreviewTests(unittest.TestCase):
    def prospect(self, **fields):
        now = datetime.now(timezone.utc)
        snapshot = {"description": DESCRIPTION + " " + "x" * 600, "bedrooms": "3", "price": "£250,000"}
        base = dict(
            report_json=json.dumps({"key_findings": [SUE_PRICE_FINDING, SUE_FINDING, DESCRIPTION_FINDING, TIME_FINDING]}),
            agent_edited_report_json=None,
            preview_json=json.dumps({"key_issues": [SUE_PRICE_FINDING, SUE_FINDING, DESCRIPTION_FINDING]}),
            listing_snapshot_json=json.dumps(snapshot),
            asking_price=250_000, bedrooms=3, bathrooms=None, listing_duration_days=38,
            listed_date=now - timedelta(days=45), processed_at=now - timedelta(days=7), created_at=None,
            sold_comparables_at=None, sold_comparables_json=None,
        )
        base.update(fields)
        return SimpleNamespace(**base)

    def test_free_preview_shows_only_findings_that_hold_up(self):
        titles = [f["title"] for f in sps.clean_preview(self.prospect())["key_issues"]]
        self.assertEqual(titles, [DESCRIPTION_FINDING["title"], TIME_FINDING["title"]])

    def test_preview_without_a_report_is_checked_too(self):
        titles = [f["title"] for f in sps.clean_preview(self.prospect(report_json=None))["key_issues"]]
        self.assertEqual(titles, [DESCRIPTION_FINDING["title"]])


if __name__ == "__main__":
    unittest.main()
