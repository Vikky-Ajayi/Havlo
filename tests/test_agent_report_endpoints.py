"""The agent report's endpoints: the page data (waiting for a rebuild when
the stored report is an older shape) and the PDF download. Real endpoints,
throwaway SQLite database (so prospects are looked up by code: SQLite can't
run the token lookup's array operator); the background rebuild is stubbed out."""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
from datetime import date, datetime, timezone
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.db.database import get_db
from app.models.models import StaleListingProspect
from app.routers import stale_listings
from app.services import agent_report as ar
from app.services.stale_prospect_service import hash_access_token
from tests.test_agent_report import NEARBY, PORTFOLIO, REPORT, SALES, SUBJECT, TODAY


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)
BASE = "/api/v1/stale-listings/prospects"
INTEL = ar.compute_intel(SUBJECT, NEARBY, SALES, REPORT, PORTFOLIO, radius=0.5, today=TODAY,
                         sources={"nearby": "rightmove", "sales_area": "within half a mile"})


class AgentReportEndpointTests(unittest.TestCase):
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
        self.refresh = mock.patch.object(ar, "start_refresh").start()
        self.addCleanup(mock.patch.stopall)
        self.cwd = os.getcwd()

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    async def _seed(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: StaleListingProspect.__table__.create(c))
        now = datetime.now(timezone.utc)
        common = dict(property_address="Lake Road East, Lakeside, Cardiff", postcode="CF23 5PH", country="UK",
                      rightmove_url="https://www.rightmove.co.uk/properties/123", asking_price=600000,
                      listing_duration_days=300, property_type="Detached house", bedrooms=4,
                      report_json=json.dumps(REPORT), listing_snapshot_json="{}", code_looked_up_at=now)
        async with self.Session() as db:
            db.add_all([
                StaleListingProspect(property_code="1001", qr_token_hash=hash_access_token("paid"), audience="agent",
                                     payment_status="completed", unlocked_at=now, agent_intel_json=json.dumps(INTEL),
                                     agent_intel_at=now, agent_brand="Acme Homes", **common),
                StaleListingProspect(property_code="1002", qr_token_hash=hash_access_token("unpaid"), audience="agent",
                                     agent_intel_json=json.dumps(INTEL), agent_intel_at=now, **common),
                StaleListingProspect(property_code="1003", qr_token_hash=hash_access_token("old"), audience="agent",
                                     payment_status="completed", agent_intel_json=json.dumps({**INTEL, "version": 1}),
                                     agent_intel_at=now, **common),
                StaleListingProspect(property_code="1004", qr_token_hash=hash_access_token("owner"), audience="owner", **common),
            ])
            await db.commit()

    def test_report_data_for_a_paid_agency(self) -> None:
        body = self.client.get(f"{BASE}/agent-intel", params={"code": "1001"}).json()
        self.assertEqual(body["status"], "ready")
        self.assertFalse(body["locked"])
        self.assertEqual(body["intel"]["headline"]["vendor_pressure"], "High")
        self.assertIn("competitors", body["intel"])

    def test_teaser_before_purchase(self) -> None:
        body = self.client.get(f"{BASE}/agent-intel", params={"code": "1002"}).json()
        self.assertTrue(body["locked"])
        self.assertIn("headline", body["intel"])
        self.assertNotIn("competitors", body["intel"])

    def test_an_older_report_is_rebuilt_before_it_is_shown(self) -> None:
        body = self.client.get(f"{BASE}/agent-intel", params={"code": "1003"}).json()
        self.assertEqual(body["status"], "preparing")
        self.refresh.assert_called()

    def test_pdf_download(self) -> None:
        with tempfile.TemporaryDirectory() as out:
            os.chdir(out)
            try:
                response = self.client.get(f"{BASE}/agent-report.pdf", params={"code": "1001", "fee": 1.5})
            finally:
                os.chdir(self.cwd)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn("Havlo-agent-report-1001.pdf", response.headers["content-disposition"])

    def test_pdf_needs_a_paid_agency_copy(self) -> None:
        self.assertEqual(self.client.get(f"{BASE}/agent-report.pdf", params={"code": "1002"}).status_code, 402)
        self.assertEqual(self.client.get(f"{BASE}/agent-report.pdf", params={"code": "1004"}).status_code, 404)
        self.assertEqual(self.client.get(f"{BASE}/agent-report.pdf", params={"code": "1001", "fee": 30}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
