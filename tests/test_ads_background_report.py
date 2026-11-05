"""The ads funnel writes a new listing's report in the background: /ads/start
answers once the listing is read, the visitor carries on, and the preview
step waits for the report only if it isn't in yet. Runs the real endpoints
and the background job against a throwaway SQLite database; the listing
reader and the report writer are faked."""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.db import database
from app.db.database import get_db
from app.models.models import StaleAgentAccount, StaleListingProspect
from app.routers import stale_listings
from app.services import ads_funnel
from app.services import stale_prospect_service as sps


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)

LISTING = "https://www.rightmove.co.uk/properties/161234567"
SCRAPED = {
    "address": "12 Oak Road, Leeds LS6 2AB", "title": "12 Oak Road, Leeds LS6 2AB", "price": "£650,000",
    "postcode": "LS6 2AB", "property_type": "Detached house", "bedrooms": "4", "bathrooms": "2",
    "listed_date": "Added on 01/06/2026", "images": ["https://img/1.jpg"],
}
REPORT = {"key_findings": [{"title": "Price", "description": "Above recent sales."}], "scores": {"pricing": 4}}
PREVIEW = {"key_issues": [{"title": "Price", "description": "Above recent sales."}], "overall_score": 61}


class AdsBackgroundReportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)

        async def create():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: [m.__table__.create(c) for m in (StaleListingProspect, StaleAgentAccount)])
        asyncio.run(create())

        async def override_db():
            async with self.Session() as session:
                yield session

        app = FastAPI()
        app.include_router(stale_listings.public_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)

        self.started: list = []
        self.writes = 0
        self.write_fails = 0

        async def fake_write(**kwargs):
            self.writes += 1
            if self.write_fails:
                self.write_fails -= 1
                raise RuntimeError("model unavailable")
            return dict(REPORT), dict(PREVIEW), [{"address": "10 Oak Road", "price": 600000}]

        async def fake_scrape(url):
            return dict(SCRAPED)

        for patcher in (
            mock.patch.object(database, "AsyncSessionLocal", self.Session),
            mock.patch.object(ads_funnel, "scrape_single_listing", fake_scrape),
            mock.patch.object(sps, "write_listing_report", fake_write),
            mock.patch.object(ads_funnel, "start_report", lambda pid: self.started.append(pid)),
            mock.patch.object(ads_funnel, "refresh_competition", mock.AsyncMock()),
            mock.patch.object(ads_funnel, "log_listings_to_sheet", mock.AsyncMock()),
            mock.patch.object(ads_funnel, "REPORT_RETRY_DELAY_SECONDS", 0),
            mock.patch.object(stale_listings, "refresh_sold_comparables_in_background", mock.AsyncMock()),
            # Postgres matches listing links by regex; SQLite can't, so by id here.
            mock.patch.object(sps, "same_rightmove_listing",
                              lambda url: StaleListingProspect.rightmove_id == sps.rightmove_listing_id(url)),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    def rows(self) -> list[StaleListingProspect]:
        async def read():
            async with self.Session() as db:
                return list((await db.execute(select(StaleListingProspect))).scalars().all())
        return asyncio.run(read())

    def start(self, audience="owner", channel="rm") -> dict:
        res = self.client.post("/api/v1/stale-listings/ads/start",
                               json={"listing_url": LISTING, "audience": audience, "channel": channel})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def preview(self, code: str) -> dict:
        res = self.client.get("/api/v1/stale-listings/prospects/preview", params={"code": code})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def test_the_property_comes_back_before_the_report_is_written(self) -> None:
        started = self.start()
        self.assertEqual(self.writes, 0)  # nothing written on the request
        (prospect,) = self.rows()
        self.assertIsNone(prospect.report_json)
        self.assertEqual(prospect.processing_status, sps.REPORT_PENDING)
        self.assertEqual(self.started, [prospect.id])  # the background write began

        data = self.preview(started["property_code"])
        self.assertEqual(data["report_status"], "pending")
        self.assertEqual(data["property_address"], "12 Oak Road, Leeds LS6 2AB")
        self.assertEqual(data["asking_price"], 650000)
        self.assertEqual(data["unlock_price"], 99.0)

        # Paying has to wait for it.
        res = self.client.post("/api/v1/stale-listings/prospects/checkout",
                               json={"property_code": started["property_code"], "payment_method": "card"})
        self.assertEqual(res.status_code, 409, res.text)

        # The background job writes it; the preview then has it.
        self.assertEqual(asyncio.run(ads_funnel.finish_report(prospect.id)), "ready")
        data = self.preview(started["property_code"])
        self.assertEqual(data["report_status"], "ready")
        self.assertEqual(data["preview"]["key_issues"][0]["title"], "Price")
        (prospect,) = self.rows()
        self.assertEqual(prospect.processing_status, "report_ready")
        self.assertIsNotNone(prospect.sold_comparables_at)

    def test_an_agents_copy_gets_the_report_once_it_is_written(self) -> None:
        started = self.start(audience="agent", channel="meta")
        owner = next(r for r in self.rows() if r.audience == "owner")
        copy = next(r for r in self.rows() if r.audience == "agent")
        self.assertEqual(started["property_code"], copy.property_code)
        self.assertEqual(copy.processing_status, sps.REPORT_PENDING)

        self.assertEqual(asyncio.run(ads_funnel.finish_report(copy.id)), "ready")
        self.assertEqual(self.writes, 1)  # written once, for the owner
        for row in self.rows():
            self.assertEqual(json.loads(row.report_json), REPORT, row.audience)
            self.assertEqual(row.processing_status, "report_ready")
        # (An agent's copy opens by its link's token, which SQLite can't look up.)
        self.assertEqual(sps.report_status(next(r for r in self.rows() if r.id == copy.id)), "ready")
        self.assertEqual(asyncio.run(ads_funnel.finish_report(owner.id)), "ready")
        self.assertEqual(self.writes, 1)  # nothing written twice

    def test_a_failed_report_shows_and_try_again_restarts_it(self) -> None:
        started = self.start()
        self.write_fails = 2  # the first go and its one retry
        (prospect,) = self.rows()
        self.assertEqual(asyncio.run(ads_funnel.finish_report(prospect.id)), "failed")
        self.assertEqual(self.writes, 2)
        self.assertEqual(self.preview(started["property_code"])["report_status"], "failed")
        self.assertIn("model unavailable", self.rows()[0].last_error)

        self.started.clear()
        res = self.client.post("/api/v1/stale-listings/prospects/report-retry",
                               json={"property_code": started["property_code"]})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["report_status"], "pending")
        self.assertEqual(self.started, [prospect.id])
        self.assertEqual(asyncio.run(ads_funnel.finish_report(prospect.id)), "ready")
        self.assertEqual(self.preview(started["property_code"])["report_status"], "ready")

    def test_a_listing_that_already_has_its_report_is_unchanged(self) -> None:
        async def seed():
            async with self.Session() as db:
                db.add(StaleListingProspect(
                    property_code="5150", qr_token_hash=uuid.uuid4().hex, property_address="12 Oak Road, Leeds",
                    rightmove_url=LISTING, rightmove_id="161234567", asking_price=650000, audience="owner",
                    report_json=json.dumps(REPORT), preview_json=json.dumps(PREVIEW), processing_status="report_ready",
                ))
                await db.commit()
        asyncio.run(seed())
        started = self.start()
        self.assertEqual(self.started, [])
        self.assertEqual(self.preview(started["property_code"])["report_status"], "ready")

    def test_reports_left_pending_are_restarted(self) -> None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)  # SQLite keeps no timezone

        async def seed():
            async with self.Session() as db:
                for code, age, report in (("1001", 600, None), ("1002", 10, None), ("1003", 600, json.dumps(REPORT))):
                    db.add(StaleListingProspect(
                        property_code=code, qr_token_hash=uuid.uuid4().hex, property_address=f"{code} Road",
                        rightmove_url=f"https://www.rightmove.co.uk/properties/{code}", audience="owner",
                        report_json=report, processing_status="report_ready" if report else sps.REPORT_PENDING,
                        created_at=now - timedelta(seconds=age),
                    ))
                await db.commit()
        asyncio.run(seed())
        self.assertEqual(asyncio.run(ads_funnel.resume_pending_reports()), 1)
        (restarted,) = self.started
        self.assertEqual(next(r.property_code for r in self.rows() if r.id == restarted), "1001")

    def test_report_status(self) -> None:
        from types import SimpleNamespace as P

        self.assertEqual(sps.report_status(P(report_json="{}", processing_status=sps.REPORT_PENDING)), "ready")
        self.assertEqual(sps.report_status(P(report_json=None, processing_status=sps.REPORT_PENDING)), "pending")
        self.assertEqual(sps.report_status(P(report_json=None, processing_status=sps.REPORT_FAILED)), "failed")
        # Letters and older rows: whatever their status, they count as ready.
        self.assertEqual(sps.report_status(P(report_json=None, processing_status="letter_ready")), "ready")


if __name__ == "__main__":
    unittest.main()
