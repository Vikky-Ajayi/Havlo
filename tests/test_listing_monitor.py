"""90-day monitoring dashboard: reading listings, spotting changes, the
checklist and plan."""
from __future__ import annotations

import json
import unittest

from app.services import listing_monitor as lm


def _page(prop: dict) -> str:
    """A listing page in Rightmove's flat PAGE_MODEL format: data[0] is the
    schema, every dict value / list item is an index into data."""
    data: list = [None]

    def put(value):
        if isinstance(value, dict):
            index = len(data)
            data.append(None)
            data[index] = {k: put(v) for k, v in value.items()}
            return index
        if isinstance(value, list):
            index = len(data)
            data.append(None)
            data[index] = [put(v) for v in value]
            return index
        data.append(value)
        return len(data) - 1

    data[0] = {"propertyData": put(prop)}
    model = json.dumps({"data": json.dumps(data), "encoding": "on"})
    return f"<html><script>window.PAGE_MODEL = {model};</script></html>"


PROP = {
    "prices": {"primaryPrice": "£530,000", "displayPriceQualifier": "Offers Over"},
    "text": {"description": "<p>A lovely   detached home.</p>"},
    "misInfo": {"branchId": 7472, "featuredProperty": False, "premiumDisplay": False},
    "status": {"published": True, "archived": False},
    "tags": [],
    "location": {"latitude": 53.49, "longitude": -2.34},
    "address": {"displayAddress": "Parkfield Road, Worsley", "outcode": "M30", "incode": "9HE"},
    "images": [{"url": "https://media.rightmove.co.uk/p/93397608/aaa111.jpeg"},
               {"url": "https://media.rightmove.co.uk/p/93397608/bbb222.jpeg"}],
    "floorplans": [],
    "virtualTours": [],
    "brochures": [],
    "keyFeatures": ["Four bedrooms", "Large garden"],
    "bedrooms": 4,
    "propertySubType": "Detached",
    "listingHistory": {"listingUpdateReason": "Added on 21/09/2025"},
}


class ReadingListingTests(unittest.TestCase):
    def test_reads_the_flat_page_model(self):
        state = lm.listing_state(lm.property_data_from_page(_page(PROP)))
        self.assertEqual(state["price"], 530000)
        self.assertEqual(state["price_qualifier"], "Offers Over")
        self.assertEqual(state["status"], "on_market")
        self.assertEqual(state["images"], ["aaa111", "bbb222"])
        self.assertEqual(state["image_count"], 2)
        self.assertEqual(state["floorplans"], 0)
        self.assertEqual(state["description_words"], 4)
        self.assertEqual(state["postcode"], "M30 9HE")
        self.assertEqual(state["branch_id"], "7472")

    def test_status_from_tags_and_archived(self):
        self.assertEqual(lm.listing_state({**PROP, "tags": ["SOLD_STC"]})["status"], "sold_stc")
        self.assertEqual(lm.listing_state({**PROP, "tags": ["UNDER_OFFER"]})["status"], "under_offer")
        self.assertEqual(lm.listing_state({**PROP, "status": {"published": False, "archived": True}})["status"], "removed")
        self.assertEqual(lm.status_from(None, "Sold STC"), "sold_stc")
        self.assertIsNone(lm.status_from(None, ""))

    def test_no_page_model(self):
        self.assertIsNone(lm.property_data_from_page("<html>nothing</html>"))


class DiffListingTests(unittest.TestCase):
    def setUp(self):
        self.before = lm.listing_state(PROP)

    def kinds(self, after):
        return [kind for kind, _ in lm.diff_listing(self.before, after)]

    def test_no_changes(self):
        self.assertEqual(lm.diff_listing(self.before, dict(self.before)), [])

    def test_price_cut(self):
        [(kind, data)] = lm.diff_listing(self.before, {**self.before, "price": 500000})
        self.assertEqual(kind, "price_reduced")
        self.assertEqual(data["change"], -30000)
        self.assertEqual(data["percent"], -5.7)

    def test_price_wording_only(self):
        self.assertEqual(self.kinds({**self.before, "price_qualifier": "Guide Price"}), ["price_wording_changed"])

    def test_new_lead_photo(self):
        [(kind, data)] = lm.diff_listing(self.before, {**self.before, "images": ["ccc333", "aaa111", "bbb222"]})
        self.assertEqual(kind, "photos_updated")
        self.assertEqual((data["added"], data["removed"], data["new_lead_photo"]), (1, 0, True))

    def test_reordered_photos_count_as_new_lead(self):
        self.assertEqual(self.kinds({**self.before, "images": ["bbb222", "aaa111"]}), ["photos_updated"])

    def test_media_and_copy(self):
        after = {**self.before, "floorplans": 1, "virtual_tours": 1, "description_hash": "other", "features": ["Four bedrooms", "South-facing garden"]}
        self.assertEqual(self.kinds(after), ["floorplan_added", "virtual_tour_added", "description_updated", "features_updated"])

    def test_featured_and_agent(self):
        after = {**self.before, "featured": True, "branch_id": "999", "agent": "New Agents"}
        self.assertEqual(self.kinds(after), ["featured_added", "agent_changed"])

    def test_status_changes(self):
        self.assertEqual(self.kinds({**self.before, "status": "under_offer"}), ["status_under_offer"])
        self.assertEqual(self.kinds({**self.before, "status": "sold_stc"}), ["status_sold_stc"])
        self.assertEqual(self.kinds({**self.before, "status": "removed"}), ["listing_removed"])
        self.assertEqual(lm.diff_listing({**self.before, "status": "removed"}, self.before)[0][0], "listing_relisted")
        self.assertEqual(lm.diff_listing({**self.before, "status": "sold_stc"}, self.before)[0][0], "back_on_market")


def _row(rm_id, price, status="on_market", first="2026-09-01", **extra):
    return {"id": rm_id, "address": f"{rm_id} Road", "price": price, "bedrooms": 3, "type": "Semi-Detached",
            "status": status, "update": "", "update_date": "", "first_listed": first, "distance": 0.2,
            "url": "", "image": "", **extra}


class NearbyTests(unittest.TestCase):
    def test_search_row(self):
        row = lm.nearby_row({
            "id": 93655350, "displayAddress": "Wellington Road", "price": {"amount": 150000}, "bedrooms": 2,
            "propertySubType": "Terraced", "displayStatus": "Sold STC", "distance": 0.1354,
            "listingUpdate": {"listingUpdateReason": "price_reduced", "listingUpdateDate": "2026-09-22T18:53:34Z"},
            "firstVisibleDate": "2026-08-04T15:15:07Z", "propertyUrl": "/properties/93655350#/?channel=RES_BUY",
            "propertyImages": {"mainImageSrc": "https://img/1.jpg"},
        })
        self.assertEqual(row["id"], "93655350")
        self.assertEqual(row["status"], "sold_stc")
        self.assertEqual(row["update"], "price_reduced")
        self.assertEqual(row["first_listed"], "2026-08-04")
        self.assertEqual(row["distance"], 0.14)
        self.assertTrue(row["url"].startswith("https://www.rightmove.co.uk/properties/93655350"))

    def test_changes_between_weeks(self):
        before = [_row("1", 300000), _row("2", 400000), _row("3", 250000)]
        after = [
            _row("1", 290000),                      # cut
            _row("2", 400000, status="sold_stc"),   # agreed
            _row("4", 350000, first="2026-09-25"),  # new since the last check
            _row("5", 200000, first="2026-01-01"),  # older one that paged in: not new
        ]
        events = lm.diff_nearby(before, after, since="2026-09-21")
        self.assertEqual([k for k, _ in events], ["nearby_reduced", "nearby_sold_stc", "nearby_new"])
        self.assertEqual(events[0][1]["change"], -10000)

    def test_market_pulse(self):
        rows = [_row("1", 300000), _row("2", 400000, update="price_reduced"), _row("3", 500000), _row("4", 1, status="sold_stc")]
        self.assertEqual(lm.market_pulse(rows), {"for_sale": 3, "under_offer_or_sold": 1, "reduced": 1, "median_price": 400000})

    def test_similar(self):
        self.assertTrue(lm.is_similar(_row("1", 1, bedrooms=4, type="Detached"), 4, "Detached house"))
        self.assertFalse(lm.is_similar(_row("1", 1, bedrooms=2, type="Detached"), 4, "Detached"))
        self.assertFalse(lm.is_similar(_row("1", 1, bedrooms=4, type="Semi-Detached"), 4, "Detached"))

    def test_typeahead_json_and_xml(self):
        body = '{"matches":[{"id":"513960","type":"POSTCODE","displayName":"M30 9HE"}]}'
        self.assertEqual(lm.location_id_from_typeahead(body, "POSTCODE"), "POSTCODE^513960")
        xml = "<TypeaheadDTO><matches><matches><id>1668</id><type>OUTCODE</type></matches></matches></TypeaheadDTO>"
        self.assertEqual(lm.location_id_from_typeahead(xml, "OUTCODE"), "OUTCODE^1668")
        self.assertIsNone(lm.location_id_from_typeahead(xml, "POSTCODE"))

    def test_postcode_sector(self):
        self.assertEqual(lm.postcode_sector("m30 9he"), "M30 9")
        self.assertEqual(lm.postcode_sector("SW1A 1AA"), "SW1A 1")
        self.assertIsNone(lm.postcode_sector("M30"))

    def test_listing_id(self):
        self.assertEqual(lm.rightmove_listing_id("https://www.rightmove.co.uk/properties/93397608#/"), "93397608")
        self.assertEqual(lm.rightmove_listing_id("https://www.zillow.com/x"), "")


REPORT = {
    "action_plan": [
        {"priority": "HIGH", "title": "Commission new photography", "description": "Lead with the garden."},
        {"priority": "URGENT", "title": "Reset the asking price", "description": "Move to £499,950."},
        {"priority": "MEDIUM", "title": "Host an open day", "description": "Create urgency."},
        {"title": "Neighbourhood Buyer Outreach", "description": "Standing advice."},
    ],
    "thirty_day_plan": [{"week": 1, "title": "Fix price"}, {"week": 2, "title": "New photos"}],
    "pricing_recommendation": "Reduce to £499,950.",
}


class ChecklistTests(unittest.TestCase):
    def test_report_actions_first_by_priority_then_catalogue(self):
        items = lm.build_checklist(REPORT, {"floorplans": 1, "virtual_tours": 0}, [], {})
        self.assertEqual([i["key"] for i in items[:3]], ["price", "photos", "report_2"])
        self.assertEqual(items[0]["title"], "Reset the asking price")
        self.assertEqual(items[0]["priority"], "URGENT")
        keys = [i["key"] for i in items]
        self.assertNotIn("floorplan", keys)  # already had one on day 0
        self.assertIn("virtual_tour", keys)
        self.assertEqual(len(keys), len(set(keys)))

    def test_detected_and_ticked(self):
        events = [{"kind": "price_reduced", "at": "2026-10-02T09:00:00+00:00"}]
        items = {i["key"]: i for i in lm.build_checklist(REPORT, {}, events, {"report_2": {"done": True, "at": "2026-10-03T00:00:00+00:00"}})}
        self.assertEqual((items["price"]["done"], items["price"]["done_by"]), (True, "detected"))
        self.assertEqual((items["report_2"]["done"], items["report_2"]["done_by"]), (True, "you"))
        self.assertFalse(items["photos"]["done"])
        self.assertTrue(items["photos"]["auto"])
        self.assertFalse(items["report_2"]["auto"])

    def test_plan(self):
        checklist = lm.build_checklist(REPORT, {}, [], {})
        plan = lm.build_plan(REPORT, 40, checklist)
        self.assertEqual(plan["current_week"], 6)
        self.assertEqual([p["current"] for p in plan["phases"]], [False, True, False])
        self.assertEqual(plan["weeks"][0]["title"], "Fix price")
        self.assertEqual(plan["weeks"][2]["title"], "Widen where the listing is seen")  # default for a missing week
        self.assertEqual(len(plan["weeks"]), 13)
        self.assertEqual([[w["week"] for w in p["weeks"]] for p in plan["phases"]], [[1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13]])
        self.assertEqual([t["key"] for t in plan["phases"][0]["tasks"]], ["price", "photos"])
        self.assertIn("Reduce to £499,950.", plan["phases"][2]["notes"][1])

    def test_next_step(self):
        checklist = lm.build_checklist(REPORT, {}, [], {})
        self.assertEqual(lm.next_step(checklist, "on_market", False)["title"], "Reset the asking price")
        self.assertEqual(lm.next_step(checklist, "sold_stc", False)["title"], "Keep the sale moving")
        self.assertEqual(lm.next_step(checklist, "on_market", True)["title"], "Plan what's next")


class SmsTests(unittest.TestCase):
    def test_short_address(self):
        self.assertEqual(lm.short_address("12 Parkfield Road, Worsley, Manchester, M30 9HE"), "12 Parkfield Road, Worsley")

    def test_text_fits_two_segments(self):
        from app.services import twilio_service

        body = twilio_service.MONITOR_DASHBOARD_SMS.format(
            address=lm.short_address("112 Long Street Name Avenue, Somewhere-on-Sea, County"),
            link=lm.dashboard_url("x" * 20),
        )
        self.assertLessEqual(len(body), 306)
        self.assertIn("/m/xxxxxxxxxxxxxxxxxxxx", body)


if __name__ == "__main__":
    unittest.main()
