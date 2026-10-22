"""The abandonment texts stop for numbers that can't receive them, and
carry short links (heyhavlo.com/a/<code>, heyhavlo.com/u/<code>)."""
from __future__ import annotations

import types
import unittest
from unittest import mock

from app.services import stale_prospect_abandonment as spa
from app.services import twilio_service


class NumberCheckTests(unittest.TestCase):
    def test_real_mobiles_are_fine(self):
        for number in ("+447911123456", "+447981234567", "+2348031234567", "+353871234567"):
            self.assertIsNone(twilio_service.sms_number_problem(number), number)

    def test_numbers_that_cant_be_texted(self):
        cases = {
            "+447700900123": "not a valid phone number",  # Ofcom drama range
            "+44791112345": "not a valid phone number",  # too short
            "+442071234567": "can't receive texts (landline or similar)",
            "+447000000000": "can't receive texts (landline or similar)",  # 070 personal number
            "+447123456789": "looks like a made-up number",
            "+447777777777": "looks like a made-up number",
            "07911123456": "not a valid phone number",  # not E.164
            "": "not a valid phone number",
        }
        for number, reason in cases.items():
            self.assertEqual(twilio_service.sms_number_problem(number), reason, number)


def msg(status, error_code=None):
    return types.SimpleNamespace(status=status, error_code=error_code)


class LastFailureTests(unittest.TestCase):
    def check(self, messages):
        client = types.SimpleNamespace(messages=types.SimpleNamespace(list=lambda **kw: messages))
        settings = types.SimpleNamespace(TWILIO_ACCOUNT_SID="AC", TWILIO_AUTH_TOKEN="t")
        with mock.patch.object(twilio_service, "_get_client", return_value=client), \
                mock.patch.object(twilio_service, "get_settings", return_value=settings):
            return twilio_service.last_sms_failure("+447911123456")

    def test_permanent_failure_stops(self):
        self.assertEqual(self.check([msg("undelivered", 30003), msg("delivered")]), "phone unreachable (Twilio 30003)")
        self.assertEqual(self.check([msg("failed", 21610)]), "replied STOP (Twilio 21610)")

    def test_two_failures_in_a_row_stop(self):
        self.assertEqual(self.check([msg("undelivered", 30008), msg("failed", 30008)]), "last two texts failed")

    def test_otherwise_keeps_sending(self):
        self.assertIsNone(self.check([]))
        self.assertIsNone(self.check([msg("delivered"), msg("undelivered", 30003)]))
        self.assertIsNone(self.check([msg("undelivered", 30008), msg("delivered")]))
        self.assertIsNone(self.check([msg("sent")]))

    def test_lookup_errors_never_block_a_send(self):
        def boom(**kw):
            raise RuntimeError("Twilio down")
        client = types.SimpleNamespace(messages=types.SimpleNamespace(list=boom))
        settings = types.SimpleNamespace(TWILIO_ACCOUNT_SID="AC", TWILIO_AUTH_TOKEN="t")
        with mock.patch.object(twilio_service, "_get_client", return_value=client), \
                mock.patch.object(twilio_service, "get_settings", return_value=settings):
            self.assertIsNone(twilio_service.last_sms_failure("+447911123456"))


class ShortLinkTests(unittest.TestCase):
    def links(self, frontend_url):
        settings = types.SimpleNamespace(FRONTEND_URL=frontend_url)
        with mock.patch.object(spa, "get_settings", return_value=settings):
            return spa.build_sms_assessment_url("8754"), spa.build_sms_unsubscribe_url("8754")

    def test_links_are_short(self):
        self.assertEqual(self.links("https://www.heyhavlo.com"), ("heyhavlo.com/a/8754", "heyhavlo.com/u/8754"))
        self.assertEqual(self.links("http://localhost:5173"), ("heyhavlo.com/a/8754", "heyhavlo.com/u/8754"))

    def test_text_reads_like_the_example(self):
        sent = {}
        with mock.patch.object(twilio_service, "_send_sms", lambda to, body, **kw: sent.update(body=body) or True):
            twilio_service.send_stale_prospect_abandonment_sms("+447911123456", 0, "heyhavlo.com/a/8754", "heyhavlo.com/u/8754")
        self.assertTrue(sent["body"].endswith("See what we found: heyhavlo.com/a/8754\n\nOpt out: heyhavlo.com/u/8754"))
        self.assertNotIn("https://", sent["body"])


if __name__ == "__main__":
    unittest.main()
