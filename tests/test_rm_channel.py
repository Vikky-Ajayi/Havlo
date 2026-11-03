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


if __name__ == "__main__":
    unittest.main()
