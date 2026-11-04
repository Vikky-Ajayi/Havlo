"""Regression tests for the property-targeting rules (minimum £500,000
asking price, detached/semi-detached/terrace houses only — no
flats/apartments/etc.) and the full-report checkout prices: a flat
£99 for owners and estate agencies alike, with the £49 kept for leads
already in the funnel when the price rose (Nov 2026).
"""
from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.services.stale_listing_discovery import DiscoveryParams, is_target_property_type
from app.routers.stale_listings import SL_PACKAGES, _stale_prospect_checkout_amount
from app.services.stale_prospect_service import prospect_unlock_price, unlock_price_for


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


def _lead(asking_price=None, audience="owner", unlock_price=None):
    return SimpleNamespace(asking_price=asking_price, audience=audience, unlock_price=unlock_price)


class CheckoutPriceTest(unittest.TestCase):
    def test_new_leads_pay_a_flat_99(self) -> None:
        for price in [None, 0, 250000, 396000, 500000, 750000, 1000000, 1992000, 5000000]:
            for audience in [None, "owner", "agent"]:
                with self.subTest(price=price, audience=audience):
                    self.assertEqual(_stale_prospect_checkout_amount(_lead(price, audience)), 99.0)
        self.assertEqual(prospect_unlock_price(750000), 99.0)

    def test_leads_already_in_the_funnel_keep_49(self) -> None:
        for audience in [None, "owner", "agent"]:
            with self.subTest(audience=audience):
                self.assertEqual(_stale_prospect_checkout_amount(_lead(750000, audience, 49.0)), 49.0)

    def test_emails_quote_the_checkout_price(self) -> None:
        for locked in [None, 49.0]:
            for audience in [None, "owner", "agent"]:
                lead = _lead(750000, audience, locked)
                with self.subTest(locked=locked, audience=audience):
                    self.assertEqual(unlock_price_for(lead), _stale_prospect_checkout_amount(lead))

    def test_seller_assessment_price(self) -> None:
        # The /stale-listings/plan checkout charges the same flat £99.
        self.assertEqual(SL_PACKAGES["property_sale_assessment"]["amount"], 99.0)
        self.assertEqual(SL_PACKAGES["listing_recovery_assessment"]["amount"], 99.0)
        # Retired plans keep their price so historical orders still resolve.
        self.assertEqual(SL_PACKAGES["professional_review"]["amount"], 299.99)


if __name__ == "__main__":
    unittest.main()
