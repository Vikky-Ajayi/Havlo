"""Property type from a Rightmove listing page (it decides whether a listing
is a detached/semi-detached/terraced house the pipeline takes)."""
from __future__ import annotations

import unittest

from app.services.listing_scraper import _rm_decode_page_model_v2
from app.services.stale_listing_discovery import is_target_property_type


def page_model(title: str, subtype: str | None) -> list:
    """A minimal compressed PAGE_MODEL: data[0] is the schema and every
    value is an index into the flat list."""
    data: list = [None]

    def put(value):
        if isinstance(value, dict):
            value = {k: put(v) for k, v in value.items()}
        data.append(value)
        return len(data) - 1

    prop = {"address": {"displayAddress": "Forest Ridge, Keston"}, "text": {"pageTitle": title}}
    if subtype is not None:
        prop["propertySubType"] = subtype
    data[0] = {"propertyData": put(prop)}
    return data


class PropertyTypeTests(unittest.TestCase):
    def property_type(self, title, subtype=None):
        return _rm_decode_page_model_v2(page_model(title, subtype))["property_type"]

    def test_title_with_bedrooms(self):
        self.assertEqual(self.property_type("4 bedroom detached house for sale in Forest Ridge, Keston, BR2"), "Detached House")

    def test_title_without_bedrooms(self):
        # Rightmove drops the count when the agent gives none; these were
        # being rejected as "not a target property type".
        self.assertEqual(self.property_type("Terraced house for sale in Langham Road, London, N15"), "Terraced House")
        self.assertTrue(is_target_property_type(self.property_type("Detached house for sale in Forest Ridge")))

    def test_falls_back_to_subtype(self):
        self.assertEqual(self.property_type("Property details", "Semi-Detached"), "Semi-Detached")

    def test_generic_house_stays_excluded(self):
        self.assertFalse(is_target_property_type(self.property_type("3 bedroom house for sale in Langham Park Place", "House")))
        self.assertFalse(is_target_property_type(self.property_type("Bungalow for sale in Cudham Lane North", "Bungalow")))


if __name__ == "__main__":
    unittest.main()
