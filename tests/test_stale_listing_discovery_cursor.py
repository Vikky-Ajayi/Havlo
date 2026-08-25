"""Regression tests for the "discovery gets stuck re-scanning duplicates and
never sends emails" bug.

Root cause (from production logs): every 15-minute cycle restarted every
location's page scan at page 0, and the per-candidate budget
(`max_candidates`) was consumed by *duplicate* listings just as much as by
genuinely new ones. Once a location's early oldest-first pages were fully
converted into prospects by an earlier cycle, later cycles burned their
entire budget re-confirming those same duplicates and never reached fresh
inventory (`eligible=0 skipped=1200` every cycle, no new emails).

These tests exercise `_run_location` directly with the network layer and DB
mocked out, so they run without a live database, Rightmove, or LLM key.
"""
from __future__ import annotations

import asyncio
import unittest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

from app.services import stale_listing_discovery as discovery


def _make_candidate(rightmove_id: str, *, address: str = "12 Example Road, London, SW1A 1AA") -> discovery.Candidate:
    return discovery.Candidate(
        rightmove_id=rightmove_id,
        url=f"https://www.rightmove.co.uk/properties/{rightmove_id}",
        city="London",
        address=address,
        price=350000,
        property_type="Terraced house",
        bedrooms=3,
        bathrooms=1,
        images=[],
        summary="",
        listed_date_raw="2024-01-01",
    )


class _FakeDb:
    """Stands in for AsyncSessionLocal(). `.get()` returns None (run "not
    found"), which `_flush_run_progress` already treats as a safe no-op —
    this avoids needing a live database for these tests."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, model, id):
        return None


class DiscoveryCursorAndDuplicateBudgetTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.finalized: list[str] = []

        async def fake_finalize(state, candidate, detail_task):
            self.finalized.append(candidate.rightmove_id)

        async def fake_scrape_detail(sem, candidate):
            # Prevents the "likely eligible" pre-fetch path from firing a
            # real HTTP request to Rightmove during the test.
            return {}

        patches = [
            patch.object(discovery, "AsyncSessionLocal", lambda: _FakeDb()),
            patch.object(discovery, "_finalize_candidate", side_effect=fake_finalize),
            patch.object(discovery, "_scrape_detail_bounded", side_effect=fake_scrape_detail),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    async def test_duplicates_do_not_consume_the_candidate_budget(self) -> None:
        """20 duplicates + 2 fresh candidates on one page, budget of 2: both
        fresh candidates must still be reached and finalized, because the 20
        duplicates must not count against the budget."""
        duplicates = [_make_candidate(f"dup-{i}") for i in range(20)]
        fresh = [_make_candidate("fresh-1"), _make_candidate("fresh-2")]
        page_one = duplicates + fresh

        existing_map = {c.rightmove_id: "1234" for c in duplicates}

        async def fake_fetch(client, city, location_id, page, min_price):
            return page_one if page == 0 else []

        with patch.object(discovery, "_fetch_search_page", side_effect=fake_fetch), \
             patch.object(discovery, "_bulk_existing_prospects", AsyncMock(return_value=existing_map)):
            params = discovery.DiscoveryParams(dry_run=False, max_candidates=2, max_pages_per_location=5)
            state = discovery._DiscoveryState(
                run_uuid=None,
                params=params,
                results={"eligible": [], "created": [], "skipped": [], "failed": []},
                lock=asyncio.Lock(),
                detail_sem=asyncio.Semaphore(4),
                finalize_sem=asyncio.Semaphore(4),
            )
            location_sem = asyncio.Semaphore(1)
            async with discovery.httpx.AsyncClient() as client:
                location_id, next_page = await discovery._run_location(
                    state, client, "London", "REGION^1", location_sem, start_page=0,
                )

        self.assertEqual(sorted(self.finalized), ["fresh-1", "fresh-2"])
        self.assertEqual(state.skipped_count, 20)
        self.assertEqual(state.processed, 2)
        self.assertEqual(location_id, "REGION^1")

    async def test_cursor_resumes_from_where_the_previous_cycle_stopped(self) -> None:
        """Once the budget is hit, the location must report back the page it
        stopped on, not page 0 — otherwise the next cycle re-scans the same
        (now-duplicate) pages forever."""
        pages = {
            0: [_make_candidate("p0-a"), _make_candidate("p0-b")],
            1: [_make_candidate("p1-a"), _make_candidate("p1-b")],
            2: [_make_candidate("p2-a")],
        }

        async def fake_fetch(client, city, location_id, page, min_price):
            return pages.get(page, [])

        with patch.object(discovery, "_fetch_search_page", side_effect=fake_fetch), \
             patch.object(discovery, "_bulk_existing_prospects", AsyncMock(return_value={})):
            # Budget of 2 is exhausted entirely by page 0; the location must
            # stop there and resume at page 1 next time, not restart at 0.
            params = discovery.DiscoveryParams(dry_run=False, max_candidates=2, max_pages_per_location=5)
            state = discovery._DiscoveryState(
                run_uuid=None,
                params=params,
                results={"eligible": [], "created": [], "skipped": [], "failed": []},
                lock=asyncio.Lock(),
                detail_sem=asyncio.Semaphore(4),
                finalize_sem=asyncio.Semaphore(4),
            )
            location_sem = asyncio.Semaphore(1)
            async with discovery.httpx.AsyncClient() as client:
                _, next_page = await discovery._run_location(
                    state, client, "London", "REGION^1", location_sem, start_page=0,
                )

        self.assertEqual(next_page, 1)
        self.assertEqual(sorted(self.finalized), ["p0-a", "p0-b"])

    async def test_cursor_resets_when_a_location_runs_out_of_results(self) -> None:
        async def fake_fetch(client, city, location_id, page, min_price):
            return []  # Rightmove has nothing at this index for this location.

        with patch.object(discovery, "_fetch_search_page", side_effect=fake_fetch):
            params = discovery.DiscoveryParams(dry_run=False, max_candidates=100, max_pages_per_location=5)
            state = discovery._DiscoveryState(
                run_uuid=None,
                params=params,
                results={"eligible": [], "created": [], "skipped": [], "failed": []},
                lock=asyncio.Lock(),
                detail_sem=asyncio.Semaphore(4),
                finalize_sem=asyncio.Semaphore(4),
            )
            location_sem = asyncio.Semaphore(1)
            async with discovery.httpx.AsyncClient() as client:
                _, next_page = await discovery._run_location(
                    state, client, "London", "REGION^1", location_sem, start_page=80,
                )

        self.assertEqual(next_page, 0)

    async def test_a_db_hiccup_in_one_location_does_not_crash_it(self) -> None:
        """Confirmed live: a transient Supabase connection error inside the
        bulk duplicate lookup used to propagate out of _run_location
        entirely, which (before the gather-level return_exceptions=True fix)
        cancelled every other concurrently-running location's real progress
        for the whole cycle. This location must instead fail gracefully and
        hand back its unchanged cursor."""
        candidates_page = [_make_candidate("x-1")]

        async def fake_fetch(client, city, location_id, page, min_price):
            return candidates_page if page == 3 else []

        async def raising_bulk_lookup(db, candidates):
            raise ConnectionError("EAUTHTIMEOUT: timeout while waiting for message")

        with patch.object(discovery, "_fetch_search_page", side_effect=fake_fetch), \
             patch.object(discovery, "_bulk_existing_prospects", side_effect=raising_bulk_lookup):
            params = discovery.DiscoveryParams(dry_run=False, max_candidates=100, max_pages_per_location=5)
            state = discovery._DiscoveryState(
                run_uuid=None,
                params=params,
                results={"eligible": [], "created": [], "skipped": [], "failed": []},
                lock=asyncio.Lock(),
                detail_sem=asyncio.Semaphore(4),
                finalize_sem=asyncio.Semaphore(4),
            )
            location_sem = asyncio.Semaphore(1)
            async with discovery.httpx.AsyncClient() as client:
                location_id, next_page = await discovery._run_location(
                    state, client, "London", "REGION^1", location_sem, start_page=3,
                )

        self.assertEqual(location_id, "REGION^1")
        self.assertEqual(next_page, 3)
        self.assertEqual(state.failed_count, 1)
        self.assertEqual(self.finalized, [])


class _FakeCursorDb:
    """Stands in for AsyncSessionLocal() backed by a single `scraper_kv_state`
    row, so the cursor round-trip can be tested without a live database."""

    _store: dict[str, str] = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, statement, params=None):
        sql = str(statement).strip().upper()
        params = params or {}
        if sql.startswith("SELECT"):
            value = type(self)._store.get(params.get("key"))
            return _FakeResult(value)
        if sql.startswith("INSERT"):
            type(self)._store[params["key"]] = params["value"]
            return _FakeResult(None)
        raise AssertionError(f"Unexpected statement in fake cursor DB: {statement}")

    async def commit(self) -> None:
        return None


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def first(self):
        return (self._value,) if self._value is not None else None


class DiscoveryCursorPersistenceTest(unittest.IsolatedAsyncioTestCase):
    async def test_cursor_round_trips_through_the_database(self) -> None:
        """Cursor state now lives in scraper_kv_state, not an /tmp file, so it
        survives a Railway redeploy (which wipes /tmp and used to silently
        reset every location back to page 0)."""
        _FakeCursorDb._store = {}
        with patch.object(discovery, "AsyncSessionLocal", lambda: _FakeCursorDb()):
            self.assertEqual(await discovery._load_discovery_cursors(), {})
            await discovery._save_discovery_cursors({"REGION^1": 12, "REGION^2": 0})
            self.assertEqual(
                await discovery._load_discovery_cursors(),
                {"REGION^1": 12, "REGION^2": 0},
            )

    async def test_falls_back_to_legacy_file_if_the_db_read_fails(self) -> None:
        import tempfile
        from pathlib import Path

        async def raising_session():
            raise ConnectionError("db unavailable")

        with tempfile.TemporaryDirectory() as tmp:
            cursor_file = Path(tmp) / "cursor.json"
            cursor_file.write_text('{"REGION^1": 7}')
            with patch.object(discovery, "_DISCOVERY_CURSOR_FILE", cursor_file), \
                 patch.object(discovery, "AsyncSessionLocal", side_effect=ConnectionError("db down")):
                self.assertEqual(await discovery._load_discovery_cursors(), {"REGION^1": 7})


if __name__ == "__main__":
    unittest.main()
