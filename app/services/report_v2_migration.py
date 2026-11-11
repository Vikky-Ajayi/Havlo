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


# ── Upgrade: 20-factor reports written by the first (thin) writer ─────────
UPGRADE_KEY = "report_v2_upgrade"
UPGRADE_LIMIT = 300


def _needs_upgrade(prospect: StaleListingProspect) -> bool:
    """A 20-factor report from an earlier writer, paid or not (paid customers
    get the full write again). Analyst-edited reports are left alone."""
    if prospect.agent_edited_report_json:
        return False
    report = sps._safe_json(prospect.report_json)
    if not report_writer.report_is_v2(report):
        return False
    return int(report.get("_writer_rev") or 1) < report_writer.WRITER_REV or bool(report.get("_paid_degraded"))


async def _upgrade_candidates() -> list[StaleListingProspect]:
    async with AsyncSessionLocal() as db:
        return list((await db.execute(
            select(StaleListingProspect).where(
                StaleListingProspect.agent_edited_report_json.is_(None),
                StaleListingProspect.country == "UK",
                StaleListingProspect.report_json.is_not(None),
            ).order_by(StaleListingProspect.created_at.desc()).limit(UPGRADE_LIMIT)
        )).scalars().all())


async def upgrade_one(prospect_id: Any, model: str | None, saved: dict[str, Any]) -> str:
    """Rebuild one prospect's 20-factor report with the current writer.
    Returns "upgraded", "skipped" or "failed"."""
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, prospect_id)
        if prospect is None or not _needs_upgrade(prospect):
            return "skipped"
        old = {"report_json": prospect.report_json, "preview_json": prospect.preview_json}
        token = groq_service.REPORT_MODEL.set(("openai", model)) if model else None
        try:
            report = await sps.rebuild_v2_report(prospect)
        except Exception:  # noqa: BLE001 -- keep the old report
            logger.exception("v2 upgrade failed for %s", prospect.property_code)
            await db.rollback()
            return "failed"
        finally:
            if token is not None:
                groq_service.REPORT_MODEL.reset(token)
        if not report.get("factors"):
            await db.rollback()
            return "failed"
        saved[str(prospect.id)] = old
        await db.commit()
    return "upgraded"


async def upgrade_status() -> dict[str, Any]:
    state = await _kv_get(UPGRADE_KEY) or {"upgraded": 0, "skipped": 0, "failed": 0}
    remaining = sum(1 for p in await _upgrade_candidates() if _needs_upgrade(p))
    state["remaining"] = remaining
    state["done"] = remaining == 0
    return state


async def run_upgrade_batch(limit: int = BATCH_SIZE) -> dict[str, Any]:
    """Rebuild up to `limit` reports from the first writer. Click until done."""
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        return {"error": "OPENAI_API_KEY isn't set.", "remaining": 0, "done": False}
    model = await _pick_model()
    todo = [p for p in await _upgrade_candidates() if _needs_upgrade(p)][:limit]
    state = await _kv_get(UPGRADE_KEY) or {"upgraded": 0, "skipped": 0, "failed": 0}
    for k in ("upgraded", "skipped", "failed"):
        state.setdefault(k, 0)
    saved: dict[str, Any] = await backup()
    run = {"upgraded": 0, "skipped": 0, "failed": 0}
    sem = asyncio.Semaphore(CONCURRENCY)
    lock = asyncio.Lock()

    async def one(prospect: StaleListingProspect) -> None:
        async with sem:
            try:
                outcome = await upgrade_one(prospect.id, model, saved)
            except Exception:  # noqa: BLE001
                logger.exception("v2 upgrade raised for %s", prospect.id)
                outcome = "failed"
        async with lock:
            run[outcome] += 1
            state[outcome] += 1
            await _kv_set(V2_MIGRATION_BACKUP_KEY, saved)
            await _kv_set(UPGRADE_KEY, state)

    await asyncio.gather(*(one(p) for p in todo))
    remaining = sum(1 for p in await _upgrade_candidates() if _needs_upgrade(p))
    state["remaining"] = remaining
    await _kv_set(UPGRADE_KEY, state)
    return {"run": run, "totals": {k: state[k] for k in ("upgraded", "skipped", "failed")},
            "remaining": remaining, "done": remaining == 0, "model": model}


async def rebuild_one_now(prospect_id: Any) -> dict[str, Any]:
    """Rebuild a single prospect's report now, whatever writer made it (the
    console's per-property button). Returns a short summary of the result,
    with the model that wrote it and any model errors.

    It writes exactly as a new lead's report is written: the live model, with
    its Groq fallback. It used to force a model of its own with no fallback,
    so when OpenAI refused calls every factor came back as the stock
    "check with your agent" text (Nov 2026)."""
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, prospect_id)
        if prospect is None:
            return {"error": "not found"}
        if prospect.agent_edited_report_json:
            return {"error": "This report was edited by an analyst; it wasn't rebuilt."}
        saved = await backup()
        saved[str(prospect.id)] = {"report_json": prospect.report_json, "preview_json": prospect.preview_json}
        calls: list[dict[str, Any]] = []
        token = groq_service.REPORT_CALLS.set(calls)
        try:
            report = await sps.rebuild_v2_report(prospect)
        finally:
            groq_service.REPORT_CALLS.reset(token)
        failed = sum(1 for f in report.get("factors") or [] if str(f.get("found") or "").startswith(
            "We couldn't check this one properly"))
        if failed >= 10:
            # The write failed: keep the report it had rather than the stock text.
            prior = saved[str(prospect.id)]
            prospect.report_json, prospect.preview_json = prior["report_json"], prior["preview_json"]
            await db.commit()
            return {"property_code": prospect.property_code, "error": "The AI write failed; the old report was kept.",
                    "model_errors": list(dict.fromkeys(c["error"] for c in calls if "error" in c))[:3]}
        await db.commit()
        await _kv_set(V2_MIGRATION_BACKUP_KEY, saved)
    from collections import Counter
    return {"property_code": prospect.property_code, "expanded": bool(report.get("_expanded")),
            "verdicts": dict(Counter(f.get("verdict") for f in report.get("factors") or [])),
            "top_actions": [t.get("title") for t in report.get("top_actions") or []],
            "model": report.get("_model"), "model_fallback": bool(report.get("_model_fallback")),
            "model_errors": list(dict.fromkeys(c["error"] for c in calls if "error" in c))[:3]}


async def write_locked_paid_report(prospect_id: Any) -> dict[str, Any]:
    """Write an unpaid prospect's full paid report now and keep it locked: it
    is stored with the free report (sps.PAID_READY_KEY), the free preview
    and emails carry on from the free one, and paying opens it at once. The
    console's full-report PDF shows it. Billed AI calls."""
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, prospect_id)
        if prospect is None:
            return {"error": "not found"}
        if prospect.payment_status == "completed":
            return {"error": "Already paid: the full report is written when they pay. Use Rebuild instead."}
        if prospect.agent_edited_report_json:
            return {"error": "This report was edited by an analyst; it wasn't changed."}
        free = sps._safe_json(prospect.report_json)
        if not report_writer.report_is_v2(free):
            return {"error": "Rebuild this report first: it isn't a 20-factor report."}
        free.pop(sps.PAID_READY_KEY, None)
        before = prospect.report_json
        calls: list[dict[str, Any]] = []
        token = groq_service.REPORT_CALLS.set(calls)
        try:
            paid = await sps.ensure_expanded_v2_report(prospect, free)
        finally:
            groq_service.REPORT_CALLS.reset(token)
        errors = list(dict.fromkeys(c["error"] for c in calls if "error" in c))[:3]
        ok = [c for c in calls if "error" not in c]
        written = sum(1 for f in paid.get("factors") or [] if len(str(f.get("found") or "")) > 120)
        if paid.get("_paid_degraded") or written < 10:
            prospect.report_json = before
            await db.commit()
            return {"property_code": prospect.property_code, "error": "The paid write didn't come out in full; nothing was saved.",
                    "model_errors": errors}
        free[sps.PAID_READY_KEY] = paid
        prospect.report_json = json.dumps(free, ensure_ascii=False)
        await db.commit()
    from collections import Counter
    return {"property_code": prospect.property_code, "locked": True,
            "verdicts": dict(Counter(f.get("verdict") for f in paid.get("factors") or [])),
            "top_actions": [t.get("title") for t in paid.get("top_actions") or []],
            "model": f"{ok[-1]['provider']}:{ok[-1]['model']}" if ok else None, "model_errors": errors}


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
