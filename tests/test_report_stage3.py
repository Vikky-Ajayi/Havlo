"""Stage 3: accuracy checks and the tone check for the 20-factor report."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from unittest import mock

from app.services import groq_service, report_guard, report_tone, report_writer as rw
from app.services.report_guard import ReportFacts


def factor(key, found="A plain point about the home.", why="It matters.", action="Do this.", verdict="problem", **kw):
    return {"num": 1, "key": key, "name": key, "verdict": verdict, "found": found, "why": why, "action": action, **kw}


class AccuracyTests(unittest.TestCase):
    def test_an_emptied_factor_becomes_check_with_agent(self):
        # The "found" is a photo claim the text model couldn't have seen.
        report = {"factors": [factor("photography", found="The living room looks cluttered and dark.")]}
        facts = ReportFacts(media_given=False)
        out = report_guard.clean_factor_report(report, facts)
        f = out["factors"][0]
        self.assertEqual(f["verdict"], "check_with_agent")
        self.assertEqual(f["found"], report_guard.FACTOR_CHECK_FALLBACK["found"])

    def test_a_trusted_photography_factor_keeps_its_photo_description(self):
        report = {"factors": [factor("photography", found="The lead photo is a dark living room.", _photo_verified=True)]}
        out = report_guard.clean_factor_report(report, ReportFacts(media_given=False))
        self.assertIn("dark living room", out["factors"][0]["found"])

    def test_a_clean_factor_is_untouched(self):
        report = {"factors": [factor("time_on_market", found="Your home's been listed a while.")]}
        out = report_guard.clean_factor_report(report, ReportFacts())
        self.assertEqual(out["factors"][0]["found"], "Your home's been listed a while.")


class ToneDetectionTests(unittest.TestCase):
    def test_banned_phrases_and_habits(self):
        self.assertIn("banned phrase: leverage", report_tone.tone_issues("You can leverage your price."))
        self.assertTrue(any("dash" in i for i in report_tone.tone_issues("Your home — a real gem — sits high.")))
        self.assertTrue(any("not just" in i for i in report_tone.tone_issues("It's not just a home but a lifestyle.")))
        long = ("This is a very long rambling sentence that keeps going and going and going well past the point "
                "where any normal person would ever say it out loud in a single breath without stopping at least "
                "once or twice to take stock and think again.")
        self.assertIn("sentence too long", report_tone.tone_issues(long))

    def test_clean_text_has_no_issues(self):
        self.assertEqual(report_tone.tone_issues("Your price is high. Drop it to £375,000."), [])

    def test_repeated_openings_across_factors(self):
        # Two factors opening the same way is normal across 20; four or more
        # with the same first three words reads as a template. The first is
        # left alone and the rest get varied.
        report = {"factors": [factor(k, found=f"Your price is {w}.") for k, w in
                              (("a", "high"), ("b", "steep"), ("c", "stretched"), ("d", "bold"))]}
        issues = report_tone.report_tone_issues(report)
        self.assertNotIn("a", issues)
        self.assertTrue(all(any("repeated opening" in i for i in issues.get(k, [])) for k in ("b", "c", "d")))
        two = {"factors": [factor("a", found="Your price is high."), factor("b", found="Your price is steep.")]}
        self.assertEqual(report_tone.report_tone_issues(two), {})

    def test_a_plain_list_of_three_is_not_three_adjectives(self):
        self.assertEqual(report_tone.tone_issues("Ask for the views, enquiries, and viewings."), [])
        self.assertIn("list of three adjectives", report_tone.tone_issues("It's a bright, spacious and modern home."))

    def test_a_rewrite_that_drops_figures_or_content_is_refused(self):
        before = "Your asking price is £3,250,000, which is £1,175,000 above the highest sale. Ask for comparables."
        self.assertFalse(report_tone._keeps_substance(before, "Your price is high. Ask for comparables."))
        self.assertTrue(report_tone._keeps_substance(
            before, "At £3,250,000, you're £1,175,000 above the highest recorded sale, so ask your agent for comparables."))


class ToneFixTests(unittest.TestCase):
    def test_only_failing_factors_are_rewritten(self):
        report = {"factors": [
            factor("visibility", found="You should leverage your price position."),
            factor("description", found="Your description reads well."),
        ]}
        rewrite = {"rewrites": [{"key": "visibility", "found": "Your price keeps you out of searches.",
                                 "why": "Buyers miss you.", "action": "Drop to the step below."}]}
        resp = types.SimpleNamespace(
            choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(rewrite)), finish_reason="stop")],
            usage=types.SimpleNamespace(prompt_tokens=10, completion_tokens=10))
        with mock.patch.object(groq_service, "_report_chat", return_value=resp) as chat:
            out = asyncio.run(report_tone.fix_report_tone(report))
        self.assertEqual(chat.call_count, 1)
        vis = next(f for f in out["factors"] if f["key"] == "visibility")
        self.assertNotIn("leverage", vis["found"])
        # The already-clean factor is untouched.
        self.assertEqual(next(f for f in out["factors"] if f["key"] == "description")["found"], "Your description reads well.")

    def test_no_call_when_tone_is_clean(self):
        report = {"factors": [factor("visibility", found="Your price is high.")]}
        with mock.patch.object(groq_service, "_report_chat") as chat:
            out = asyncio.run(report_tone.fix_report_tone(report))
        chat.assert_not_called()
        self.assertEqual(out, report)


class FinalizeTests(unittest.TestCase):
    def test_pipeline_fixes_tone_then_rechecks(self):
        report = {"factors": [
            factor("visibility", found="You should leverage your price."),
            factor("photography", found="The photos look cluttered.", _photo_verified=False),
        ], "executive_summary": "Summary.", "pricing_line": "Price line."}
        rewrite = {"rewrites": [{"key": "visibility", "found": "Your price keeps you out of searches.",
                                 "why": "x", "action": "y"}]}
        resp = types.SimpleNamespace(
            choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(rewrite)), finish_reason="stop")],
            usage=types.SimpleNamespace(prompt_tokens=10, completion_tokens=10))
        with mock.patch.object(groq_service, "_report_chat", return_value=resp):
            out = asyncio.run(rw.finalize_report(report, ReportFacts(media_given=False)))
        vis = next(f for f in out["factors"] if f["key"] == "visibility")
        self.assertNotIn("leverage", vis["found"])
        # The unverified photo claim was removed by the accuracy pass.
        photo = next(f for f in out["factors"] if f["key"] == "photography")
        self.assertEqual(photo["verdict"], "check_with_agent")


if __name__ == "__main__":
    unittest.main()
