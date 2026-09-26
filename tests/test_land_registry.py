"""HM Land Registry comparables: parsing, selection, and how they reach the report and letter."""
from __future__ import annotations

import json
import unittest
from datetime import date, datetime, timezone

from app.models.models import StaleListingProspect
from app.services import land_registry as lr
from app.services.groq_service import generate_stale_listing_report  # noqa: F401  (import check)
from app.services.stale_prospect_service import (
    _letter_price_position,
    cached_sold_comparables,
    report_comparable_rows,
)

TODAY = date(2026, 9, 26)

# Trimmed from a real SPARQL response for CF23 5J* (Penylan, Cardiff).
SPARQL_PAYLOAD = {
    "results": {
        "bindings": [
            {"paon": {"value": "5"}, "street": {"value": "BRONWYDD AVENUE"}, "postcode": {"value": "CF23 5JP"},
             "amount": {"value": "765500"}, "date": {"value": "2025-01-31"},
             "ptype": {"value": "http://landregistry.data.gov.uk/def/common/detached"},
             "category": {"value": "http://landregistry.data.gov.uk/def/ppi/standardPricePaidTransaction"}},
            {"paon": {"value": "DYFED HOUSE"}, "saon": {"value": "FLAT 12"}, "street": {"value": "GLENSIDE COURT"},
             "postcode": {"value": "CF23 5JS"}, "amount": {"value": "135000"}, "date": {"value": "2026-03-23"},
             "ptype": {"value": "http://landregistry.data.gov.uk/def/common/flat-maisonette"},
             "category": {"value": "http://landregistry.data.gov.uk/def/ppi/standardPricePaidTransaction"}},
            {"paon": {"value": "57"}, "street": {"value": "TY-DRAW ROAD"}, "postcode": {"value": "CF23 5HD"},
             "amount": {"value": "740000"}, "date": {"value": "2025-04-17"},
             "ptype": {"value": "http://landregistry.data.gov.uk/def/common/semi-detached"},
             "category": {"value": "http://landregistry.data.gov.uk/def/ppi/standardPricePaidTransaction"}},
            {"paon": {"value": "THE STRAFFORD"}, "saon": {"value": "APARTMENT 3"}, "street": {"value": "BRONWYDD AVENUE"},
             "postcode": {"value": "CF23 5JP"}, "amount": {"value": "340000"}, "date": {"value": "2024-11-18"},
             "ptype": {"value": "http://landregistry.data.gov.uk/def/common/flat-maisonette"},
             "category": {"value": "http://landregistry.data.gov.uk/def/ppi/additionalPricePaidTransaction"}},
        ]
    }
}


def sale(address, type_, price, when, category="standard"):
    return {"address": address, "type": type_, "price": price, "date": date.fromisoformat(when), "category": category}


class ParsingTests(unittest.TestCase):
    def test_parses_real_response(self):
        sales = lr._parse_sales(SPARQL_PAYLOAD)
        self.assertEqual(len(sales), 4)
        self.assertEqual(sales[0]["address"], "5 Bronwydd Avenue, CF23 5JP")
        self.assertEqual(sales[0]["type"], "detached")
        self.assertEqual(sales[0]["price"], 765500)
        self.assertEqual(sales[1]["address"], "Flat 12, Dyfed House, Glenside Court, CF23 5JS")
        self.assertEqual(sales[2]["address"], "57 Ty-Draw Road, CF23 5HD")
        self.assertEqual(sales[3]["category"], "additional")

    def test_title_casing(self):
        self.assertEqual(lr._tidy("ST JOHN'S ROAD"), "St John's Road")
        self.assertEqual(lr._tidy("TY-DRAW ROAD"), "Ty-Draw Road")

    def test_postcodes(self):
        self.assertEqual(lr.full_postcode(None, "6, Bronwydd Avenue, Penylan, Cardiff CF23 5JP"), "CF23 5JP")
        self.assertEqual(lr.full_postcode("cf235jp"), "CF23 5JP")
        self.assertIsNone(lr.full_postcode("Hemingford Road, London, N1"))
        self.assertEqual(lr.outcode(None, "Hemingford Road, London, N1"), "N1")
        self.assertEqual(lr.outcode("N1 1DE"), "N1")

    def test_property_types(self):
        self.assertEqual(lr.lr_property_type("Semi-Detached House"), "semi-detached")
        self.assertEqual(lr.lr_property_type("Detached House"), "detached")
        self.assertEqual(lr.lr_property_type("End of Terrace"), "terraced")
        self.assertEqual(lr.lr_property_type("Town House"), "terraced")
        self.assertEqual(lr.lr_property_type("Apartment"), "flat-maisonette")
        self.assertIsNone(lr.lr_property_type("Bungalow"))
        self.assertIsNone(lr.lr_property_type(None))


class SelectionTests(unittest.TestCase):
    def test_prefers_same_type_close_in_price_and_skips_bad_rows(self):
        sales = [
            sale("5 Bronwydd Avenue, CF23 5JP", "detached", 765500, "2025-01-31"),
            sale("10 Ty Gwyn Crescent, CF23 5JL", "detached", 785000, "2025-06-20"),
            sale("20 Clos Derwen, CF23 5HJ", "detached", 660000, "2025-05-27"),
            sale("Penylan Cottage, Ty Gwyn Avenue, CF23 5JJ", "detached", 830000, "2025-07-28"),
            sale("44 Bronwydd Avenue, CF23 5JQ", "detached", 560000, "2025-11-06"),
            sale("57 Ty-Draw Road, CF23 5HD", "semi-detached", 890000, "2025-04-17"),   # closest price, wrong type
            sale("Flat 12, Dyfed House, CF23 5JS", "flat-maisonette", 135000, "2026-03-23"),
            sale("9 Bronwydd Avenue, CF23 5JP", "detached", 900000, "2025-02-01", category="additional"),
            sale("6 Bronwydd Avenue, CF23 5JP", "detached", 700000, "2019-05-01"),        # too old
            sale("6 Bronwydd Avenue, CF23 5JP", "detached", 880000, "2025-03-01"),        # the subject itself
        ]
        chosen = lr.select_comparables(
            sales, asking_price=895000, lr_type="detached",
            subject_address="6, Bronwydd Avenue, Penylan, Cardiff CF23 5JP", today=TODAY,
        )
        self.assertEqual([s["address"] for s in chosen], [
            "Penylan Cottage, Ty Gwyn Avenue, CF23 5JJ",
            "10 Ty Gwyn Crescent, CF23 5JL",
            "20 Clos Derwen, CF23 5HJ",
            "5 Bronwydd Avenue, CF23 5JP",
        ])  # four detached, newest first; not the semi, the flat, the non-standard sale, or the subject

    def test_falls_back_to_other_types_when_short(self):
        sales = [
            sale("1 A Road, X1 1AA", "detached", 500000, "2026-01-01"),
            sale("2 A Road, X1 1AA", "terraced", 480000, "2025-12-01"),
        ]
        chosen = lr.select_comparables(sales, asking_price=500000, lr_type="detached", subject_address="", today=TODAY)
        self.assertEqual(len(chosen), 2)

    def test_nothing_found(self):
        self.assertEqual(lr.select_comparables([], asking_price=1, lr_type=None, subject_address="", today=TODAY), [])


def make_prospect(**overrides) -> StaleListingProspect:
    fields = dict(
        country="UK", property_code="3001", property_address="6, Bronwydd Avenue, Penylan, Cardiff CF23 5JP",
        postcode="CF23 5JP", asking_price=895000.0, bedrooms=4, property_type="Detached House",
        rightmove_url="https://www.rightmove.co.uk/properties/1", qr_token_hash="x",
    )
    fields.update(overrides)
    return StaleListingProspect(**fields)


STORED = [
    {"address": "Penylan Cottage, Ty Gwyn Avenue, CF23 5JJ", "property_type": "Detached", "price": 830000, "date": "2025-07-28"},
    {"address": "10 Ty Gwyn Crescent, CF23 5JL", "property_type": "Detached", "price": 785000, "date": "2025-06-20"},
    {"address": "20 Clos Derwen, CF23 5HJ", "property_type": "Detached", "price": 660000, "date": "2025-05-27"},
    {"address": "5 Bronwydd Avenue, CF23 5JP", "property_type": "Detached", "price": 765500, "date": "2025-01-31"},
]


class ReportAndLetterTests(unittest.TestCase):
    def test_not_looked_up_yet(self):
        p = make_prospect()
        self.assertIsNone(cached_sold_comparables(p))
        self.assertEqual(report_comparable_rows(p), [])

    def test_looked_up_none_found(self):
        p = make_prospect(sold_comparables_json="[]", sold_comparables_at=datetime.now(timezone.utc))
        self.assertEqual(cached_sold_comparables(p), [])
        self.assertEqual(report_comparable_rows(p), [])

    def test_rows_are_recorded_sales_plus_subject(self):
        p = make_prospect(sold_comparables_json=json.dumps(STORED), sold_comparables_at=datetime.now(timezone.utc))
        rows = report_comparable_rows(p)
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0]["sold_asking"], "£830,000 sold Jul 2025")
        self.assertEqual(rows[0]["sold_price"], 830000)
        self.assertFalse(rows[0]["is_subject"])
        self.assertTrue(rows[-1]["is_subject"])
        self.assertEqual(rows[-1]["sold_asking"], "£895,000 asking")
        self.assertEqual(rows[-1]["property_type"], "Detached")

    def test_letter_price_position_uses_recorded_sales(self):
        p = make_prospect(sold_comparables_json=json.dumps(STORED), sold_comparables_at=datetime.now(timezone.utc))
        label, direction, _, _ = _letter_price_position(p.asking_price, report_comparable_rows(p))
        # Average recorded sale is ~£760k; £895k asking is well above it.
        self.assertEqual((label, direction), ("Above Market", "above"))


if __name__ == "__main__":
    unittest.main()
