from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.services.stale_listing_discovery import DiscoveryParams, _skip_reason
from app.services.stale_prospect_service import is_specific_address, parse_listed_date


class StaleListingDiscoveryRulesTest(unittest.TestCase):
    def test_postal_quality_address_filter(self) -> None:
        self.assertTrue(is_specific_address("12 Example Road, London, SW1A 1AA"))
        self.assertTrue(is_specific_address("Flat 2, 8 High Street, Leeds, LS1 1AB"))
        self.assertFalse(is_specific_address("Example Road, London"))
        self.assertFalse(is_specific_address("Near London"))

    def test_parse_rightmove_listing_dates(self) -> None:
        parsed = parse_listed_date("Added on 12 January 2024")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed.date().isoformat(), "2024-01-12")
        self.assertEqual(parse_listed_date("2024-02-01T12:00:00+00:00").tzinfo, timezone.utc)

    def test_skip_reason_accepts_only_stale_postal_quality_residential(self) -> None:
        params = DiscoveryParams(min_price=300001, min_days_on_market=180)
        self.assertIsNone(
            _skip_reason(
                snapshot={"property_type": "Terraced house"},
                address="12 Example Road, London, SW1A 1AA",
                price=350000,
                listed_date=datetime(2024, 1, 12, tzinfo=timezone.utc),
                duration_days=200,
                params=params,
            )
        )
        self.assertEqual(
            _skip_reason(
                snapshot={"property_type": "Terraced house"},
                address="12 Example Road, London, SW1A 1AA",
                price=299999,
                listed_date=datetime(2024, 1, 12, tzinfo=timezone.utc),
                duration_days=200,
                params=params,
            ),
            "below_minimum_price",
        )
        self.assertEqual(
            _skip_reason(
                snapshot={"property_type": "Land"},
                address="12 Example Road, London, SW1A 1AA",
                price=350000,
                listed_date=datetime(2024, 1, 12, tzinfo=timezone.utc),
                duration_days=200,
                params=params,
            ),
            "not_residential_sale",
        )


if __name__ == "__main__":
    unittest.main()
