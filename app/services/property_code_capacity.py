"""Owner property codes are 4 digits (0000-9999): the code printed on each
letter and typed at /check. A code is in use while its prospect isn't
archived (make_property_code only avoids those), so there's room for
10,000 at once.

check_property_code_capacity runs every few hours and emails
ADMIN_NOTIFY_EMAIL once when 90% are in use, with how fast they're being
used up. If usage later falls below 85% (prospects archived), it re-arms,
so a second climb past 90% is reported again. The last check is kept in
scraper_kv_state under STATE_KEY.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import distinct, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect
from app.services import email_service

logger = logging.getLogger(__name__)

TOTAL_CODES = 10_000
ALERT_FRACTION = 0.9
REARM_FRACTION = 0.85
STATE_KEY = "property_code_capacity"


def _in_use_filters() -> tuple:
    return (
        StaleListingProspect.property_code.op("~")("^[0-9]{4}$"),
        or_(StaleListingProspect.source_status.is_(None), StaleListingProspect.source_status != "archived"),
    )


async def codes_in_use(db: AsyncSession) -> int:
    return int((await db.execute(
        select(func.count(distinct(StaleListingProspect.property_code))).where(*_in_use_filters())
    )).scalar() or 0)


async def codes_used_per_day(db: AsyncSession, days: int = 30) -> float:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    created = int((await db.execute(
        select(func.count(StaleListingProspect.id))
        .where(*_in_use_filters())
        .where(StaleListingProspect.created_at >= since)
    )).scalar() or 0)
    return created / days


def should_alert(used: int, state: dict[str, Any]) -> bool:
    return used >= ALERT_FRACTION * TOTAL_CODES and not state.get("alerted_at")


def should_rearm(used: int, state: dict[str, Any]) -> bool:
    return used < REARM_FRACTION * TOTAL_CODES and bool(state.get("alerted_at"))


async def _load_state(db: AsyncSession) -> dict[str, Any]:
    row = (await db.execute(
        text("SELECT value_json FROM scraper_kv_state WHERE key = :key"), {"key": STATE_KEY}
    )).first()
    try:
        return json.loads(row[0]) if row and row[0] else {}
    except ValueError:
        return {}


async def _save_state(db: AsyncSession, state: dict[str, Any]) -> None:
    await db.execute(
        text(
            """
            INSERT INTO scraper_kv_state (key, value_json, updated_at)
            VALUES (:key, :value, now())
            ON CONFLICT (key) DO UPDATE
                SET value_json = EXCLUDED.value_json, updated_at = now()
            """
        ),
        {"key": STATE_KEY, "value": json.dumps(state)},
    )
    await db.commit()


async def check_property_code_capacity() -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        used = await codes_in_use(db)
        per_day = await codes_used_per_day(db)
        state = await _load_state(db)
        now = datetime.now(timezone.utc).isoformat()
        state.update({"used": used, "total": TOTAL_CODES, "per_day": round(per_day, 1), "checked_at": now})
        if should_rearm(used, state):
            state.pop("alerted_at", None)
        elif should_alert(used, state):
            to_email = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
            if not to_email:
                logger.error("Property codes are %d/%d used, but ADMIN_NOTIFY_EMAIL is empty.", used, TOTAL_CODES)
            elif await asyncio.to_thread(
                email_service.send_property_code_capacity_alert_sync,
                to_email=to_email, used=used, total=TOTAL_CODES, per_day=per_day,
            ):
                state["alerted_at"] = now
            else:
                logger.warning("Property code capacity alert wasn't accepted; will retry next check.")
        await _save_state(db, state)
    return {"used": used, "total": TOTAL_CODES, "per_day": round(per_day, 1), "alerted": bool(state.get("alerted_at"))}
