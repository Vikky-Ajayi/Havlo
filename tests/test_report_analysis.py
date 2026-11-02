"""The numbers behind the 20-factor report, worked out in code (from a real
listing that got a thin report: a £3.25m five-bed, reduced 118 days ago)."""
from __future__ import annotations

import unittest

from app.services import listing_monitor as lm
from app.services import report_analysis as ra
from app.services import report_factors as rf

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


class VerdictAndPreviewTests(unittest.TestCase):
    def test_no_rivals_near_the_price_means_competition_is_working_well(self):
        from app.services import report_writer as rw
        a = ra.analyse(SNAPSHOT, asking_price=3_250_000, reduced_days=118, sales=SALES,
                       intel={"market": {"for_sale": 0, "alternatives": 0}})
        facts = rw.factor_facts(a)
        self.assertEqual((facts["active_competition"]["verdict"], facts["active_competition"]["forced"]),
                         ("working_well", True))
        busy = rw.factor_facts(ra.analyse(SNAPSHOT, asking_price=3_250_000, sales=SALES,
                                          intel={"market": {"for_sale": 9, "alternatives": 4}}))
        self.assertFalse(busy["active_competition"]["forced"])  # the model judges a crowded field

    def test_net_proceeds_is_always_a_check(self):
        from app.services import report_writer as rw
        facts = rw.factor_facts(_a())
        self.assertEqual(facts["net_proceeds"]["verdict"], "check_with_agent")

    def test_preview_shows_the_range_of_problems_not_three_on_price(self):
        from app.services import report_writer as rw
        sev = {"asking_price": 5, "pricing_range": 5, "comparable_sold": 4, "time_on_market": 4,
               "buyer_objections": 4, "agent_marketing": 3}
        factors = [{"key": f["key"], "num": f["num"], "name": f["name"],
                    "verdict": "problem" if f["key"] in sev else "working_well", "severity": sev.get(f["key"])}
                   for f in rf.FACTORS]
        revealed = [r["key"] for r in rw.v2_preview({"factors": factors})["revealed"]]
        self.assertEqual(revealed, ["asking_price", "time_on_market", "buyer_objections"])


class GuardFigureTests(unittest.TestCase):
    def facts(self):
        from app.services import stale_prospect_service as sps
        a = ra.analyse(SNAPSHOT, asking_price=3_250_000, reduced_days=118, sales=SALES)
        return sps.report_facts(SNAPSHOT, {"_trusted": a["trusted"], "_sales_given": True, "_media_given": True},
                                asking_price=3_250_000, listing_duration_days=118, sales=SALES)

    def test_rounded_and_hedged_computed_figures_are_kept(self):
        from app.services import report_guard as rg
        f = self.facts()
        for s in ("At £3.25m, you're about £1.2m above the highest recorded sale nearby.",
                  "You're more than £1.1m above the highest of the four recorded sales.",
                  "Moving to £3,000,000 would save a buyer £30,000 in stamp duty compared with similar homes."):
            self.assertIsNone(rg._check(s, f), s)

    def test_a_sold_for_claim_must_be_a_real_sale(self):
        from app.services import report_guard as rg
        f = self.facts()
        self.assertIsNone(rg._check("The four detached houses sold nearby went for £1,600,000 to £2,075,000.", f))
        for s in ("Similar homes sold for £3,000,000 last year.",  # a scenario price, not a sale
                  "Comparable homes nearby sold for around £2.6m.",
                  "A comparable detached house achieved £2,750,000 in the spring."):
            self.assertEqual(rg._check(s, f), "market", s)


class GuardFalsePositiveTests(unittest.TestCase):
    """Three true sentences the checks wrongly cut from the live 2143 report."""

    def facts(self):
        from app.services import stale_prospect_service as sps
        a = ra.analyse(SNAPSHOT, asking_price=3_250_000, reduced_days=118, sales=SALES)
        report = {"_trusted": a["trusted"], "_sales_given": True, "_media_given": True,
                  "_photo_review": {"photos_seen": 53}}
        return sps.report_facts(SNAPSHOT, report, asking_price=3_250_000, listing_duration_days=118, sales=SALES)

    def test_true_sentences_are_kept(self):
        from app.services import report_guard as rg
        f = self.facts()
        for s in ("Your listing has 53 photographs and one floor plan, but no virtual tour or video.",
                  "Your £3,250,000 asking price is £1,175,000 above the highest recorded detached sale of £2,075,000.",
                  "Declutter the gym before retaking photos 48 and 49."):
            self.assertIsNone(rg._check(s, f), s)

    def test_false_ones_are_still_cut(self):
        from app.services import report_guard as rg
        f = self.facts()
        self.assertEqual(rg._check("There's no floor plan on the listing.", f), "media")
        self.assertEqual(rg._check("The asking price is £3,400,000.", f), "asking_price")
        self.assertEqual(rg._check("The kitchen looks dated and cluttered.", f), "unseen_photos")
