"""Trustpilot invitations for promo-code customers (trustpilot_invites.py):
who gets one, when, and what Trustpilot is sent."""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.models.models import StaleListingProspect
from app.services import trustpilot_invites as ti


@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)

AFTER = ti.STARTED_AT + timedelta(hours=2)
SETTINGS = SimpleNamespace(TRUSTPILOT_AFS_EMAIL="heyhavlo.com+x@invite.trustpilot.com", TEST_ORDER_EMAILS="@heyhavlo.com")


def prospect(**kw):
    base = dict(payment_method="promo", payment_status="completed", trustpilot_invited_at=None,
                contact_email="ann@example.com", contact_name="Ann Smith", unlocked_at=AFTER,
                analyst_review_due_at=None, report_released_at=None, id=uuid.uuid4(), property_code="1234")
    return SimpleNamespace(**{**base, **kw})


class WhoTests(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch("app.services.attribution.get_settings", return_value=SETTINGS)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_promo_checkout_with_its_report_is_invited(self):
        self.assertTrue(ti.wants_invite(prospect()))

    def test_card_customers_internal_addresses_and_earlier_checkouts_are_not(self):
        self.assertFalse(ti.wants_invite(prospect(payment_method="card")))
        self.assertFalse(ti.wants_invite(prospect(contact_email="team@heyhavlo.com")))
        self.assertFalse(ti.wants_invite(prospect(contact_email="")))
        self.assertFalse(ti.wants_invite(prospect(unlocked_at=ti.STARTED_AT - timedelta(days=1))))
        self.assertFalse(ti.wants_invite(prospect(trustpilot_invited_at=AFTER)))

    def test_an_expert_review_waits_for_its_release(self):
        held = prospect(analyst_review_due_at=AFTER + timedelta(hours=72))
        self.assertFalse(ti.wants_invite(held))
        held.report_released_at = AFTER + timedelta(hours=72)
        self.assertTrue(ti.wants_invite(held))

    def test_trustpilot_gets_the_customer_in_its_snippet(self):
        p = prospect()
        _subject, html, _plain = ti.render(p)
        blob = html.split('<script type="application/json+trustpilot">')[1].split("</script>")[0]
        self.assertEqual(json.loads(blob), {"recipientEmail": "ann@example.com", "recipientName": "Ann Smith",
                                            "referenceId": str(p.id), "locale": "en-GB"})


class CycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.addCleanup(os.unlink, self.tmp.name)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.addCleanup(lambda: asyncio.run(self.engine.dispose()))

        async def seed():
            async with self.engine.begin() as conn:
                await conn.run_sync(lambda c: StaleListingProspect.__table__.create(c))
            async with self.Session() as db:
                rows = (("1111", "promo", "ann@example.com", None),
                        ("2222", "promo", "Ann@Example.com ", None),  # same person, second property
                        ("3333", "card", "bob@example.com", None),
                        ("4444", "promo", "team@heyhavlo.com", None),
                        ("5555", "promo", "cat@example.com", AFTER + timedelta(hours=72)))  # still held
                for i, (code, method, email, due) in enumerate(rows):
                    db.add(StaleListingProspect(property_code=code, qr_token_hash=code, property_address="x",
                                                country="UK", rightmove_url=f"https://example.com/{code}",
                                                payment_status="completed", payment_method=method,
                                                contact_email=email, contact_name="Ann",
                                                unlocked_at=AFTER + timedelta(minutes=i), analyst_review_due_at=due))
                await db.commit()
        asyncio.run(seed())

    def run_cycle(self, settings=SETTINGS):
        sent = []

        async def go():
            with mock.patch.object(ti, "AsyncSessionLocal", self.Session), \
                    mock.patch.object(ti, "get_settings", return_value=settings), \
                    mock.patch("app.services.attribution.get_settings", return_value=settings), \
                    mock.patch("app.services.email_service._send_sync",
                               side_effect=lambda to, subject, html, plain: sent.append((to, html)) or True):
                return await ti.run_invite_cycle()
        return asyncio.run(go()), sent

    def invited(self):
        async def go():
            async with self.Session() as db:
                return {p.property_code: p.trustpilot_invited_at is not None
                        for p in (await db.execute(select(StaleListingProspect))).scalars()}
        return asyncio.run(go())

    def test_one_invitation_per_promo_customer_sent_to_trustpilot(self):
        out, sent = self.run_cycle()
        self.assertEqual(out, {"invited": 1})
        self.assertEqual([to for to, _ in sent], [SETTINGS.TRUSTPILOT_AFS_EMAIL])
        self.assertIn("ann@example.com", sent[0][1])
        self.assertEqual(self.invited(), {"1111": True, "2222": True, "3333": False, "4444": False, "5555": False})
        out, sent = self.run_cycle()  # nothing twice
        self.assertEqual((out, sent), ({"invited": 0}, []))

    def test_nothing_is_sent_without_the_trustpilot_address(self):
        out, sent = self.run_cycle(SimpleNamespace(TRUSTPILOT_AFS_EMAIL="", TEST_ORDER_EMAILS="@heyhavlo.com"))
        self.assertEqual(sent, [])
        self.assertEqual(out["invited"], 0)


if __name__ == "__main__":
    unittest.main()
