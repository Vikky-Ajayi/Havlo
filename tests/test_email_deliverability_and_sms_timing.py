"""Marketing emails carry one-click unsubscribe headers; the abandonment
text series starts straight away (day 0) and goes every 2 days."""
from __future__ import annotations

import sys
import types
import unittest
from datetime import datetime, timedelta, timezone
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
    NOW = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)

    def next_text(self, sent, days_since_last=None):
        last = None if days_since_last is None else self.NOW - timedelta(days=days_since_last)
        return twilio_service.next_abandonment_sms(set(sent), last, self.NOW)

    def test_new_prospects_are_texted_on_day_0_then_every_four_days(self):
        days = twilio_service.SMS_ABANDONMENT_STAGE_DAYS
        self.assertEqual(list(days[:4]), [0, 4, 8, 12])
        self.assertEqual(days[-1], 120)
        self.assertEqual(len(days), len(twilio_service.SMS_ABANDONMENT_MESSAGES))
        self.assertEqual(len(days), 31)
        self.assertEqual(self.next_text(set()), (0, 0))           # straight away
        self.assertIsNone(self.next_text({0}, days_since_last=3.9))
        self.assertEqual(self.next_text({0}, days_since_last=4), (4, 1))
        self.assertEqual(self.next_text({0, 4}, days_since_last=4), (8, 2))

    def test_a_gap_in_sending_never_bursts(self):
        # The loop was down for 3 weeks: one text now, the next 4 days later.
        self.assertEqual(self.next_text({0, 4}, days_since_last=21), (8, 2))
        self.assertIsNone(self.next_text({0, 4, 8}, days_since_last=0))

    def test_prospects_part_way_through_the_two_day_series_move_to_every_four(self):
        # Had texts 1-4 on days 0, 2, 4, 6: text 5 comes 4 days after the last.
        self.assertIsNone(self.next_text({0, 2, 4, 6}, days_since_last=2))
        self.assertEqual(self.next_text({0, 2, 4, 6}, days_since_last=4), (10, 4))

    def test_prospects_part_way_through_the_three_day_series_move_too(self):
        self.assertEqual(self.next_text({0, 4, 7, 10}, days_since_last=4), (14, 4))
        # Its first text was day 1 then: counted as the first message, not resent.
        self.assertEqual(self.next_text({1}, days_since_last=4), (5, 1))
        self.assertEqual(self.next_text({1, 4}, days_since_last=4), (8, 2))

    def test_the_series_ends_after_31_texts(self):
        all_sent = set(twilio_service.SMS_ABANDONMENT_STAGE_DAYS)
        self.assertIsNone(self.next_text(all_sent, days_since_last=30))
        self.assertEqual(self.next_text(all_sent - {120}, days_since_last=4), (120, 30))

    def test_message_is_picked_by_position(self):
        sent = {}
        with mock.patch.object(twilio_service, "_send_sms", lambda to, body, **kw: sent.update(body=body) or True):
            self.assertTrue(twilio_service.send_stale_prospect_abandonment_sms("+447700900000", 1, "https://x/l", "https://x/u"))
        self.assertTrue(sent["body"].startswith("What if the reason your property"))
        self.assertIn("https://x/l", sent["body"])
        self.assertTrue(sent["body"].endswith("Opt out: https://x/u"))
        self.assertFalse(twilio_service.send_stale_prospect_abandonment_sms("+447700900000", 31, "l", "u"))


if __name__ == "__main__":
    unittest.main()
