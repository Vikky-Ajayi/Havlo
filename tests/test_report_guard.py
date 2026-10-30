"""AI-written reports never describe photos or rooms the model hasn't
seen. The model reads the listing's text only; in Oct 2026 a report told a
seller her living room was cluttered when it was empty, and lost the sale."""
from __future__ import annotations

import json
import unittest
from types import SimpleNamespace

from app.services import report_guard
from app.services import stale_prospect_service as sps

# The finding the seller saw (Hoo Road, Kidderminster), word for word.
SUE_FINDING = {
    "title": "Sparse visual storytelling",
    "icon": "photos",
    "type": "issue",
    "description": (
        "The Rightmove gallery contains only a handful of images, each taken from a single angle with limited "
        "natural light. The living room appears cluttered with personal items, the kitchen shows no countertop "
        "finish, and the conservatory is presented without furniture, leaving the space feeling unfinished.\n\n"
        "Buyers form an instant impression from the first image; a dark, cramped visual narrative reduces "
        "click-through rates and increases bounce, especially when competing listings showcase bright, staged rooms.\n\n"
        "No virtual tour or 360-degree view is available, limiting remote engagement for out-of-area purchasers."
    ),
}
PRICE_FINDING = {
    "title": "Price sits above local absorption",
    "icon": "price",
    "type": "issue",
    "description": (
        "The asking price of £250,000 for a three-bedroom semi-detached house on Hoo Road is roughly 7 percent "
        "higher than the average price per bedroom for recent sales nearby."
    ),
}
DESCRIPTION_FINDING = {
    "title": "Description lacks compelling detail",
    "icon": "description",
    "type": "issue",
    "description": (
        'The property description repeats generic phrases such as "practical area for food preparation" and '
        "stops abruptly mid-sentence."
    ),
}


class GuardTests(unittest.TestCase):
    def test_the_finding_that_lost_the_sale_is_removed(self):
        findings = report_guard.clean_findings([PRICE_FINDING, SUE_FINDING, DESCRIPTION_FINDING])
        self.assertEqual([f["title"] for f in findings], [PRICE_FINDING["title"], DESCRIPTION_FINDING["title"]])

    def test_genuine_findings_are_untouched(self):
        findings = report_guard.clean_findings([PRICE_FINDING, DESCRIPTION_FINDING])
        self.assertEqual(findings, [PRICE_FINDING, DESCRIPTION_FINDING])

    def test_photo_findings_go_even_without_a_photos_icon(self):
        finding = dict(SUE_FINDING, icon="marketing", title="Photography undersells the home")
        self.assertEqual(report_guard.clean_findings([finding]), [])

    def test_seen_room_sentences_are_removed_from_other_findings(self):
        mixed = dict(PRICE_FINDING, description=PRICE_FINDING["description"] + " The lounge looks dated and dark.")
        [kept] = report_guard.clean_findings([mixed])
        self.assertEqual(kept["description"], PRICE_FINDING["description"])
        for sentence in (
            "The photos show a tired kitchen.",
            "Rooms appear small and cramped.",
            "The living room appears cluttered with personal items.",
            "No floor plan is included in the listing.",
        ):
            self.assertEqual(report_guard.clean_text(sentence, {}), "", sentence)

    def test_action_plan_photography_advice_can_stay(self):
        report = {"key_findings": [PRICE_FINDING], "action_plan": [
            {"title": "Book a fresh professional shoot", "description": "A new set of photos can renew interest after a long listing."},
        ]}
        cleaned = report_guard.clean_report(report)
        self.assertEqual(cleaned["action_plan"], report["action_plan"])

    def test_an_analysts_edit_keeps_its_wording(self):
        report = {"key_findings": [SUE_FINDING]}
        self.assertEqual(report_guard.clean_report(report, ai_written=False)["key_findings"], [SUE_FINDING])


class PreviewTests(unittest.TestCase):
    def prospect(self, **fields):
        base = dict(
            report_json=json.dumps({"key_findings": [PRICE_FINDING, SUE_FINDING, DESCRIPTION_FINDING, PRICE_FINDING]}),
            agent_edited_report_json=None,
            preview_json=json.dumps({"key_issues": [PRICE_FINDING, SUE_FINDING, DESCRIPTION_FINDING]}),
            listing_snapshot_json="{}",
        )
        base.update(fields)
        return SimpleNamespace(**base)

    def test_free_preview_no_longer_shows_it(self):
        titles = [f["title"] for f in sps.clean_preview(self.prospect())["key_issues"]]
        self.assertNotIn(SUE_FINDING["title"], titles)
        self.assertEqual(len(titles), 3)

    def test_preview_without_a_report_is_cleaned_too(self):
        titles = [f["title"] for f in sps.clean_preview(self.prospect(report_json=None))["key_issues"]]
        self.assertEqual(titles, [PRICE_FINDING["title"], DESCRIPTION_FINDING["title"]])


if __name__ == "__main__":
    unittest.main()
