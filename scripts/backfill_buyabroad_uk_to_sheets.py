"""
Backfill script — push existing buyabroad/uk form data to Google Sheets.

Covers the four buyabroad/uk-specific tabs:
  • "Eligibility Check"               ← /buyabroad/uk (source: buyabroad-uk)
  • "Agent / Partner Application"     ← /buyabroad/uk/agents (source: buyabroad-uk-agents)
  • "Free Consultation"               ← /buyabroad/uk/listings (source: buyabroad-uk-listings)
  • "UK Property Purchase Application"← /buyabroad/uk/apply

All four are read from their respective database tables:
  • uk_contact_form_submissions  (filtered by source)
  • uk_client_applications

Only rows where sheets_recorded_at IS NULL are pushed (i.e. not yet written to
Sheets). After a successful push the row's sheets_recorded_at is stamped so
re-running the script is safe — it will skip already-pushed rows.

Run from the project root:
    python scripts/backfill_buyabroad_uk_to_sheets.py [--dry-run]

Requirements: GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SPREADSHEET_ID must be set.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update

from app.db.database import AsyncSessionLocal
from app.models.models import UKContactFormSubmission, UKClientApplication
from app.services.google_sheets import (
    _get_spreadsheet,
    _parse_message_lines,
    ensure_tabs_exist,
    is_configured,
)

DRY_RUN = False


# ── helpers ──────────────────────────────────────────────────────────────────

def _ts(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _append(ws, row: list, tab: str) -> None:
    if DRY_RUN:
        print(f"    [DRY-RUN] would append to '{tab}': {row[:5]}")
        return
    ws.append_row(row, value_input_option="USER_ENTERED")


# ── per-tab backfill functions ────────────────────────────────────────────────

async def backfill_eligibility_check(sheet, db) -> int:
    """source = 'buyabroad-uk'  →  'Eligibility Check' tab."""
    tab = "Eligibility Check"
    ws = sheet.worksheet(tab)

    result = await db.execute(
        select(UKContactFormSubmission)
        .where(
            UKContactFormSubmission.source == "buyabroad-uk",
            UKContactFormSubmission.sheets_recorded_at.is_(None),
        )
        .order_by(UKContactFormSubmission.created_at)
    )
    rows = result.scalars().all()

    pushed = 0
    for r in rows:
        parsed = _parse_message_lines(r.message or "")
        phone = f"{r.phone_country_code}{r.phone_number}".strip()
        _append(ws, [
            _ts(r.created_at),
            r.first_name,
            r.last_name,
            r.email,
            phone,
            parsed.get("Outcome", ""),
            parsed.get("Looking to buy", ""),
            parsed.get("Approximate budget", ""),
            parsed.get("Timeline", ""),
            parsed.get("WhatsApp", ""),
        ], tab)
        if not DRY_RUN:
            await db.execute(
                update(UKContactFormSubmission)
                .where(UKContactFormSubmission.id == r.id)
                .values(sheets_recorded_at=datetime.now(timezone.utc))
            )
        pushed += 1

    if not DRY_RUN and pushed:
        await db.commit()
    return pushed


async def backfill_agent_partner(sheet, db) -> int:
    """source = 'buyabroad-uk-agents'  →  'Agent / Partner Application' tab."""
    tab = "Agent / Partner Application"
    ws = sheet.worksheet(tab)

    result = await db.execute(
        select(UKContactFormSubmission)
        .where(
            UKContactFormSubmission.source == "buyabroad-uk-agents",
            UKContactFormSubmission.sheets_recorded_at.is_(None),
        )
        .order_by(UKContactFormSubmission.created_at)
    )
    rows = result.scalars().all()

    pushed = 0
    for r in rows:
        parsed = _parse_message_lines(r.message or "")
        phone = f"{r.phone_country_code}{r.phone_number}".strip()
        _append(ws, [
            _ts(r.created_at),
            r.first_name,
            r.last_name,
            r.email,
            phone,
            parsed.get("Address", ""),
            parsed.get("Real estate company / agency", ""),
            parsed.get("Company website / social link", ""),
            parsed.get("Clients they can refer monthly", ""),
            parsed.get("Minimum property price their clients can afford", ""),
        ], tab)
        if not DRY_RUN:
            await db.execute(
                update(UKContactFormSubmission)
                .where(UKContactFormSubmission.id == r.id)
                .values(sheets_recorded_at=datetime.now(timezone.utc))
            )
        pushed += 1

    if not DRY_RUN and pushed:
        await db.commit()
    return pushed


async def backfill_free_consultation(sheet, db) -> int:
    """source = 'buyabroad-uk-listings'  →  'Free Consultation' tab."""
    tab = "Free Consultation"
    ws = sheet.worksheet(tab)

    result = await db.execute(
        select(UKContactFormSubmission)
        .where(
            UKContactFormSubmission.source == "buyabroad-uk-listings",
            UKContactFormSubmission.sheets_recorded_at.is_(None),
        )
        .order_by(UKContactFormSubmission.created_at)
    )
    rows = result.scalars().all()

    pushed = 0
    for r in rows:
        parsed = _parse_message_lines(r.message or "")
        phone = f"{r.phone_country_code}{r.phone_number}".strip()
        _append(ws, [
            _ts(r.created_at),
            r.first_name,
            r.last_name,
            r.email,
            phone,
            parsed.get("Property", ""),
            parsed.get("Price", ""),
            parsed.get("Rightmove URL", parsed.get("Property URL", "")),
            parsed.get("City", ""),
        ], tab)
        if not DRY_RUN:
            await db.execute(
                update(UKContactFormSubmission)
                .where(UKContactFormSubmission.id == r.id)
                .values(sheets_recorded_at=datetime.now(timezone.utc))
            )
        pushed += 1

    if not DRY_RUN and pushed:
        await db.commit()
    return pushed


async def backfill_uk_purchase_application(sheet, db) -> int:
    """uk_client_applications  →  'UK Property Purchase Application' tab."""
    tab = "UK Property Purchase Application"
    ws = sheet.worksheet(tab)

    result = await db.execute(
        select(UKClientApplication)
        .where(UKClientApplication.sheets_recorded_at.is_(None))
        .order_by(UKClientApplication.created_at)
    )
    rows = result.scalars().all()

    pushed = 0
    for r in rows:
        _append(ws, [
            _ts(r.created_at),
            r.full_name,
            r.date_of_birth,
            r.email,
            r.mobile,
            r.address,
            r.occupation,
            r.uk_area,
            r.property_type,
            r.bedrooms,
            r.budget,
        ], tab)
        if not DRY_RUN:
            await db.execute(
                update(UKClientApplication)
                .where(UKClientApplication.id == r.id)
                .values(sheets_recorded_at=datetime.now(timezone.utc))
            )
        pushed += 1

    if not DRY_RUN and pushed:
        await db.commit()
    return pushed


# ── main ─────────────────────────────────────────────────────────────────────

async def run_backfill() -> None:
    if not is_configured():
        print("ERROR: Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SPREADSHEET_ID.")
        sys.exit(1)

    print("Connecting to Google Sheets...")
    sheet = _get_spreadsheet()
    print(f"Connected: {sheet.title}")

    print("Ensuring tabs exist...")
    ensure_tabs_exist()

    print(f"\nMode: {'DRY RUN — nothing will be written' if DRY_RUN else 'LIVE'}\n")

    async with AsyncSessionLocal() as db:
        tasks = [
            ("Eligibility Check",                backfill_eligibility_check(sheet, db)),
            ("Agent / Partner Application",      backfill_agent_partner(sheet, db)),
            ("Free Consultation",                backfill_free_consultation(sheet, db)),
            ("UK Property Purchase Application", backfill_uk_purchase_application(sheet, db)),
        ]

        total = 0
        for label, coro in tasks:
            try:
                n = await coro
                status = "✓" if n > 0 else "–"
                print(f"  {status} {label}: {n} row(s) pushed")
                total += n
            except Exception as exc:
                print(f"  ✗ {label}: FAILED — {type(exc).__name__}: {exc}")

    print(f"\nDone. {total} total row(s) written to Google Sheets.")
    if DRY_RUN:
        print("(Dry-run — no data was actually written or stamped.)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill buyabroad/uk form submissions to Google Sheets."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be written without writing or stamping anything.",
    )
    args = parser.parse_args()
    DRY_RUN = args.dry_run

    asyncio.run(run_backfill())
