"""Alert when the 4-digit owner property codes are nearly used up."""
from __future__ import annotations

import unittest
from unittest import mock

from app.services import email_service
from app.services import property_code_capacity as pcc


class AlertRuleTests(unittest.TestCase):
    def test_alerts_at_90_percent_once(self):
        self.assertFalse(pcc.should_alert(8_999, {}))
        self.assertTrue(pcc.should_alert(9_000, {}))
        self.assertFalse(pcc.should_alert(9_500, {"alerted_at": "2026-09-28T00:00:00+00:00"}))

    def test_rearms_only_after_falling_below_85_percent(self):
        alerted = {"alerted_at": "2026-09-28T00:00:00+00:00"}
        self.assertFalse(pcc.should_rearm(8_600, alerted))
        self.assertTrue(pcc.should_rearm(8_499, alerted))
        self.assertFalse(pcc.should_rearm(8_000, {}))


class AlertEmailTests(unittest.TestCase):
    def test_email_gives_usage_and_runway(self):
        with mock.patch.object(email_service, "_send_sync", return_value=True) as send:
            self.assertTrue(email_service.send_property_code_capacity_alert_sync(
                to_email="admin@example.com", used=9_012, total=10_000, per_day=180.0,
            ))
        kwargs = send.call_args.kwargs
        self.assertEqual(kwargs["subject"], "[Havlo] Property codes are 90% used")
        self.assertIn("9,012 of 10,000", kwargs["plain_body"])
        self.assertIn("about 5 days", kwargs["plain_body"])

    def test_no_runway_when_nothing_is_being_used(self):
        with mock.patch.object(email_service, "_send_sync", return_value=True) as send:
            email_service.send_property_code_capacity_alert_sync(to_email="a@example.com", used=9_100, total=10_000, per_day=0)
        self.assertIn("No new codes", send.call_args.kwargs["plain_body"])


if __name__ == "__main__":
    unittest.main()
