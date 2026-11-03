"""The agent's figures typed into Listing Engagement / Viewing-to-Offer, and
the factor rewritten from them (report_owner_figures.py); the report PDF
(report_v2_pdf.py). The AI calls are faked."""
from __future__ import annotations

import asyncio
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services import report_factors as rf
from app.services import report_owner_figures as rof


def _report(**extra):
    factors = [{"num": f["num"], "key": f["key"], "name": f["name"],
                "verdict": "check_with_agent" if f.get("always_check") else "working_well",
                "found": "Rightmove only shows your views to your agent.", "why": "It tells you if buyers find it.",
                "action": "Ask for the four figures."} for f in rf.FACTORS]
    factors[2]["verdict"] = "problem"
    return {"version": 2, "factors": factors, "_expanded": True, "_trusted": {"amounts": [425000], "percents": [5.6]},
            "day_sentence": "Your property has been advertised for 70 days.", **extra}


def _prospect(report, **extra):
    base = dict(report_json=json.dumps(report), agent_edited_report_json=None, listing_snapshot_json="{}",
                asking_price=450000, listing_duration_days=70, audience="owner", bedrooms=3, bathrooms=1,
                listed_date=None, processed_at=None, created_at=None, sold_comparables_at=None)
    base.update(extra)
    return SimpleNamespace(**base)


class CleanFiguresTests(unittest.TestCase):
    def test_blank_fields_are_dropped_and_numbers_read(self) -> None:
        self.assertEqual(rof.clean_figures("engagement", {"views_total": "1,240", "views_14d": "", "enquiries": 9}),
                         {"views_total": 1240, "enquiries": 9})

    def test_figures_that_cant_be_right_are_refused(self) -> None:
        for key, raw in (("engagement", {}), ("engagement", {"views_total": "lots"}), ("engagement", {"views_total": -3}),
                         ("engagement", {"views_total": 2.5}), ("engagement", {"views_total": 100, "views_14d": 200}),
                         ("viewing_conversion", {"viewings": 3, "second_viewings": 5}), ("photography", {"x": 1})):
            with self.assertRaises(rof.FiguresError, msg=(key, raw)):
                rof.clean_figures(key, raw)

    def test_feedback_is_kept_as_text(self) -> None:
        got = rof.clean_figures("viewing_conversion", {"viewings": 6, "feedback": "  liked the garden,\n small kitchen "})
        self.assertEqual(got, {"viewings": 6, "feedback": "liked the garden, small kitchen"})


class DeriveTests(unittest.TestCase):
    def test_falling_views_are_a_problem(self) -> None:
        d = rof.derive("engagement", {"views_total": 1400, "views_14d": 90, "enquiries": 14, "viewings_booked": 5}, 70)
        self.assertEqual(d["average_views_per_fortnight"], 280)
        self.assertEqual(d["last_14_days_vs_average_pct"], -68)
        self.assertEqual(d["enquiries_per_100_views"], 1.0)
        self.assertEqual(d["enquiries_that_became_viewings_pct"], 35.7)
        self.assertEqual(d["_forced_verdict"], "problem")

    def test_steady_views_leave_the_verdict_to_the_writer(self) -> None:
        d = rof.derive("engagement", {"views_total": 1400, "views_14d": 300, "enquiries": 14, "viewings_booked": 5}, 70)
        self.assertEqual(d["views_trend"], "holding up")
        self.assertIsNone(d["_forced_verdict"])

    def test_many_viewings_and_no_offer_is_a_problem(self) -> None:
        d = rof.derive("viewing_conversion", {"viewings": 9, "second_viewings": 1, "offers": 0}, 70)
        self.assertEqual(d["second_viewing_rate_pct"], 11.1)
        self.assertEqual(d["_forced_verdict"], "problem")
        self.assertIsNone(rof.derive("viewing_conversion", {"viewings": 3, "offers": 0}, 70)["_forced_verdict"])

    def test_worked_out_percentages_are_trusted(self) -> None:
        d = rof.derive("engagement", {"views_total": 1400, "views_14d": 90, "enquiries": 14, "viewings_booked": 5}, 70)
        extra = rof.trusted_additions({}, d)
        self.assertIn(68.0, extra["percents"])
        self.assertIn(35.7, extra["percents"])
        self.assertEqual(extra["days"], [14])


class ApplyTests(unittest.TestCase):
    def _apply(self, report, answer, key="engagement", figures=None, **extra):
        prospect = _prospect(report, **extra)
        prompts = []

        async def fake_ask(prompt, **kwargs):
            prompts.append(prompt)
            return answer

        async def same(report, **kwargs):
            return report

        from app.services import report_tone, report_writer
        with mock.patch.object(report_writer, "_ask", fake_ask), mock.patch.object(report_tone, "fix_report_tone", same):
            factor = asyncio.run(rof.apply_owner_figures(
                prospect, key, figures or {"views_total": 1400, "views_14d": 90, "enquiries": 14, "viewings_booked": 5}))
        return prospect, factor, prompts

    ANSWER = {"verdict": "working_well", "severity": None,
              "found": "Your listing has had 1,400 views, but only 90 in the last 14 days, 68% below its own average.",
              "why": "Buyers have stopped finding it.", "action": "Change the lead photo and move to the next search step."}

    def test_the_factor_is_rewritten_with_a_real_verdict(self) -> None:
        prospect, factor, prompts = self._apply(_report(), self.ANSWER)
        self.assertEqual(factor["verdict"], "problem")  # falling views settle it, whatever the writer said
        self.assertEqual(factor["severity"], 3)
        self.assertIn("1,400 views", factor["found"])
        self.assertIn("updated_at", factor["owner_figures"])
        saved = json.loads(prospect.report_json)
        stored = next(f for f in saved["factors"] if f["key"] == "engagement")
        self.assertEqual(stored["found"], factor["found"])
        self.assertEqual(saved["_owner_figures"]["engagement"]["figures"]["views_total"], 1400)
        self.assertIn(68.0, saved["_trusted"]["percents"])
        self.assertIn(5.6, saved["_trusted"]["percents"])  # the report's own figures stay trusted
        # The writer is told the verdict and is no longer allowed "check with your agent".
        self.assertIn("[verdict: problem]", prompts[0])
        self.assertIn('never "check_with_agent"', prompts[0])
        self.assertIn('"views_total": 1400', prompts[0])

    def test_an_ops_edit_is_the_report_updated(self) -> None:
        edited = _report(executive_summary="Edited by the team.")
        prospect, _, _ = self._apply(_report(), self.ANSWER, agent_edited_report_json=json.dumps(edited))
        self.assertIn("_owner_figures", json.loads(prospect.agent_edited_report_json))
        self.assertNotIn("_owner_figures", json.loads(prospect.report_json))

    def test_an_empty_answer_changes_nothing(self) -> None:
        with self.assertRaises(rof.FiguresError):
            self._apply(_report(), {})

    def test_rewrites_are_limited_each_day(self) -> None:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        report = _report(_owner_figures={"engagement": {"runs": [now] * rof.RUNS_PER_DAY}})
        with self.assertRaises(rof.TooManyRuns):
            self._apply(report, self.ANSWER)

    def test_a_rebuild_keeps_the_rewritten_factor(self) -> None:
        prospect, factor, _ = self._apply(_report(), self.ANSWER)
        old = json.loads(prospect.report_json)
        rebuilt = rof.carry_over(old, _report())
        again = next(f for f in rebuilt["factors"] if f["key"] == "engagement")
        self.assertEqual(again["found"], factor["found"])
        self.assertEqual(again["verdict"], "problem")
        self.assertIn(68.0, rebuilt["_trusted"]["percents"])
        self.assertEqual(rof.figures_for_page(rebuilt)["engagement"]["views_total"], 1400)


class ReportPdfTests(unittest.TestCase):
    def test_the_20_factor_report_builds_as_a_pdf(self) -> None:
        from pypdf import PdfReader

        from app.services import report_v2_pdf
        from app.services import stale_prospect_service as sps

        report = _report(overall_score=48, executive_summary="Your property has been advertised for 70 days.",
                         top_actions=[{"title": "Move to £425,000", "detail": "Do it with the new photos."}],
                         competition={"for_sale_now": 4, "listings": [{"address": "Oak Road", "price": 440000}]})
        report["factors"][1]["owner_figures"] = {"updated_at": "2026-11-03T10:00:00+00:00"}
        prospect = _prospect(report, property_address="1 Test Road, Leeds", postcode="LS6 2AB", property_code="9998",
                             property_type="Semi-detached")
        sales = [{"address": "3 Test Road, Leeds", "property_type": "Semi", "sold_price": 410000, "sold_date": "2026-02-01"}]
        with mock.patch.object(sps, "report_comparable_rows", return_value=sales):
            path = report_v2_pdf.generate_v2_report_pdf(prospect)
        text = " ".join(p.extract_text() for p in PdfReader(path).pages)
        for expected in ("FULL PROPERTY ASSESSMENT", "Executive summary", "Your three most important actions",
                         "Sold nearby", "For sale now", "Your 30-day plan", "All 20 factors", "Seller Net Proceeds",
                         "Sharing this report with your agent", "Relaunch Strategy", "Updated from your agent"):
            self.assertIn(expected, text, expected)
        Path(path).unlink(missing_ok=True)

    def test_score_bars_match_the_page(self) -> None:
        from app.services import report_v2_pdf

        factors = [{"key": "photography", "verdict": "problem", "severity": 5},
                   {"key": "description", "verdict": "working_well"}, {"key": "floor_plan", "verdict": "check_with_agent"}]
        self.assertEqual(report_v2_pdf.scores_from_factors(factors)["listing_presentation"], round((20 + 85 + 60) / 3))


if __name__ == "__main__":
    unittest.main()
