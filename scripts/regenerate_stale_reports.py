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

# The moment this bulk-fix effort started. Every one of the 51 qualifying
# prospects had a report generated well before this (weeks-old letter_sent_at
# dates from the original discovery run) — so "updated_at >= this cutoff"
# reliably means "already redone with the fixed prompt", letting the script
# be re-run day after day (Groq's daily token cap means one run rarely
# finishes all 51) and pick up only what's left, with no separate state file
# to keep in sync.
_REGEN_CUTOFF = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)

# Groq's account-level daily token cap (not the per-request one) means every
# property after some point in a run will keep failing the same way. Once
# this many CONSECUTIVE properties fail with a message indicating a rate/
# quota limit, stop the whole run instead of burning through the rest with
# pointless retries — the reports API already tried this in production
# and would have quietly saved generic fallback content instead of failing.
_MAX_CONSECUTIVE_QUOTA_FAILURES = 2

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

    def already_regenerated(r) -> bool:
        return bool(r.updated_at) and r.updated_at >= _REGEN_CUTOFF

    return [r for r in qualifying if not already_regenerated(r)]


# Exact title from _DEFAULT_REPORT / _DEFAULT_REPORT_PUBLIC in groq_service.py
# — generate_stale_listing_report() catches its own Groq failures internally
# and returns this generic dict instead of raising, so a 429/quota failure
# never surfaces as an exception here. Detecting it explicitly is the only
# way to avoid silently saving and emailing the exact boilerplate this whole
# effort exists to get rid of.
_FALLBACK_MARKER_TITLE = "Low viewing conversion rate"


def is_fallback_report(report: dict) -> bool:
    return any(f.get("title") == _FALLBACK_MARKER_TITLE for f in (report.get("key_findings") or []))


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

    # Re-scrape the live listing instead of reusing the stored snapshot (which
    # may be weeks old) — picks up genuine changes since discovery, including
    # the price_reduced signal from Rightmove's own listingHistory (see
    # listing_scraper.py) that the stored snapshot predates. Falls back to
    # the stored snapshot if the listing is unreachable/blocked, rather than
    # failing the whole regeneration over a transient scrape issue.
    try:
        from app.services.listing_scraper import scrape_single_listing
        from app.services.stale_prospect_service import snapshot_from_scrape

        scraped = await scrape_single_listing(prospect.rightmove_url)
        if scraped and not scraped.get("blocked"):
            fresh_snapshot = snapshot_from_scrape(scraped, prospect.rightmove_url)
            if fresh_snapshot.get("address") or fresh_snapshot.get("price"):
                snapshot = fresh_snapshot
    except Exception as exc:
        print(f"    Live re-scrape failed, using stored snapshot instead: {exc}")

    report = await generate_prospect_report(
        property_address=prospect.property_address,
        rightmove_url=prospect.rightmove_url,
        snapshot=snapshot,
        listing_duration_days=prospect.listing_duration_days,
        expand_report=True,  # full two-pass quality for this one-off fix, unlike the bulk-discovery job
    )
    if is_fallback_report(report):
        # generate_stale_listing_report() swallowed a real failure (e.g. a
        # Groq quota/rate-limit error) and returned its generic fallback
        # dict instead of raising. Raise here so the caller's retry/failure
        # bookkeeping treats this property as not-yet-done rather than
        # saving and emailing the exact boilerplate this fix removes.
        raise RuntimeError("generate_prospect_report returned the generic fallback report (Groq call likely failed) — not saving or emailing it.")
    preview = build_preview(report, snapshot, prospect.property_address)

    prospect.report_json = _json.dumps(report, ensure_ascii=False)
    prospect.preview_json = _json.dumps(preview, ensure_ascii=False)
    # Keep the stored snapshot in sync with whatever snapshot the report and
    # PDF above were actually built from — generate_letter_pdf() reads
    # prospect.listing_snapshot_json directly, so leaving the old one in
    # place here would make the letter show stale data (e.g. "Nil" price
    # changes) even when the re-scrape above found a fresher answer.
    prospect.listing_snapshot_json = _json.dumps(snapshot, ensure_ascii=False)

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
    parser.add_argument("--skip", type=int, default=0, help="Skip the first N qualifying prospects (for resuming after a partial run).")
    args = parser.parse_args()

    from app.db.database import AsyncSessionLocal

    # The initial listing query has itself hit the same transient connection
    # drop the per-property loop retries around (seen live: a Windows-side
    # WinError 121 network blip) — retry it too instead of letting one bad
    # moment abort the whole script before anything even starts.
    qualifying = None
    for attempt in (1, 2, 3):
        try:
            async with AsyncSessionLocal() as session:
                qualifying = await find_qualifying_prospects(session)
            break
        except Exception as exc:
            print(f"Listing qualifying prospects failed (attempt {attempt}): {exc}")
            if attempt == 3:
                raise
            await asyncio.sleep(3)

    if args.property_code:
        qualifying = [r for r in qualifying if r.property_code == args.property_code]
    if args.skip:
        qualifying = qualifying[args.skip:]
    if args.limit:
        qualifying = qualifying[: args.limit]

    print(f"{'LIVE' if args.live else 'DRY RUN'}: {len(qualifying)} prospect(s) to process\n")

    def _looks_like_quota_error(exc: Exception) -> bool:
        text = str(exc).lower()
        return any(marker in text for marker in ("rate_limit_exceeded", "tokens per day", "tpd", "429", "fallback report"))

    results = []
    consecutive_quota_failures = 0
    for i, row in enumerate(qualifying, start=1):
        # Capture these from `row` (loaded by the initial query, outside any
        # per-iteration session) rather than the fresh `prospect` object
        # below — if that session's connection dies mid-transaction (seen
        # live: a transient WinError 121 network drop), `prospect`'s
        # attributes are no longer safe to touch and a second crash trying
        # to log the failure took down the whole batch instead of just
        # skipping that one property.
        code, address = row.property_code, row.property_address

        last_exc: Exception | None = None
        for attempt in (1, 2):
            try:
                async with AsyncSessionLocal() as db:
                    prospect = await db.get(type(row), row.id)
                    print(f"[{i}/{len(qualifying)}] {code} — {address}" + (f" (retry {attempt})" if attempt > 1 else ""))
                    result = await regenerate_one(db, prospect, live=args.live, output_dir="scratchpad_report/regen_output")
                    print(f"    score {result['old_overall_score']} -> {result['new_overall_score']}, "
                          f"{result['key_findings_count']} findings, {result['action_plan_count']} actions, "
                          f"emailed={result['emailed']}")
                    results.append(result)
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                print(f"    FAILED (attempt {attempt}): {exc}")
                if attempt == 2:
                    results.append({"property_code": code, "address": address, "error": str(exc)})
                else:
                    await asyncio.sleep(3)

        if last_exc is not None and _looks_like_quota_error(last_exc):
            consecutive_quota_failures += 1
            if consecutive_quota_failures >= _MAX_CONSECUTIVE_QUOTA_FAILURES:
                remaining = len(qualifying) - i
                print(
                    f"\nStopping early: {consecutive_quota_failures} properties in a row failed with what looks "
                    f"like a Groq quota/rate-limit error. {remaining} still unprocessed — re-run this same "
                    f"command later (or tomorrow, once the daily cap resets) to pick up where this left off; "
                    f"already-completed prospects are skipped automatically."
                )
                break
        else:
            consecutive_quota_failures = 0

    summary_path = f"scratchpad_report/regen_summary_{'live' if args.live else 'dryrun'}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nWrote summary to {summary_path}")


if __name__ == "__main__":
    asyncio.run(main())
