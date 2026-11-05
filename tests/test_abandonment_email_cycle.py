"""The pre-purchase (abandonment) email drip's send cycle, end to end against a
throwaway SQLite database. From 19 Oct to 5 Nov 2026 it crashed on every
cycle that had an email due (it unpacked three values from (prospect, stage)
pairs), so no drip email went out; this runs the real cycle to keep it
sending."""
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

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.models.models import StaleListingProspect, StaleProspectAbandonmentEmail
from app.services import email_service, stale_prospect_abandonment as drip


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)
NOW = datetime.now(timezone.utc)


class _SqliteClock(datetime):
    """SQLite hands timestamps back without a timezone (Postgres keeps it), so
    the cycle's clock runs in naive UTC here to subtract like for like."""

    @classmethod
    def now(cls, tz=None):
        return datetime.now(timezone.utc).replace(tzinfo=None)


class AbandonmentEmailCycleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        asyncio.run(self._seed())
        self.sent: list[dict] = []
        for patcher in (
            mock.patch.object(drip, "AsyncSessionLocal", self.Session),
            mock.patch.object(drip, "datetime", _SqliteClock),
            mock.patch.object(email_service, "send_stale_prospect_abandonment_email_sync",
                              lambda **kw: self.sent.append(kw) or True),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    def lead(self, email: str, **extra) -> StaleListingProspect:
        values = dict(
            property_code=f"{len(email):04d}"[-4:], qr_token_hash=uuid.uuid4().hex, property_address="1 High St, Leeds",
            rightmove_url=f"https://www.rightmove.co.uk/properties/{uuid.uuid4().int % 10**8}", asking_price=650000,
            contact_name="Sam Owner", contact_email=email, contact_details_submitted_at=NOW - timedelta(hours=2),
            payment_status="pending", audience="owner",
        )
        values.update(extra)
        return StaleListingProspect(**values)

    async def _seed(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: [m.__table__.create(c) for m in (StaleListingProspect, StaleProspectAbandonmentEmail)])
        async with self.Session() as db:
            db.add_all([
                self.lead("letter@example.com"),
                self.lead("kept49@example.com", unlock_price=49.0),
                self.lead("review@example.com", lead_source="review_seller"),
                # Not this drip: ads homeowners (their own flow), payers, agents.
                self.lead("ads@example.com", lead_source="rm_seller"),
                self.lead("paid@example.com", payment_status="completed", unlocked_at=NOW),
                self.lead("agent@example.com", audience="agent"),
            ])
            await db.commit()

    def test_due_emails_are_sent_once_with_each_leads_price_and_page(self) -> None:
        result = asyncio.run(drip.run_abandonment_email_cycle())
        self.assertEqual(result["sent"], 3)
        got = {kw["to_email"]: kw for kw in self.sent}
        self.assertEqual(set(got), {"letter@example.com", "kept49@example.com", "review@example.com"})
        self.assertEqual({kw["stage"] for kw in self.sent}, {1})
        self.assertEqual(got["letter@example.com"]["price"], 99.0)
        self.assertEqual(got["kept49@example.com"]["price"], 49.0)
        self.assertEqual(got["review@example.com"]["landing_path"], "/review/seller")

        async def recorded():
            async with self.Session() as db:
                return (await db.execute(select(StaleProspectAbandonmentEmail))).scalars().all()
        self.assertEqual(len(asyncio.run(recorded())), 3)

        # Next cycle: stage 2 isn't due yet, and stage 1 never goes twice.
        self.sent.clear()
        self.assertEqual(asyncio.run(drip.run_abandonment_email_cycle())["sent"], 0)
        self.assertEqual(self.sent, [])

    def test_a_backlog_gets_only_the_latest_due_email(self) -> None:
        # Leads left waiting while the cycle was down: one 17 days in with
        # nothing sent, one 10 days in that had stages 1-3. Each gets only the
        # stage due now (8 and 7), not every missed one 5 minutes apart.
        async def add():
            async with self.Session() as db:
                fresh = self.lead("waited17@example.com", contact_details_submitted_at=NOW - timedelta(days=17))
                partway = self.lead("partway@example.com", contact_details_submitted_at=NOW - timedelta(days=10, hours=1))
                db.add_all([fresh, partway])
                await db.flush()
                db.add_all([StaleProspectAbandonmentEmail(prospect_id=partway.id, stage=s) for s in (1, 2, 3)])
                await db.commit()
        asyncio.run(add())

        asyncio.run(drip.run_abandonment_email_cycle())
        got = {kw["to_email"]: kw["stage"] for kw in self.sent}
        self.assertEqual(got["waited17@example.com"], 8)
        self.assertEqual(got["partway@example.com"], 7)

        self.sent.clear()
        for _ in range(5):  # the next five cycles (25 minutes): nothing more for either
            asyncio.run(drip.run_abandonment_email_cycle())
        self.assertEqual([kw for kw in self.sent if kw["to_email"] in got], [])


if __name__ == "__main__":
    unittest.main()
