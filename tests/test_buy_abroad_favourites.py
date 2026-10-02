"""Buy Abroad favourites saved to the account: add, list, remove, and that
one user's favourites never show up for another. Runs the real endpoints
against a throwaway SQLite database.
"""
from __future__ import annotations

import asyncio
import os
import tempfile
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.database import get_db
from app.dependencies import get_current_user
from app.models.models import BuyAbroadFavourite, User, UserRole
from app.routers import users

BASE = "/api/v1/users/me/favourite-listings"


class BuyAbroadFavouritesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self.tmp.name}")
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        self.alice, self.bob = asyncio.run(self._seed())
        self.current = self.alice

        async def override_db():
            async with self.Session() as session:
                yield session

        app = FastAPI()
        app.include_router(users.router, prefix="/api/v1")
        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: self.current
        self.client = TestClient(app)

    def tearDown(self) -> None:
        asyncio.run(self.engine.dispose())
        os.unlink(self.tmp.name)

    async def _seed(self) -> tuple[User, User]:
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: [m.__table__.create(c) for m in (User, BuyAbroadFavourite)])
        async with self.Session() as db:
            people = [
                User(email=f"{name}@example.com", first_name=name, last_name="Test", phone_number="7000000000", role=UserRole.buyer)
                for name in ("alice", "bob")
            ]
            db.add_all(people)
            await db.commit()
            return people[0], people[1]

    def test_add_list_and_remove(self) -> None:
        self.assertEqual(self.client.get(BASE).json(), {"listing_ids": []})
        self.assertEqual(self.client.post(BASE, json={"listing_ids": ["rm1"]}).json()["listing_ids"], ["rm1"])
        # Adding again (plus a new one, with a duplicate) keeps one of each, in saved order.
        response = self.client.post(BASE, json={"listing_ids": ["rm2", "rm1", " rm2 "]})
        self.assertEqual(response.json()["listing_ids"], ["rm1", "rm2"])
        self.assertEqual(self.client.delete(f"{BASE}/rm1").json()["listing_ids"], ["rm2"])
        self.assertEqual(self.client.delete(f"{BASE}/missing").json()["listing_ids"], ["rm2"])
        self.assertEqual(self.client.get(BASE).json()["listing_ids"], ["rm2"])

    def test_favourites_belong_to_their_account(self) -> None:
        self.client.post(BASE, json={"listing_ids": ["rm1", "rm2"]})
        self.current = self.bob
        self.assertEqual(self.client.get(BASE).json()["listing_ids"], [])
        self.client.post(BASE, json={"listing_ids": ["rm9"]})
        self.client.delete(f"{BASE}/rm1")
        self.current = self.alice
        self.assertEqual(self.client.get(BASE).json()["listing_ids"], ["rm1", "rm2"])

    def test_rejects_bad_ids(self) -> None:
        self.assertEqual(self.client.post(BASE, json={"listing_ids": []}).status_code, 422)
        self.assertEqual(self.client.post(BASE, json={"listing_ids": ["x" * 51]}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
