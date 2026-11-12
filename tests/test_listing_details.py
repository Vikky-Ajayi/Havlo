"""Reading every section of a Rightmove listing (listing_scraper._rm_listing_details),
the EPC chart and floor plan (photo_review.read_documents), and how the
report analysis uses them."""
from __future__ import annotations

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest import mock

from app.services import listing_scraper as ls
from app.services import photo_review
from app.services import report_analysis as ra
from app.services import report_writer

PROP = {
    "tenure": {"tenureType": "LEASEHOLD", "yearsRemainingOnLease": 82, "message": None},
    "livingCosts": {"councilTaxBand": "C", "annualGroundRent": 250, "annualServiceCharge": 1800.5,
                    "councilTaxExempt": False},
    "sizings": [{"unit": "sqm", "minimumSize": 62, "maximumSize": 62}, {"unit": "sqft", "minimumSize": 667,
                                                                        "maximumSize": 667}],
    "rooms": [{"name": "Kitchen", "dimension": "3.1m x 2.4m", "description": "Fitted units"},
              {"name": "Disclaimer", "description": "These particulars are not an offer"}],
    "floorplans": [{"url": "https://media.rightmove.co.uk/floor/1.jpeg"}],
    "epcGraphs": [{"url": "https://media.rightmove.co.uk/epc/1.png"}],
    "brochures": [{"url": "https://x/b.pdf"}],
    "virtualTours": [{"url": "https://youtube.com/x", "provider": "YOUTUBE"}],
    "nearestStations": [{"name": "Kidderminster Station", "distance": 0.249}],
    "features": {"heating": [{"displayText": "Gas central"}], "parking": [{"displayText": "Allocated"}],
                 "risks": {"floodedInLastFiveYears": False, "floodSources": []},
                 "obligations": {"listed": False, "restrictions": True}},
    "prices": {"displayPriceQualifier": "Guide Price", "pricePerSqFt": "£240 per sq ft"},
    "images": [{"caption": "Kitchen"}, {"caption": "Picture No. 05"}],
}


class DetailsTests(unittest.TestCase):
    def test_every_section_is_read(self):
        d = ls._rm_listing_details(PROP)
        self.assertEqual((d["tenure"], d["lease_years_remaining"]), ("leasehold", 82))
        self.assertEqual(d["council_tax_band"], "C")
        self.assertEqual((d["ground_rent_per_year"], d["service_charge_per_year"]), (250, 1800.5))
        self.assertEqual((d["size_sqft"], d["size_sqm"]), (667, 62))
        self.assertEqual(d["rooms"], [{"name": "Kitchen", "size": "3.1m x 2.4m", "note": "Fitted units"}])
        self.assertEqual(d["floorplan_urls"], ["https://media.rightmove.co.uk/floor/1.jpeg"])
        self.assertTrue(d["epc_shown"])
        self.assertEqual((d["brochure_count"], d["tour_count"], d["tour_types"]), (1, 1, ["youtube"]))
        self.assertEqual(d["stations"], [{"name": "Kidderminster Station", "miles": 0.2}])
        self.assertEqual((d["heating"], d["parking"]), (["Gas central"], ["Allocated"]))
        self.assertEqual(d["flood_risk"], {"flooded_last_5_years": False})
        self.assertEqual(d["obligations"], {"listed_building": False, "restrictions": True})
        self.assertEqual(d["price_qualifier"], "Guide Price")
        self.assertEqual(d["photo_captions"], ["Kitchen"])

    def test_tbc_council_tax_is_not_a_band(self):
        d = ls._rm_listing_details({"livingCosts": {"councilTaxBand": "TBC"}})
        self.assertNotIn("council_tax_band", d)
        self.assertEqual(d["council_tax_band_note"], "TBC")

    def test_the_compressed_page_model_keeps_the_details(self):
        # data[0] is the schema; every value is an index into data.
        data = [{"propertyData": 1}, {"address": 2, "tenure": 4, "sizings": 6}, {"displayAddress": 3},
                "Hoo Road, DY10", {"tenureType": 5}, "FREEHOLD", [7], {"unit": 8, "maximumSize": 9}, "sqft", 898]
        out = ls._rm_decode_page_model_v2(data)
        self.assertEqual(out["details"]["tenure"], "freehold")
        self.assertEqual(out["details"]["size_sqft"], 898)
        self.assertEqual(out["floor_area"], "898 sq ft")


class AnalysisTests(unittest.TestCase):
    def snapshot(self, **extra):
        return {"description": "A lovely flat near the station.", "features": [], "media": {"photos": 20,
                "floorplans": 1, "virtual_tours": 1}, "details": ls._rm_listing_details(PROP), **extra}

    def test_rightmove_panels_count_as_given(self):
        desc = ra.description_review(self.snapshot(), ra.listing_details(self.snapshot()))
        for key in ("floor_area", "epc_rating", "tenure", "council_tax_band", "parking", "transport"):
            self.assertIn(key, desc["covers"])
        self.assertEqual(set(desc["shown_in_listing_sections"]) & {"tenure", "council_tax_band"},
                         {"tenure", "council_tax_band"})
        self.assertEqual(desc["floor_area_sqft"], 667)
        self.assertNotIn("tenure", desc["in_description"])

    def test_an_old_snapshot_is_judged_on_its_text_as_before(self):
        desc = ra.description_review({"description": "Nice house.", "features": []}, {})
        self.assertIn("tenure", desc["missing"])
        self.assertFalse(desc["sections_read"])

    def test_the_epc_and_floor_plan_read_feed_the_factors(self):
        review = {"photos_seen": 20, "findings": [], "documents": {
            "epc_current": "D", "epc_current_score": 62, "epc_potential": "B", "epc_potential_score": 84,
            "floor_area_sqft": 700, "floors": 1, "layout_notes": "Open-plan living space."}}
        a = ra.analyse(self.snapshot(), asking_price=160000, photo_review=review)
        self.assertEqual(a["property"]["epc_rating"], "D")
        facts = report_writer.factor_facts(a)
        self.assertEqual(facts["condition_readiness"]["data"]["epc_potential"], "B")
        self.assertEqual(facts["floor_plan"]["data"]["floor_plan_layout_notes"], "Open-plan living space.")
        self.assertEqual(facts["buyer_objections"]["data"]["lease_years_remaining"], 82)
        self.assertNotIn("floorplan_urls", json.dumps(facts))  # image links are for the vision step only
        self.assertIn(1800.5, a["trusted"]["amounts"])

    def test_no_epc_anywhere_is_a_marketing_gap(self):
        details = {**ls._rm_listing_details(PROP), "epc_shown": False}
        a = ra.analyse(self.snapshot(details=details), asking_price=160000)
        self.assertIn("no EPC on the listing", a["marketing_gaps"])


class DocumentReadTests(unittest.TestCase):
    def _reply(self, data):
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(data)))])

    def test_the_rating_and_area_are_read_and_checked(self):
        reply = self._reply({"epc_current": "d", "epc_current_score": 62, "epc_potential": "Z",
                             "floor_area_sqft": "1,050", "floors": 2, "layout_notes": "Good flow."})
        with mock.patch.object(photo_review.groq_service, "_openai_chat", return_value=reply):
            out = asyncio.run(photo_review.read_documents(["https://e/1.png"], ["https://f/1.jpg"], model="m"))
        self.assertEqual(out["epc_current"], "D")
        self.assertEqual(out["epc_current_score"], 62)
        self.assertNotIn("epc_potential", out)  # "Z" isn't a rating
        self.assertEqual((out["floor_area_sqft"], out["floors"]), (1050, 2))

    def test_nothing_to_read(self):
        self.assertIsNone(asyncio.run(photo_review.read_documents([], [], model="m")))

    def test_documents_without_a_photo_review_dont_mark_photos_verified(self):
        report = {"factors": [{"key": "photography"}]}
        report_writer._mark_photography_verified(report, {"findings": [], "photos_seen": 0, "documents": {"x": 1}})
        self.assertNotIn("_photo_verified", report["factors"][0])


if __name__ == "__main__":
    unittest.main()
