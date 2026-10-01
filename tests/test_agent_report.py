"""Agent report figures (app/services/agent_report.compute_intel)."""
from __future__ import annotations

import unittest
from datetime import date, timedelta

from app.services import agent_report as ar

TODAY = date(2026, 10, 1)


def ago(days: int) -> str:
    return (TODAY - timedelta(days=days)).isoformat()


def home(i, price, status="on_market", listed=60, agent="Hills", beds=4, type_="Detached", update="", photos=20, floorplans=1, tours=0):
    return {"id": str(i), "address": f"{i} Road", "price": price, "bedrooms": beds, "type": type_, "status": status,
            "update": update, "update_date": "", "first_listed": ago(listed), "distance": 0.2, "url": "", "image": "",
            "agent": agent, "branch": f"{agent}, Town", "branch_id": agent, "photos": photos, "floorplans": floorplans,
            "virtual_tours": tours}


SUBJECT = {
    "id": "subject", "address": "1 Subject Road", "price": 600000, "dom": 300, "listed_date": ago(300), "reduced_date": None,
    "bedrooms": 4, "type": "Detached House", "agent": "Acme Homes", "branch_id": "9", "photos": 10, "floorplans": 0,
    "virtual_tours": 0, "description_words": 100, "features": 4, "last_update": None,
}
NEARBY = [
    home(1, 580000, listed=40), home(2, 610000, listed=80, agent="Thornley"), home(3, 640000, listed=120),
    home(4, 520000, listed=160, update="price_reduced"), home(5, 590000, listed=200, agent="Acme Homes"),
    home(6, 700000, listed=20, agent="Thornley"),
    home(7, 595000, status="sold_stc", listed=100), home(8, 605000, status="sold_stc", listed=150, agent="Thornley"),
    home(9, 560000, status="under_offer", listed=90, agent="Hills"),
    home(10, 650000, status="under_offer", listed=400, agent="Bairstow"),
    home(11, 250000, type_="Flat", beds=2, listed=30, agent="Hills"),
    home(12, 260000, type_="Flat", beds=2, listed=10, agent="Your Move"),
]
SALES = [{"id": "a", "price": 580000, "type": "Detached", "date": ago(100), "address": "x"},
         {"id": "b", "price": 620000, "type": "Detached", "date": ago(200), "address": "y"},
         {"id": "c", "price": 240000, "type": "Flat", "date": ago(50), "address": "z"}]
REPORT = {"scores": {"listing_presentation": 40, "buyer_appeal": 48},
          "key_findings": [{"title": "Weak lead photo", "description": "Dark image", "icon": "photos", "type": "issue"}],
          "thirty_day_plan": [{"week": 1, "title": "Reset price"}]}
PORTFOLIO = [{"id": "subject", "price": 600000, "dom": 300}, {"id": "b", "price": 400000, "dom": 500},
             {"id": "c", "price": 350000, "dom": 200}]


def intel(**overrides):
    subject = {**SUBJECT, **overrides}
    return ar.compute_intel(subject, NEARBY, SALES, REPORT, PORTFOLIO, radius=0.5, today=TODAY)


class AgentReportTests(unittest.TestCase):
    def test_compares_with_similar_homes(self):
        r = intel()
        self.assertEqual(r["basis"], "similar")
        self.assertEqual(r["comparables"], 10)  # the two flats are left out

    def test_days_on_market_benchmark_is_the_typical_age_of_similar_homes_for_sale(self):
        r = intel()
        self.assertEqual(r["headline"]["dom_benchmark"], 100)  # ages 20, 40, 80, 120, 160, 200
        self.assertEqual(r["market"]["dom_gap"], 200)
        self.assertEqual(r["market"]["staleness"], 100)  # older than every similar home for sale

    def test_success_gap_counts_homes_listed_after_this_one_that_sold_first(self):
        r = intel()
        self.assertEqual(r["headline"]["success_gap"], 3)  # 7, 8, 9 - not 10, listed before
        self.assertEqual(r["vendor_view"]["agreed"], 4)

    def test_competitors(self):
        c = intel()["competitors"]
        self.assertEqual(c["leading"][0]["agent"], "Hills")  # most agreed sales nearby
        self.assertTrue(any(a["you"] for a in c["agencies"] if a["agent"] == "Acme Homes"))
        self.assertNotIn("Acme Homes", [a["agent"] for a in c["alternative_set"]])
        self.assertEqual(c["agreed_in_segment"], 3)  # Hills, Thornley, Bairstow
        self.assertEqual(c["threat"], "High")

    def test_price_position(self):
        p = intel()["pricing"]
        self.assertEqual(p["median_for_sale"], 600000)
        self.assertEqual(p["premium_pct"], 0)
        self.assertEqual(p["sold_median"], 600000)  # detached sales only
        self.assertEqual(p["sold_count"], 2)

    def test_presentation_gaps_from_the_listing_against_similar_ones(self):
        gaps = intel()["presentation"]["gaps"]
        self.assertEqual(len(gaps), 4)  # photos, floorplan, description, features (few tours nearby)
        self.assertTrue(gaps[0].startswith("10 photos"))
        self.assertEqual(intel()["headline"]["relaunch"], "Strong")

    def test_risk_and_actions(self):
        r = intel()
        self.assertIn(r["headline"]["risk"], ("High", "Critical"))
        self.assertEqual(len(r["actions"]), 5)
        order = [ar.PRIORITY_ORDER[a["priority"]] for a in r["actions"]]
        self.assertEqual(order, sorted(order))
        self.assertTrue(r["vendor"]["questions"])
        self.assertEqual(r["branch"]["rank_by_time"], 2)
        self.assertEqual(r["branch"]["stale_value"], 1350000)

    def test_price_reduced_listing_counts_from_the_reduction(self):
        r = intel(dom=None, listed_date=None, reduced_date=ago(120))
        self.assertEqual(r["vendor_view"]["since_label"], "since its last price reduction")
        self.assertIsNone(r["headline"]["dom"])
        self.assertEqual(r["headline"]["success_gap"], 2)  # 7 (100 days) and 9 (90 days)

    def test_teaser_is_headline_only(self):
        t = ar.teaser(intel())
        self.assertIn("headline", t)
        self.assertNotIn("competitors", t)
        self.assertNotIn("actions", t)

    def test_falls_back_when_few_similar_homes(self):
        r = ar.compute_intel({**SUBJECT, "type": "Flat", "bedrooms": 2}, NEARBY, SALES, REPORT, PORTFOLIO, radius=1.0, today=TODAY)
        self.assertEqual(r["basis"], "nearby")


if __name__ == "__main__":
    unittest.main()
