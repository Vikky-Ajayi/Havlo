"""HM Land Registry Price Paid Data, kept in our own database.

Comparable sold prices came from Land Registry's public SPARQL endpoint, one
query per lookup, until it started refusing the server (HTTP 403). Land
Registry also publishes the same data as free yearly CSV files, re-issued
every month with that month's additions and corrections, so the last few
years of it now live in land_registry_sales and a lookup is a local query.

A background loop (one worker at a time, via the scrapers' advisory lock)
checks the files every few hours and reloads a year whenever Land Registry
has re-issued it (its ETag changed): rows are upserted and any Land Registry
has since withdrawn are deleted, so the table always matches the files.
Postgres parses the CSV itself (COPY); Python only streams the bytes, so
the web worker's event loop isn't tied up.

Only standard sales (category A) with a postcode are kept -- the only ones
select_comparables would use -- which also keeps the table small.

Contains HM Land Registry data (c) Crown copyright and database right,
licensed under the Open Government Licence v3.0.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import date, datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

from app.db import database
from app.models.models import LandRegistrySale
from app.services.land_registry import LOOKBACK_MONTHS, format_address

logger = logging.getLogger(__name__)

FILES_URL = "http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com"
STATE_KEY = "land_registry_price_paid"
USER_AGENT = "Havlo/1.0 (+https://www.heyhavlo.com; sold-price comparables)"
TYPE_NAMES = {
    "D": "detached",
    "S": "semi-detached",
    "T": "terraced",
    "F": "flat-maisonette",
    "O": "otherPropertyType",
}
# A re-issued year with far fewer rows than we already hold is more likely a
# truncated or broken file than Land Registry withdrawing sales: keep ours.
MIN_RELOAD_FRACTION = 0.8
_RAW_COLUMNS = (
    "tid", "price", "sale_date", "postcode", "ptype", "old_new", "duration", "paon", "saon",
    "street", "locality", "town", "district", "county", "category", "status",
)
_READY_CACHE_SECONDS = 300
_ready_cache: tuple[float, bool] = (0.0, False)


class PricePaidNotReady(RuntimeError):
    """The table doesn't cover the lookup window yet (first load running)."""


def years_needed(today: date | None = None) -> list[int]:
    """Calendar years covering the lookup window (land_registry's `since`)."""
    today = today or datetime.now(timezone.utc).date()
    return list(range(today.year - LOOKBACK_MONTHS // 12, today.year + 1))


async def _load_state() -> dict[str, Any]:
    async with database.AsyncSessionLocal() as db:
        row = (await db.execute(
            text("SELECT value_json FROM scraper_kv_state WHERE key = :key"), {"key": STATE_KEY}
        )).first()
    try:
        state = json.loads(row[0]) if row and row[0] else {}
    except ValueError:
        state = {}
    state.setdefault("years", {})
    return state


async def _save_state(state: dict[str, Any]) -> None:
    async with database.AsyncSessionLocal() as db:
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


def _covered(state: dict[str, Any], today: date | None = None) -> bool:
    """Every year the lookup window needs is loaded, or known not to be
    published yet (e.g. the new year's file in early January)."""
    years = state.get("years") or {}
    return all(str(year) in years for year in years_needed(today))


async def ready() -> bool:
    """Whether lookups can trust the table (cached for a few minutes)."""
    global _ready_cache
    checked_at, value = _ready_cache
    if checked_at and time.monotonic() - checked_at < _READY_CACHE_SECONDS:
        return value
    value = _covered(await _load_state())
    _ready_cache = (time.monotonic(), value)
    return value


def sales_from_rows(rows: list[tuple]) -> list[dict[str, Any]]:
    """(paon, saon, street, postcode, price, sale_date, property_type) rows
    as the sale dicts select_comparables takes."""
    return [
        {
            "address": format_address(saon or "", paon or "", street or "", postcode),
            "type": TYPE_NAMES.get(ptype, "otherPropertyType"),
            "price": int(price),
            "date": when,
            "category": "standard",
        }
        for paon, saon, street, postcode, price, when, ptype in rows
    ]


async def recorded_sales(postcodes: list[str], since: date, limit: int = 400) -> list[dict[str, Any]]:
    """Standard sales in these postcodes since `since`, newest first.
    Raises PricePaidNotReady until the first load has finished, so an empty
    table is never mistaken for "no sales nearby"."""
    if not await ready():
        raise PricePaidNotReady("Land Registry price paid data is still loading")
    sale = LandRegistrySale
    async with database.AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(sale.paon, sale.saon, sale.street, sale.postcode, sale.price, sale.sale_date, sale.property_type)
            .where(sale.postcode.in_([pc.upper().strip() for pc in postcodes]))
            .where(sale.sale_date >= since)
            .order_by(sale.sale_date.desc())
            .limit(limit)
        )).all()
    return sales_from_rows([tuple(row) for row in rows])


def _engine() -> AsyncEngine:
    # Its own connection with no per-statement timeout: loading a year means
    # a COPY and an upsert of about a million rows each.
    return create_async_engine(
        database.DATABASE_URL, poolclass=NullPool, connect_args=database._connect_args(None)
    )


async def _load_year(engine: AsyncEngine, client: httpx.AsyncClient, year: int) -> dict[str, Any]:
    """Make land_registry_sales' rows for `year` exactly Land Registry's
    current pp-<year>.csv, in one transaction. Returns etag and counts."""
    url = f"{FILES_URL}/pp-{year}.csv"
    start, end = date(year, 1, 1), date(year + 1, 1, 1)
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TEMP TABLE ppd_raw (" + ", ".join(f"{c} text" for c in _RAW_COLUMNS) + ") ON COMMIT DROP"
        ))
        raw = (await conn.get_raw_connection()).driver_connection
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            etag = response.headers.get("etag")
            await raw.copy_to_table("ppd_raw", source=response.aiter_bytes(), format="csv")
        await conn.execute(text(
            """
            CREATE TEMP TABLE ppd_new ON COMMIT DROP AS
            SELECT DISTINCT ON (tid)
                trim(both '{}' from tid)::uuid AS transaction_id,
                price::bigint AS price,
                left(sale_date, 10)::date AS sale_date,
                upper(trim(postcode)) AS postcode,
                ptype AS property_type,
                nullif(trim(paon), '') AS paon,
                nullif(trim(saon), '') AS saon,
                nullif(trim(street), '') AS street
            FROM ppd_raw
            WHERE category = 'A'
              AND coalesce(status, 'A') <> 'D'
              AND trim(coalesce(postcode, '')) <> ''
              AND length(trim(postcode)) <= 8
              AND ptype IN ('D', 'S', 'T', 'F', 'O')
              AND price ~ '^[0-9]+$'
              AND left(sale_date, 10)::date >= :start AND left(sale_date, 10)::date < :end
            ORDER BY tid
            """
        ), {"start": start, "end": end})
        await conn.execute(text("DELETE FROM ppd_new WHERE price < 1 OR price > 2147483647"))
        # The withdrawn-sales DELETE below looks up every row of the year in
        # ppd_new. When the table's statistics predate this year's rows (e.g.
        # loading 2025 right after 2026), Postgres expects ~1 row and picks a
        # nested loop that rescans all of ppd_new per row -- a million times
        # a million; it ran for half an hour on the first real load. With
        # this index each row is one index lookup, whatever plan it picks.
        await conn.execute(text("CREATE INDEX ON ppd_new (transaction_id)"))
        await conn.execute(text("ANALYZE ppd_new"))
        new_rows, latest = (await conn.execute(text("SELECT count(*), max(sale_date) FROM ppd_new"))).one()
        held = (await conn.execute(
            text("SELECT count(*) FROM land_registry_sales WHERE sale_date >= :start AND sale_date < :end"),
            {"start": start, "end": end},
        )).scalar_one()
        if held > 1000 and new_rows < held * MIN_RELOAD_FRACTION:
            raise RuntimeError(
                f"pp-{year}.csv gave {new_rows} sales but we hold {held}; keeping ours (truncated file?)"
            )
        upserted = (await conn.execute(text(
            """
            INSERT INTO land_registry_sales AS s
                (transaction_id, price, sale_date, postcode, property_type, paon, saon, street)
            SELECT transaction_id, price, sale_date, postcode, property_type, paon, saon, street FROM ppd_new
            ON CONFLICT (transaction_id) DO UPDATE SET
                price = EXCLUDED.price, sale_date = EXCLUDED.sale_date, postcode = EXCLUDED.postcode,
                property_type = EXCLUDED.property_type, paon = EXCLUDED.paon, saon = EXCLUDED.saon,
                street = EXCLUDED.street
            WHERE (s.price, s.sale_date, s.postcode, s.property_type, s.paon, s.saon, s.street)
                IS DISTINCT FROM
                  (EXCLUDED.price, EXCLUDED.sale_date, EXCLUDED.postcode, EXCLUDED.property_type,
                   EXCLUDED.paon, EXCLUDED.saon, EXCLUDED.street)
            """
        ))).rowcount
        withdrawn = (await conn.execute(text(
            """
            DELETE FROM land_registry_sales s
            WHERE s.sale_date >= :start AND s.sale_date < :end
              AND NOT EXISTS (SELECT 1 FROM ppd_new n WHERE n.transaction_id = s.transaction_id)
            """
        ), {"start": start, "end": end})).rowcount
    return {
        "etag": etag, "rows": new_rows, "latest_sale": latest.isoformat() if latest else None,
        "changed": upserted, "withdrawn": withdrawn,
    }


async def refresh_price_paid() -> dict[str, Any]:
    """One check of Land Registry's yearly files: reload any year that has
    been re-issued since we loaded it, and drop years that have left the
    lookup window. Safe to run repeatedly; a failed year is retried next time."""
    global _ready_cache
    state = await _load_state()
    years = years_needed()
    summary: dict[str, Any] = {}
    engine = _engine()
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(900.0, connect=20.0), follow_redirects=True,
            headers={"User-Agent": USER_AGENT}, trust_env=False,
        ) as client:
            for year in sorted(years, reverse=True):  # newest first: most useful soonest
                url = f"{FILES_URL}/pp-{year}.csv"
                try:
                    head = await client.head(url)
                    if head.status_code in (403, 404) and year == years[-1]:
                        # This year's file isn't published yet.
                        state["years"][str(year)] = {"missing": True, "checked_at": datetime.now(timezone.utc).isoformat()}
                        summary[year] = "not published yet"
                        continue
                    head.raise_for_status()
                    known = state["years"].get(str(year)) or {}
                    if known.get("etag") and known.get("etag") == head.headers.get("etag"):
                        summary[year] = "unchanged"
                        continue
                    started = time.monotonic()
                    result = await _load_year(engine, client, year)
                    state["years"][str(year)] = {
                        "etag": result["etag"],
                        "rows": result["rows"],
                        "latest_sale": result["latest_sale"],
                        "loaded_at": datetime.now(timezone.utc).isoformat(),
                    }
                    await _save_state(state)
                    summary[year] = (
                        f"{result['rows']} sales ({result['changed']} new/changed, "
                        f"{result['withdrawn']} withdrawn) in {time.monotonic() - started:.0f}s"
                    )
                except Exception as exc:  # noqa: BLE001 -- one bad year mustn't block the others
                    logger.warning("Price paid data: loading %s failed: %s", year, exc)
                    summary[year] = f"failed: {type(exc).__name__}: {str(exc)[:200]}"
        async with engine.begin() as conn:
            pruned = (await conn.execute(
                text("DELETE FROM land_registry_sales WHERE sale_date < :first"),
                {"first": date(years[0], 1, 1)},
            )).rowcount
        if pruned:
            summary["pruned_old_sales"] = pruned
        for key in list(state["years"]):
            if int(key) < years[0]:
                del state["years"][key]
        await _save_state(state)
    finally:
        await engine.dispose()
    _ready_cache = (time.monotonic(), _covered(state))
    return summary


async def status() -> dict[str, Any]:
    """What's loaded, for the status endpoint (no data, just counts)."""
    state = await _load_state()
    return {
        "ready": _covered(state),
        "years": {
            year: "not published yet" if info.get("missing") else {
                "sales": info.get("rows"), "latest_sale": info.get("latest_sale"), "loaded_at": info.get("loaded_at"),
            }
            for year, info in sorted(state["years"].items())
        },
    }
