"""The Follow Up list's delete action (code-protected) and the agency code it
now carries for an agency's lookups. Runs the real endpoints against a
throwaway SQLite database.
"""
from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import tempfile
import unittest
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.db.database import get_db
from app.models.models import (
    StaleAgentAccount,
    StaleListingMonitor,
    StaleListingMonitorEvent,
    StaleListingProspect,
    StaleProspectAbandonmentEmail,
    StaleProspectAbandonmentSms,
    StaleProspectPostPurchaseEmail,
)
from app.routers import stale_listings


# SQLite has no ARRAY type; store the Postgres array columns as JSON text.
@compiles(ARRAY, "sqlite")
def _array_as_text(_type, _compiler, **_kw):
    return "TEXT"


sqlite3.register_adapter(list, json.dumps)

TABLES = [
    StaleAgentAccount,
    StaleListingProspect,
    StaleProspectAbandonmentEmail,
    StaleProspectAbandonmentSms,
    StaleProspectPostPurchaseEmail,
    StaleListingMonitor,
    StaleListingMonitorEvent,
]
BASE = "/api/v1/stale-listings/prospects-console"


class ConsoleProspectDeleteTest(unittest.TestCase):
    def setUp(self) -> None:
        stale_listings._delete_failures.clear()
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.owner_id, self.copy_id = asyncio.run(self._seed())

        async def override_db():
            async with self.Session() as session:
                yield session

        app = FastAPI()
        app.include_router(stale_listings.public_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    async def _seed(self) -> tuple[str, str]:
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: [model.__table__.create(c) for model in TABLES])
        async with self.Session() as db:
            now = datetime.now(timezone.utc)
            account = StaleAgentAccount(company_key="smith-jones", company_name="Smith & Jones", agent_code="54321")
            db.add(account)
            await db.flush()
            owner = StaleListingProspect(
                property_code="4821", qr_token_hash="h1", property_address="1 Test Road",
                country="UK", rightmove_url="https://example.com/1", code_looked_up_at=now,
            )
            copy = StaleListingProspect(
                property_code="A7Q2", qr_token_hash="h2", property_address="2 Agency Road",
                country="UK", rightmove_url="https://example.com/2", code_looked_up_at=now,
                audience="agent", agent_account_id=account.id, agent_company_name="Smith & Jones Ltd",
            )
            db.add_all([owner, copy])
            await db.flush()
            db.add(StaleProspectAbandonmentEmail(prospect_id=owner.id, stage=1))
            await db.commit()
            return str(owner.id), str(copy.id)

    def _follow_up(self, q: str = "") -> list[dict]:
        return self.client.get(f"{BASE}/abandoned", params={"q": q} if q else None).json()["items"]

    def _delete(self, prospect_id: str, code: str, client: str = "1.1.1.1"):
        return self.client.post(
            f"{BASE}/prospects/{prospect_id}/delete", json={"code": code}, headers={"x-forwarded-for": client}
        )

    def test_agency_lookups_carry_the_agency_code(self) -> None:
        by_code = {item["property_code"]: item for item in self._follow_up()}
        self.assertEqual(by_code["A7Q2"]["agent_code"], "54321")
        self.assertIsNone(by_code["4821"]["agent_code"])
        self.assertEqual([item["property_code"] for item in self._follow_up("54321")], ["A7Q2"])

    def test_wrong_code_is_refused(self) -> None:
        self.assertEqual(self._delete(self.owner_id, "1111").status_code, 403)
        self.assertEqual(len(self._follow_up()), 2)

    def test_right_code_deletes_the_prospect_and_its_history(self) -> None:
        response = self._delete(self.owner_id, "8989")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["property_code"] for item in self._follow_up()], ["A7Q2"])

        async def leftover_emails() -> int:
            async with self.Session() as db:
                return (await db.execute(select(func.count()).select_from(StaleProspectAbandonmentEmail))).scalar()

        self.assertEqual(asyncio.run(leftover_emails()), 0)
        self.assertEqual(self._delete(str(uuid.uuid4()), "8989").status_code, 404)

    def test_repeated_wrong_codes_lock_that_client_out(self) -> None:
        statuses = [self._delete(self.copy_id, "0000", client="9.9.9.9").status_code for _ in range(6)]
        self.assertEqual(statuses, [403] * 5 + [429])
        self.assertEqual(self._delete(self.copy_id, "8989", client="9.9.9.9").status_code, 429)
        self.assertEqual(self._delete(self.copy_id, "8989", client="2.2.2.2").status_code, 200)


if __name__ == "__main__":
    unittest.main()
