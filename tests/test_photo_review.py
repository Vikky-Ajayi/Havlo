"""Real photo feedback: the vision step's observations are kept (we saw the
photos), while the text model still can't describe photos it hasn't seen."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from unittest import mock

from app.services import groq_service, photo_review, report_guard
from app.services import stale_prospect_service as sps
from app.services.report_guard import ReportFacts

VISION_JSON = json.dumps({
    "overall": "The photos are dark and make the rooms feel small.",
    "findings": [
        {"title": "Lead photo is a dim interior", "type": "issue",
         "description": "The first image is a dark living room rather than the exterior, so the listing opens "
         "on a weak note. A bright kerb-side shot would set a stronger first impression."},
        {"title": "No garden photo", "type": "issue",
         "description": "None of the photos show the garden, which buyers filtering for outdoor space will miss."},
    ],
    "actions": ["Reshoot the lead photo as a bright exterior", "Add a photo of the garden"],
})


def vision_response(content=VISION_JSON):
    return types.SimpleNamespace(
        choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=content), finish_reason="stop")],
        usage=types.SimpleNamespace(prompt_tokens=1100, completion_tokens=400))


class ReviewTests(unittest.TestCase):
    def test_it_sends_the_photos_and_returns_findings(self):
        sent = {}

        def fake_openai(model, body):
            sent["model"] = model
            sent["content"] = body["messages"][1]["content"]
            return vision_response()

        with mock.patch.object(groq_service, "_openai_chat", fake_openai):
            out = asyncio.run(photo_review.review_photos(
                ["https://img/1.jpg", "not-a-url", "https://img/2.jpg"], address="1 Test Rd",
                property_type="Semi", photo_count=12, model="gpt-6.1-terra"))
        images = [c for c in sent["content"] if c["type"] == "image_url"]
        self.assertEqual([i["image_url"]["url"] for i in images], ["https://img/1.jpg", "https://img/2.jpg"])
        self.assertEqual(images[0]["image_url"]["detail"], "low")
        self.assertEqual(out["photos_seen"], 2)
        self.assertEqual([f["title"] for f in out["findings"]], ["Lead photo is a dim interior", "No garden photo"])

    def test_no_photos_or_a_failure_returns_none(self):
        self.assertIsNone(asyncio.run(photo_review.review_photos([], address="x", property_type=None, photo_count=0, model="m")))

        def boom(model, body):
            raise RuntimeError("vision 500")

        with mock.patch.object(groq_service, "_openai_chat", boom):
            self.assertIsNone(asyncio.run(photo_review.review_photos(
                ["https://img/1.jpg"], address="x", property_type=None, photo_count=1, model="m")))


class AddPhotoReviewTests(unittest.TestCase):
    def test_runs_the_whole_path_with_a_key_present_without_erroring(self):
        # Regression: add_photo_review used groq_service without importing it,
        # which NameError'd on prod (where the key is set) and would have
        # broken report generation. Exercise the full path.
        import os
        from app.services import stale_prospect_service as sps, photo_review as pr

        review = {"overall": "Dark.", "model": "gpt-6.1-terra", "photos_seen": 1,
                  "findings": [{"title": "Lead photo is dim", "description": "The first image is dark.", "type": "issue"}],
                  "actions": ["Reshoot the lead photo"]}

        async def fake_review(image_urls, **kw):
            return review

        async def go():
            with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}, clear=False):
                os.environ.pop("REPORT_MODEL", None)
                with mock.patch.object(pr, "review_photos", fake_review):
                    return await sps.add_photo_review(
                        {"key_findings": [{"title": "Price", "description": "x", "icon": "price"}], "action_plan": []},
                        {"images": ["https://img/1.jpg"], "media": {"photos": 6}, "property_type": "Flat"}, "1 Test Rd")

        out = asyncio.run(go())
        self.assertIn("Lead photo is dim", [f["title"] for f in out["key_findings"]])

    def test_a_crash_in_the_photo_step_never_breaks_the_report(self):
        import os
        from app.services import stale_prospect_service as sps, photo_review as pr

        async def boom(image_urls, **kw):
            raise RuntimeError("vision exploded")

        async def go():
            with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}, clear=False):
                os.environ.pop("REPORT_MODEL", None)
                with mock.patch.object(pr, "review_photos", boom):
                    return await sps.add_photo_review({"key_findings": []}, {"images": ["https://img/1.jpg"]}, "x")

        self.assertEqual(asyncio.run(go()), {"key_findings": []})


class MergeAndCheckTests(unittest.TestCase):
    def test_photo_findings_survive_the_checks_but_text_photo_claims_do_not(self):
        review = {"overall": "Dark photos.", "model": "gpt-6.1-terra", "photos_seen": 2,
                  "findings": json.loads(VISION_JSON)["findings"], "actions": ["Reshoot the lead photo"]}
        report = {"key_findings": [
            {"title": "Price above the local market", "icon": "price", "type": "issue",
             "description": "The asking price sits above recent comparable interest."},
            {"title": "Sparse visual storytelling", "icon": "photos", "type": "issue",
             "description": "The living room appears cluttered with personal items."},
        ], "action_plan": []}
        merged = sps._apply_photo_review(report, review)
        # The text model's invented photo finding is gone; the two verified
        # ones are in, and the price finding stays.
        titles = [f["title"] for f in merged["key_findings"]]
        self.assertIn("Lead photo is a dim interior", titles)
        self.assertIn("No garden photo", titles)
        self.assertIn("Price above the local market", titles)
        self.assertNotIn("Sparse visual storytelling", titles)
        for f in merged["key_findings"]:
            if f["title"] in ("Lead photo is a dim interior", "No garden photo"):
                self.assertTrue(f["_photo_verified"])

        # Now run the real checks: no media counts given, yet the verified
        # photo findings must be kept (we actually saw the photos).
        facts = ReportFacts(asking_price=250_000, media={}, media_given=False)
        cleaned = report_guard.clean_report(merged, facts)
        kept = [f["title"] for f in cleaned["key_findings"]]
        self.assertIn("Lead photo is a dim interior", kept)
        self.assertIn("No garden photo", kept)
        # The verified finding's photo description is NOT stripped.
        lead = next(f for f in cleaned["key_findings"] if f["title"] == "Lead photo is a dim interior")
        self.assertIn("dark living room", lead["description"])

    def test_an_unverified_photo_finding_is_still_removed(self):
        report = {"key_findings": [
            {"title": "Photography undersells the home", "icon": "photos", "type": "issue",
             "description": "The kitchen looks dated and the lounge is dark."},
        ]}
        cleaned = report_guard.clean_report(report, ReportFacts(media_given=False))
        self.assertEqual(cleaned["key_findings"], [])


if __name__ == "__main__":
    unittest.main()
