"""Shared utilities for high-volume marketplace property scrapers."""
from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import httpx
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.database import AsyncSessionLocal, engine
from app.models.models import RightmoveListing

logger = logging.getLogger(__name__)

_BROWSER_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]


def browser_headers(referer: str | None = None) -> dict[str, str]:
    headers = {
        "User-Agent": random.choice(_BROWSER_UAS),
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Connection": "keep-alive",
    }
    if referer:
        headers["Referer"] = referer
    return headers


async def rate_limited_get(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    delay: tuple[float, float] = (0.8, 1.8),
) -> httpx.Response:
    async with sem:
        resp = await client.get(
            url,
            params=params,
            headers=headers or browser_headers(),
            follow_redirects=True,
            timeout=30,
        )
        await asyncio.sleep(random.uniform(*delay))
        return resp


async def rate_limited_post(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    url: str,
    *,
    data: dict[str, Any] | str,
    headers: dict[str, str] | None = None,
    delay: tuple[float, float] = (0.8, 1.8),
) -> httpx.Response:
    async with sem:
        resp = await client.post(
            url,
            data=data,
            headers=headers or browser_headers(),
            follow_redirects=True,
            timeout=30,
        )
        await asyncio.sleep(random.uniform(*delay))
        return resp


def parse_next_data(html: str, paths: list[list[str]]) -> list[dict[str, Any]]:
    match = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    for path in paths:
        node: Any = data
        for key in path:
            if not isinstance(node, dict):
                node = None
                break
            node = node.get(key)
        if isinstance(node, list) and node:
            return [item for item in node if isinstance(item, dict)]
        if isinstance(node, dict):
            for key in ("hits", "results", "properties", "listings"):
                items = node.get(key)
                if isinstance(items, list) and items:
                    return [item for item in items if isinstance(item, dict)]
    return []


def normalize_listing_text(title: str, address: str) -> tuple[str, str]:
    """Prefer a short address headline; keep marketing copy as description."""
    clean_title = re.sub(r"\s+", " ", (title or "").strip())
    clean_address = re.sub(r"\s+", " ", (address or "").strip())
    headline = clean_address or clean_title
    if headline and clean_title and headline.lower() == clean_title.lower():
        clean_title = headline
    if len(headline) > 120 and clean_address:
        headline = clean_address[:120].rsplit(",", 1)[0].strip() or headline[:120]
    return headline[:500], (clean_title or headline)[:500]


def load_progress(progress_file: Path) -> set[str]:
    try:
        if progress_file.exists():
            data = json.loads(progress_file.read_text())
            return set(data.get("completed", []))
    except Exception:
        pass
    return set()


def save_progress(progress_file: Path, completed: set[str]) -> None:
    try:
        progress_file.write_text(json.dumps({
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "completed": sorted(completed),
        }, indent=2))
    except Exception as exc:
        logger.debug("Could not save scraper progress (%s): %s", progress_file, exc)


async def upsert_listing_rows(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        rid = row.get("rightmove_id")
        if rid:
            seen[str(rid)] = row
    rows = list(seen.values())
    now = datetime.now(timezone.utc)
    for row in rows:
        row.setdefault("scraped_at", now)
        row.setdefault("is_active", True)

    async with AsyncSessionLocal() as db:
        stmt = pg_insert(RightmoveListing).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["rightmove_id"],
            set_={
                c.key: stmt.excluded[c.key]
                for c in RightmoveListing.__table__.columns
                if c.key not in ("id", "rightmove_id", "created_at")
            },
        )
        result = await db.execute(stmt)
        await db.commit()
        return int(result.rowcount or 0)


async def run_scraper_loop(
    name: str,
    scrape_fn: Callable[[], Any],
    interval_hours: float,
    *,
    initial_delay_seconds: float = 0,
) -> None:
    if initial_delay_seconds > 0:
        logger.info("%s scraper waiting %.0fs before first cycle.", name, initial_delay_seconds)
        await asyncio.sleep(initial_delay_seconds)
    logger.info("%s scraper loop started (interval %.1fh).", name, interval_hours)
    while True:
        try:
            stats = await run_once_with_advisory_lock(name, scrape_fn)
            logger.info("%s scraper cycle finished: %s", name, stats)
        except Exception as exc:
            logger.error("%s scraper loop error: %s", name, exc, exc_info=True)
        await asyncio.sleep(interval_hours * 3600)


async def run_once_with_advisory_lock(
    name: str,
    scrape_fn: Callable[[], Any],
) -> Any:
    """Run one scraper cycle, skipping it if another worker holds the source lock."""
    lock_name = f"havlo_marketplace_scraper:{name.lower()}"
    lock_acquired = True
    lock_conn = None

    try:
        lock_conn = await engine.connect()
        result = await lock_conn.execute(
            text("SELECT pg_try_advisory_lock(hashtext(:lock_name))"),
            {"lock_name": lock_name},
        )
        await lock_conn.commit()
        lock_acquired = bool(result.scalar())
    except Exception as exc:
        logger.debug("%s scraper advisory lock unavailable; continuing without it: %s", name, exc)
        if lock_conn is not None:
            await lock_conn.close()
            lock_conn = None

    if not lock_acquired:
        logger.info("%s scraper skipped; another process already holds the scraper lock.", name)
        if lock_conn is not None:
            await lock_conn.close()
        return {"skipped": 1, "reason": "lock-held"}

    try:
        return await scrape_fn()
    finally:
        if lock_conn is not None:
            try:
                await lock_conn.execute(
                    text("SELECT pg_advisory_unlock(hashtext(:lock_name))"),
                    {"lock_name": lock_name},
                )
                await lock_conn.commit()
            except Exception as exc:
                logger.debug("%s scraper advisory unlock failed: %s", name, exc)
            await lock_conn.close()
