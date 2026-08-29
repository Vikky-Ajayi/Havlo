"""Bulk-regenerate stale-listing prospect reports with the fixed Groq prompt
(see app/services/groq_service.py — the boilerplate-injection bug that made
every finding/action repeat the same fixed sentences has been removed) and
push updated letter PDFs to ADMIN_NOTIFY_EMAIL for review.

Scope (confirmed with the user):
  - Prospects matching today's discovery criteria: property_type in
    (detached, terrace-ish), asking_price >= £500,000, listing_duration_days
    >= 180 (mirrors DiscoveryParams defaults in stale_listing_discovery.py).
  - PLUS the 3 already-paid (payment_status="completed") prospects, included
    even though at least one (Blade Tower, a flat) falls outside that filter.

Modes:
  --dry-run (default): regenerate each report + rebuild its letter PDF on
    disk for review, but roll back every DB change and send no email.
  --live: persist the regenerated report/preview/letter PDF to the DB,
    reissue a QR access token (matching the existing retry_pending_stale_
    prospect_emails pattern — the old token's hash can't be recovered), and
    email the letter PDF to ADMIN_NOTIFY_EMAIL via the existing
    send_prospect_letter_to_admin() pipeline function.

Usage (from repo root):
    python scripts/regenerate_stale_reports.py                # dry run, all qualifying
    python scripts/regenerate_stale_reports.py --limit 5       # dry run, first 5 only
    python scripts/regenerate_stale_reports.py --live          # live run, all qualifying
    python scripts/regenerate_stale_reports.py --live --property-code 9969   # live, one property
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Manual .env loader (quote-stripping) so this runs standalone like the
# scratchpad test scripts used to validate the Groq prompt fix.
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            val = val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                val = val[1:-1]
            os.environ.setdefault(key.strip(), val)


def is_target_property_type(property_type: str) -> bool:
    text = (property_type or "").lower()
    return ("detached" in text) or ("terrace" in text)


async def find_qualifying_prospects(session):
    from sqlalchemy import select
    from app.models.models import StaleListingProspect

    result = await session.execute(select(StaleListingProspect).order_by(StaleListingProspect.created_at.asc()))
    rows = list(result.scalars().all())

    def matches_current_criteria(r) -> bool:
        return (
            is_target_property_type(r.property_type)
            and (r.asking_price or 0) >= 500000
            and (r.listing_duration_days or 0) >= 180
        )

    qualifying = [r for r in rows if matches_current_criteria(r) or r.payment_status == "completed"]
    return qualifying


async def regenerate_one(db, prospect, *, live: bool, output_dir: str) -> dict:
    import json as _json

    from app.services.stale_prospect_service import (
        build_preview,
        create_access_token,
        generate_letter_pdf,
        generate_prospect_report,
        hash_access_token,
        send_prospect_letter_to_admin,
    )
    from app.config import get_settings

    snapshot = _json.loads(prospect.listing_snapshot_json) if prospect.listing_snapshot_json else {}
    old_report = _json.loads(prospect.report_json) if prospect.report_json else {}

    report = await generate_prospect_report(
        property_address=prospect.property_address,
        rightmove_url=prospect.rightmove_url,
        snapshot=snapshot,
        listing_duration_days=prospect.listing_duration_days,
        expand_report=True,  # full two-pass quality for this one-off fix, unlike the bulk-discovery job
    )
    preview = build_preview(report, snapshot, prospect.property_address)

    prospect.report_json = _json.dumps(report, ensure_ascii=False)
    prospect.preview_json = _json.dumps(preview, ensure_ascii=False)

    token = create_access_token()
    public_base_url = get_settings().FRONTEND_URL or "https://www.heyhavlo.com"
    letter_path = generate_letter_pdf(prospect, token, public_base_url)

    result = {
        "property_code": prospect.property_code,
        "address": prospect.property_address,
        "old_overall_score": old_report.get("overall_score"),
        "new_overall_score": report.get("overall_score"),
        "key_findings_count": len(report.get("key_findings") or []),
        "action_plan_count": len(report.get("action_plan") or []),
        "letter_pdf_path": letter_path,
        "emailed": False,
    }

    if live:
        prospect.qr_token_hash = hash_access_token(token)
        prospect.letter_pdf_path = letter_path
        prospect.processing_status = "letter_ready"
        await db.commit()
        emailed = await send_prospect_letter_to_admin(str(prospect.id), token, public_base_url)
        result["emailed"] = emailed
    else:
        # Dry run: keep the freshly generated PDF on disk for review (it
        # already landed at generated/stale-prospect-letters/stale-listing-
        # {code}.pdf) but discard every DB-side change.
        await db.rollback()

    return result


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Persist changes and email ADMIN_NOTIFY_EMAIL. Default is a dry run.")
    parser.add_argument("--limit", type=int, default=0, help="Only process the first N qualifying prospects (0 = no limit).")
    parser.add_argument("--property-code", type=str, default="", help="Only process this one property_code.")
    args = parser.parse_args()

    from app.db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        qualifying = await find_qualifying_prospects(session)

    if args.property_code:
        qualifying = [r for r in qualifying if r.property_code == args.property_code]
    if args.limit:
        qualifying = qualifying[: args.limit]

    print(f"{'LIVE' if args.live else 'DRY RUN'}: {len(qualifying)} prospect(s) to process\n")

    results = []
    for i, row in enumerate(qualifying, start=1):
        async with AsyncSessionLocal() as db:
            prospect = await db.get(type(row), row.id)
            print(f"[{i}/{len(qualifying)}] {prospect.property_code} — {prospect.property_address}")
            try:
                result = await regenerate_one(db, prospect, live=args.live, output_dir="scratchpad_report/regen_output")
                print(f"    score {result['old_overall_score']} -> {result['new_overall_score']}, "
                      f"{result['key_findings_count']} findings, {result['action_plan_count']} actions, "
                      f"emailed={result['emailed']}")
                results.append(result)
            except Exception as exc:
                print(f"    FAILED: {exc}")
                await db.rollback()
                results.append({"property_code": prospect.property_code, "error": str(exc)})

    summary_path = f"scratchpad_report/regen_summary_{'live' if args.live else 'dryrun'}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nWrote summary to {summary_path}")


if __name__ == "__main__":
    asyncio.run(main())
