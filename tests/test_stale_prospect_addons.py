"""The optional-services basket: the catalog's statuses, one order per basket,
items already owned dropped, SumUp confirmation, and the team email once."""
from __future__ import annotations

import asyncio
import json
import types
import unittest
from unittest import mock

from app.models.models import StaleProspectAddonOrder
from app.services import stale_prospect_addons as addons


def _prospect():
    return types.SimpleNamespace(
        id="p1", property_code="1234", property_address="A home",
        contact_name="Sam Seller", contact_email="sam@example.com",
        rightmove_url="https://www.rightmove.co.uk/properties/1")


def _order(items, status="pending", **over):
    o = StaleProspectAddonOrder(
        prospect_id="p1", items_json=json.dumps(items), amount=sum(i["price"] for i in items),
        currency="GBP", status=status)
    for k, v in over.items():
        setattr(o, k, v)
    return o


class CatalogTests(unittest.TestCase):
    def test_statuses_available_ordered_included(self):
        orders = [_order([{"key": "listing_rewrite", "name": "Listing Rewrite", "price": 199.0}], status="completed")]
        cat = {c["key"]: c["status"] for c in addons.catalog(orders)}
        self.assertEqual(cat["listing_rewrite"], "ordered")
        self.assertEqual(cat["relaunch_strategy"], "available")
        self.assertEqual(cat["monitoring_30"], "included")


class CreateOrderTests(unittest.TestCase):
    def _run(self, keys, existing=None):
        prospect = _prospect()
        db = mock.Mock()
        db.add = mock.Mock()
        db.flush = mock.AsyncMock()
        checkout = mock.AsyncMock(return_value={"id": "chk_1", "checkout_url": "https://pay.sumup/x"})
        with mock.patch.object(addons, "completed_orders", new=mock.AsyncMock(return_value=existing or [])), \
                mock.patch.object(addons.sumup_service, "create_checkout", new=checkout):
            return asyncio.run(addons.create_order(db, prospect, keys, redirect_url="https://havlo/back")), checkout

    def test_basket_total_and_items(self):
        result, checkout = self._run(["listing_rewrite", "relaunch_strategy"])
        self.assertEqual(result["amount"], 498.0)
        self.assertEqual([i["key"] for i in result["items"]], ["listing_rewrite", "relaunch_strategy"])
        self.assertEqual(result["checkout_url"], "https://pay.sumup/x")
        # One SumUp checkout for the whole basket.
        self.assertEqual(checkout.await_count, 1)
        self.assertEqual(checkout.await_args.kwargs["amount"], 498.0)

    def test_unknown_item_is_rejected(self):
        with self.assertRaises(addons.AddonError):
            self._run(["nope"])

    def test_already_owned_items_are_dropped(self):
        existing = [_order([{"key": "listing_rewrite", "name": "Listing Rewrite", "price": 199.0}], status="completed")]
        result, _ = self._run(["listing_rewrite", "relaunch_strategy"], existing=existing)
        self.assertEqual([i["key"] for i in result["items"]], ["relaunch_strategy"])
        self.assertEqual(result["amount"], 299.0)

    def test_empty_basket_after_dropping_raises(self):
        existing = [_order([{"key": "relaunch_strategy", "name": "Relaunch Strategy", "price": 299.0}], status="completed")]
        with self.assertRaises(addons.AddonError):
            self._run(["relaunch_strategy"], existing=existing)

    def test_monitoring_cannot_be_bought(self):
        with self.assertRaises(addons.AddonError):
            self._run(["monitoring_30"])


class ConfirmTests(unittest.TestCase):
    def _confirm(self, status):
        order = _order([{"key": "listing_rewrite", "name": "Listing Rewrite", "price": 199.0}],
                       sumup_checkout_id="chk_1")
        with mock.patch.object(addons.sumup_service, "get_checkout_status",
                               new=mock.AsyncMock(return_value={"status": status})):
            asyncio.run(addons.confirm_order(mock.Mock(), order))
        return order

    def test_paid_marks_completed(self):
        order = self._confirm("PAID")
        self.assertEqual(order.status, "completed")
        self.assertIsNotNone(order.paid_at)

    def test_unpaid_stays_pending(self):
        order = self._confirm("PENDING")
        self.assertEqual(order.status, "pending")
        self.assertIsNone(order.paid_at)


class EmailTests(unittest.TestCase):
    def test_team_emailed_once(self):
        order = _order([{"key": "relaunch_strategy", "name": "Relaunch Strategy", "price": 299.0}],
                       status="completed", reference="SLA-1234-ABCD")
        send = mock.AsyncMock(return_value=True)
        with mock.patch.object(addons.email_service, "send_admin_notification", new=send):
            self.assertTrue(asyncio.run(addons.email_team(order, _prospect())))
            self.assertIsNotNone(order.team_emailed_at)
            # Already emailed → no second send.
            self.assertFalse(asyncio.run(addons.email_team(order, _prospect())))
        self.assertEqual(send.await_count, 1)
        fields = send.await_args.args[2]
        self.assertIn("Relaunch Strategy", fields["Services"])
        self.assertEqual(fields["Total"], "£299.00")


if __name__ == "__main__":
    unittest.main()
