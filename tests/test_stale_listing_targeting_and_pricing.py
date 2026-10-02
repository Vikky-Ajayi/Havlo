"""Regression tests for the property-targeting rules (minimum £500,000
asking price, detached/semi-detached/terrace houses only — no
flats/apartments/etc.) and the full-report checkout prices: a flat
£299.99 for owners, £149.99 for estate agencies.
"""
from __future__ import annotations

import unittest

from app.services.stale_listing_discovery import DiscoveryParams, is_target_property_type
from app.routers.stale_listings import SL_PACKAGES, _stale_prospect_checkout_amount
from app.services.stale_prospect_service import prospect_unlock_price


class PropertyTypeTargetingTest(unittest.TestCase):
    def test_wanted_house_types_are_accepted(self) -> None:
        for value in [
            "Detached House",
            "Semi-Detached House",
            "Terraced House",
            "End of Terrace House",
            "Link-Detached House",
        ]:
            with self.subTest(value=value):
                self.assertTrue(is_target_property_type(value))

    def test_flats_and_other_types_are_rejected(self) -> None:
        for value in [
            "Flat",
            "Apartment",
            "Penthouse",
            "Maisonette",
            "Ground Floor Flat",
            "Bungalow",
            "Park Home",
            "Barn Conversion",
            "Duplex",
            "Town House",
            "",
        ]:
            with self.subTest(value=value):
                self.assertFalse(is_target_property_type(value))

    def test_default_minimum_price_is_five_hundred_thousand(self) -> None:
        self.assertEqual(DiscoveryParams().min_price, 500000)


class CheckoutPriceTest(unittest.TestCase):
    def test_flat_price_regardless_of_asking_price(self) -> None:
        for price in [None, 0, 350000, 499999, 500000, 750000, 999999, 1000000, 5000000]:
            with self.subTest(price=price):
                self.assertEqual(_stale_prospect_checkout_amount(price), 299.99)
                self.assertEqual(_stale_prospect_checkout_amount(price, "owner"), 299.99)

    def test_agencies_pay_the_agent_assessment_price(self) -> None:
        for price in [None, 350000, 1000000]:
            with self.subTest(price=price):
                self.assertEqual(_stale_prospect_checkout_amount(price, "agent"), 149.99)
        self.assertEqual(SL_PACKAGES["listing_recovery_assessment"]["amount"], 149.99)

    def test_emails_quote_the_checkout_price(self) -> None:
        for audience in [None, "owner", "agent"]:
            with self.subTest(audience=audience):
                self.assertEqual(
                    prospect_unlock_price(750000, audience),
                    _stale_prospect_checkout_amount(750000, audience),
                )

    def test_seller_assessment_price(self) -> None:
        self.assertEqual(SL_PACKAGES["property_sale_assessment"]["amount"], 299.99)


if __name__ == "__main__":
    unittest.main()
