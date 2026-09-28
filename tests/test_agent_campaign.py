"""Agent campaign helpers: grouping agencies, letter wording, portfolio status."""
from __future__ import annotations

import json
import unittest
from datetime import date, datetime, timedelta, timezone

from app.models.models import StaleListingProspect
from app.services import agent_campaign as ac


class AgentCampaignTests(unittest.TestCase):
    def test_company_key_merges_spellings(self):
        self.assertEqual(ac.company_key("Grant J. Bates Property Limited"), "GRANT J BATES PROPERTY LTD")
        self.assertEqual(ac.company_key("GRANT J BATES PROPERTY LTD"), "GRANT J BATES PROPERTY LTD")
        self.assertEqual(ac.company_key("  Smith & Jones   (UK) Ltd "), "SMITH & JONES UK LTD")
        self.assertEqual(ac.company_key(None), "")

    def test_display_company_name(self):
        self.assertEqual(ac.display_company_name("GRANT J BATES PROPERTY LTD"), "Grant J Bates Property Ltd")
        self.assertEqual(ac.display_company_name("SMITH & JONES UK LLP"), "Smith & Jones UK LLP")
        self.assertEqual(ac.display_company_name("Leaders and Romans Group"), "Leaders and Romans Group")
        self.assertEqual(ac.display_company_name("THE LOMOND GROUP"), "The Lomond Group")

    def test_days_on_market_counts_from_listing_date(self):
        listed = datetime(2026, 1, 1, tzinfo=timezone.utc)
        prospect = StaleListingProspect(listed_date=listed, listing_duration_days=180)
        self.assertEqual(ac.days_on_market(prospect, today=date(2026, 9, 28)), 270)
        # Never below what was recorded at discovery.
        self.assertEqual(ac.days_on_market(StaleListingProspect(listing_duration_days=200), today=date(2026, 9, 28)), 200)

    def test_qualifies_and_labels(self):
        today = datetime.now(timezone.utc)
        long_listed = StaleListingProspect(listed_date=today - timedelta(days=400), listing_duration_days=400,
                                           listing_snapshot_json=json.dumps({"listed_date": "2025-08-01"}))
        reduced = StaleListingProspect(listed_date=datetime(2026, 3, 16, tzinfo=timezone.utc), listing_duration_days=120,
                                       listing_snapshot_json=json.dumps({"listed_date": "Reduced on 16/03/2026"}))
        too_new = StaleListingProspect(listed_date=today - timedelta(days=90), listing_duration_days=90,
                                       listing_snapshot_json=json.dumps({"listed_date": "2026-06-30"}))
        self.assertTrue(ac.qualifies(long_listed))
        self.assertTrue(ac.qualifies(reduced))  # reduced in price: discovery's other criterion
        self.assertFalse(ac.qualifies(too_new))
        self.assertEqual(ac.market_label(long_listed), "400 days")
        self.assertEqual(ac.market_label(reduced), "Reduced Mar 2026")
        # Known days on market first, then reductions.
        self.assertEqual(sorted([reduced, long_listed], key=ac._stale_order), [long_listed, reduced])

    def test_property_status(self):
        self.assertEqual(ac.property_status(None), "new")
        self.assertEqual(ac.property_status(StaleListingProspect()), "opened")
        self.assertEqual(
            ac.property_status(StaleListingProspect(contact_details_submitted_at=datetime.now(timezone.utc))), "in_progress"
        )
        self.assertEqual(ac.property_status(StaleListingProspect(unlocked_at=datetime.now(timezone.utc))), "unlocked")

    def test_copied_fields_exclude_funnel_and_payment(self):
        for field in ("contact_email", "payment_status", "unlocked_at", "qr_token_hash", "property_code",
                      "letter_pdf_path", "processing_status", "sumup_checkout_id"):
            self.assertNotIn(field, ac._COPIED_FIELDS)
        for field in ("report_json", "listing_snapshot_json", "sold_comparables_json", "asking_price"):
            self.assertIn(field, ac._COPIED_FIELDS)


if __name__ == "__main__":
    unittest.main()
