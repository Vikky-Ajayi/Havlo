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

    def test_missing_factors_are_filled_with_check_with_agent(self):
        # AI returns only 3 factors; the rest must be filled.
        rep = self.write(ai_report(factors=[
            {"key": "visibility", "verdict": "problem", "found": "Just above £375k.", "why": "x", "action": "y"}]))
        self.assertEqual(len(rep["factors"]), 20)
        filled = [f for f in rep["factors"] if f["key"] != "visibility"]
        self.assertTrue(all(f["verdict"] == "check_with_agent" for f in filled))

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

    def test_a_failed_call_still_returns_twenty_check_factors(self):
        with mock.patch.object(groq_service, "_report_chat", side_effect=RuntimeError("boom")):
            rep = asyncio.run(rw.write_free_report(SNAPSHOT, asking_price=390_000, advertised_days=96))
        self.assertEqual(len(rep["factors"]), 20)
        self.assertTrue(all(f["verdict"] == "check_with_agent" for f in rep["factors"]))


class FactsTests(unittest.TestCase):
    def test_visibility_verdict_comes_from_code(self):
        facts = rw.build_free_facts(SNAPSHOT, asking_price=390_000, country="UK", reduced_days=None,
                                    advertised_days=96, sales=None, photo_review=None)
        self.assertEqual(facts["visibility"]["verdict"], rf.PROBLEM)
        self.assertEqual(facts["affordability"]["data"]["stamp_duty"], 9_500)


if __name__ == "__main__":
    unittest.main()
