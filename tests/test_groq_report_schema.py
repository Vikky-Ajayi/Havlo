"""Regression tests for the Full Report redesign's schema additions in
groq_service.generate_stale_listing_report:

- scores now has 5 keys (pricing, listing_presentation, market_positioning,
  competition, buyer_appeal) instead of the old 4 (photos, pricing,
  description, positioning).
- key_findings gained evidence/impact/recommend.
- action_plan gained why_it_matters.
- New top-level active_competition (3 entries) and thirty_day_plan (4
  entries, weeks 1-4 in order).

These are all additive/renamed fields that must degrade gracefully for a
report that predates this change (an old-shaped Groq response, or the
on-disk report_json of any of the prospects already in the database) —
these tests exercise that backward-compatibility path directly, since it
would otherwise only be caught by eyeballing a live report.
"""
from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock, patch

from app.services import groq_service


def _fake_groq_response(payload: dict) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = json.dumps(payload)
    return response


class OldShapedReportNormalisationTest(unittest.IsolatedAsyncioTestCase):
    """Simulates a Groq call that returns the OLD schema shape (as if the
    model/prompt had never been updated) to prove _normalise_report_output
    still produces a fully-formed new-shape report."""

    async def test_old_scores_and_missing_new_fields_are_backfilled(self) -> None:
        old_shaped_payload = {
            "overall_score": 55,
            "days_on_market": 200,
            "scores": {"photos": 40, "pricing": 60, "description": 50, "positioning": 45},
            "key_findings": [
                {"title": "Weak photos", "description": "The photos are dated and few in number.", "type": "issue", "icon": "photos"},
            ],
            "action_plan": [
                {"priority": "URGENT", "title": "Reshoot photos", "description": "Book a photographer.", "bullets": ["Book this week.", "Upload within 48 hours."]},
            ],
            "comparable_sales": [
                {"address": "1 Test Street", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£300,000", "is_subject": False},
            ],
            "pricing_recommendation": "Reduce by 5%.",
            "pricing_recommendation_detail": "A reduction would help.",
            "executive_summary": "The property is stale.",
            # Deliberately no active_competition, no thirty_day_plan, no
            # evidence/impact/recommend, no why_it_matters — exactly what an
            # old prospect's stored report_json looks like.
        }

        with patch.object(groq_service, "_get_client", return_value=MagicMock(
            chat=MagicMock(completions=MagicMock(create=MagicMock(return_value=_fake_groq_response(old_shaped_payload))))
        )):
            report = await groq_service.generate_stale_listing_report(
                package="listing_recovery_assessment",
                questions_data={"lead_source": "automated_letter_prospecting", "days_on_market": 200},
                property_address="1 Test Street, London",
                listing_url="https://www.rightmove.co.uk/properties/1",
                listing_snapshot={"address": "1 Test Street, London", "price": "£350,000"},
                expand_report=False,
                has_seller_survey=False,
            )

        # scores: new 5-key shape, none missing.
        self.assertEqual(
            set(report["scores"].keys()),
            {"pricing", "listing_presentation", "market_positioning", "competition", "buyer_appeal"},
        )
        for value in report["scores"].values():
            self.assertIsInstance(value, int)

        # every finding has the 3 new fields, non-empty.
        for finding in report["key_findings"]:
            self.assertTrue(finding.get("evidence"))
            self.assertTrue(finding.get("impact"))
            self.assertTrue(finding.get("recommend"))

        # every action has why_it_matters, non-empty.
        for action in report["action_plan"]:
            self.assertTrue(action.get("why_it_matters"))

        # active_competition: exactly 3, defaulted.
        self.assertEqual(len(report["active_competition"]), 3)
        for entry in report["active_competition"]:
            self.assertIn("address", entry)
            self.assertIn("differentiator", entry)

        # thirty_day_plan: exactly 4, weeks 1-4 in order.
        self.assertEqual(len(report["thirty_day_plan"]), 4)
        self.assertEqual([w["week"] for w in report["thirty_day_plan"]], [1, 2, 3, 4])

    async def test_new_shaped_scores_pass_through_unchanged(self) -> None:
        new_shaped_payload = {
            "overall_score": 60,
            "scores": {
                "pricing": 70, "listing_presentation": 65, "market_positioning": 55,
                "competition": 50, "buyer_appeal": 60,
            },
            "key_findings": [],
            "action_plan": [],
            "comparable_sales": [],
            "active_competition": [
                {"address": "A", "price": "£1", "beds": 3, "distance": "0.1mi", "days_listed": 10, "differentiator": "X"},
                {"address": "B", "price": "£2", "beds": 3, "distance": "0.2mi", "days_listed": 20, "differentiator": "Y"},
                {"address": "C", "price": "£3", "beds": 3, "distance": "0.3mi", "days_listed": 30, "differentiator": "Z"},
            ],
            "thirty_day_plan": [
                {"week": 1, "title": "A"}, {"week": 2, "title": "B"},
                {"week": 3, "title": "C"}, {"week": 4, "title": "D"},
            ],
            "pricing_recommendation": "",
            "pricing_recommendation_detail": "",
            "executive_summary": "",
        }

        with patch.object(groq_service, "_get_client", return_value=MagicMock(
            chat=MagicMock(completions=MagicMock(create=MagicMock(return_value=_fake_groq_response(new_shaped_payload))))
        )):
            report = await groq_service.generate_stale_listing_report(
                package="listing_recovery_assessment",
                questions_data={"days_on_market": 100},
                property_address="2 Test Street, London",
                listing_url="https://www.rightmove.co.uk/properties/2",
                listing_snapshot={"address": "2 Test Street, London", "price": "£400,000"},
                expand_report=False,
                has_seller_survey=False,
            )

        self.assertEqual(report["scores"]["pricing"], 70)
        self.assertEqual([e["address"] for e in report["active_competition"]], ["A", "B", "C"])
        self.assertEqual([w["title"] for w in report["thirty_day_plan"]], ["A", "B", "C", "D"])


if __name__ == "__main__":
    unittest.main()
