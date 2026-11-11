"""A full paid report written ahead of payment (console "write-full-report")
stays locked: the free preview is unchanged, and paying opens it at once."""
from __future__ import annotations

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest import mock

from app.services import report_factors as rf
from app.services import report_writer
from app.services import stale_prospect_service as sps


def _report(text: str, **extra):
    factors = [{"num": f["num"], "key": f["key"], "name": f["name"], "verdict": "working_well",
                "found": f"{text} {f['key']}", "why": "w", "action": "a"} for f in rf.FACTORS]
    return {"version": 2, "factors": factors, "executive_summary": f"{text} summary", **extra}


class LockedPaidReportTests(unittest.TestCase):
    def test_paying_opens_the_report_written_ahead_without_writing_again(self):
        paid = _report("PAID", _expanded=True)
        free = _report("FREE", **{sps.PAID_READY_KEY: paid})
        prospect = SimpleNamespace(report_json=json.dumps(free))
        writer = mock.AsyncMock()
        with mock.patch.object(report_writer, "write_paid_report", writer):
            got = asyncio.run(sps.ensure_expanded_v2_report(prospect, free))
        writer.assert_not_awaited()
        self.assertTrue(got["_expanded"])
        stored = json.loads(prospect.report_json)
        self.assertEqual(stored["executive_summary"], "PAID summary")
        self.assertNotIn(sps.PAID_READY_KEY, stored)

    def test_the_free_preview_still_comes_from_the_free_report(self):
        free = _report("FREE", **{sps.PAID_READY_KEY: _report("PAID", _expanded=True)})
        preview = report_writer.v2_preview(free)
        shown = json.dumps(preview)
        self.assertIn("FREE", shown)
        self.assertNotIn("PAID", shown)

    def test_a_half_written_paid_report_is_not_used(self):
        free = _report("FREE", **{sps.PAID_READY_KEY: {"version": 2}})  # not expanded
        prospect = SimpleNamespace(report_json=json.dumps(free), listing_snapshot_json="{}")
        with mock.patch.object(sps, "refresh_sold_comparables", mock.AsyncMock(side_effect=RuntimeError("would write"))):
            with self.assertRaises(RuntimeError):
                asyncio.run(sps.ensure_expanded_v2_report(prospect, free))


if __name__ == "__main__":
    unittest.main()
