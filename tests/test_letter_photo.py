"""Letter photo: agents replace listing photos, which kills the saved link."""
from __future__ import annotations

import json
import unittest
from unittest import mock

from app.models.models import StaleListingProspect
from app.services import stale_prospect_service as sps

URL = "https://www.rightmove.co.uk/properties/165559778#/?channel=RES_BUY"
SNAP = {"image": "https://media/old-lead.png", "images": ["https://media/old-lead.png", "https://media/old-2.jpeg"]}


def fetcher(working: set[str]):
    return lambda url: f"photo:{url}" if url in working else None


class LetterPhotoTests(unittest.TestCase):
    def prospect(self):
        return StaleListingProspect(rightmove_url=URL, listing_snapshot_json=json.dumps(SNAP))

    def test_saved_lead_photo_when_it_loads(self):
        p = self.prospect()
        with mock.patch.object(sps, "_letter_fetch_photo", fetcher({"https://media/old-lead.png"})), \
             mock.patch.object(sps, "_current_listing_photos") as live:
            self.assertEqual(sps._letter_listing_photo(p, dict(SNAP)), "photo:https://media/old-lead.png")
        live.assert_not_called()

    def test_current_lead_photo_when_the_saved_one_is_gone(self):
        p = self.prospect()
        with mock.patch.object(sps, "_letter_fetch_photo", fetcher({"https://media/new-lead.jpeg", "https://media/old-2.jpeg"})), \
             mock.patch.object(sps, "_current_listing_photos", return_value=["https://media/new-lead.jpeg", "https://media/new-2.jpeg"]):
            self.assertEqual(sps._letter_listing_photo(p, dict(SNAP)), "photo:https://media/new-lead.jpeg")
        saved = json.loads(p.listing_snapshot_json)
        self.assertEqual(saved["image"], "https://media/new-lead.jpeg")
        self.assertEqual(saved["images"][:2], ["https://media/new-lead.jpeg", "https://media/new-2.jpeg"])

    def test_other_saved_photos_when_the_listing_cant_be_read(self):
        p = self.prospect()
        with mock.patch.object(sps, "_letter_fetch_photo", fetcher({"https://media/old-2.jpeg"})), \
             mock.patch.object(sps, "_current_listing_photos", return_value=[]):
            self.assertEqual(sps._letter_listing_photo(p, dict(SNAP)), "photo:https://media/old-2.jpeg")
        self.assertEqual(json.loads(p.listing_snapshot_json), SNAP)

    def test_placeholder_when_nothing_loads(self):
        with mock.patch.object(sps, "_letter_fetch_photo", fetcher(set())), \
             mock.patch.object(sps, "_current_listing_photos", return_value=["https://media/new-lead.jpeg"]):
            self.assertIsNone(sps._letter_listing_photo(self.prospect(), dict(SNAP)))

    def test_no_live_lookup_for_non_rightmove_links(self):
        self.assertEqual(sps._current_listing_photos("n/a"), [])


if __name__ == "__main__":
    unittest.main()
