"""The numbers behind the 20-factor report, worked out in code (from a real
listing that got a thin report: a £3.25m five-bed, reduced 118 days ago)."""
from __future__ import annotations

import unittest

from app.services import listing_monitor as lm
from app.services import report_analysis as ra

SNAPSHOT = {
    "title": "Monkhams Avenue, Woodford Green, IG8",
    "address": "Monkhams Avenue, Woodford Green, IG8",
    "postcode": "IG8 0EX", "price": "£3,250,000", "bedrooms": "5", "bathrooms": "4",
    "property_type": "Detached House", "price_reduced": True,
    "media": {"photos": 53, "floorplans": 1, "virtual_tours": 0},
    "agent": {"brand": "An Agency"},
    "features": ["Guide Price £3,250,000-£3,500,000", "5 Double Bedrooms/4 Bathrooms",
                 "Circa 120 ft West Facing Rear Garden With Detached Gym", "0.4 miles Walk To Woodford Central Line Station",
                 "4860 Sq. ft Of Accommodation Space"],
    "description": "A substantial Victorian family home, refurbished back to brick within the last six years, with "
                   "outstanding schooling nearby. EPC Rating: C",
}
SALES = [{"price": 1_600_000, "date": "2026-07-29", "property_type": "Detached"},
         {"price": 2_000_000, "date": "2025-09-30", "property_type": "Detached"},
         {"price": 1_665_000, "date": "2025-07-31", "property_type": "Detached"},
         {"price": 2_075_000, "date": "2025-02-07", "property_type": "Detached"}]


def _a(**over):
    kw = dict(asking_price=3_250_000, country="UK", reduced_days=118, sales=SALES)
    kw.update(over)
    return ra.analyse(SNAPSHOT, **kw)


class AnalysisTests(unittest.TestCase):
    def test_price_against_the_recorded_sales(self):
        pos = _a()["price_position"]
        self.assertEqual(pos["sales_high"], 2_075_000)
        self.assertEqual(pos["above_highest_by"], 1_175_000)
        self.assertEqual(pos["above_highest_pct"], 56.6)
        self.assertTrue(pos["sales_are_weak_guide"])  # far above every sale: likely smaller homes
        self.assertEqual(pos["asking_price_per_sqft"], 669)

    def test_scenarios_step_down_with_the_buyers_stamp_duty(self):
        hold, step1, _ = _a()["scenarios"]
        self.assertEqual((hold["price"], hold["buyer_stamp_duty"]), (3_250_000, 303_750))
        self.assertEqual((step1["price"], step1["buyer_stamp_duty_saving"]), (3_000_000, 30_000))

    def test_reads_the_listing_details_it_used_to_miss(self):
        a = _a()
        self.assertEqual(a["property"]["floor_area_sqft"], 4860)
        self.assertEqual(a["property"]["epc_rating"], "C")
        self.assertEqual(a["property"]["station_miles"], 0.4)
        self.assertEqual(a["property"]["garden_length_ft"], 120)
        self.assertIn("tenure", a["description"]["missing"])

    def test_flags_the_out_of_date_guide_price_and_missing_tour(self):
        a = _a()
        self.assertTrue(a["guide_range"]["top_above_asking"])
        self.assertEqual(a["guide_range"]["top_above_asking_by"], 250_000)
        self.assertTrue(any("virtual tour" in g for g in a["marketing_gaps"]))

    def test_long_since_the_reduction_is_a_problem(self):
        self.assertEqual(_a()["timing"]["verdict_hint"], "problem")
        self.assertIsNone(_a(reduced_days=20)["timing"]["verdict_hint"])

    def test_every_computed_figure_is_trusted_for_the_checks(self):
        t = _a()["trusted"]
        for amount in (1_175_000, 3_000_000, 30_000, 303_750, 669):
            self.assertIn(float(amount), t["amounts"])
        self.assertIn(56.6, t["percents"])
        self.assertIn(118, t["days"])


class DashboardFromReportTests(unittest.TestCase):
    REPORT = {
        "version": 2,
        "top_actions": [{"title": "Remove the old guide price", "detail": "Ask the agent to delete it today."},
                        {"title": "Add a virtual tour", "detail": "Book a filmed tour this week."},
                        {"title": "Get evidence for the price", "detail": "Three sales of 4,000+ sq ft homes."}],
        "factors": [
            {"key": "asking_price", "name": "Asking Price Competitiveness", "verdict": "problem", "severity": 5,
             "action": "Get three sales of similar-size homes."},
            {"key": "photography", "name": "Photography", "verdict": "problem", "severity": 2,
             "action": "Make the garden the second photo."},
            {"key": "engagement", "name": "Engagement", "verdict": "check_with_agent",
             "action": "Ask for views in the last 14 days."},
        ],
        "_next_price_step": 3_000_000,
    }

    def test_checklist_is_the_reports_own_actions(self):
        items = lm.build_checklist(self.REPORT, {"floorplans": 1, "virtual_tours": 0}, [], {})
        titles = [i["title"] for i in items]
        self.assertEqual(titles[:3], ["Remove the old guide price", "Add a virtual tour", "Get evidence for the price"])
        self.assertIn("Get your listing figures from your agent", titles)
        self.assertNotIn("Rewrite the listing description", titles)  # no generic catalogue filler

    def test_a_price_change_on_the_listing_ticks_the_price_task(self):
        events = [{"kind": "price_reduced", "at": "2026-11-05T09:00:00+00:00"}]
        items = {i["key"]: i for i in lm.build_checklist(self.REPORT, {}, events, {})}
        price = next(i for i in items.values() if i["key"] == "price")
        self.assertTrue(price["done"])
        self.assertEqual(price["done_by"], "detected")

    def test_box_three_names_the_reports_next_price_step(self):
        checklist = lm.build_checklist(self.REPORT, {}, [], {})
        plan = lm.build_plan(self.REPORT, 22, checklist, window=lm.MONITOR_DAYS_V2)
        self.assertTrue(any("£3,000,000" in n for n in plan["phases"][2]["notes"]))
        self.assertTrue(plan["phases"][0]["tasks"])  # box 1 has the urgent actions


if __name__ == "__main__":
    unittest.main()
