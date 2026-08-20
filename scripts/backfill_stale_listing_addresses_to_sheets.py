"""Backfill existing 180-day-plus stale listing addresses into Google Sheets.

Run from the project root:

    python scripts/backfill_stale_listing_addresses_to_sheets.py [--dry-run]

The script is safe to run repeatedly. Rows are de-duplicated by Rightmove ID
or listing URL in the dedicated "Stale Listing Addresses" tab.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingProspect
from app.services.google_sheets import (
    SHEET_TABS,
    _get_spreadsheet,
    ensure_tabs_exist,
    is_configured,
    record_stale_listing_address,
)


def _as_dict(prospect: StaleListingProspect) -> dict[str, Any]:
    return {
        "rightmove_id": prospect.rightmove_id or "",
        "property_code": prospect.property_code or "",
        "property_address": prospect.property_address or "",
        "asking_price": prospect.asking_price or "",
        "listed_date": prospect.listed_date,
        "listing_duration_days": prospect.listing_duration_days or "",
        "property_type": prospect.property_type or "",
        "bedrooms": prospect.bedrooms or "",
        "bathrooms": prospect.bathrooms or "",
        "listing_url": prospect.rightmove_url or "",
        "discovery_run_id": str(prospect.discovery_run_id or ""),
        "source_status": "stale_180_days_plus",
    }


async def backfill(*, dry_run: bool) -> int:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingProspect)
            .where(
                StaleListingProspect.listing_duration_days.is_not(None),
                StaleListingProspect.listing_duration_days >= 180,
                StaleListingProspect.property_address.is_not(None),
                StaleListingProspect.property_address != "",
            )
            .order_by(StaleListingProspect.created_at)
        )
        prospects = result.scalars().all()

    written = 0
    for prospect in prospects:
        data = _as_dict(prospect)
        if dry_run:
            print(
                f"[DRY-RUN] {data['listing_duration_days']} days | "
                f"{data['property_address']} | {data['listing_url']}"
            )
        else:
            record_stale_listing_address(data)
            written += 1
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not is_configured():
        raise SystemExit(
            "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON "
            "and GOOGLE_SPREADSHEET_ID."
        )
    ensure_tabs_exist()
    sheet = _get_spreadsheet()
    sheet.worksheet("Stale Listing Addresses")
    count = asyncio.run(backfill(dry_run=args.dry_run))
    print(f"Completed stale listing address backfill: {count} record(s) processed.")


if __name__ == "__main__":
    main()