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


class UniqueListingsTests(unittest.TestCase):
    def prospect(self, url, **kw):
        p = StaleListingProspect(rightmove_url=url, **kw)
        p.id = kw.get("id") or __import__("uuid").uuid4()
        return p

    def test_one_per_listing_whatever_the_link(self):
        old = self.prospect("https://www.rightmove.co.uk/properties/172322219#/?channel=RES_BUY",
                            created_at=datetime(2026, 9, 14, tzinfo=timezone.utc))
        new = self.prospect("https://www.rightmove.co.uk/properties/172322219?utm_source=copytoclipboard",
                            created_at=datetime(2026, 9, 24, tzinfo=timezone.utc))
        other = self.prospect("https://www.rightmove.co.uk/properties/90000001", created_at=datetime(2026, 9, 1, tzinfo=timezone.utc))
        self.assertEqual(ac.unique_listings([new, old, other]), [old, other])

    def test_prefers_the_copy_already_used(self):
        old = self.prospect("https://www.rightmove.co.uk/properties/1", created_at=datetime(2026, 9, 1, tzinfo=timezone.utc))
        looked_up = self.prospect("https://www.rightmove.co.uk/properties/1", created_at=datetime(2026, 9, 9, tzinfo=timezone.utc),
                                  code_looked_up_at=datetime(2026, 9, 20, tzinfo=timezone.utc))
        opened = self.prospect("https://www.rightmove.co.uk/properties/1", created_at=datetime(2026, 9, 10, tzinfo=timezone.utc))
        self.assertEqual(ac.unique_listings([old, looked_up]), [looked_up])
        self.assertEqual(ac.unique_listings([old, looked_up, opened], prefer={opened.id}), [opened])


class AgentLetterVersionTests(unittest.TestCase):
    def test_every_test_version_has_copy(self):
        for version in ac.AGENT_LETTER_VERSIONS[1:]:
            copy = ac._agent_version_copy(version, 8, "Smith & Jones")
            self.assertEqual(len(copy["items"]), 6)
            self.assertIn("Smith &amp; Jones", " ".join(copy["body"]))
            self.assertTrue(copy["headline"] and copy["closing"] and len(copy["cta"]) == 2)

    def test_counts_fill_in(self):
        self.assertTrue(ac._agent_version_copy(3, 12, "X")["headline"].startswith("12 vendors"))
        with self.assertRaises(ValueError):
            ac._agent_version_copy(6, 2, "X")
