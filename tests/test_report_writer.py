"""The free 20-factor writer: always 20 valid factors, forced check-with-agent
factors, the code day line, and no street or house names in the output."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from unittest import mock

from app.services import groq_service, report_factors as rf, report_writer as rw

SNAPSHOT = {
    "title": "Green Tops, Thorn Close, Kidderminster, DY10 1NB",
    "address": "Green Tops, Thorn Close, Kidderminster, DY10 1NB",
    "postcode": "DY10 1NB",
    "price": "£390,000",
    "bedrooms": "3", "bathrooms": "2", "property_type": "Semi-detached",
    "description": "A lovely home on Thorn Close with an extended kitchen 4m x 3m and a south-facing garden.",
    "features": ["Extended kitchen", "South-facing garden"],
    "media": {"photos": 23, "floorplans": 1, "virtual_tours": 0},
    "agent": {"brand": "Smiths"},
}


def ai_report(**over):
    factors = [{"key": f["key"], "verdict": "working_well", "found": f"Point about {f['key']}.",
                "why": "It matters.", "action": "Do this."} for f in rf.FACTORS]
    base = {"overall_score": 44, "pricing_line": "Your price looks high for Thorn Close.",
            "executive_summary": "Here is the summary for Green Tops.", "factors": factors}
    base.update(over)
    return base


def response(payload):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(payload)), finish_reason="stop")],
        usage=types.SimpleNamespace(prompt_tokens=100, completion_tokens=100))


class ScrubTests(unittest.TestCase):
    def test_street_house_and_postcode_are_removed(self):
        out = rw.scrub_place_names("Green Tops on Thorn Close in DY10 1NB is lovely.", SNAPSHOT)
        self.assertNotIn("Green Tops", out)
        self.assertNotIn("Thorn Close", out)
        self.assertNotIn("DY10 1NB", out)
        self.assertIn("your property", out)

    def test_other_street_names_caught_too(self):
        self.assertNotIn("Oak Avenue", rw.scrub_place_names("Homes on Oak Avenue sell fast.", SNAPSHOT))


class WriteTests(unittest.TestCase):
    def write(self, payload):
        with mock.patch.object(groq_service, "_report_chat", return_value=response(payload)):
            return asyncio.run(rw.write_free_report(SNAPSHOT, asking_price=390_000, advertised_days=96))

    def test_always_twenty_valid_factors(self):
        rep = self.write(ai_report())
        self.assertEqual(len(rep["factors"]), 20)
        self.assertEqual([f["key"] for f in rep["factors"]], list(rf.FACTOR_KEYS))
        for f in rep["factors"]:
            self.assertIn(f["verdict"], {"problem", "working_well", "check_with_agent"})
            self.assertTrue(f["found"])

    def test_missing_factors_are_filled(self):
        # AI returns only 1 factor; the rest are filled: a code-decided verdict
        # where the facts settle it (96 days advertised = too long), otherwise
        # check-with-agent, each with a specific next step, not a bare referral.
        rep = self.write(ai_report(factors=[
            {"key": "visibility", "verdict": "problem", "found": "Just above £375k.", "why": "x", "action": "y"}]))
        self.assertEqual(len(rep["factors"]), 20)
        by_key = {f["key"]: f for f in rep["factors"]}
        self.assertEqual(by_key["time_on_market"]["verdict"], "problem")
        self.assertEqual(by_key["description"]["verdict"], "check_with_agent")
        self.assertIn("views in the last 14 days", by_key["engagement"]["action"])
        self.assertNotEqual(by_key["description"]["action"], "Ask your agent about this.")

    def test_private_factors_are_forced_to_check_even_if_ai_says_otherwise(self):
        rep = self.write(ai_report())  # AI said working_well for everything
        for key in ("engagement", "viewing_conversion"):
            f = next(x for x in rep["factors"] if x["key"] == key)
            self.assertEqual(f["verdict"], "check_with_agent")

    def test_the_day_line_is_the_code_one_and_opens_the_summary(self):
        rep = self.write(ai_report())
        self.assertEqual(rep["day_sentence"], "Your property has been advertised for 96 days.")
        self.assertTrue(rep["executive_summary"].startswith("Your property has been advertised for 96 days."))

    def test_no_place_names_survive_anywhere(self):
        rep = self.write(ai_report())
        blob = json.dumps(rep)
        for banned in ("Green Tops", "Thorn Close", "DY10 1NB"):
            self.assertNotIn(banned, blob)

    def test_a_failed_call_still_returns_twenty_factors(self):
        with mock.patch.object(groq_service, "_report_chat", side_effect=RuntimeError("boom")):
            rep = asyncio.run(rw.write_free_report(SNAPSHOT, asking_price=390_000, advertised_days=96))
        self.assertEqual(len(rep["factors"]), 20)
        by_key = {f["key"]: f for f in rep["factors"]}
        # The code-decided verdicts still hold; the rest fall back to check.
        self.assertEqual(by_key["visibility"]["verdict"], "problem")
        self.assertEqual(by_key["time_on_market"]["verdict"], "problem")
        self.assertEqual(by_key["asking_price"]["verdict"], "check_with_agent")

    def test_the_prompt_gets_the_full_description_and_how_to_judge(self):
        long_desc = "A lovely home. " * 200 + "EPC Rating: C"
        seen = {}

        def capture(**body):
            seen["prompt"] = body["messages"][-1]["content"]
            return response(ai_report())

        snap = {**SNAPSHOT, "description": long_desc}
        with mock.patch.object(groq_service, "_report_chat", side_effect=capture):
            asyncio.run(rw.write_free_report(snap, asking_price=390_000, advertised_days=96))
        self.assertIn("EPC Rating: C", seen["prompt"])  # not cut at 1,500 characters any more
        self.assertIn("how to judge:", seen["prompt"])
        self.assertIn('ONLY for listing engagement, viewing-to-offer and seller net proceeds', seen["prompt"])
        self.assertIn("the full report", seen["prompt"])  # named as something never to say

    def test_preview_reveals_the_most_serious_problems_first(self):
        factors = [{"key": f["key"], "verdict": "working_well", "found": "ok", "why": "w", "action": "a"} for f in rf.FACTORS]
        for f in factors:
            if f["key"] == "visibility":
                f.update(verdict="problem", severity=2)
            if f["key"] == "agent_marketing":
                f.update(verdict="problem", severity=5)
        rep = self.write(ai_report(factors=factors))
        revealed = [r["key"] for r in rw.v2_preview(rep)["revealed"]]
        self.assertEqual(revealed[0], "agent_marketing")


class FactsTests(unittest.TestCase):
    def test_visibility_verdict_comes_from_code(self):
        facts = rw.build_free_facts(SNAPSHOT, asking_price=390_000, country="UK", reduced_days=None,
                                    advertised_days=96, sales=None, photo_review=None)
        self.assertEqual(facts["visibility"]["verdict"], rf.PROBLEM)
        self.assertEqual(facts["affordability"]["data"]["stamp_duty"], 9_500)


if __name__ == "__main__":
    unittest.main()


class PaidWriterTests(unittest.TestCase):
    def test_paid_keeps_free_verdicts_and_expands_all_twenty(self):
        from app.services import agent_report

        free = None
        with mock.patch.object(groq_service, "_report_chat", return_value=response(ai_report(
                factors=[{"key": "visibility", "verdict": "problem", "found": "Just above £375k.", "why": "x", "action": "y"}]
                        + [{"key": f["key"], "verdict": "working_well", "found": "ok", "why": "w", "action": "a"}
                           for f in rf.FACTORS if f["key"] != "visibility"]))):
            free = asyncio.run(rw.write_free_report(SNAPSHOT, asking_price=390_000, advertised_days=96))

        intel = {"market": {"for_sale": 23, "competing": [{"price": 380000, "type": "Semi"}]},
                 "headline": {"dom_benchmark": 60}, "vendor_view": {"agreed_since_listed": 4, "since_label": "since you listed", "sold_since_listed": 2},
                 "sold": {"count_12m": 31, "median_12m": 372000}}

        detail = {"factors": [{"key": f["key"], "found": f"Detailed {f['key']}.", "why": "because", "action": "do it"}
                              for f in rf.FACTORS]}

        async def go():
            with mock.patch.object(agent_report, "build_intel", return_value=intel), \
                    mock.patch.object(groq_service, "_report_chat", return_value=response(detail)):
                return await rw.write_paid_report(object(), free, SNAPSHOT, asking_price=390_000, advertised_days=96)

        paid = asyncio.run(go())
        self.assertEqual(len(paid["factors"]), 20)
        self.assertTrue(paid["_expanded"])
        self.assertTrue(paid["_market_data"])
        vis = next(f for f in paid["factors"] if f["key"] == "visibility")
        self.assertEqual(vis["verdict"], "problem")  # verdict kept from free
        self.assertIn("Detailed visibility", vis["found"])
        eng = next(f for f in paid["factors"] if f["key"] == "engagement")
        self.assertEqual(eng["verdict"], "check_with_agent")  # still forced

    def test_market_facts_extraction(self):
        intel = {"market": {"for_sale": 12, "competing": []}, "headline": {"dom_benchmark": 55},
                 "vendor_view": {"agreed_since_listed": 3}, "sold": {"count_12m": 20, "median_12m": 300000}}
        m = rw.build_market_facts(intel)
        self.assertEqual(m["active_competition"]["homes_for_sale_nearby"], 12)
        self.assertEqual(m["buyer_demand"]["agreed_since_you_listed"], 3)
        self.assertEqual(m["asking_price"]["median_sold_nearby_12m"], 300000)
        self.assertEqual(rw.build_market_facts({}), {})

    def test_paid_survives_no_market_data(self):
        from app.services import agent_report

        with mock.patch.object(groq_service, "_report_chat", return_value=response(ai_report())):
            free = asyncio.run(rw.write_free_report(SNAPSHOT, asking_price=390_000, advertised_days=96))

        async def go():
            with mock.patch.object(agent_report, "build_intel", side_effect=RuntimeError("search down")), \
                    mock.patch.object(groq_service, "_report_chat", return_value=response({"factors": []})):
                return await rw.write_paid_report(object(), free, SNAPSHOT, asking_price=390_000, advertised_days=96)

        paid = asyncio.run(go())
        self.assertEqual(len(paid["factors"]), 20)
        self.assertFalse(paid["_market_data"])
        # Falls back to the free text when a detail half returns nothing.
        self.assertTrue(all(f["found"] for f in paid["factors"]))
