"""Report pricing (0.025% of the asking price, £99 to £498), the Google-ads
analyst-review funnel's 48-hour hold, and the Follow Up console's funnel stages."""
from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.routers.stale_listings import _prospect_funnel_status
from app.services import analyst_review, email_service
from app.services.stale_prospect_service import prospect_unlock_price, serialize_preview

T0 = datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc)


def prospect(**fields):
    base = dict(
        id=uuid4(), lead_source=None, payment_status="pending", unlocked_at=None,
        analyst_review_due_at=None, report_released_at=None, report_ready_emailed_at=None,
        checkout_visited_at=None, contact_details_submitted_at=None, qr_token_hashes=[], audience="owner",
    )
    base.update(fields)
    return SimpleNamespace(**base)


class PricingTests(unittest.TestCase):
    def test_minimum_below_396k(self):
        self.assertEqual(prospect_unlock_price(250_000), 99.0)  # 0.025% would be £62.50
        self.assertEqual(prospect_unlock_price(396_000), 99.0)

    def test_in_between_rounds_to_the_pound(self):
        self.assertEqual(prospect_unlock_price(600_000), 150.0)
        self.assertEqual(prospect_unlock_price(1_200_000), 300.0)
        self.assertEqual(prospect_unlock_price(437_500), 109.0)  # 109.375
        self.assertEqual(prospect_unlock_price(438_000), 110.0)  # 109.5 rounds up, as Math.round does

    def test_maximum_from_1_992_000(self):
        self.assertEqual(prospect_unlock_price(1_992_000), 498.0)
        self.assertEqual(prospect_unlock_price(1_995_000), 498.0)
        self.assertEqual(prospect_unlock_price(25_000_000), 498.0)

    def test_unknown_price_is_the_minimum(self):
        for value in (None, 0, -5, float("nan"), "not a price"):
            self.assertEqual(prospect_unlock_price(value), 99.0, value)

    def test_same_for_agents(self):
        self.assertEqual(prospect_unlock_price(800_000, "agent"), prospect_unlock_price(800_000, "owner"))

    def test_email_price_format(self):
        self.assertEqual(email_service._stale_abandonment_format_price(99.0), "£99")
        self.assertEqual(email_service._stale_abandonment_format_price(498.0), "£498")
        self.assertEqual(email_service._stale_abandonment_format_price(49.99), "£49.99")


class AnalystReviewTests(unittest.TestCase):
    def test_review_purchase_is_held_48_hours(self):
        for source in ("review_seller", "review_agent"):
            p = prospect(lead_source=source)
            analyst_review.mark_paid(p, T0)
            self.assertEqual(p.payment_status, "completed")
            self.assertEqual(p.unlocked_at, T0)
            self.assertEqual(p.analyst_review_due_at, T0 + timedelta(hours=48))
            self.assertTrue(analyst_review.report_on_hold(p))
            self.assertFalse(analyst_review.report_available(p))

    def test_other_funnels_unlock_on_payment(self):
        for source in (None, "meta_seller", "meta_agent", "google_seller", "google_agent", "review_agent_listing"):
            p = prospect(lead_source=source)
            analyst_review.mark_paid(p, T0)
            self.assertIsNone(p.analyst_review_due_at, source)
            self.assertFalse(analyst_review.report_on_hold(p))
            self.assertTrue(analyst_review.report_available(p))

    def test_release_opens_it_once(self):
        p = prospect(lead_source="review_seller")
        analyst_review.mark_paid(p, T0)
        later = T0 + timedelta(hours=3)
        self.assertTrue(analyst_review.release(p, later))
        self.assertEqual(p.report_released_at, later)
        self.assertTrue(analyst_review.report_available(p))
        self.assertFalse(analyst_review.release(p, later + timedelta(hours=1)))
        self.assertEqual(p.report_released_at, later)

    def test_paying_again_does_not_hold_a_released_report(self):
        p = prospect(lead_source="review_seller")
        analyst_review.mark_paid(p, T0)
        analyst_review.release(p, T0 + timedelta(hours=48))
        analyst_review.mark_paid(p, T0 + timedelta(days=3))
        self.assertFalse(analyst_review.report_on_hold(p))

    def test_purchase_started_at_is_the_release_when_reviewed(self):
        p = prospect(lead_source="review_seller")
        analyst_review.mark_paid(p, T0)
        self.assertEqual(analyst_review.purchase_started_at(p), T0)
        analyst_review.release(p, T0 + timedelta(hours=48))
        self.assertEqual(analyst_review.purchase_started_at(p), T0 + timedelta(hours=48))
        naive = prospect(unlocked_at=datetime(2026, 10, 1, 9, 0))
        self.assertEqual(analyst_review.purchase_started_at(naive).tzinfo, timezone.utc)

    def test_report_link_token_is_stable_and_added_once(self):
        p = prospect(lead_source="review_agent", audience="agent")
        first = analyst_review.report_url(p)
        second = analyst_review.report_url(p)
        self.assertEqual(first, second)
        self.assertIn("/review/agent?token=", first)
        self.assertEqual(len(p.qr_token_hashes), 1)
        owner = prospect(lead_source="review_seller")
        self.assertIn("/review/seller?token=", analyst_review.report_url(owner))

    def test_preview_says_when_the_report_is_held(self):
        p = prospect(
            lead_source="review_seller", property_code="1234", property_address="1 High St, Lincoln, LN1 2BJ",
            postcode=None, rightmove_url="https://www.rightmove.co.uk/properties/1", asking_price=1_995_000,
            listing_duration_days=204, bedrooms=7, bathrooms=6, listing_snapshot_json="{}", listed_date=None,
            created_at=T0, preview_json="{}", property_confirmed_at=None, contact_email="a@b.co",
            sumup_checkout_id=None, bank_transfer_reference=None,
        )
        analyst_review.mark_paid(p, T0)
        data = serialize_preview(p)
        self.assertTrue(data["is_unlocked"])
        self.assertTrue(data["report_on_hold"])
        self.assertEqual(data["unlock_price"], 498.0)
        self.assertEqual(data["analyst_review_due_at"], (T0 + timedelta(hours=48)).isoformat())


class FunnelStageTests(unittest.TestCase):
    def test_stages(self):
        self.assertEqual(_prospect_funnel_status(prospect()), "looked_up")
        self.assertEqual(_prospect_funnel_status(prospect(contact_details_submitted_at=T0)), "details_submitted")
        self.assertEqual(
            _prospect_funnel_status(prospect(contact_details_submitted_at=T0, checkout_visited_at=T0)),
            "reached_checkout",
        )
        self.assertEqual(
            _prospect_funnel_status(prospect(checkout_visited_at=T0, payment_status="completed")), "paid"
        )


class ReportReadyEmailTests(unittest.TestCase):
    def test_email_content(self):
        captured = {}
        original = email_service._send_sync
        email_service._send_sync = lambda **kw: captured.update(kw) or True
        try:
            ok = email_service.send_analyst_report_ready_email_sync(
                to_email="a@b.co", first_name="Jane", property_address="7 The Fairways, Lincoln, LN1 2BJ",
                report_url="https://heyhavlo.com/review/seller?token=abc", unsubscribe_url="https://x/u",
            )
        finally:
            email_service._send_sync = original
        self.assertTrue(ok)
        self.assertEqual(captured["to_email"], "a@b.co")
        self.assertIn("report is ready", captured["subject"])
        self.assertIn("https://heyhavlo.com/review/seller?token=abc", captured["html_body"])
        self.assertIn("7 The Fairways", captured["plain_body"])



class ChannelTests(unittest.TestCase):
    def test_review_is_its_own_channel(self):
        from app.services import ads_funnel, ads_nurture
        self.assertEqual(ads_funnel.channel_of("review_seller"), "review")
        self.assertEqual(ads_funnel.channel_of("google_agent"), "google")
        self.assertEqual(ads_funnel.channel_of("meta_seller"), "meta")
        self.assertEqual(ads_funnel.channel_of(None), "meta")
        self.assertEqual(ads_funnel.seller_source("review"), "review_seller")
        self.assertEqual(ads_nurture.landing_path("review", "owner"), "/review/seller")
        self.assertEqual(ads_nurture.landing_path("google", "agent"), "/g/agent")



class ReviewSellerStaleListingsFlowTests(unittest.TestCase):
    """The analyst-review funnel's homeowners get the Stale Listings email and
    text flows, with every link back to /review/seller."""

    def _capture(self, fn, **kw):
        captured = {}
        original = email_service._send_sync
        email_service._send_sync = lambda **k: captured.update(k) or True
        try:
            fn(**kw)
        finally:
            email_service._send_sync = original
        return captured

    def test_funnel_path(self):
        self.assertEqual(analyst_review.funnel_path(prospect(lead_source="review_seller")), "/review/seller")
        for source in (None, "meta_seller", "google_seller"):
            self.assertEqual(analyst_review.funnel_path(prospect(lead_source=source)), "/stale-listings/prospect")

    def test_pre_purchase_email_links_to_review_page(self):
        sent = self._capture(
            email_service.send_stale_prospect_abandonment_email_sync,
            to_email="a@b.co", first_name="Jane", stage=1, asking_price=600_000, property_code="4822",
            unsubscribe_url="https://x/u", frontend_base_url="https://www.heyhavlo.com", landing_path="/review/seller",
        )
        self.assertIn("https://www.heyhavlo.com/review/seller?code=4822", sent["html_body"])

    def test_pre_purchase_email_default_link_unchanged(self):
        sent = self._capture(
            email_service.send_stale_prospect_abandonment_email_sync,
            to_email="a@b.co", first_name="Jane", stage=1, asking_price=600_000, property_code="4822",
            unsubscribe_url="https://x/u", frontend_base_url="https://www.heyhavlo.com",
        )
        self.assertIn("https://www.heyhavlo.com/stale-listings/prospect?code=4822", sent["html_body"])

    def test_post_purchase_email_links_to_review_page(self):
        sent = self._capture(
            email_service.send_stale_prospect_post_purchase_email_sync,
            to_email="a@b.co", first_name="Jane", stage=2, asking_price=600_000, property_code="4822",
            unsubscribe_url="https://x/u", frontend_base_url="https://www.heyhavlo.com", report_path="/review/seller",
        )
        self.assertIn("https://www.heyhavlo.com/review/seller?code=4822", sent["html_body"])


if __name__ == "__main__":
    unittest.main()
