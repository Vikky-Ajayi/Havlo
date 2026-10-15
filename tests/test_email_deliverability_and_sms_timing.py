"""Marketing emails carry one-click unsubscribe headers; the abandonment
text series starts straight away (day 0)."""
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
    def test_first_text_is_immediate(self):
        days = twilio_service.SMS_ABANDONMENT_STAGE_DAYS
        self.assertEqual(days[0], 0)
        self.assertNotIn(1, days)
        self.assertEqual(days[1], 4)
        self.assertEqual(days[-1], 91)
        self.assertEqual(len(days), 31)


if __name__ == "__main__":
    unittest.main()
