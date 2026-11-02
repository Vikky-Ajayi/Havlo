"""The 20-factor rollout migration: which reports it rewrites and which it
leaves alone (paid, analyst-edited, already on the new report)."""
from __future__ import annotations

import json
import types
import unittest

from app.services import report_factors as rf
from app.services import report_v2_migration as mig
from app.services import report_writer as rw


def _prospect(*, report, paid=False, edited=False, audience="owner"):
    return types.SimpleNamespace(
        payment_status="completed" if paid else "pending",
        agent_edited_report_json=json.dumps({"x": 1}) if edited else None,
        audience=audience,
        report_json=json.dumps(report) if report is not None else None)


def _old_report():
    return {"overall_score": 40, "key_findings": [{"title": "t", "type": "issue", "description": "d"}]}


def _v2_report():
    return {"version": rw.REPORT_VERSION, "overall_score": 44,
            "factors": [{"key": f["key"], "num": f["num"], "name": f["name"], "verdict": "working_well"} for f in rf.FACTORS]}


class NeedsMigrationTests(unittest.TestCase):
    def test_old_unpaid_report_is_migrated(self):
        self.assertTrue(mig._needs_migration(_prospect(report=_old_report())))

    def test_agent_old_unpaid_report_is_migrated(self):
        self.assertTrue(mig._needs_migration(_prospect(report=_old_report(), audience="agent")))

    def test_already_v2_is_skipped(self):
        self.assertFalse(mig._needs_migration(_prospect(report=_v2_report())))

    def test_paid_is_skipped(self):
        self.assertFalse(mig._needs_migration(_prospect(report=_old_report(), paid=True)))

    def test_analyst_edited_is_skipped(self):
        self.assertFalse(mig._needs_migration(_prospect(report=_old_report(), edited=True)))

    def test_no_report_is_skipped(self):
        self.assertFalse(mig._needs_migration(_prospect(report=None)))


if __name__ == "__main__":
    unittest.main()
