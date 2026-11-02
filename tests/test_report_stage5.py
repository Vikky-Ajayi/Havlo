"""The paid pass for a 20-factor report: ensure_expanded_v2_report keeps the
free verdicts, expands every factor, re-runs the checks and marks it expanded."""
from __future__ import annotations

import asyncio
import json
import re
import types
import unittest
from unittest import mock

from app.services import agent_report, groq_service, report_factors as rf
from app.services import report_writer as rw
from app.services import stale_prospect_service as sps

SNAPSHOT = {
    "title": "Green Tops, Thorn Close, Kidderminster, DY10 1NB",
    "address": "Green Tops, Thorn Close, Kidderminster, DY10 1NB",
    "postcode": "DY10 1NB", "price": "£390,000",
    "bedrooms": "3", "bathrooms": "2", "property_type": "Semi-detached",
    "description": "A lovely home with an extended kitchen 4m x 3m and a garden.",
    "features": ["Extended kitchen"], "media": {"photos": 23, "floorplans": 1},
    "price_reduced": True,
}

_PROBLEMS = {"visibility", "asking_price", "reduction_history"}


def _free_report() -> dict:
    factors = []
    for f in rf.FACTORS:
        key = f["key"]
        verdict = (rf.PROBLEM if key in _PROBLEMS
                   else rf.CHECK_WITH_AGENT if key in ("engagement", "viewing_conversion")
                   else rf.WORKING_WELL)
        factors.append({"num": f["num"], "key": key, "name": f["name"], "verdict": verdict,
                        "found": f"Free line about {key}.", "why": "It matters.", "action": "Do this."})
    return {"version": rw.REPORT_VERSION, "overall_score": 44,
            "pricing_line": "Your price looks high.", "executive_summary": "Summary.",
            "day_sentence": None, "factors": factors}


def _response(payload) -> types.SimpleNamespace:
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(payload)), finish_reason="stop")],
        usage=types.SimpleNamespace(prompt_tokens=100, completion_tokens=100))


def _fake_report_chat(**body):
    """Full paid write → fuller text per key; summary → summary + three
    actions; tone edit → unchanged; else empty."""
    text = str(body["messages"][-1]["content"])
    if "Write the full paid assessment" in text:
        keys = [m.group(1) for m in re.finditer(r"\[key: ([a-z_]+)\]", text)]
        return _response({"factors": [{"key": k, "found": f"A fuller look at your {k}.",
                                       "why": "It matters to the sale.", "action": "Here is the step."} for k in keys]})
    if "three most important actions" in text:
        return _response({"executive_summary": "The price is the main barrier.", "pricing_line": "Priced high.",
                          "overall_score": 41,
                          "top_actions": [{"title": f"Action {i}", "detail": f"Do thing {i} this week."} for i in (1, 2, 3)]})
    if "Edit these property-report paragraphs" in text:
        before = text.split("Return JSON")[0]
        items = json.loads(re.search(r"\[.*\]", before, re.S).group(0))
        return _response({"rewrites": [{"key": i["key"], "found": i.get("found", ""),
                                        "why": i.get("why", ""), "action": i.get("action", "")} for i in items]})
    return _response({})


def _prospect() -> types.SimpleNamespace:
    return types.SimpleNamespace(
        id="p1", listing_snapshot_json=json.dumps(SNAPSHOT), report_json=None,
        asking_price=390_000, listing_duration_days=96, audience="owner", country="UK",
        bedrooms=3, bathrooms=2, listed_date=None, processed_at=None, created_at=None,
        sold_comparables_at=None)


class EnsureExpandedV2Tests(unittest.TestCase):
    def _run(self):
        prospect = _prospect()
        with mock.patch.object(groq_service, "_report_chat", side_effect=_fake_report_chat), \
                mock.patch.object(agent_report, "build_intel", new=mock.AsyncMock(return_value={})), \
                mock.patch.object(sps, "refresh_sold_comparables", new=mock.AsyncMock(return_value=[])):
            report = asyncio.run(sps.ensure_expanded_v2_report(prospect, _free_report()))
        return prospect, report

    def test_expands_all_twenty_factors(self):
        _, report = self._run()
        self.assertEqual(len(report["factors"]), 20)
        self.assertTrue(report["_expanded"])

    def test_verdicts_are_preserved_from_the_free_report(self):
        _, report = self._run()
        by_key = {f["key"]: f for f in report["factors"]}
        self.assertEqual(by_key["visibility"]["verdict"], rf.PROBLEM)
        self.assertEqual(by_key["engagement"]["verdict"], rf.CHECK_WITH_AGENT)
        self.assertEqual(by_key["description"]["verdict"], rf.WORKING_WELL)

    def test_text_is_the_expanded_version(self):
        _, report = self._run()
        by_key = {f["key"]: f for f in report["factors"]}
        self.assertIn("A fuller look at your visibility", by_key["visibility"]["found"])

    def test_report_is_saved_back_on_the_prospect(self):
        prospect, report = self._run()
        self.assertIsNotNone(prospect.report_json)
        self.assertEqual(json.loads(prospect.report_json)["factors"][0]["key"], report["factors"][0]["key"])

    def test_paid_report_has_a_summary_and_three_top_actions(self):
        _, report = self._run()
        self.assertEqual([t["title"] for t in report["top_actions"]], ["Action 1", "Action 2", "Action 3"])
        self.assertIn("The price is the main barrier.", report["executive_summary"])
        self.assertEqual(report["_writer_rev"], rw.WRITER_REV)

    def test_computed_figures_are_kept_for_the_checks(self):
        _, report = self._run()
        self.assertIn(390_000.0, report["_trusted"]["amounts"])

    def test_no_street_or_house_names_survive(self):
        _, report = self._run()
        blob = json.dumps(report["factors"])
        self.assertNotIn("Thorn Close", blob)
        self.assertNotIn("Green Tops", blob)


if __name__ == "__main__":
    unittest.main()
