"""The seller page (/sell) is its own channel: its leads are tagged
"sell_seller", get the ads emails, and those emails link back to /sell."""
from __future__ import annotations

import unittest

from app.schemas.schemas import AdsReminderRequest, AdsStartRequest
from app.services import ads_funnel, ads_nurture


class SellChannelTest(unittest.TestCase):
    def test_leads_are_tagged_as_the_seller_page(self) -> None:
        self.assertEqual(ads_funnel.seller_source("sell"), "sell_seller")
        self.assertEqual(ads_funnel.channel_of("sell_seller"), "sell")
        self.assertEqual(ads_funnel.CHANNEL_LABELS["sell"], "Seller page")

    def test_they_get_the_ads_emails_linking_back_to_sell(self) -> None:
        self.assertIn("sell_seller", ads_funnel.NURTURED_LEAD_SOURCES)
        self.assertEqual(ads_nurture.landing_path("sell", "owner"), "/sell")

    def test_the_page_can_send_its_channel(self) -> None:
        start = AdsStartRequest(listing_url="https://www.rightmove.co.uk/properties/123", channel="sell")
        self.assertEqual(start.channel, "sell")
        reminder = AdsReminderRequest(first_name="Jo", email="jo@example.com", channel="sell")
        self.assertEqual(reminder.channel, "sell")


if __name__ == "__main__":
    unittest.main()
