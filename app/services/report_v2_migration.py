"""The rollout step for the 20-factor report: rewrite the latest 100 unpaid
reports into the new structure (homeowner and agent, UK), so people who already
saw a preview get the new one. Paid reports and analyst-edited ones are left
alone, and anything already on the 20-factor report is skipped.

Run by hand from the console, a small batch at a time, so progress is visible
and a long request never times out: each POST migrates up to BATCH_SIZE of the
remaining targets; the status shows how many are done. Every old report and
preview is kept in the backup key first, so a rewrite can be undone.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, text

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect
from app.services import groq_service
from app.services import report_writer
from app.services import stale_prospect_service as sps

logger = logging.getLogger(__name__)

V2_MIGRATION_KEY = "report_v2_migration"
V2_MIGRATION_BACKUP_KEY = "report_v2_migration_backup"
TARGET_LIMIT = 100  # the latest N unpaid reports
BATCH_SIZE = 20     # migrated per console click
CONCURRENCY = 3
PREFERRED_MODELS = ("gpt-6.1-terra", "gpt-6.1-sol", "gpt-5.6-terra", "gpt-5.4", "gpt-6-luna")


async def _kv_get(key: str) -> dict[str, Any] | None:
    async with AsyncSessionLocal() as db:
        row = (await db.execute(text("SELECT value_json FROM scraper_kv_state WHERE key = :key"), {"key": key})).first()
    if not row:
        return None
    try:
        return json.loads(row[0]) if row[0] else {}
    except ValueError:
        return {}


async def _kv_set(key: str, value: dict[str, Any]) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                "INSERT INTO scraper_kv_state (key, value_json, updated_at) VALUES (:key, :value, now()) "
                "ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()"
            ),
            {"key": key, "value": json.dumps(value, ensure_ascii=False)},
        )
        await db.commit()


async def backup() -> dict[str, Any]:
    """prospect id -> the report and preview it had before the rewrite."""
    return await _kv_get(V2_MIGRATION_BACKUP_KEY) or {}


async def _pick_model() -> str | None:
    wanted = (os.environ.get("REPORT_REGEN_MODEL") or os.environ.get("REPORT_MODEL") or "").strip()
    wanted = wanted.split(":")[-1] if wanted else ""
    from app.services.model_comparison import openai_models

    available = await openai_models()
    if wanted:
        return wanted if wanted in available else None
    return next((m for m in PREFERRED_MODELS if m in available), None)


async def _candidates() -> list[StaleListingProspect]:
    """The latest TARGET_LIMIT unpaid, non-analyst-edited UK reports (homeowner
    and agent). Already-migrated ones are filtered out when a batch runs."""
    async with AsyncSessionLocal() as db:
        return list((await db.execute(
            select(StaleListingProspect).where(
                StaleListingProspect.payment_status != "completed",
                StaleListingProspect.agent_edited_report_json.is_(None),
                StaleListingProspect.country == "UK",
                StaleListingProspect.report_json.is_not(None),
            ).order_by(StaleListingProspect.created_at.desc()).limit(TARGET_LIMIT)
        )).scalars().all())


def _needs_migration(prospect: StaleListingProspect) -> bool:
    if prospect.payment_status == "completed" or prospect.agent_edited_report_json:
        return False
    report = sps._safe_json(prospect.report_json)
    return bool(report) and not report_writer.report_is_v2(report)


async def migrate_one(prospect_id: Any, model: str | None, saved: dict[str, Any]) -> str:
    """Rewrite one prospect's report into the 20-factor structure, written for
    its audience. Returns "migrated", "skipped" or "failed"."""
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, prospect_id)
        if prospect is None or not _needs_migration(prospect):
            return "skipped"
        snapshot = sps._safe_json(prospect.listing_snapshot_json)
        if not snapshot.get("description") and not snapshot.get("title"):
            return "skipped"
        agent = (prospect.audience == "agent")
        token = None
        if model:
            token = groq_service.REPORT_MODEL.set(("openai", model))  # this task's context only
        try:
            report = await sps.generate_v2_report(
                prospect.property_address, prospect.rightmove_url, snapshot,
                asking_price=prospect.asking_price, listing_duration_days=prospect.listing_duration_days,
                country="UK",
                sold_comparables=sps.cached_sold_comparables(prospect) if getattr(prospect, "sold_comparables_at", None) else None,
                agent=agent)
        except Exception:  # noqa: BLE001 -- a bad call leaves the old report in place
            logger.exception("v2 migration failed for %s", prospect.property_code)
            return "failed"
        finally:
            if token is not None:
                groq_service.REPORT_MODEL.reset(token)

        if not report.get("factors"):
            return "failed"
        saved[str(prospect.id)] = {"report_json": prospect.report_json, "preview_json": prospect.preview_json}
        report["_v2_migrated"] = {"at": datetime.now(timezone.utc).isoformat(), "model": model}
        prospect.report_json = json.dumps(report, ensure_ascii=False)
        prospect.preview_json = json.dumps(report_writer.v2_preview(report), ensure_ascii=False)
        await db.commit()
    return "migrated"


async def status() -> dict[str, Any]:
    """Progress so far plus how many of the latest 100 still need migrating."""
    state = await _kv_get(V2_MIGRATION_KEY) or {"migrated": 0, "skipped": 0, "failed": 0}
    candidates = await _candidates()
    remaining = sum(1 for p in candidates if _needs_migration(p))
    state["candidates"] = len(candidates)
    state["remaining"] = remaining
    state["done"] = remaining == 0
    return state


async def run_batch(limit: int = BATCH_SIZE) -> dict[str, Any]:
    """Migrate up to `limit` of the remaining targets. Safe to call repeatedly
    until status reports done. Returns this run's counts and overall progress."""
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        return {"error": "OPENAI_API_KEY isn't set.", "migrated": 0, "skipped": 0, "failed": 0, "remaining": 0}
    model = await _pick_model()
    candidates = await _candidates()
    todo = [p for p in candidates if _needs_migration(p)][:limit]

    state = await _kv_get(V2_MIGRATION_KEY) or {"migrated": 0, "skipped": 0, "failed": 0}
    state.setdefault("migrated", 0)
    state.setdefault("skipped", 0)
    state.setdefault("failed", 0)
    state.update(model=model, started_at=datetime.now(timezone.utc).isoformat())

    saved: dict[str, Any] = await backup()
    run = {"migrated": 0, "skipped": 0, "failed": 0}
    sem = asyncio.Semaphore(CONCURRENCY)
    lock = asyncio.Lock()

    async def one(prospect: StaleListingProspect) -> None:
        async with sem:
            try:
                outcome = await migrate_one(prospect.id, model, saved)
            except Exception:  # noqa: BLE001
                logger.exception("v2 migration raised for %s", prospect.id)
                outcome = "failed"
        async with lock:
            run[outcome] += 1
            state[outcome] += 1
            await _kv_set(V2_MIGRATION_BACKUP_KEY, saved)
            await _kv_set(V2_MIGRATION_KEY, state)

    await asyncio.gather(*(one(p) for p in todo))
    remaining = sum(1 for p in await _candidates() if _needs_migration(p))
    state["remaining"] = remaining
    state["finished_at"] = datetime.now(timezone.utc).isoformat()
    await _kv_set(V2_MIGRATION_KEY, state)
    logger.info("v2 migration batch: %s (remaining %d)", run, remaining)
    return {"run": run, "totals": {k: state[k] for k in ("migrated", "skipped", "failed")},
            "remaining": remaining, "done": remaining == 0, "model": model}
