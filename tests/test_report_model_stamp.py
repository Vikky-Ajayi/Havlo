"""20-factor reports record which model wrote them, and the errors when
OpenAI failed, so a fallback or failed write shows in the data."""
from __future__ import annotations

import asyncio
import unittest
from unittest import mock

from app.services import groq_service
from app.services import stale_prospect_service as sps


def _run(calls_made):
    async def fake(*args, **kwargs):
        calls = groq_service.REPORT_CALLS.get()
        calls.extend(calls_made)
        return {"factors": []}

    with mock.patch.object(sps, "_generate_v2_report", fake):
        return asyncio.run(sps.generate_v2_report(
            "1 Test Road", "https://example.com", {}, asking_price=1, listing_duration_days=1, country="UK",
            sold_comparables=None))


class ModelStampTests(unittest.TestCase):
    def test_a_normal_write_records_its_model(self):
        report = _run([{"provider": "openai", "model": "gpt-6.1-terra"}])
        self.assertEqual(report["_model"], "openai:gpt-6.1-terra")
        self.assertNotIn("_model_errors", report)

    def test_a_groq_fallback_is_flagged_with_the_openai_error(self):
        report = _run([{"provider": "openai", "model": "gpt-6.1-terra", "error": "RuntimeError: OpenAI returned 429"},
                       {"provider": "groq", "model": "llama"}])
        self.assertEqual(report["_model"], "groq:llama")
        self.assertTrue(report["_model_fallback"])
        self.assertEqual(report["_model_errors"], ["RuntimeError: OpenAI returned 429"])

    def test_a_write_that_failed_entirely_keeps_the_errors(self):
        report = _run([{"provider": "openai", "model": "x", "error": "boom"}] * 2)
        self.assertNotIn("_model", report)
        self.assertEqual(report["_model_errors"], ["boom"])

    def test_the_context_is_left_clean(self):
        _run([])
        self.assertIsNone(groq_service.REPORT_CALLS.get())


if __name__ == "__main__":
    unittest.main()
