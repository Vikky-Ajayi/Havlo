"""The marketing team's tracking brief (Nov 2026): /assess/seller's events sent
to Meta's Conversions API from the server too (meta_capi.py), the bad-link
error types, and the "left their details but didn't buy" audience
(meta_audience.py). Meta itself is faked."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sqlite3
import tempfile
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.db.database import get_db
from app.models.models import StaleListingProspect, StaleProspectAddonOrder
from app.routers import stale_listings
from app.services import ads_funnel, meta_audience, meta_capi


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)


def sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


SETTINGS = SimpleNamespace(META_CAPI_ACCESS_TOKEN="tok", META_PIXEL_ID="123", META_TEST_EVENT_CODE="",
                           META_GRAPH_VERSION="v23.0", TEST_ORDER_EMAILS="@heyhavlo.com")


class HashingTests(unittest.TestCase):
    def test_contact_details_are_normalised_then_hashed(self):
        self.assertEqual(meta_capi.hash_email("  Ann@Example.COM "), sha("ann@example.com"))
        self.assertEqual(meta_capi.hash_phone("+44 07700 900123"), sha("447700900123"))
        self.assertIsNone(meta_capi.hash_phone("07700 900123"))  # no country code: can't be sure
        self.assertEqual(meta_capi.split_name("Ann Mary SMITH"), ("ann", "mary smith"))

    def test_details_only_once_given_and_always_the_external_id(self):
        pid = uuid.uuid4()
        before = SimpleNamespace(id=pid, contact_email=None, contact_phone=None, contact_name=None)
        data = meta_capi.user_data(before, {"ip": "1.2.3.4", "ua": "Safari", "fbc": "fb.1.1.abc", "fbp": ""})
        self.assertEqual(data, {"external_id": [sha(str(pid))], "client_ip_address": "1.2.3.4",
                                "client_user_agent": "Safari", "fbc": "fb.1.1.abc"})
        after = SimpleNamespace(id=pid, contact_email="ann@example.com", contact_phone="+44 7700900123",
                                contact_name="Ann Smith")
        data = meta_capi.user_data(after, {})
        self.assertEqual(data["em"], [sha("ann@example.com")])
        self.assertEqual(data["ph"], [sha("447700900123")])
        self.assertEqual((data["fn"], data["ln"]), ([sha("ann")], [sha("smith")]))


class ErrorTypeTests(unittest.TestCase):
    def test_each_bad_link_says_what_was_wrong(self):
        for link, kind in (("hello", "not_a_listing_link"), ("https://www.zoopla.co.uk/for-sale/", "not_a_listing_page"),
                           ("https://www.onthemarket.com/details/1/", "unsupported_site")):
            with self.assertRaises(ads_funnel.ListingLinkError) as caught:
                ads_funnel.clean_rightmove_url(link)
            self.assertEqual(caught.exception.kind, kind)


def prospect_row(code, **kw):
    base = dict(property_code=code, qr_token_hash=code, property_address="x", country="UK",
                rightmove_url=f"https://example.com/{code}", lead_source="meta_seller", payment_status="pending")
    return StaleListingProspect(**{**base, **kw})


class ServerEventTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.addCleanup(os.unlink, self.tmp.name)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.addCleanup(lambda: asyncio.run(self.engine.dispose()))

        async def create():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: [m.__table__.create(c) for m in (StaleListingProspect, StaleProspectAddonOrder)])
            async with self.Session() as db:
                db.add(prospect_row("1111", contact_email="ann@example.com", contact_name="Ann Smith",
                                    contact_phone="+44 7700900123"))
                db.add(prospect_row("2222", lead_source="google_seller"))
                await db.commit()
        asyncio.run(create())

        async def override_db():
            async with self.Session() as session:
                yield session

        app = FastAPI()
        app.include_router(stale_listings.public_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)
        self.sent: list = []

        async def fake_send(events):
            self.sent.extend(events)
            return True
        for patcher in (mock.patch.object(meta_capi, "send", fake_send),
                        mock.patch.object(meta_capi, "AsyncSessionLocal", self.Session),
                        mock.patch.object(meta_capi, "get_settings", return_value=SETTINGS),
                        mock.patch("app.services.attribution.get_settings", return_value=SETTINGS)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def post(self, **body):
        base = {"event_name": "InitiateCheckout", "event_id": "InitiateCheckout-1111", "code": "1111",
                "fbp": "fb.1.1.p", "fbc": "fb.1.1.c", "source_url": "https://www.heyhavlo.com/assess/seller",
                "consent": True}
        return self.client.post("/api/v1/stale-listings/meta/event", json={**base, **body},
                                headers={"user-agent": "Safari", "x-forwarded-for": "1.2.3.4"})

    def prospect(self, code):
        async def get():
            async with self.Session() as db:
                from sqlalchemy import select
                return (await db.execute(select(StaleListingProspect).where(StaleListingProspect.property_code == code))).scalar_one()
        return asyncio.run(get())

    def test_checkout_goes_with_the_value_and_details_from_the_prospect(self):
        self.assertEqual(self.post().json(), {"sent": True})
        (event,) = self.sent
        self.assertEqual((event["event_name"], event["event_id"]), ("InitiateCheckout", "InitiateCheckout-1111"))
        self.assertEqual(event["custom_data"]["value"], 79.0)  # /assess/seller's price
        self.assertEqual(event["custom_data"]["currency"], "GBP")
        self.assertEqual(event["user_data"]["em"], [sha("ann@example.com")])
        self.assertEqual(event["user_data"]["fbc"], "fb.1.1.c")
        self.assertEqual(event["user_data"]["client_ip_address"], "1.2.3.4")
        kept = json.loads(self.prospect("1111").meta_tracking_json)
        self.assertTrue(kept["consent"])
        self.assertEqual(kept["fbp"], "fb.1.1.p")

    def test_nothing_without_consent_or_from_other_pages(self):
        self.assertEqual(self.post(consent=False).json(), {"sent": False})
        self.assertEqual(self.post(code="2222", event_id="InitiateCheckout-2222").json(), {"sent": False})
        self.assertEqual(self.post(event_name="Purchase").json(), {"sent": False})  # only the server sends Purchase
        self.assertEqual(self.sent, [])

    def test_a_bad_link_goes_with_its_error_type(self):
        self.assertEqual(self.post(event_name="ListingLinkError", event_id="ListingLinkError-x", code=None,
                                   error_type="not_a_listing_link").json(), {"sent": True})
        self.assertEqual(self.sent[0]["custom_data"], {"error_type": "not_a_listing_link"})
        self.assertNotIn("external_id", self.sent[0]["user_data"])

    def test_purchase_once_from_the_server_for_a_real_card_payment(self):
        self.post()  # consent and click IDs kept

        async def pay(**kw):
            async with self.Session() as db:
                from sqlalchemy import select
                p = (await db.execute(select(StaleListingProspect).where(StaleListingProspect.property_code == "1111"))).scalar_one()
                for k, v in kw.items():
                    setattr(p, k, v)
                await db.commit()
                return p.id
        pid = asyncio.run(pay(payment_status="completed", payment_method="card", unlocked_at=datetime.now(timezone.utc)))
        self.sent.clear()
        self.assertTrue(asyncio.run(meta_capi.send_purchase(str(pid))))
        self.assertFalse(asyncio.run(meta_capi.send_purchase(str(pid))))  # once
        (event,) = self.sent
        self.assertEqual(event["event_id"], f"order-{pid}")
        self.assertEqual(event["custom_data"]["order_id"], str(pid))
        self.assertEqual(event["custom_data"]["value"], 79.0)
        self.assertEqual(event["user_data"]["fbc"], "fb.1.1.c")

    def test_never_a_purchase_for_a_promo_code(self):
        self.post()
        p = self.prospect("1111")

        async def promo():
            async with self.Session() as db:
                row = await db.get(StaleListingProspect, p.id)
                row.payment_status, row.payment_method = "completed", "promo"
                await db.commit()
        asyncio.run(promo())
        self.sent.clear()
        self.assertFalse(asyncio.run(meta_capi.send_purchase(str(p.id))))
        self.assertEqual(self.sent, [])


    def test_purchase_from_any_page_and_agentpurchase_for_agents(self):
        async def add():
            async with self.Session() as db:
                rows = [prospect_row("3333", lead_source="google_seller", payment_status="completed",
                                     payment_method="card", unlocked_at=datetime.now(timezone.utc)),
                        prospect_row("4444", lead_source="meta_agent", audience="agent", payment_status="completed",
                                     payment_method="card", unlocked_at=datetime.now(timezone.utc)),
                        prospect_row("5555", lead_source=None, payment_status="completed", payment_method="card",
                                     unlocked_at=datetime.now(timezone.utc))]  # no cookie consent
                for row in rows:
                    meta_capi.remember(row, {"fbc": "fb.1.1.c"}) if row.property_code != "5555" else None
                    db.add(row)
                await db.commit()
                return [r.id for r in rows]
        ids = asyncio.run(add())
        results = [asyncio.run(meta_capi.send_purchase(str(i))) for i in ids]
        self.assertEqual(results, [True, True, False])
        self.assertEqual([e["event_name"] for e in self.sent], ["Purchase", "AgentPurchase"])
        self.assertEqual(self.sent[1]["custom_data"]["content_name"], "Havlo Agent Report")

    def test_the_checkout_keeps_consent_for_any_page(self):
        async def add():
            async with self.Session() as db:
                db.add(prospect_row("6666", lead_source="sell_seller", report_json="{}"))
                await db.commit()
        asyncio.run(add())
        # Bank transfer: the same checkout, without going to SumUp.
        with mock.patch.object(stale_listings, "report_status", return_value="ready"):
            self.client.post("/api/v1/stale-listings/prospects/checkout",
                             json={"property_code": "6666", "payment_method": "bank_transfer",
                                   "meta": {"consent": True, "fbp": "fb.1.1.p", "fbc": "fb.1.1.c"}},
                             headers={"user-agent": "Safari"})
        kept = meta_capi.tracking(self.prospect("6666"))
        self.assertEqual((kept.get("consent"), kept.get("fbc")), (True, "fb.1.1.c"))


def lead(email, phone="", name="Ann Smith", paid="pending", unsub=None, sms_unsub=None):
    return SimpleNamespace(contact_email=email, contact_phone=phone, contact_name=name, payment_status=paid,
                           unsubscribed_at=unsub, sms_unsubscribed_at=sms_unsub, country="UK")


class AudienceTests(unittest.TestCase):
    def test_leads_who_didnt_buy_once_each_without_customers_or_opt_outs(self):
        now = datetime.now(timezone.utc)
        with mock.patch("app.services.attribution.get_settings", return_value=SETTINGS):
            out = meta_audience.pick([
                lead("ann@example.com", "+44 7700900123"),
                lead("ANN@example.com"),  # the same person, another property
                lead("bob@example.com", "+44 7700900999", paid="completed"),
                lead("bob@example.com"),  # bought another property: a customer
                lead("cat@example.com", unsub=now),
                lead("dan@example.com", sms_unsub=now),
                lead("team@heyhavlo.com"),
                lead("", "+44 7700900555", name="Eve"),
                lead("", ""),
            ])
        self.assertEqual(out, [
            {"email": "ann@example.com", "phone": "447700900123", "fn": "Ann", "ln": "Smith", "country": "GB"},
            {"email": "", "phone": "447700900555", "fn": "Eve", "ln": "", "country": "GB"},
        ])
        self.assertTrue(meta_audience.to_csv(out).startswith("email,phone,fn,ln,country"))

    def test_buyers_once_each_without_internal_or_opt_outs(self):
        now = datetime.now(timezone.utc)
        with mock.patch("app.services.attribution.get_settings", return_value=SETTINGS):
            out = meta_audience.pick_buyers([
                lead("bob@example.com", "+44 7700900999", paid="completed"),
                lead("BOB@example.com", paid="completed"),
                lead("ann@example.com"),  # didn't buy
                lead("cat@example.com", paid="completed", unsub=now),
                lead("team@heyhavlo.com", paid="completed"),
            ])
        self.assertEqual([r["email"] for r in out], ["bob@example.com"])


if __name__ == "__main__":
    unittest.main()
