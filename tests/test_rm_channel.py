"""The /rm/ pages: copies of the Meta pages with their own channel, so their
leads are tagged rm_..., labelled, filterable and emailed back to /rm/."""
from __future__ import annotations

import unittest

from app.schemas.schemas import AdsStartRequest
from app.services import ads_funnel, ads_nurture


class RmChannelTests(unittest.TestCase):
    def test_leads_are_tagged_rm(self):
        self.assertEqual(ads_funnel.seller_source("rm"), "rm_seller")
        self.assertEqual(ads_funnel.agent_source("rm"), "rm_agent")
        self.assertEqual(ads_funnel.channel_of("rm_agent_listing"), "rm")
        self.assertEqual(ads_funnel.CHANNEL_LABELS["rm"], "Rightmove page")
        self.assertIn("rm_seller", ads_funnel.NURTURED_LEAD_SOURCES)  # gets the same follow-up emails

    def test_emails_link_back_to_the_rm_pages(self):
        self.assertEqual(ads_nurture.landing_path("rm", "owner"), "/rm/seller")
        self.assertEqual(ads_nurture.landing_path("rm", "agent"), "/rm/agent")
        self.assertEqual(ads_nurture.landing_path("meta", "owner"), "/assess/seller")  # Meta unchanged

    def test_the_start_request_accepts_rm(self):
        req = AdsStartRequest(listing_url="https://www.rightmove.co.uk/properties/1", channel="rm")
        self.assertEqual(req.channel, "rm")

    def test_rightmove_sellers_get_one_email_flow_not_two(self):
        from app.services import stale_prospect_abandonment

        # The ads emails (ads_nurture) cover them, so the older flow leaves them out.
        self.assertIn("rm_seller", stale_prospect_abandonment._ADS_NURTURED_SELLERS)
        self.assertNotIn("review_seller", stale_prospect_abandonment._ADS_NURTURED_SELLERS)


class RmJourneyPathsTests(unittest.TestCase):
    """Every page after the /rm/ landing pages keeps an /rm/ address, so
    Rightmove's Tag Manager containers cover the whole journey."""

    def test_rightmove_leads_stay_under_rm(self):
        from app.services import funnel_paths

        for source in ("rm_seller", "rm_agent", "rm_agent_listing"):
            self.assertTrue(funnel_paths.is_rm_lead(source))
            self.assertEqual(funnel_paths.complete_path(source), "/rm/complete")
            self.assertEqual(funnel_paths.report_path(source), "/rm/report")
            self.assertEqual(funnel_paths.next_steps_path(source), "/rm/next-steps")
            self.assertEqual(funnel_paths.dashboard_path(source, "abc"), "/rm/dashboard/abc")

    def test_everyone_else_keeps_the_default_addresses(self):
        from app.services import funnel_paths

        for source in (None, "", "meta_seller", "google_agent", "sell_seller", "review_seller", "letter"):
            self.assertFalse(funnel_paths.is_rm_lead(source))
            self.assertEqual(funnel_paths.complete_path(source), "/stale-listings/prospect/complete")
            self.assertEqual(funnel_paths.report_path(source), "/stale-listings/prospect/report")
            self.assertEqual(funnel_paths.next_steps_path(source), "/stale-listings/prospect/next-steps")
            self.assertEqual(funnel_paths.dashboard_path(source, "abc"), "/m/abc")

    def test_dashboard_texts_link_to_the_rm_dashboard(self):
        from app.services import listing_monitor

        self.assertTrue(listing_monitor.dashboard_url("abc", "rm_seller").endswith("/rm/dashboard/abc"))
        self.assertTrue(listing_monitor.dashboard_url("abc", "meta_seller").endswith("/m/abc"))
        self.assertTrue(listing_monitor.dashboard_url("abc").endswith("/m/abc"))

    def test_short_links_and_reminders_go_back_to_the_rm_landing_page(self):
        from types import SimpleNamespace

        from app.services import analyst_review

        def path(lead_source, audience="owner"):
            return analyst_review.funnel_path(SimpleNamespace(lead_source=lead_source, audience=audience))

        self.assertEqual(path("rm_seller"), "/rm/seller")
        self.assertEqual(path("rm_agent", "agent"), "/rm/agent")
        self.assertEqual(path("review_seller"), "/review/seller")
        self.assertEqual(path("meta_seller"), "/stale-listings/prospect")
        self.assertEqual(path(None), "/stale-listings/prospect")


if __name__ == "__main__":
    unittest.main()
