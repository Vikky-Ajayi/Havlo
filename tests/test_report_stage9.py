"""The agent variant: the 20-factor report is written as "this property" for an
agency, and an agency copy's free report is rewritten that way on first open."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from unittest import mock

from app.services import report_factors as rf
from app.services import report_writer as rw
from app.services import stale_prospect_service as sps

SNAPSHOT = {"title": "A home", "address": "A home", "postcode": "DY10 1NB", "price": "£390,000",
            "bedrooms": "3", "property_type": "Semi-detached", "description": "A home.", "media": {"photos": 20}}


def _facts(agent):
    return rw.build_free_facts(SNAPSHOT, asking_price=390_000, country="UK", reduced_days=None,
                              advertised_days=96, sales=None, photo_review=None, agent=agent)


class PromptWordingTests(unittest.TestCase):
    def test_free_prompt_says_this_property_for_agents(self):
        # The instruction line addresses the agent's listing as "this property"
        # (the tone examples below it stay in their own voice).
        agent = rw._free_prompt(_facts(True), agent=True, day_sentence=None)
        owner = rw._free_prompt(_facts(False), agent=False, day_sentence=None)
        self.assertIn("for this property", agent)
        self.assertIn("for your property", owner)

    def test_paid_prompt_says_this_property_for_agents(self):
        specs = rf.FACTORS[:3]
        free_by_key = {s["key"]: {"verdict": "problem", "found": "x"} for s in specs}
        agent = rw._paid_prompt(specs, free_by_key, _facts(True), agent=True, day_sentence=None)
        owner = rw._paid_prompt(specs, free_by_key, _facts(False), agent=False, day_sentence=None)
        self.assertIn("for this property", agent)
        self.assertIn("for your property", owner)


def _v2_report(**over):
    factors = [{"key": f["key"], "num": f["num"], "name": f["name"], "verdict": "working_well",
                "found": "x", "why": "y", "action": "z"} for f in rf.FACTORS]
    base = {"version": rw.REPORT_VERSION, "overall_score": 44, "factors": factors}
    base.update(over)
    return base


class RegenerateAgentFreeTests(unittest.TestCase):
    def _copy(self, report):
        return types.SimpleNamespace(
            property_code="A1234", property_address="A home", rightmove_url="https://rm/1",
            asking_price=390_000, listing_duration_days=96, country="UK",
            listing_snapshot_json=json.dumps(SNAPSHOT),
            report_json=json.dumps(report) if report is not None else None,
            preview_json=None, sold_comparables_at=None)

    def test_rewrites_a_v2_copy_as_agent(self):
        copy = self._copy(_v2_report())
        fresh = _v2_report(executive_summary="this property summary")
        gen = mock.AsyncMock(return_value=fresh)
        with mock.patch.object(sps, "generate_v2_report", new=gen):
            did = asyncio.run(sps.regenerate_agent_v2_free(copy))
        self.assertTrue(did)
        self.assertEqual(gen.await_args.kwargs["agent"], True)
        self.assertEqual(json.loads(copy.report_json)["executive_summary"], "this property summary")
        self.assertEqual(json.loads(copy.preview_json)["total_factors"], len(rf.FACTORS))

    def test_old_report_is_left_alone(self):
        copy = self._copy({"key_findings": [], "overall_score": 40})  # not v2
        with mock.patch.object(sps, "generate_v2_report", new=mock.AsyncMock()) as gen:
            did = asyncio.run(sps.regenerate_agent_v2_free(copy))
        self.assertFalse(did)
        gen.assert_not_awaited()

    def test_a_failed_rewrite_keeps_the_copied_report(self):
        original = _v2_report(executive_summary="owner-worded")
        copy = self._copy(original)
        with mock.patch.object(sps, "generate_v2_report", new=mock.AsyncMock(side_effect=RuntimeError("boom"))):
            did = asyncio.run(sps.regenerate_agent_v2_free(copy))
        self.assertFalse(did)
        self.assertEqual(json.loads(copy.report_json)["executive_summary"], "owner-worded")


if __name__ == "__main__":
    unittest.main()
