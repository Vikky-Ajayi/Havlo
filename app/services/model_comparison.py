"""Side-by-side test of report models on real listings (console > Compare
models), to choose a model on evidence.

Each listing is read fresh from Rightmove (full description, real photo /
floor plan / tour counts) with the Land Registry sales we hold, then every
model writes the free report from exactly the same facts and prompt, and
the same claim checks (report_guard.py) run on each. For every model we
keep what it wrote, what the checks removed, the time taken and the token
cost. Nothing is saved to the prospects: live reports are untouched.

A run takes minutes, so it runs in the background; its progress and
results live in scraper_kv_state, readable by every worker.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select, text

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect
from app.services import groq_service, report_guard
from app.services import stale_prospect_service as sps

logger = logging.getLogger(__name__)

STATE_KEY = "report_model_comparison"
CURRENT = ("groq", groq_service.GROQ_MODEL)

# US dollars per million tokens (input, output), standard tier, as listed on
# 31 Oct 2026: developers.openai.com/api/docs/pricing, and for gpt-oss-120b
# on Groq the rate quoted across third-party listings (Groq's own page
# didn't show it). Models missing here show tokens but no cost.
PRICES: dict[str, tuple[float, float]] = {
    groq_service.GROQ_MODEL: (0.15, 0.60),
    "gpt-6-astra": (10.00, 50.00),
    "gpt-6.1-sol": (2.00, 10.00),
    "gpt-6.1-terra": (1.00, 5.00),
    "gpt-6-luna": (0.10, 0.50),
    "gpt-6-sol": (2.00, 10.00),
    "gpt-5.6-sol": (4.00, 20.00),
    "gpt-5.6-terra": (2.00, 12.00),
    "gpt-5.6-luna": (0.20, 1.20),
    "gpt-5.5": (5.00, 30.00),
    "gpt-5.4": (2.50, 15.00),
    "gpt-5.4-mini": (0.75, 4.50),
    "gpt-5.4-nano": (0.20, 1.25),
    "gpt-5-mini": (0.25, 2.00),
    "gpt-5-nano": (0.05, 0.40),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4o-mini": (0.15, 0.60),
}
PRICES_AS_OF = "31 Oct 2026"
# Suggested pair: a capable mid-priced model and a cheap one.
SUGGESTED = ("gpt-6.1-terra", "gpt-6-luna")
_NOT_TEXT = ("embedding", "whisper", "tts", "audio", "realtime", "transcribe", "image", "dall-e", "moderation",
             "search", "computer-use", "codex", "sora")

_task: asyncio.Task | None = None  # keeps the background run from being garbage-collected


def cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> float | None:
    price = PRICES.get(model)
    if not price:
        return None
    return round(prompt_tokens * price[0] / 1_000_000 + completion_tokens * price[1] / 1_000_000, 5)


async def openai_models() -> list[str]:
    """The OpenAI text models this account's key can use, priced ones first."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return []
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"})
    if resp.status_code >= 400:
        raise RuntimeError(f"OpenAI returned {resp.status_code}: {resp.text[:200]}")
    ids = [m.get("id", "") for m in resp.json().get("data") or []]
    ids = [i for i in ids if (i.startswith("gpt-") or i[:2] in ("o1", "o3", "o4")) and not any(w in i for w in _NOT_TEXT)]
    return sorted(set(ids), key=lambda i: (i not in PRICES, i))


async def load_state() -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        row = (await db.execute(text("SELECT value_json FROM scraper_kv_state WHERE key = :key"), {"key": STATE_KEY})).first()
    try:
        return json.loads(row[0]) if row and row[0] else {}
    except ValueError:
        return {}


async def _save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                "INSERT INTO scraper_kv_state (key, value_json, updated_at) VALUES (:key, :value, now()) "
                "ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now()"
            ),
            {"key": STATE_KEY, "value": json.dumps(state, ensure_ascii=False)},
        )
        await db.commit()


def is_running(state: dict[str, Any]) -> bool:
    if state.get("status") != "running":
        return False
    try:
        updated = datetime.fromisoformat(state.get("updated_at") or "")
    except ValueError:
        return False
    # A run that stopped saving (the worker restarted) isn't running any more.
    return (datetime.now(timezone.utc) - updated).total_seconds() < 15 * 60


async def _listings(limit: int) -> list[StaleListingProspect]:
    """Recent homeowner listings, one per Rightmove property, newest first;
    more than needed, since some have been taken down."""
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.audience == "owner",
                StaleListingProspect.country == "UK",
                StaleListingProspect.rightmove_url.like("%rightmove.co.uk/properties/%"),
            )
            .order_by(StaleListingProspect.created_at.desc())
            .limit(limit * 4)
        )).scalars().all()
    seen: set[str] = set()
    out = []
    for p in rows:
        rid = sps.rightmove_listing_id(p.rightmove_url or "")
        if rid and rid not in seen:
            seen.add(rid)
            out.append(p)
    return out


async def _write(provider: str, model: str, *, prospect: StaleListingProspect, snapshot: dict[str, Any],
                 sales: list[dict[str, Any]] | None) -> dict[str, Any]:
    """One model's free report for one listing, checked."""
    calls: list[dict[str, Any]] = []
    groq_service.REPORT_MODEL.set((provider, model))  # this task's own context only
    groq_service.REPORT_CALLS.set(calls)
    report_snapshot = sps.with_recorded_sales(snapshot, sales)
    try:
        report = await sps.generate_prospect_report(
            property_address=prospect.property_address,
            rightmove_url=prospect.rightmove_url,
            snapshot=report_snapshot,
            listing_duration_days=prospect.listing_duration_days,
            expand_report=False,
            market="UK",
        )
    except Exception as exc:  # noqa: BLE001
        calls.append({"error": f"{type(exc).__name__}: {exc}"[:300]})
        report = {}
    ok = any("error" not in c for c in calls)
    prompt_tokens = sum(c.get("prompt_tokens", 0) for c in calls)
    completion_tokens = sum(c.get("completion_tokens", 0) for c in calls)
    result: dict[str, Any] = {
        "provider": provider,
        "model": model,
        "ok": ok,
        "error": next((c["error"] for c in reversed(calls) if "error" in c), None) if not ok else None,
        "seconds": round(sum(c.get("seconds", 0) for c in calls), 1),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": cost_usd(model, prompt_tokens, completion_tokens),
    }
    if not ok:
        return result  # what came back is the stock fallback report, not this model's
    report["_sales_given"] = bool(report_snapshot["recorded_sales_nearby"])
    report["_media_given"] = sps.media_known(snapshot.get("media"))
    facts = sps.report_facts(
        snapshot, report, asking_price=prospect.asking_price, bedrooms=prospect.bedrooms, bathrooms=prospect.bathrooms,
        listing_duration_days=prospect.listing_duration_days,
        listed_date=sps.parse_listed_date(snapshot.get("listed_date")) or prospect.listed_date,
        written_at=datetime.now(timezone.utc), sales=sales,
    )
    removed: list[dict[str, Any]] = []
    cleaned = report_guard.clean_report(report, facts, removed=removed)
    raw_findings = [f for f in report.get("key_findings") or [] if isinstance(f, dict)]
    shown = [f for f in cleaned.get("key_findings") or [] if isinstance(f, dict)][:3]
    result.update({
        "findings_written": len(raw_findings),
        "findings_kept": len(cleaned.get("key_findings") or []),
        "removed": [r for r in removed if r["rule"] != "emptied"],
        # The free preview as a customer would now see it.
        "preview": [{"title": f.get("title"), "description": f.get("description")} for f in shown],
        "first_written": [{"title": f.get("title"), "description": f.get("description")} for f in raw_findings[:3]],
    })
    return result


async def run(models: list[tuple[str, str]], limit: int) -> None:
    from app.services.listing_scraper import scrape_single_listing

    state = {
        "status": "running", "started_at": datetime.now(timezone.utc).isoformat(),
        "models": [{"provider": p, "model": m} for p, m in models], "target": limit, "results": [],
        "skipped": 0, "prices_as_of": PRICES_AS_OF,
    }
    await _save_state(state)
    try:
        for prospect in await _listings(limit):
            if len(state["results"]) >= limit:
                break
            try:
                scraped = await scrape_single_listing(prospect.rightmove_url)
            except Exception:  # noqa: BLE001 -- taken down or unreadable
                scraped = {}
            snapshot = sps.snapshot_from_scrape(scraped or {}, prospect.rightmove_url)
            if scraped.get("blocked") or not snapshot.get("description"):
                state["skipped"] += 1
                await _save_state(state)
                continue
            sales = sps.cached_sold_comparables(prospect)
            if sales is None:
                sales = await sps._lookup_sold_comparables(
                    country="UK", postcode=prospect.postcode or snapshot.get("postcode"),
                    address=prospect.property_address, property_type=prospect.property_type or snapshot.get("property_type"),
                    asking_price=prospect.asking_price, timeout=20,
                )
            written = await asyncio.gather(*(
                _write(p, m, prospect=prospect, snapshot=snapshot, sales=sales) for p, m in models
            ))
            state["results"].append({
                "property_code": prospect.property_code,
                "address": prospect.property_address,
                "url": prospect.rightmove_url,
                "asking_price": prospect.asking_price,
                "sales_given": bool(sales),
                "media": snapshot.get("media"),
                "description_chars": len(snapshot.get("description") or ""),
                "models": list(written),
            })
            await _save_state(state)
        state["status"] = "done"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Model comparison failed")
        state["status"] = "failed"
        state["error"] = f"{type(exc).__name__}: {exc}"[:300]
    state["finished_at"] = datetime.now(timezone.utc).isoformat()
    await _save_state(state)


def start(models: list[tuple[str, str]], limit: int) -> None:
    global _task
    _task = asyncio.create_task(run(models, limit))


def summary(state: dict[str, Any]) -> list[dict[str, Any]]:
    """Per model, across the run's listings."""
    out = []
    for spec in state.get("models") or []:
        rows = [m for r in state.get("results") or [] for m in r.get("models") or []
                if m.get("model") == spec["model"] and m.get("provider") == spec["provider"]]
        ok = [m for m in rows if m.get("ok")]
        costs = [m["cost_usd"] for m in ok if m.get("cost_usd") is not None]
        rules: dict[str, int] = {}
        for m in ok:
            for r in m.get("removed") or []:
                rules[r["rule"]] = rules.get(r["rule"], 0) + 1
        out.append({
            **spec,
            "current": (spec["provider"], spec["model"]) == CURRENT,
            "reports": len(rows),
            "failed": len(rows) - len(ok),
            "reports_with_removals": sum(1 for m in ok if m.get("removed")),
            "claims_removed": sum(len(m.get("removed") or []) for m in ok),
            "previews_under_3": sum(1 for m in ok if len(m.get("preview") or []) < 3),
            "avg_findings_kept": round(sum(m.get("findings_kept", 0) for m in ok) / len(ok), 1) if ok else None,
            "avg_seconds": round(sum(m.get("seconds", 0) for m in ok) / len(ok), 1) if ok else None,
            "avg_cost_usd": round(sum(costs) / len(costs), 5) if costs else None,
            "by_rule": dict(sorted(rules.items(), key=lambda item: -item[1])),
        })
    return out
