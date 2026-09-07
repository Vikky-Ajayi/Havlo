"""Re-render the letter PDF for every prospect that has one, from its
already-stored report/snapshot data - no Groq calls, no DB writes, no
re-sending. Exists specifically to backfill a pure PDF-layout fix (e.g. the
postcode-own-line address fix) across the whole existing prospect base in
one pass, since generate_letter_pdf() only ever runs against whatever data a
prospect already had at the time it was last generated.

Usage (from repo root):
    python scripts/regenerate_all_letter_pdfs.py             # every prospect with a report
    python scripts/regenerate_all_letter_pdfs.py --limit 20  # first 20 only, for a spot-check
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    from sqlalchemy import select
    from app.db.database import AsyncSessionLocal
    from app.models.models import StaleListingProspect
    from app.services.stale_prospect_service import generate_letter_pdf, create_access_token
    from app.config import get_settings

    base_url = get_settings().FRONTEND_URL or "https://www.heyhavlo.com"

    # Fetch AND process one batch of full ORM entities at a time - avoids
    # both failure modes seen today: one giant single-shot SELECT of every
    # row's large report_json/listing_snapshot_json/preview_json blobs
    # hung outright, and a separate id-list-then-refetch-one-at-a-time
    # pattern means ~1786 individual round trips (DB latency has been
    # ~8s/round-trip today - that would take hours). Each batch is one
    # query for ~100 full rows, processed immediately, session closed
    # before the next batch opens.
    # Kept small (not 100) - DB round-trips have been running 4-15s each
    # today (confirmed live, degraded network/pooler, not a code issue),
    # and a 100-row batch of large-TEXT-column rows hit an outright
    # asyncpg TimeoutError under that. 25 rows retried a couple of times
    # is far more likely to land than one big batch retried never.
    BATCH = 25
    offset = 0
    processed = 0
    results = []
    while True:
        if args.limit and processed >= args.limit:
            break
        batch = None
        batch_failed = False
        for attempt in (1, 2, 3):
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(StaleListingProspect)
                        .order_by(StaleListingProspect.created_at.asc())
                        .limit(BATCH).offset(offset)
                    )
                    batch = list(result.scalars().all())
                batch_failed = False
                break
            except Exception as exc:
                print(f"  batch at offset {offset} failed (attempt {attempt}): {exc}")
                batch_failed = True
                if attempt < 3:
                    await asyncio.sleep(5)
        if batch_failed:
            # Don't let one unreachable batch abort the whole run and lose
            # every result gathered so far - record it and move to the
            # next offset; this range can be retried later with --limit
            # bookkeeping or just by re-running (already-fine PDFs are
            # cheap to regenerate again).
            results.append({"property_code": None, "ok": False, "error": f"batch fetch failed at offset {offset}"})
            offset += BATCH
            continue
        if not batch:
            break
        for p in batch:
            if args.limit and processed >= args.limit:
                break
            processed += 1
            if not p.report_json:
                continue
            try:
                token = create_access_token()
                path = generate_letter_pdf(p, token, base_url)
                print(f"[{processed}] {p.property_code} OK -> {path}")
                results.append({"property_code": p.property_code, "ok": True})
            except Exception as exc:
                print(f"[{processed}] {p.property_code} FAILED: {exc}")
                results.append({"property_code": p.property_code, "ok": False, "error": str(exc)})
        offset += BATCH

    ok = sum(1 for r in results if r["ok"])
    print(f"\nDone: {ok}/{len(results)} regenerated successfully (of {processed} prospects seen).")
    summary_path = f"scratchpad_report/regen_all_pdfs_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Wrote summary to {summary_path}")


if __name__ == "__main__":
    asyncio.run(main())
