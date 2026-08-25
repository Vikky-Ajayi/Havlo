"""Regression tests for the property-targeting and tiered-checkout-price
rules: minimum £500,000 asking price, detached/semi-detached/terrace houses
only (no flats/apartments/etc.), and the £499.99 / £999.99 checkout tiers.
"""
from __future__ import annotations

import unittest

from app.services.stale_listing_discovery import DiscoveryParams, is_target_property_type
from app.routers.stale_listings import _stale_prospect_checkout_amount


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


class CheckoutPriceTierTest(unittest.TestCase):
    def test_below_500k_keeps_legacy_price(self) -> None:
        for price in [None, 0, 350000, 499999]:
            with self.subTest(price=price):
                self.assertEqual(_stale_prospect_checkout_amount(price), 149.99)

    def test_500k_to_999k_tier(self) -> None:
        for price in [500000, 750000, 999999]:
            with self.subTest(price=price):
                self.assertEqual(_stale_prospect_checkout_amount(price), 499.99)

    def test_1m_and_above_tier(self) -> None:
        for price in [1000000, 1500000, 5000000]:
            with self.subTest(price=price):
                self.assertEqual(_stale_prospect_checkout_amount(price), 999.99)


if __name__ == "__main__":
    unittest.main()
