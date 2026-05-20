from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.models import StaleListingAssessment
from app.services.email_service import send_stale_listing_agent_notification_sync
from app.services.groq_service import generate_stale_listing_report
from app.services.listing_scraper import scrape_single_listing
from app.services.stale_listing_bootstrap import _listing_snapshot, _snapshot_has_content
from app.services.stale_review_access import issue_stale_review_magic_link
from app.config import get_settings


DEFAULT_REFERENCES = ["SL-P6XBB5", "SL-XLAYL9", "SL-DOV80N"]


def _load_questions(raw: str | dict | None) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


async def _run(args: argparse.Namespace) -> list[dict]:
    settings = get_settings()
    review_recipient = (settings.ADMIN_NOTIFY_EMAIL or "").strip()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StaleListingAssessment).where(StaleListingAssessment.reference.in_(args.references))
        )
        rows = list(result.scalars().all())
        row_map = {row.reference: row for row in rows}

        missing = [reference for reference in args.references if reference not in row_map]
        if missing:
            raise SystemExit(f"Missing stale listing references: {', '.join(missing)}")

        refreshed_items: list[dict] = []
        for reference in args.references:
            assessment = row_map[reference]
            listing_url = (assessment.listing_url or "").strip()
            if not listing_url:
                raise SystemExit(f"{reference} has no listing_url")

            scraped = await scrape_single_listing(listing_url)
            snapshot = _listing_snapshot(scraped, listing_url)
            questions = _load_questions(assessment.questions_data)

            report_dict = await generate_stale_listing_report(
                package=assessment.package,
                questions_data=questions,
                property_address=assessment.property_address or snapshot.get("address") or "",
                listing_url=listing_url,
                listing_snapshot=snapshot,
            )

            assessment.ai_report_json = json.dumps(report_dict, ensure_ascii=False)
            assessment.agent_edited_report_json = None
            assessment.agent_notes = None
            assessment.ai_report_generated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            assessment.report_status = "in_review"
            if snapshot.get("image"):
                assessment.listing_image_url = snapshot["image"]
            if _snapshot_has_content(snapshot):
                assessment.listing_snapshot_json = json.dumps(snapshot, ensure_ascii=False)
                if snapshot.get("address"):
                    assessment.property_address = snapshot["address"]

            review_url = ""
            if review_recipient:
                review_url = await issue_stale_review_magic_link(
                    db,
                    recipient_email=review_recipient,
                    assessment_id=str(assessment.id),
                    reference=assessment.reference,
                )

            await db.commit()
            await db.refresh(assessment)

            sent = None
            if review_recipient:
                sent = await asyncio.to_thread(
                    send_stale_listing_agent_notification_sync,
                    assessment.first_name or "Customer",
                    assessment.last_name or "",
                    assessment.email,
                    assessment.reference,
                    assessment.package,
                    assessment.property_address or "",
                    listing_url,
                    review_url,
                )

            refreshed_items.append(
                {
                    "reference": assessment.reference,
                    "package": assessment.package,
                    "email": assessment.email,
                    "payment_status": assessment.payment_status,
                    "report_status": assessment.report_status,
                    "property_address": assessment.property_address,
                    "has_ai_report": bool(assessment.ai_report_json),
                    "review_email_sent": sent,
                }
            )

        return refreshed_items


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate AI reports and resend review emails for stale listing refs.")
    parser.add_argument(
        "--references",
        nargs="+",
        default=DEFAULT_REFERENCES,
        help="Stale listing references to refresh.",
    )
    args = parser.parse_args()
    result = asyncio.run(_run(args))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
