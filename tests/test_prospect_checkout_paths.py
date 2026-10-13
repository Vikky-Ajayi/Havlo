"""How a full assessment is paid for is recorded, and SumUp's "back to
merchant" link is the one the page sent. Runs the real checkout endpoint
against a throwaway SQLite database; SumUp itself is faked.
"""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.db.database import get_db
from app.models.models import StaleListingProspect
from app.routers import stale_listings


# SQLite has no ARRAY type; store the Postgres array columns as JSON text.
@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)

CODE = "4821"  # looked up by code: SQLite has no array-contains for token lookups
URL = "/api/v1/stale-listings/prospects/checkout"


class CheckoutPathsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        asyncio.run(self._seed())

        async def override_db():
            async with self.Session() as session:
                yield session

        app = FastAPI()
        app.include_router(stale_listings.public_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)
        patches = [
            mock.patch.object(stale_listings, "expand_report_in_background", mock.AsyncMock()),
            mock.patch.object(stale_listings, "_stale_prospect_promo_valid", lambda code: code == "GOODCODE"),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    async def _seed(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: StaleListingProspect.__table__.create(c))
        async with self.Session() as db:
            db.add(StaleListingProspect(
                property_code="4821", qr_token_hash="h1", property_address="1 Test Road",
                country="UK", rightmove_url="https://example.com/1", asking_price=650000,
            ))
            await db.commit()

    def _prospect(self) -> StaleListingProspect:
        async def get():
            async with self.Session() as db:
                return (await db.execute(select(StaleListingProspect))).scalar_one()

        return asyncio.run(get())

    def test_promo_unlock_is_recorded_as_promo(self) -> None:
        r = self.client.post(URL, json={"property_code": CODE, "payment_method": "card", "promo_code": "GOODCODE"})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["unlocked"])
        self.assertEqual(body["payment_method"], "promo")
        prospect = self._prospect()
        self.assertEqual(prospect.payment_status, "completed")
        self.assertEqual(prospect.payment_method, "promo")

    def test_card_checkout_sends_sumup_the_pages_return_link(self) -> None:
        sent = {}

        async def fake_create_checkout(**kwargs):
            sent.update(kwargs)
            return {"id": "chk_1", "checkout_url": "https://pay.example/chk_1"}

        back = "https://www.heyhavlo.com/assess/seller?fbclid=x&paid=card"
        with mock.patch.object(stale_listings.sumup_service, "create_checkout", fake_create_checkout):
            r = self.client.post(URL, json={"property_code": CODE, "payment_method": "card", "redirect_url": back})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json().get("unlocked"))
        # The page's own address and marker come back from SumUp, plus the property code.
        self.assertEqual(sent["redirect_url"], f"{back}&code={CODE}")
        prospect = self._prospect()
        self.assertEqual(prospect.payment_method, "card")
        self.assertEqual(prospect.payment_status, "pending")

    def test_a_wrong_promo_code_unlocks_nothing(self) -> None:
        async def fake_create_checkout(**kwargs):
            return {"id": "chk_2", "checkout_url": "https://pay.example/chk_2"}

        with mock.patch.object(stale_listings.sumup_service, "create_checkout", fake_create_checkout):
            r = self.client.post(URL, json={"property_code": CODE, "payment_method": "card", "promo_code": "NOPE"})
        self.assertFalse(r.json().get("unlocked"))
        self.assertNotEqual(self._prospect().payment_method, "promo")


if __name__ == "__main__":
    unittest.main()
