"""Agency follow-ups: stage timing, unsubscribe links and message content."""
from __future__ import annotations

import os
import unittest
from datetime import timedelta
from unittest import mock
from uuid import uuid4

from app.services import agent_followups as af
from app.services import email_service, twilio_service
from app.services.stale_prospect_service import (
    unsubscribe_token,
    verify_sms_unsubscribe_short_token,
    verify_unsubscribe_token,
)


class NextDueTests(unittest.TestCase):
    def test_nothing_before_the_first_delay(self):
        self.assertIsNone(af._next_due(af.EMAIL_STAGES, timedelta(minutes=59), set()))

    def test_first_stage_after_an_hour(self):
        self.assertEqual(af._next_due(af.EMAIL_STAGES, timedelta(hours=1), set()), 1)

    def test_only_the_earliest_unsent_stage(self):
        # A long outage: everything is due, but one at a time.
        self.assertEqual(af._next_due(af.EMAIL_STAGES, timedelta(days=40), {1}), 2)
        self.assertEqual(af._next_due(af.EMAIL_STAGES, timedelta(days=40), {1, 2, 3, 4, 5}), 6)

    def test_waits_for_the_next_delay(self):
        self.assertIsNone(af._next_due(af.EMAIL_STAGES, timedelta(days=2), {1, 2}))

    def test_done_after_the_last_stage(self):
        self.assertIsNone(af._next_due(af.EMAIL_STAGES, timedelta(days=90), {1, 2, 3, 4, 5, 6}))
        self.assertIsNone(af._next_due(af.SMS_STAGES, timedelta(days=90), {1, 2}))


class UnsubscribeLinkTests(unittest.TestCase):
    def test_email_link_verifies_for_its_agency_only(self):
        account_id = uuid4()
        url = af.build_email_unsubscribe_url(account_id)
        token = url.split("token=")[1]
        self.assertIn(f"account_id={account_id}", url)
        self.assertTrue(verify_unsubscribe_token(af.email_unsubscribe_key(account_id), token))
        self.assertFalse(verify_unsubscribe_token(af.email_unsubscribe_key(uuid4()), token))

    def test_agency_token_differs_from_an_owner_token_for_the_same_id(self):
        account_id = uuid4()
        self.assertNotEqual(unsubscribe_token(af.email_unsubscribe_key(account_id)), unsubscribe_token(str(account_id)))

    def test_sms_link_is_short_and_verifies(self):
        url = af.build_sms_unsubscribe_url("12345")
        self.assertRegex(url, r"/ua/12345\?t=[0-9a-f]{12}$")
        token = url.split("t=")[1]
        self.assertTrue(verify_sms_unsubscribe_short_token(af.sms_unsubscribe_key("12345"), token))
        # Not usable as an owner's /u/ link for the same digits.
        self.assertFalse(verify_sms_unsubscribe_short_token("12345", token))


class SmsFlagTests(unittest.TestCase):
    def test_follows_the_owner_sms_flag_by_default(self):
        with mock.patch.dict(os.environ, {"ENABLE_STALE_PROSPECT_ABANDONMENT_SMS": "true"}, clear=False):
            os.environ.pop("ENABLE_AGENT_FOLLOWUP_SMS", None)
            self.assertTrue(af.sms_enabled())
        with mock.patch.dict(os.environ, {"ENABLE_STALE_PROSPECT_ABANDONMENT_SMS": ""}, clear=False):
            os.environ.pop("ENABLE_AGENT_FOLLOWUP_SMS", None)
            self.assertFalse(af.sms_enabled())

    def test_own_flag_wins(self):
        with mock.patch.dict(os.environ, {"ENABLE_STALE_PROSPECT_ABANDONMENT_SMS": "true", "ENABLE_AGENT_FOLLOWUP_SMS": "false"}):
            self.assertFalse(af.sms_enabled())


class ContentTests(unittest.TestCase):
    def test_every_email_stage_renders(self):
        for stage, _ in af.EMAIL_STAGES:
            config = email_service._stale_agent_followup_content(
                stage, brand="Smith & Jones", count=7, price_text="£49.99", agent_code="12345"
            )
            self.assertTrue(config["subject"] and config["heading"] and config["cta_label"])
            self.assertNotIn("{", config["content_html"])

    def test_email_sends_with_the_links(self):
        with mock.patch.object(email_service, "_send_sync", return_value=True) as send:
            self.assertTrue(email_service.send_stale_agent_followup_email_sync(
                to_email="a@example.com", first_name="Sam", stage=4, brand="Smith & Jones",
                listing_count=7, agent_code="12345",
                portfolio_url="https://www.heyhavlo.com/check/agent?token=abc",
                unsubscribe_url="https://www.heyhavlo.com/unsub",
            ))
        kwargs = send.call_args.kwargs
        self.assertIn("check/agent?token=abc", kwargs["html_body"])
        self.assertIn("https://www.heyhavlo.com/unsub", kwargs["html_body"])
        self.assertIn("Smith &amp; Jones", kwargs["html_body"])

    def test_every_sms_stage_fits_two_segments(self):
        for stage, _ in af.SMS_STAGES:
            with mock.patch.object(twilio_service, "_send_sms", return_value=True) as send:
                twilio_service.send_stale_agent_followup_sms(
                    "+447700900000", stage, brand="Langford Russell", count=12,
                    link="https://www.heyhavlo.com/check/agent?token=" + "x" * 43,
                    unsubscribe_url=af.build_sms_unsubscribe_url("12345"),
                )
            body = send.call_args.args[1]
            self.assertIn("Unsubscribe: ", body)
            self.assertLessEqual(len(body), 306)


if __name__ == "__main__":
    unittest.main()
