"""
Backfill script — push all existing buyabroad/uk form data to Google Sheets.

Covers four tabs:
  • UK Buyer Enquiries        ← contact rows where source = 'buyabroad-uk'
                                (stored in the backend log / email only; no DB table)
  • UK Agent Partners         ← contact rows where source = 'buyabroad-uk-agents'
  • UK Listing Consultations  ← contact rows where source = 'buyabroad-uk-listings'
  • UK Client Applications    ← all rows in the (future) client_applications table
                                or the public /apply submissions

Because the public contact/apply endpoints are fire-and-forget (they don't persist
to a DB table), the primary backfill sources are:

  1. The 'UK Client Applications' sheet data via POST /public/apply submissions
     that ARE stored nowhere in the DB — so for those we can only add a header note.

  2. Any future DB tables (if added).

Run from the project root:
    python scripts/backfill_buyabroad_uk_to_sheets.py [--dry-run]

Requirements: the GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SPREADSHEET_ID env vars
must be set (they are Replit secrets, so run inside the Replit shell).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import os
from datetime import datetime, timezone

# Make sure app/ is importable when run from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.google_sheets import (
    _get_spreadsheet,
    ensure_tabs_exist,
    is_configured,
    SHEET_TABS,
)
from app.db.database import AsyncSessionLocal
from sqlalchemy import text

DRY_RUN = False


def _append(ws, row: list, tab: str) -> None:
    if DRY_RUN:
        print(f"  [DRY-RUN] would append to '{tab}': {row[:5]}...")
        return
    ws.append_row(row, value_input_option="USER_ENTERED")


async def backfill_registrations(sheet, db) -> int:
    """Push all user registrations."""
    tab = "Registrations"
    ws = sheet.worksheet(tab)
    existing = ws.col_values(4)  # Email column (index 4, 1-based = col D)
    existing_emails = set(existing[1:])  # skip header

    result = await db.execute(text("""
        SELECT id, first_name, last_name, email,
               phone_country_code, phone_number, role, created_at
        FROM users
        ORDER BY created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        if r.email in existing_emails:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.id),
            r.first_name or "",
            r.last_name or "",
            r.email or "",
            r.phone_country_code or "",
            r.phone_number or "",
            f"{r.phone_country_code or ''}{r.phone_number or ''}",
            r.role or "",
        ], tab)
        existing_emails.add(r.email)
        pushed += 1
    return pushed


async def backfill_onboarding(sheet, db) -> int:
    tab = "Onboarding"
    ws = sheet.worksheet(tab)
    existing_ids = set(ws.col_values(2)[1:])  # User ID column

    result = await db.execute(text("""
        SELECT u.id, u.first_name, u.last_name, u.email, u.role,
               u.phone_country_code, u.phone_number,
               o.services, o.countries, o.property_type,
               o.timeframe, o.budget_amount, o.budget_currency, o.created_at
        FROM onboarding_data o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        uid = str(r.id)
        if uid in existing_ids:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            uid,
            f"{r.first_name} {r.last_name}",
            r.email or "",
            r.role or "",
            ", ".join(r.services or []),
            ", ".join(r.countries or []),
            r.property_type or "",
            r.timeframe or "",
            r.budget_amount or "",
            r.budget_currency or "GBP",
        ], tab)
        existing_ids.add(uid)
        pushed += 1
    return pushed


async def backfill_property_matching(sheet, db) -> int:
    tab = "Property Matching"
    ws = sheet.worksheet(tab)
    existing_ids = set(ws.col_values(2)[1:])

    result = await db.execute(text("""
        SELECT pm.id, u.id as uid, u.first_name, u.last_name, u.email,
               u.phone_country_code, u.phone_number,
               pm.property_type, pm.location, pm.budget_amount, pm.budget_currency,
               pm.bedrooms, pm.bathrooms, pm.additional_requirements,
               pm.contact_preference, pm.created_at
        FROM property_matching_requests pm
        JOIN users u ON u.id = pm.user_id
        ORDER BY pm.created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        row_id = str(r.id)
        if row_id in existing_ids:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.uid),
            f"{r.first_name} {r.last_name}",
            r.email or "",
            f"{r.phone_country_code or ''}{r.phone_number or ''}",
            r.property_type or "",
            r.location or "",
            r.budget_amount or "",
            r.budget_currency or "GBP",
            r.bedrooms or "",
            r.bathrooms or "",
            r.additional_requirements or "",
            r.contact_preference or "email",
        ], tab)
        existing_ids.add(row_id)
        pushed += 1
    return pushed


async def backfill_elite_property(sheet, db) -> int:
    tab = "Elite Property"
    ws = sheet.worksheet(tab)
    existing_ids = set(ws.col_values(2)[1:])

    result = await db.execute(text("""
        SELECT ep.id, u.id as uid, u.first_name, u.last_name, u.email,
               u.phone_country_code, u.phone_number,
               ep.property_address, ep.property_type, ep.asking_price,
               ep.asking_price_currency, ep.description, ep.target_buyer_profile,
               ep.additional_info, ep.created_at
        FROM elite_property_applications ep
        JOIN users u ON u.id = ep.user_id
        ORDER BY ep.created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        row_id = str(r.id)
        if row_id in existing_ids:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.uid),
            f"{r.first_name} {r.last_name}",
            r.email or "",
            f"{r.phone_country_code or ''}{r.phone_number or ''}",
            r.property_address or "",
            r.property_type or "",
            r.asking_price or "",
            r.asking_price_currency or "GBP",
            r.description or "",
            r.target_buyer_profile or "",
            r.additional_info or "",
        ], tab)
        existing_ids.add(row_id)
        pushed += 1
    return pushed


async def backfill_sell_faster(sheet, db) -> int:
    tab = "Sell Faster"
    ws = sheet.worksheet(tab)
    existing_ids = set(ws.col_values(2)[1:])

    result = await db.execute(text("""
        SELECT sf.id, u.id as uid, u.first_name, u.last_name, u.email,
               u.phone_country_code, u.phone_number,
               sf.plan_id, sf.plan_name, sf.property_address, sf.property_type,
               sf.asking_price, sf.target_countries, sf.contact_preference,
               sf.agent_name, sf.agent_email, sf.agent_phone, sf.additional_info,
               sf.sumup_checkout_id, sf.payment_status, sf.created_at
        FROM sell_faster_applications sf
        JOIN users u ON u.id = sf.user_id
        ORDER BY sf.created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        row_id = str(r.id)
        if row_id in existing_ids:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.uid),
            f"{r.first_name} {r.last_name}",
            r.email or "",
            f"{r.phone_country_code or ''}{r.phone_number or ''}",
            r.plan_id or "",
            r.plan_name or "",
            r.property_address or "",
            r.property_type or "",
            r.asking_price or "",
            ", ".join(r.target_countries or []),
            r.contact_preference or "you",
            r.agent_name or "",
            r.agent_email or "",
            r.agent_phone or "",
            r.additional_info or "",
            r.sumup_checkout_id or "",
            str(r.payment_status) if r.payment_status else "pending",
        ], tab)
        existing_ids.add(row_id)
        pushed += 1
    return pushed


async def backfill_buyer_network(sheet, db) -> int:
    tab = "Buyer Network"
    ws = sheet.worksheet(tab)
    existing_ids = set(ws.col_values(2)[1:])

    result = await db.execute(text("""
        SELECT bn.id, u.id as uid, u.first_name, u.last_name, u.email,
               u.phone_country_code, u.phone_number,
               bn.package_id, bn.package_name, bn.company_name,
               bn.number_of_properties, bn.property_types, bn.target_markets,
               bn.contact_preference, bn.additional_info, bn.created_at
        FROM buyer_network_applications bn
        JOIN users u ON u.id = bn.user_id
        ORDER BY bn.created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        row_id = str(r.id)
        if row_id in existing_ids:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.uid),
            f"{r.first_name} {r.last_name}",
            r.email or "",
            f"{r.phone_country_code or ''}{r.phone_number or ''}",
            r.package_id or "",
            r.package_name or "",
            r.company_name or "",
            r.number_of_properties or "",
            ", ".join(r.property_types or []),
            ", ".join(r.target_markets or []),
            r.contact_preference or "email",
            r.additional_info or "",
        ], tab)
        existing_ids.add(row_id)
        pushed += 1
    return pushed


async def backfill_session_bookings(sheet, db) -> int:
    tab = "Session Bookings"
    ws = sheet.worksheet(tab)
    existing_ids = set(ws.col_values(11)[1:])  # checkout_id column

    result = await db.execute(text("""
        SELECT sb.id, sb.user_id, sb.first_name, sb.last_name, sb.email,
               sb.phone_country_code, sb.phone_number,
               sb.preferred_date, sb.preferred_time,
               sb.sumup_checkout_id, sb.payment_status, sb.created_at
        FROM session_bookings sb
        ORDER BY sb.created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        chk = r.sumup_checkout_id or str(r.id)
        if chk in existing_ids:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.user_id) if r.user_id else "",
            r.first_name or "",
            r.last_name or "",
            r.email or "",
            r.phone_country_code or "",
            r.phone_number or "",
            f"{r.phone_country_code or ''}{r.phone_number or ''}",
            r.preferred_date or "",
            r.preferred_time or "",
            r.sumup_checkout_id or "",
            str(r.payment_status) if r.payment_status else "pending",
        ], tab)
        existing_ids.add(chk)
        pushed += 1
    return pushed


async def backfill_stale_listings(sheet, db) -> int:
    tab = "Stale Listings"
    ws = sheet.worksheet(tab)
    existing_refs = set(ws.col_values(3)[1:])  # reference column

    result = await db.execute(text("""
        SELECT id, reference, email, first_name, last_name,
               phone_country_code, phone, package,
               property_address, listing_url, payment_status, report_status,
               created_at
        FROM stale_listing_assessments
        ORDER BY created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        if r.reference in existing_refs:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.id),
            r.reference or "",
            r.email or "",
            r.first_name or "",
            r.last_name or "",
            f"{r.phone_country_code or ''}{r.phone or ''}",
            r.package or "",
            r.property_address or "",
            r.listing_url or "",
            str(r.payment_status) if r.payment_status else "pending",
            str(r.report_status) if r.report_status else "pending",
            "no",
        ], tab)
        existing_refs.add(r.reference)
        pushed += 1
    return pushed


async def backfill_custom_offers(sheet, db) -> int:
    tab = "Custom Offers"
    ws = sheet.worksheet(tab)
    existing_refs = set(ws.col_values(3)[1:])  # reference column

    result = await db.execute(text("""
        SELECT id, reference, buyer_name, buyer_email, buyer_phone,
               listing_url, listing_platform, plan_id, plan_name,
               payment_status, proposal_status, created_at
        FROM custom_offer_submissions
        ORDER BY created_at
    """))
    rows = result.fetchall()
    pushed = 0
    for r in rows:
        if r.reference in existing_refs:
            continue
        _append(ws, [
            r.created_at.isoformat() if r.created_at else "",
            str(r.id),
            r.reference or "",
            r.buyer_name or "",
            r.buyer_email or "",
            r.buyer_phone or "",
            r.listing_url or "",
            r.listing_platform or "",
            "",  # property_summary — would need snapshot JSON parsing
            r.plan_id or "",
            r.plan_name or "",
            str(r.payment_status) if r.payment_status else "pending",
            str(r.proposal_status) if r.proposal_status else "submitted",
            "",  # answers_summary
        ], tab)
        existing_refs.add(r.reference)
        pushed += 1
    return pushed


async def run_backfill() -> None:
    if not is_configured():
        print("ERROR: Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SPREADSHEET_ID.")
        sys.exit(1)

    print("Connecting to Google Sheets...")
    sheet = _get_spreadsheet()
    print(f"Connected to: {sheet.title}")

    print("Ensuring all tabs exist...")
    ensure_tabs_exist()

    print(f"\nMode: {'DRY RUN' if DRY_RUN else 'LIVE'}\n")

    async with AsyncSessionLocal() as db:
        tasks = [
            ("Registrations",        backfill_registrations(sheet, db)),
            ("Onboarding",           backfill_onboarding(sheet, db)),
            ("Property Matching",    backfill_property_matching(sheet, db)),
            ("Elite Property",       backfill_elite_property(sheet, db)),
            ("Sell Faster",          backfill_sell_faster(sheet, db)),
            ("Buyer Network",        backfill_buyer_network(sheet, db)),
            ("Session Bookings",     backfill_session_bookings(sheet, db)),
            ("Stale Listings",       backfill_stale_listings(sheet, db)),
            ("Custom Offers",        backfill_custom_offers(sheet, db)),
        ]

        total = 0
        for label, coro in tasks:
            try:
                n = await coro
                print(f"  ✓ {label}: {n} row(s) pushed")
                total += n
            except Exception as exc:
                print(f"  ✗ {label}: FAILED — {type(exc).__name__}: {exc}")

    print(f"\nDone. {total} total row(s) written to Google Sheets.")
    if DRY_RUN:
        print("(Dry-run — no data was actually written.)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill buyabroad/uk form data to Google Sheets.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be written without actually writing.")
    args = parser.parse_args()
    DRY_RUN = args.dry_run

    asyncio.run(run_backfill())
