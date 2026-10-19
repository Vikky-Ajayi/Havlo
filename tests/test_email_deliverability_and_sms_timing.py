"""Marketing emails carry one-click unsubscribe headers; the abandonment
text series starts straight away (day 0) and goes every 2 days."""
from __future__ import annotations

import sys
import types
import unittest
from unittest import mock

from app.services import email_service, twilio_service


class ListUnsubscribeHeaderTests(unittest.TestCase):
    def send(self, **kwargs):
        sent = {}
        fake_resend = types.SimpleNamespace(api_key=None, Emails=types.SimpleNamespace(send=lambda p: sent.update(p) or {"id": "x"}))
        settings = types.SimpleNamespace(
            RESEND_API_KEY="re_test", EMAIL_FROM="hello@heyhavlo.com", EMAIL_FROM_NAME="Havlo", EMAIL_REPLY_TO="",
        )
        with mock.patch.dict(sys.modules, {"resend": fake_resend}), \
                mock.patch.object(email_service, "get_settings", return_value=settings), \
                mock.patch.object(email_service, "_is_configured", return_value=True):
            self.assertTrue(email_service._send_sync(
                to_email="a@b.co", subject="s", html_body="<p>h</p>", plain_body="p", **kwargs
            ))
        return sent

    def test_marketing_email_has_one_click_unsubscribe(self):
        url = "https://www.heyhavlo.com/api/v1/stale-listings/prospects/unsubscribe?prospect_id=1&token=t"
        sent = self.send(unsubscribe_url=url)
        self.assertEqual(sent["headers"]["List-Unsubscribe"], f"<{url}>")
        self.assertEqual(sent["headers"]["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")

    def test_transactional_email_has_no_unsubscribe_header(self):
        self.assertNotIn("headers", self.send())


class AbandonmentSmsTimingTests(unittest.TestCase):
    def test_first_text_is_immediate_then_every_two_days(self):
        days = twilio_service.SMS_ABANDONMENT_STAGE_DAYS
        self.assertEqual(days[0], 0)
        self.assertEqual(list(days[:4]), [0, 2, 4, 6])
        self.assertEqual(days[-1], 60)
        self.assertEqual(len(days), len(twilio_service.SMS_ABANDONMENT_MESSAGES))
        self.assertEqual(len(days), 31)

    def test_new_prospects_are_on_the_two_day_series(self):
        schedule = twilio_service.sms_abandonment_schedule
        self.assertEqual(schedule(set()), twilio_service.SMS_ABANDONMENT_STAGE_DAYS)
        self.assertEqual(schedule({0}), twilio_service.SMS_ABANDONMENT_STAGE_DAYS)
        self.assertEqual(schedule({0, 2, 4}), twilio_service.SMS_ABANDONMENT_STAGE_DAYS)

    def test_prospects_part_way_through_the_old_series_finish_it(self):
        schedule = twilio_service.sms_abandonment_schedule
        legacy = twilio_service.LEGACY_SMS_ABANDONMENT_STAGE_DAYS
        self.assertEqual(list(legacy[:4]), [0, 4, 7, 10])
        self.assertEqual(legacy[-1], 91)
        self.assertEqual(len(legacy), 31)
        self.assertEqual(schedule({1}), legacy)
        self.assertEqual(schedule({0, 1, 4}), legacy)
        self.assertEqual(schedule({0, 4}), legacy)
        self.assertEqual(schedule({0, 4, 7, 10}), legacy)

    def test_message_is_picked_by_position(self):
        sent = {}
        with mock.patch.object(twilio_service, "_send_sms", lambda to, body, **kw: sent.update(body=body) or True):
            self.assertTrue(twilio_service.send_stale_prospect_abandonment_sms("+447700900000", 1, "https://x/l", "https://x/u"))
        self.assertTrue(sent["body"].startswith("What if the reason your property"))
        self.assertIn("https://x/l", sent["body"])
        self.assertTrue(sent["body"].endswith("Unsubscribe: https://x/u"))
        self.assertFalse(twilio_service.send_stale_prospect_abandonment_sms("+447700900000", 31, "l", "u"))


if __name__ == "__main__":
    unittest.main()
