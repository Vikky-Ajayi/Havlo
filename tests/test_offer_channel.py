"""The Meta2 offer page (/offer/seller): the /sell page at a limited-time £59.
Its leads are tagged meta2_seller, pay £59 everywhere (locked onto the lead),
see £99 crossed out, and keep their whole journey under /offer/."""
from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest import mock

from app.schemas.schemas import AdsStartRequest
from app.services import ads_funnel, ads_nurture, funnel_paths
from app.services import stale_prospect_service as sps


class OfferTaggingTests(unittest.TestCase):
    def test_leads_are_tagged_meta2_not_meta(self):
        self.assertEqual(ads_funnel.seller_source("meta2"), "meta2_seller")
        self.assertEqual(ads_funnel.channel_of("meta2_seller"), "meta2")
        self.assertEqual(ads_funnel.channel_of("meta_seller"), "meta")
        self.assertEqual(ads_funnel.CHANNEL_LABELS["meta2"], "Meta2 offer page")
        self.assertIn("meta2_seller", ads_funnel.NURTURED_LEAD_SOURCES)

    def test_the_console_funnel_filter_keeps_meta2_apart(self):
        from app.routers import stale_listings

        self.assertEqual(stale_listings._funnel_of("meta2_seller"), "meta2")
        self.assertEqual(stale_listings._funnel_of("meta_seller"), "meta")
        meta = str(stale_listings._FUNNEL_SOURCE_FILTERS["meta"]().compile(compile_kwargs={"literal_binds": True}))
        self.assertIn("'meta\\_%'", meta)  # "meta_..." only: meta2_seller doesn't match it

    def test_the_start_request_accepts_meta2(self):
        self.assertEqual(AdsStartRequest(listing_url="https://www.rightmove.co.uk/properties/1", channel="meta2").channel, "meta2")

    def test_one_email_flow_linking_back_to_the_offer_page(self):
        from app.services import stale_prospect_abandonment

        self.assertIn("meta2_seller", stale_prospect_abandonment._ADS_NURTURED_SELLERS)
        self.assertEqual(ads_nurture.landing_path("meta2", "owner"), "/offer/seller")


class OfferJourneyPathsTests(unittest.TestCase):
    def test_the_whole_journey_stays_under_offer(self):
        source = "meta2_seller"
        self.assertEqual(funnel_paths.landing_path(source, "owner"), "/offer/seller")
        self.assertEqual(funnel_paths.complete_path(source), "/offer/complete")
        self.assertEqual(funnel_paths.report_path(source), "/offer/report")
        self.assertEqual(funnel_paths.next_steps_path(source), "/offer/next-steps")
        self.assertEqual(funnel_paths.dashboard_path(source, "abc"), "/offer/dashboard/abc")
        self.assertFalse(funnel_paths.is_rm_lead(source))

    def test_rightmove_and_meta_are_unchanged(self):
        self.assertEqual(funnel_paths.complete_path("rm_seller"), "/rm/complete")
        self.assertEqual(funnel_paths.landing_path("rm_agent", "agent"), "/rm/agent")
        self.assertEqual(funnel_paths.complete_path("meta_seller"), "/stale-listings/prospect/complete")
        self.assertIsNone(funnel_paths.landing_path("meta_seller", "owner"))


class OfferPriceTests(unittest.TestCase):
    def _start(self, target, channel):
        async def fake_prospect(*args, **kwargs):
            return target

        with mock.patch.object(ads_funnel, "_funnel_prospect", fake_prospect), \
                mock.patch.object(ads_funnel, "_grant_access", return_value="tok"):
            asyncio.run(ads_funnel.start_from_listing(
                mock.AsyncMock(), listing_url="https://www.rightmove.co.uk/properties/93138003", audience="owner",
                channel=channel))
        return target

    @staticmethod
    def _target(**extra):
        base = dict(payment_status="pending", unlock_price=None, asking_price=450000, audience="owner",
                    code_looked_up_at=None, property_code="1234", id="p1")
        base.update(extra)
        return SimpleNamespace(**base)

    def test_coming_through_the_offer_page_locks_in_59(self):
        self.assertEqual(self._start(self._target(), "meta2").unlock_price, 59.0)

    def test_a_listing_first_seen_at_99_gets_the_offer_too(self):
        target = self._target(lead_source="meta_seller")
        self.assertEqual(self._start(target, "meta2").unlock_price, 59.0)

    def test_a_lower_price_already_locked_in_is_kept(self):
        self.assertEqual(self._start(self._target(unlock_price=49.0), "meta2").unlock_price, 49.0)

    def test_other_pages_and_paid_reports_are_untouched(self):
        self.assertIsNone(self._start(self._target(), "meta").unlock_price)
        self.assertIsNone(self._start(self._target(payment_status="completed"), "meta2").unlock_price)

    def test_99_shows_crossed_out_only_beside_the_offer(self):
        offer = SimpleNamespace(lead_source="meta2_seller", unlock_price=59.0, asking_price=None, audience="owner")
        self.assertEqual(sps.unlock_price_for(offer), 59.0)
        self.assertEqual(sps.offer_was_price(offer), 99.0)
        old_49 = SimpleNamespace(lead_source="meta_seller", unlock_price=49.0, asking_price=None, audience="owner")
        self.assertIsNone(sps.offer_was_price(old_49))
        self.assertIsNone(sps.offer_was_price(SimpleNamespace(lead_source="meta2_seller", unlock_price=None)))


if __name__ == "__main__":
    unittest.main()
