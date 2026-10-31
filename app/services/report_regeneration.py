"""One-off: rewrite the free reports people saw before the report checks
went live (31 Oct 2026), with OpenAI and the real facts.

Every one of those 105 previews contained invented claims (console >
Report accuracy). The checks now hide them when read, which can leave a
preview with one or two findings. This rewrites each unpaid prospect's
report from a fresh read of the listing (full description, real photo /
floor plan / tour counts, Land Registry sales), checked like any new
report. Paid reports and analyst-edited ones are left alone. Each old
report and preview is kept in REGEN_BACKUP_KEY first, so the accuracy
check still shows what people actually saw and a rewrite can be undone.

Runs once, by itself, after a deploy: the first worker to claim
REGEN_STATE_KEY runs it, the others skip. A listing taken down since, or a
failed OpenAI call, leaves that prospect's (checked) report as it was.
Set REPORT_REGEN_MODEL to choose the OpenAI model.
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
from app.services import stale_prospect_service as sps

logger = logging.getLogger(__name__)

REGEN_STATE_KEY = "report_regen_2026_10"
REGEN_BACKUP_KEY = "report_regen_2026_10_backup"
CHECKS_LIVE_AT = datetime(2026, 10, 31, tzinfo=timezone.utc)
# OpenAI's mid-priced model as listed on 31 Oct 2026 ($1 / $5 per 1M tokens);
# the first of these the key can use.
PREFERRED_MODELS = ("gpt-6.1-terra", "gpt-6.1-sol", "gpt-5.6-terra", "gpt-5.4", "gpt-6-luna")
CONCURRENCY = 3


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


async def _claim(state: dict[str, Any]) -> bool:
    """True for the one worker that gets to run it (ever)."""
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            text(
                "INSERT INTO scraper_kv_state (key, value_json, updated_at) VALUES (:key, :value, now()) "
                "ON CONFLICT (key) DO NOTHING RETURNING key"
            ),
            {"key": REGEN_STATE_KEY, "value": json.dumps(state)},
        )).first()
        await db.commit()
    return row is not None


async def status() -> dict[str, Any] | None:
    return await _kv_get(REGEN_STATE_KEY)


async def backup() -> dict[str, Any]:
    """prospect id -> the report and preview it had before the rewrite."""
    return await _kv_get(REGEN_BACKUP_KEY) or {}


async def _pick_model() -> str | None:
    wanted = (os.environ.get("REPORT_REGEN_MODEL") or "").strip()
    from app.services.model_comparison import openai_models

    available = await openai_models()
    if wanted:
        return wanted if wanted in available else None
    return next((m for m in PREFERRED_MODELS if m in available), None)


async def _targets() -> list[StaleListingProspect]:
    async with AsyncSessionLocal() as db:
        return list((await db.execute(
            select(StaleListingProspect).where(
                StaleListingProspect.contact_details_submitted_at.is_not(None),
                StaleListingProspect.contact_details_submitted_at < CHECKS_LIVE_AT,
                StaleListingProspect.payment_status != "completed",
                StaleListingProspect.agent_edited_report_json.is_(None),
                StaleListingProspect.country == "UK",
                StaleListingProspect.rightmove_url.like("%rightmove.co.uk/properties/%"),
            ).order_by(StaleListingProspect.contact_details_submitted_at.desc())
        )).scalars().all())


async def regenerate_one(prospect_id: Any, model: str, saved: dict[str, Any]) -> str:
    """Rewrite one prospect's free report. Returns "regenerated", "gone"
    (the listing can't be read any more) or "failed"."""
    from app.services.listing_scraper import scrape_single_listing

    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, prospect_id)
        if prospect is None or prospect.payment_status == "completed" or prospect.agent_edited_report_json:
            return "gone"
        try:
            scraped = await scrape_single_listing(prospect.rightmove_url)
        except Exception:  # noqa: BLE001 -- taken down or unreadable
            scraped = {}
        fresh = sps.snapshot_from_scrape(scraped or {}, prospect.rightmove_url)
        if scraped.get("blocked") or not fresh.get("description"):
            return "gone"
        old_snapshot = sps._safe_json(prospect.listing_snapshot_json)
        snapshot = {**old_snapshot, **{k: v for k, v in fresh.items() if v not in (None, "", [], {})}}
        snapshot["description_truncated"] = fresh.get("description_truncated")
        sales = await sps.refresh_sold_comparables(prospect)
        report_snapshot = sps.with_recorded_sales(snapshot, sales)

        # How long it has been on the market now, not when we first found it.
        now = datetime.now(timezone.utc)
        listed = prospect.listed_date or sps.parse_listed_date(snapshot.get("listed_date"))
        if listed is not None and listed.tzinfo is None:
            listed = listed.replace(tzinfo=timezone.utc)
        written = prospect.processed_at or prospect.created_at
        if written is not None and written.tzinfo is None:
            written = written.replace(tzinfo=timezone.utc)
        if listed is not None:
            days_on_market = max(0, (now - listed).days)
        elif prospect.listing_duration_days is not None and written is not None:
            days_on_market = prospect.listing_duration_days + max(0, (now - written).days)
        else:
            days_on_market = prospect.listing_duration_days

        calls: list[dict[str, Any]] = []
        groq_service.REPORT_MODEL.set(("openai", model))  # this task's context only
        groq_service.REPORT_CALLS.set(calls)
        report = await sps.generate_prospect_report(
            property_address=prospect.property_address,
            rightmove_url=prospect.rightmove_url,
            snapshot=report_snapshot,
            listing_duration_days=days_on_market,
            expand_report=False,
            market="UK",
        )
        if not any("error" not in c for c in calls):
            # The call failed and this is the stock fallback: keep what's there.
            logger.warning("Report rewrite failed for %s: %s", prospect.property_address,
                           next((c.get("error") for c in calls if "error" in c), "no call made"))
            return "failed"
        report["_sales_given"] = bool(report_snapshot["recorded_sales_nearby"])
        report["_media_given"] = sps.media_known(snapshot.get("media"))
        report["_regenerated"] = {"at": now.isoformat(), "model": model}

        saved[str(prospect.id)] = {"report_json": prospect.report_json, "preview_json": prospect.preview_json}
        prospect.listing_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
        sps.check_new_report(report, sps.prospect_report_facts(prospect, report), prospect.property_address)
        prospect.report_json = json.dumps(report, ensure_ascii=False)
        prospect.preview_json = json.dumps(sps.build_preview(report, snapshot, prospect.property_address), ensure_ascii=False)
        await db.commit()
    return "regenerated"


async def run_once() -> dict[str, Any] | None:
    """Started after each deploy; does the work at most once, ever."""
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        logger.info("Report rewrite skipped: OPENAI_API_KEY isn't set.")
        return None
    if await _kv_get(REGEN_STATE_KEY) is not None:
        return None  # already run, or another worker has it
    now = datetime.now(timezone.utc).isoformat()
    if not await _claim({"status": "starting", "started_at": now}):
        return None

    state: dict[str, Any] = {"status": "running", "started_at": now}
    try:
        model = await _pick_model()
        if not model:
            state.update(status="failed", error="None of the preferred OpenAI models is available on this key.")
            await _kv_set(REGEN_STATE_KEY, state)
            return state
        targets = await _targets()
        state.update(model=model, total=len(targets), regenerated=0, gone=0, failed=0)
        await _kv_set(REGEN_STATE_KEY, state)
        saved: dict[str, Any] = await backup()
        sem = asyncio.Semaphore(CONCURRENCY)
        lock = asyncio.Lock()

        async def one(prospect: StaleListingProspect) -> None:
            async with sem:
                try:
                    outcome = await regenerate_one(prospect.id, model, saved)
                except Exception:  # noqa: BLE001
                    logger.exception("Report rewrite raised for prospect %s", prospect.id)
                    outcome = "failed"
            async with lock:
                state[outcome] += 1
                await _kv_set(REGEN_BACKUP_KEY, saved)
                await _kv_set(REGEN_STATE_KEY, state)

        await asyncio.gather(*(one(p) for p in targets))
        state["status"] = "done"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Report rewrite stopped")
        state.update(status="failed", error=f"{type(exc).__name__}: {exc}"[:300])
    state["finished_at"] = datetime.now(timezone.utc).isoformat()
    await _kv_set(REGEN_STATE_KEY, state)
    logger.info("Report rewrite finished: %s", state)
    return state


async def start_after_delay(seconds: float = 90) -> None:
    await asyncio.sleep(seconds)
    try:
        await run_once()
    except Exception:  # noqa: BLE001 -- never take the app down
        logger.exception("Report rewrite could not start")
