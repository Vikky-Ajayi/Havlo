"""UTM tags (app/services/attribution.py): tagging the funnel's email and text
links, saving where a lead and a sale came from, and keeping test orders out
of the purchase events."""
from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest import mock

from app.services import attribution as at
from app.services import email_service, twilio_service

SITE = "https://www.heyhavlo.com"


class TagTests(unittest.TestCase):
    def test_site_links_get_tags_and_keep_their_query_and_fragment(self):
        url = at.tag_url(f"{SITE}/assess/complete?token=abc#top", source="email", campaign="abandonment",
                         content="stage_3")
        self.assertEqual(url, f"{SITE}/assess/complete?token=abc&utm_source=email&utm_medium=email"
                              "&utm_campaign=abandonment&utm_content=stage_3#top")

    def test_other_links_are_left_alone(self):
        for url in ("https://www.instagram.com/havlo", f"{SITE}/stale-listings/unsubscribe?x=1",
                    f"{SITE}/sms/opt-out?t=1", f"{SITE}/sell?utm_source=facebook"):
            self.assertEqual(at.tag_url(url, source="email", campaign="x"), url)

    def test_html_and_text(self):
        html = f'<a href="{SITE}/m/tok?a=1&amp;b=2">Open</a> <a href="mailto:hi@x.com">Mail</a>'
        tagged = at.tag_html(html, campaign="post_purchase", content="stage_1")
        self.assertIn('href="https://www.heyhavlo.com/m/tok?a=1&amp;b=2&amp;utm_source=email', tagged)
        self.assertIn('href="mailto:hi@x.com"', tagged)
        text = at.tag_text(f"See it: {SITE}/m/tok. Opt out: {SITE}/sms/opt-out?t=1",
                           source="sms", campaign="dashboard")
        self.assertIn(f"{SITE}/m/tok?utm_source=sms&utm_medium=sms&utm_campaign=dashboard.", text)
        self.assertIn(f"Opt out: {SITE}/sms/opt-out?t=1", text)

    def test_the_email_flows_send_tagged_links(self):
        with mock.patch.object(email_service, "_is_configured", return_value=True), \
                mock.patch("resend.Emails.send", return_value={"id": "1"}) as send:
            email_service.send_ads_flow_email_sync(
                to_email="a@b.com", first_name="Sam", subject="S", preheader="P", paragraphs=["Hi"],
                cta_label="Go", cta_url=f"{SITE}/assess/seller?token=t", unsubscribe_url=f"{SITE}/unsubscribe?x=1",
                utm_campaign="ads_vendor_main", utm_content="stage_2")
        params = send.call_args[0][0]
        self.assertIn("utm_campaign=ads_vendor_main", params["html"])
        self.assertIn("utm_content=stage_2", params["text"])
        self.assertNotIn("unsubscribe?x=1&", params["text"])

    def test_the_texts_send_tagged_links(self):
        with mock.patch.object(twilio_service, "_send_sms", return_value="ok") as send:
            twilio_service.send_monitor_dashboard_sms("+447700900000", address="1 Road", link=f"{SITE}/m/tok", days=30)
        self.assertIn("/m/tok?utm_source=sms&utm_medium=sms&utm_campaign=dashboard", send.call_args[0][1])


class RecordTests(unittest.TestCase):
    def test_the_lead_keeps_its_first_source_and_the_sale_its_latest(self):
        p = SimpleNamespace(lead_utm_json=None, purchase_utm_json=None)
        ad = {"last": {"source": "facebook", "medium": "paid_social", "campaign": "nov", "landing": "/sell?token=x"}}
        email = {"first": ad["last"], "last": {"source": "email", "medium": "email", "campaign": "abandonment",
                                              "content": "stage_2"}}
        self.assertTrue(at.record_lead(p, ad))
        self.assertFalse(at.record_lead(p, email))  # the visit that brought them in stays
        self.assertTrue(at.record_purchase(p, email))
        out = at.summary(p)
        self.assertEqual(out["lead"]["label"], "Meta ads")
        self.assertEqual(out["purchase"]["label"], "Email")
        self.assertEqual(out["purchase"]["first_label"], "Meta ads")
        self.assertEqual(json.loads(p.lead_utm_json)["last"]["landing"], "/sell")  # no token kept

    def test_nothing_to_record(self):
        p = SimpleNamespace(lead_utm_json=None)
        self.assertFalse(at.record_lead(p, None))
        self.assertFalse(at.record_lead(p, {"last": {"junk": 1}}))

    def test_labels(self):
        self.assertEqual(at.source_label({"source": "sms"}), "SMS")
        self.assertEqual(at.source_label({"source": "mailchimp"}), "Email")
        self.assertEqual(at.source_label({"source": "ig"}), "Meta ads")
        self.assertEqual(at.source_label({"gclid": True}), "Google ads")
        self.assertEqual(at.source_label({"source": "newsletter"}), "newsletter")


class TestOrderTests(unittest.TestCase):
    def prospect(self, **kw):
        base = dict(payment_status="completed", payment_method="card", contact_email="jane@example.com")
        return SimpleNamespace(**{**base, **kw})

    def test_a_card_sale_counts(self):
        self.assertTrue(at.count_as_sale(self.prospect()))

    def test_promo_unlocks_and_internal_addresses_never_count(self):
        self.assertFalse(at.count_as_sale(self.prospect(payment_method="promo")))
        with mock.patch.object(at, "get_settings", return_value=SimpleNamespace(
                TEST_ORDER_EMAILS="@heyhavlo.com, tester@gmail.com", FRONTEND_URL="")):
            self.assertFalse(at.count_as_sale(self.prospect(contact_email="ops@heyhavlo.com")))
            self.assertFalse(at.count_as_sale(self.prospect(contact_email="Tester@gmail.com")))
            self.assertTrue(at.count_as_sale(self.prospect()))

    def test_unpaid_never_counts(self):
        self.assertFalse(at.count_as_sale(self.prospect(payment_status="pending")))
        self.assertFalse(at.count_as_sale(self.prospect(payment_method="bank_transfer")))


if __name__ == "__main__":
    unittest.main()
