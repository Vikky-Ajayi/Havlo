"""The senior-partner pass: weak factors (ones that only repeat what the seller
knows) are rewritten; verdicts never change; a rewrite that guts a factor is
refused; a failed call leaves the report as written."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from unittest import mock

from app.services import groq_service, report_editor


def _resp(payload):
    return types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content=json.dumps(payload)))])


REPORT = {"factors": [
    {"key": "time_on_market", "name": "Time on Market Analysis", "verdict": "problem",
     "found": "Your price was last reduced 118 days ago, and it's still on the market. No sale has been agreed.",
     "why": "It's been a while.", "action": "Keep going."},
    {"key": "floor_plan", "name": "Floor Plan", "verdict": "working_well",
     "found": "Your floor plan is there with room sizes.", "why": "Buyers use it.", "action": "Leave it."},
]}
BETTER = ("Your last reduction sent an alert to buyers with saved searches 118 days ago; nothing new has reached them "
          "since, so to active buyers your home has gone quiet, and the old 'Reduced on' date now invites low offers.")


class EditorTests(unittest.TestCase):
    def run_edit(self, payload=None, error=None, keys=None):
        side = RuntimeError("down") if error else None
        with mock.patch.object(groq_service, "_report_chat", side_effect=side, return_value=_resp(payload or {})):
            return asyncio.run(report_editor.edit_report(REPORT, {}, keys=keys))

    def test_a_weak_factor_is_rewritten_and_keeps_its_verdict(self):
        out = self.run_edit({"rewrites": [{"key": "time_on_market", "reason": "only repeats the date",
                                           "verdict": "working_well", "found": BETTER,
                                           "why": "Buyers read a long time unsold as a sign something's wrong.",
                                           "action": "Set one reset day: the price step, the new lead photo and the "
                                                     "corrected guide price all at once, so the alert lands on a "
                                                     "listing that looks new."}]})
        f = {x["key"]: x for x in out["factors"]}["time_on_market"]
        self.assertEqual(f["found"], BETTER)
        self.assertEqual(f["verdict"], "problem")  # never changed by the editor
        self.assertEqual(out["_edited"][0]["key"], "time_on_market")

    def test_a_rewrite_that_guts_the_text_is_refused(self):
        out = self.run_edit({"rewrites": [{"key": "time_on_market", "found": "It's slow.", "why": "x", "action": "y"}]})
        f = {x["key"]: x for x in out["factors"]}["time_on_market"]
        self.assertEqual(f["found"], REPORT["factors"][0]["found"])

    def test_only_the_chosen_keys_are_touched(self):
        out = self.run_edit({"rewrites": [{"key": "floor_plan", "found": "A long and different floor plan text "
                                                                          "that is clearly rewritten here.",
                                           "why": "Different why text.", "action": "Different action text."}]},
                            keys={"time_on_market"})
        f = {x["key"]: x for x in out["factors"]}["floor_plan"]
        self.assertEqual(f["found"], REPORT["factors"][1]["found"])

    def test_a_failed_call_leaves_the_report_as_written(self):
        self.assertIs(self.run_edit(error=True), REPORT)


if __name__ == "__main__":
    unittest.main()
