"""The in-house assessment dataset (assessment_dataset.py): what's pulled from
each report, the sync that keeps it up to date, and the stats."""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.models.models import (
    AssessmentRecord,
    StaleListingMonitor,
    StaleListingMonitorEvent,
    StaleListingProspect,
    StaleProspectAddonOrder,
)
from app.services import assessment_dataset as ad
from app.services import report_factors as rf


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)

SNAPSHOT = {
    "address": "1 Test Road, Leeds", "postcode": "LS6 2AB", "price": "£450,000", "property_type": "Semi-Detached",
    "bedrooms": "3", "description": "A lovely semi with a garden. " * 30, "features": ["Garden", "Parking"],
    "media": {"photos": 12, "floorplans": 0, "virtual_tours": 0}, "images": ["https://img/1.jpg"],
}


def v2_report(**verdicts):
    factors = []
    for f in rf.FACTORS:
        v = verdicts.get(f["key"], "working_well")
        factors.append({"num": f["num"], "key": f["key"], "name": f["name"], "verdict": v,
                        "severity": 4 if v == "problem" else None, "found": "x", "why": "y", "action": "z"})
    return {"version": 2, "factors": factors, "overall_score": 48, "_model": "openai:gpt-6.1-terra",
            "_photo_review": {"photos_seen": 12, "weak_photos": [{"n": 3}], "missing_shots": ["Garden"],
                              "rooms_shown": ["Kitchen"]}}


def prospect(**extra):
    base = dict(
        id="p1", report_json=json.dumps(v2_report(photography="problem", asking_price="problem")),
        agent_edited_report_json=None, listing_snapshot_json=json.dumps(SNAPSHOT), asking_price=450000.0,
        listing_duration_days=200, country="UK", city="Leeds", postcode="LS6 2AB", property_type="Semi-Detached",
        bedrooms=3, bathrooms=1, lead_source="meta_seller", is_manual=False, rightmove_id="93138003",
        rightmove_url="https://www.rightmove.co.uk/properties/93138003", parent_prospect_id=None,
        processed_at=datetime(2026, 11, 1, tzinfo=timezone.utc), created_at=datetime(2026, 11, 1, tzinfo=timezone.utc),
        sold_comparables_at=None, agent_brand="Smith & Co", agent_company_name=None, agent_branch_id="123",
        code_looked_up_at=datetime(2026, 11, 1, tzinfo=timezone.utc), contact_details_submitted_at=None,
        checkout_visited_at=None, payment_status="pending", unlocked_at=None, audience="owner",
        contact_name="Jane Doe", contact_email="jane@example.com", contact_phone="07700900000",
        property_address="1 Test Road, Leeds",
    )
    base.update(extra)
    return SimpleNamespace(**base)


class ExtractTests(unittest.TestCase):
    def test_a_20_factor_report_gives_its_flags_metrics_and_verdicts(self):
        v = ad.extract(prospect())
        flags, metrics = json.loads(v["flags_json"]), json.loads(v["metrics_json"])
        self.assertEqual(v["report_format"], "v2")
        self.assertEqual(v["channel"], "meta")
        self.assertEqual(v["postcode_district"], "LS6")
        self.assertEqual(v["property_type"], "semi-detached")
        self.assertEqual(v["price_band"], "£350k–500k")
        self.assertTrue(flags["poor_photos"])
        self.assertTrue(flags["pricing_issue"])
        self.assertTrue(flags["few_photos"])
        self.assertTrue(flags["no_floor_plan"])
        self.assertTrue(flags["no_video_or_tour"])
        self.assertTrue(flags["on_market_180"])
        self.assertTrue(flags["weak_photos_found"])
        self.assertEqual(metrics["photos"], 12)
        self.assertEqual(metrics["problems"], 2)
        self.assertEqual(json.loads(v["factors_json"])["photography"], {"verdict": "problem", "severity": 4})

    def test_no_personal_details_are_kept(self):
        text = json.dumps(ad.extract(prospect()), default=str)
        for secret in ("Jane", "jane@example.com", "07700900000", "1 Test Road", "93138003"):
            self.assertNotIn(secret, text)

    def test_an_older_report_uses_its_scores_and_findings(self):
        old = {"overall_score": 55, "scores": {"pricing": 30, "listing_presentation": 70},
               "key_findings": [{"type": "issue", "title": "Photos undersell the home"}]}
        flags = json.loads(ad.extract(prospect(report_json=json.dumps(old)))["flags_json"])
        self.assertTrue(flags["pricing_issue"])
        self.assertTrue(flags["poor_photos"])
        self.assertIsNone(flags["marketing_issue"])  # the older report has no such verdict

    def test_unknowns_stay_unknown(self):
        snap = {**SNAPSHOT, "media": {}}
        flags = json.loads(ad.extract(prospect(listing_snapshot_json=json.dumps(snap), listing_duration_days=None))["flags_json"])
        self.assertIsNone(flags["few_photos"])
        self.assertIsNone(flags["no_video_or_tour"])
        self.assertIsNone(flags["on_market_180"])

    def test_the_watch_gives_the_outcome_and_what_changed(self):
        at = datetime(2026, 11, 8, tzinfo=timezone.utc)
        events = [SimpleNamespace(scope="listing", kind="photos_updated", detected_at=at - timedelta(days=3)),
                  SimpleNamespace(scope="listing", kind="status_under_offer", detected_at=at),
                  SimpleNamespace(scope="nearby", kind="nearby_new", detected_at=at)]
        v = ad.extract(prospect(), monitor=SimpleNamespace(listing_status="under_offer"), events=events)
        self.assertEqual(v["outcome"], "under_offer")
        self.assertEqual(v["outcome_at"], at)
        self.assertEqual(json.loads(v["changes_json"]), {"photos_updated": 1, "status_under_offer": 1})


class StatsTests(unittest.TestCase):
    def _rows(self):
        rows = []
        for i, (photos_bad, paid, outcome) in enumerate([(True, True, "under_offer"), (True, False, None),
                                                          (False, True, "on_market"), (False, False, None)]):
            p = prospect(report_json=json.dumps(v2_report(photography="problem" if photos_bad else "working_well")),
                         payment_status="completed" if paid else "pending", rightmove_id=str(i),
                         listing_duration_days=100 + i * 50)
            v = ad.extract(p, monitor=SimpleNamespace(listing_status=outcome) if outcome else None, events=[])
            row = {k: v[k] for k in ad.EXPORT_COLUMNS if k in v}
            row.update(flags=json.loads(v["flags_json"]), metrics=json.loads(v["metrics_json"]),
                       factors=json.loads(v["factors_json"]), details=json.loads(v["details_json"]),
                       changes=json.loads(v["changes_json"] or "{}"), paid_at=None,
                       dom_bucket=ad._bucket(v["days_on_market"], ad.DOM_BUCKETS),
                       photo_bucket=ad._bucket(12, ad.PHOTO_BUCKETS), score_bucket="40–54", epc=None, month="2026-11")
            rows.append(row)
        return rows

    def test_shares_and_comparisons(self):
        s = ad.compute_stats(self._rows())
        self.assertEqual(s["total"], 4)
        poor = next(f for f in s["flags"] if f["key"] == "poor_photos")
        self.assertEqual((poor["count"], poor["pct"]), (2, 50.0))
        self.assertEqual(poor["paid_rate_with"], 50.0)
        self.assertEqual(poor["agreed_rate_with"], 100.0)
        self.assertEqual(poor["agreed_rate_without"], 0.0)
        photography = next(f for f in s["factors"] if f["key"] == "photography")
        self.assertEqual(photography["problem_pct"], 50.0)
        self.assertEqual(s["funnel"]["paid"], 2)
        self.assertEqual(s["outcomes"]["agreed_pct"], 50.0)
        self.assertEqual(s["by_month"][0]["poor_photos_pct"], 50.0)

    def test_the_export_has_a_column_per_flag_and_factor(self):
        header = ad.export_csv(self._rows()).splitlines()[0].split(",")
        self.assertIn("flag_poor_photos", header)
        self.assertIn("factor_photography", header)
        self.assertNotIn("contact_email", header)


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.addCleanup(os.unlink, self.tmp.name)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.addCleanup(lambda: asyncio.run(self.engine.dispose()))

        async def seed():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: [m.__table__.create(c) for m in (
                    StaleListingProspect, StaleListingMonitor, StaleListingMonitorEvent, StaleProspectAddonOrder,
                    AssessmentRecord)])
            async with self.Session() as db:
                for code, report in (("1111", json.dumps(v2_report(photography="problem"))), ("2222", None)):
                    db.add(StaleListingProspect(property_code=code, qr_token_hash=code, property_address="x",
                                                country="UK", rightmove_url=f"https://example.com/{code}",
                                                report_json=report, listing_snapshot_json=json.dumps(SNAPSHOT),
                                                asking_price=450000, listing_duration_days=120))
                await db.commit()

        asyncio.run(seed())

    def _sync(self):
        async def run():
            async with self.Session() as db:
                out = await ad.sync_batch(db)
                await db.commit()
                return out
        return asyncio.run(run())

    def _records(self):
        async def run():
            async with self.Session() as db:
                return (await db.execute(select(AssessmentRecord))).scalars().all()
        return asyncio.run(run())

    def test_reports_are_added_once_and_refreshed_when_they_change(self):
        self.assertEqual(self._sync(), {"synced": 1, "added": 1})  # the one without a report is skipped
        self.assertEqual(self._sync(), {"synced": 0, "added": 0})
        record = self._records()[0]
        self.assertTrue(json.loads(record.flags_json)["poor_photos"])

        async def change():
            async with self.Session() as db:
                p = (await db.execute(select(StaleListingProspect).where(StaleListingProspect.property_code == "1111"))).scalar_one()
                p.report_json = json.dumps(v2_report())
                p.updated_at = datetime.now(timezone.utc) + timedelta(seconds=5)
                await db.commit()
        asyncio.run(change())
        self.assertEqual(self._sync(), {"synced": 1, "added": 0})
        self.assertFalse(json.loads(self._records()[0].flags_json)["poor_photos"])


if __name__ == "__main__":
    unittest.main()
