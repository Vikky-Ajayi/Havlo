"""Helpers for automated Stale Listings prospect letters and unlock flow."""
from __future__ import annotations

import base64
import asyncio
import hashlib
import hmac
import json
import logging
import math
import os
import random
import re
import secrets
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any
from datetime import datetime, timezone
from xml.sax.saxutils import escape as _xml_escape

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import RightmoveListing, StaleListingProspect
from app.services.groq_service import generate_stale_listing_report

logger = logging.getLogger(__name__)

# qrcode and reportlab are pinned, required dependencies (requirements.txt),
# not truly optional — imported eagerly here (rather than lazily inside
# generate_letter_pdf, as before) so the many small drawing helpers below
# can use them as plain module-level functions. Still guarded so a broken
# install fails with a clear message instead of an import-time traceback
# taking down the whole module.
try:
    import qrcode
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader
    from reportlab.platypus import Paragraph
    from reportlab.pdfgen import canvas as rl_canvas
    _PDF_LIBS_IMPORT_ERROR: ImportError | None = None
except ImportError as _pdf_libs_exc:  # pragma: no cover - depends on deployment image
    _PDF_LIBS_IMPORT_ERROR = _pdf_libs_exc


def create_access_token() -> str:
    return secrets.token_urlsafe(32)


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def unsubscribe_token(prospect_id: str) -> str:
    """Deterministic per-prospect unsubscribe token — no extra DB column
    needed, just an HMAC of the prospect id keyed on the app secret. Used to
    build/verify the one-click unsubscribe link in abandonment drip emails."""
    secret = (get_settings().SECRET_KEY or "").encode("utf-8")
    return hmac.new(secret, str(prospect_id).encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def verify_unsubscribe_token(prospect_id: str, token: str) -> bool:
    expected = unsubscribe_token(prospect_id)
    return hmac.compare_digest(expected, (token or "").strip())


def prospect_unlock_price(asking_price: float | None) -> float:
    """Full-report price shown to a letter prospect, tiered by asking price.

    Mirrors app.routers.stale_listings._stale_prospect_checkout_amount and
    the frontend's unlockPrice() (havlo_frontend/src/pages/stale-prospect/
    types.ts) — three independent copies of the same tiers because the
    frontend needs it before checkout resolves, the checkout route needs
    the authoritative amount, and the abandonment email drip needs it to
    show the recipient's real price rather than a hardcoded figure. Keep
    all three in sync if the tiers ever change.
    """
    price = float(asking_price or 0)
    if price >= 1_000_000:
        return 999.99
    if price >= 500_000:
        return 499.99
    return 149.99


def normalize_property_code(code: str) -> str:
    return "".join(ch for ch in str(code or "") if ch.isdigit())[:4]


async def make_property_code(db: AsyncSession) -> str:
    for _ in range(40):
        code = f"{random.randint(0, 9999):04d}"
        result = await db.execute(
            select(StaleListingProspect.id).where(
                StaleListingProspect.property_code == code,
                (StaleListingProspect.source_status.is_(None))
                | (StaleListingProspect.source_status != "archived"),
            )
        )
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError("Could not allocate a unique property code.")


def is_specific_address(address: str) -> bool:
    text = (address or "").strip()
    lower = text.lower()
    vague_terms = (
        "area",
        "near",
        "close to",
        "within",
        "surrounding",
        "undisclosed",
        "confidential",
        "available upon request",
        "contact agent",
        "not specified",
        "approximate",
    )
    street_terms = (
        "road",
        "street",
        "avenue",
        "lane",
        "drive",
        "close",
        "court",
        "way",
        "gardens",
        "garden",
        "crescent",
        "terrace",
        "place",
        "mews",
        "grove",
        "walk",
        "rise",
        "hill",
        "square",
        "row",
        "view",
        "park",
        "yard",
        "quay",
    )
    postcode = re.search(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", text, re.IGNORECASE)
    has_unit_or_number = bool(
        re.search(r"\b\d+[A-Z]?\b", text, re.IGNORECASE)
        or re.search(r"\b(flat|apartment|apt|unit|suite|the)\s+[A-Z0-9]", text, re.IGNORECASE)
    )
    has_street = any(re.search(rf"\b{re.escape(term)}\b", lower) for term in street_terms)
    has_town_part = "," in text and len([part for part in text.split(",") if part.strip()]) >= 2
    return (
        len(text) >= 16
        and not any(term in lower for term in vague_terms)
        and has_unit_or_number
        and has_street
        and (bool(postcode) or has_town_part)
    )


def extract_price(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    digits = re.sub(r"[^\d.]", "", str(value))
    try:
        return float(digits) if digits else None
    except ValueError:
        return None


def snapshot_from_scrape(scraped: dict[str, Any], url: str) -> dict[str, Any]:
    images = scraped.get("images") if isinstance(scraped.get("images"), list) else []
    return {
        "title": scraped.get("title") or scraped.get("address") or "",
        "address": scraped.get("address") or scraped.get("title") or "",
        "price": scraped.get("price") or "",
        "image": scraped.get("image") or (images[0] if images else ""),
        "images": images,
        "bedrooms": scraped.get("bedrooms") or "",
        "bathrooms": scraped.get("bathrooms") or "",
        "property_type": scraped.get("property_type") or "",
        "platform": "Rightmove" if "rightmove" in url.lower() else "",
        "description": scraped.get("description") or "",
        "listed_date": scraped.get("listed_date") or "",
        "features": scraped.get("features") if isinstance(scraped.get("features"), list) else [],
    }


def snapshot_from_rightmove_listing(listing: RightmoveListing) -> dict[str, Any]:
    try:
        images = json.loads(listing.images_json or "[]")
    except Exception:
        images = []
    return {
        "title": listing.title or listing.address,
        "address": listing.address,
        "price": f"£{listing.price_gbp:,.0f}",
        "image": images[0] if images else "",
        "images": images,
        "bedrooms": listing.bedrooms,
        "bathrooms": listing.bathrooms or "",
        "property_type": listing.property_type,
        "platform": "Rightmove",
        "description": listing.description or "",
    }


def parse_listed_date(value: Any) -> datetime | None:
    """Parse Rightmove date strings into an aware UTC datetime when reliable."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = re.sub(r"\s+", " ", str(value)).strip()
    text = re.sub(r"^(added|reduced|listed|first listed)\s+(on\s+)?", "", text, flags=re.IGNORECASE)
    text = text.replace(",", "")
    candidates = [
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d %b %Y",
        "%d %B %Y",
        "%b %d %Y",
        "%B %d %Y",
    ]
    for fmt in candidates:
        try:
            parsed = datetime.strptime(text[:26] if "%z" in fmt else text, fmt)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    match = re.search(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})", text)
    if match:
        for fmt in ("%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(match.group(0), fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


async def create_prospect_from_listing_snapshot(
    db: AsyncSession,
    *,
    rightmove_url: str,
    property_address: str,
    listing_snapshot: dict[str, Any],
    asking_price: float,
    listing_duration_days: int,
    listed_date: datetime | None = None,
    discovery_run_id: Any | None = None,
    expand_report: bool = True,
) -> tuple[StaleListingProspect, str, str]:
    """Create a fully processed prospect, report, preview and letter PDF."""
    token = create_access_token()
    property_code = await make_property_code(db)
    report = await generate_prospect_report(
        property_address=property_address,
        rightmove_url=rightmove_url,
        snapshot=listing_snapshot,
        listing_duration_days=listing_duration_days,
        expand_report=expand_report,
    )
    preview = build_preview(report, listing_snapshot, property_address)
    now = datetime.now(timezone.utc)
    prospect = StaleListingProspect(
        property_code=property_code,
        qr_token_hash=hash_access_token(token),
        property_address=property_address,
        rightmove_url=rightmove_url,
        rightmove_id=listing_snapshot.get("rightmove_id") or None,
        asking_price=float(asking_price),
        listing_duration_days=int(listing_duration_days),
        listed_date=listed_date,
        property_type=listing_snapshot.get("property_type") or None,
        bedrooms=int(listing_snapshot["bedrooms"]) if str(listing_snapshot.get("bedrooms") or "").isdigit() else None,
        bathrooms=int(listing_snapshot["bathrooms"]) if str(listing_snapshot.get("bathrooms") or "").isdigit() else None,
        listing_snapshot_json=json.dumps(listing_snapshot, ensure_ascii=False),
        report_json=json.dumps(report, ensure_ascii=False),
        preview_json=json.dumps(preview, ensure_ascii=False),
        discovery_run_id=discovery_run_id,
        source_status="active",
        discovered_at=now,
        processed_at=now,
        processing_status="report_ready",
        payment_status="pending",
    )
    db.add(prospect)
    await db.flush()
    letter_path = generate_letter_pdf(prospect, token, get_settings().FRONTEND_URL or "https://www.heyhavlo.com")
    prospect.letter_pdf_path = letter_path
    prospect.processing_status = "letter_ready"
    return prospect, token, letter_path


async def send_prospect_letter_to_admin(
    prospect_id: str,
    token: str,
    public_base_url: str,
) -> bool:
    """Send the generated prospect letter and persist the result."""
    import uuid

    from app.services import email_service

    admin_email = (get_settings().ADMIN_NOTIFY_EMAIL or "").strip()
    if not admin_email:
        async with AsyncSessionLocal() as db:
            prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
            if prospect:
                prospect.processing_status = "email_skipped"
                prospect.last_error = "ADMIN_NOTIFY_EMAIL is not configured."
                await db.commit()
        return False

    preview_url = f"{public_base_url.rstrip('/')}/stale-listings/prospect?token={token}"
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
        if not prospect:
            return False
        prospect.processing_status = "email_sending"
        await db.commit()
        property_address = prospect.property_address
        property_code = prospect.property_code
        letter_pdf_path = prospect.letter_pdf_path or ""

    sent = await asyncio.to_thread(
        email_service.send_stale_prospect_letter_sync,
        to_email=admin_email,
        property_address=property_address,
        property_code=property_code,
        preview_url=preview_url,
        letter_pdf_path=letter_pdf_path,
    )
    async with AsyncSessionLocal() as db:
        prospect = await db.get(StaleListingProspect, uuid.UUID(prospect_id))
        if prospect:
            if sent:
                prospect.processing_status = "email_sent"
                prospect.letter_sent_at = datetime.now(timezone.utc)
                prospect.last_error = None
            else:
                prospect.processing_status = "email_failed"
                prospect.last_error = "Email provider did not accept the prospect letter email. Check Resend settings and logs."
            await db.commit()
    return sent


def build_preview(report: dict[str, Any], snapshot: dict[str, Any], address: str) -> dict[str, Any]:
    return {
        "property_address": address,
        "overall_score": report.get("overall_score", 50),
        "scores": report.get("scores") or {},
        "key_issues": (report.get("key_findings") or [])[:3],
        "recommendations": (report.get("action_plan") or [])[:3],
        "executive_summary": report.get("executive_summary") or "",
        "locked_message": "Unlock the full assessment to see the complete action plan, pricing recommendation, comparable sales review and agent-backed recommendations.",
        "listing_snapshot": snapshot,
    }


def _safe_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def serialize_preview(prospect: StaleListingProspect) -> dict[str, Any]:
    return {
        "prospect_id": str(prospect.id),
        "property_code": prospect.property_code,
        "property_address": prospect.property_address,
        "rightmove_url": prospect.rightmove_url,
        "asking_price": prospect.asking_price,
        "listing_duration_days": prospect.listing_duration_days,
        "bedrooms": prospect.bedrooms,
        "bathrooms": prospect.bathrooms,
        "listing_snapshot": _safe_json(prospect.listing_snapshot_json),
        "preview": _safe_json(prospect.preview_json),
        "payment_status": prospect.payment_status,
        "is_unlocked": prospect.payment_status == "completed",
        "property_confirmed": prospect.property_confirmed_at is not None,
        "has_contact_details": bool(prospect.contact_email),
    }


def serialize_report(prospect: StaleListingProspect) -> dict[str, Any]:
    return {
        "prospect_id": str(prospect.id),
        "property_code": prospect.property_code,
        "property_address": prospect.property_address,
        "rightmove_url": prospect.rightmove_url,
        "asking_price": prospect.asking_price,
        "listing_duration_days": prospect.listing_duration_days,
        "contact_name": prospect.contact_name,
        "listing_snapshot": _safe_json(prospect.listing_snapshot_json),
        "report_data": _safe_json(prospect.report_json),
        "payment_status": prospect.payment_status,
    }


async def generate_prospect_report(
    property_address: str,
    rightmove_url: str,
    snapshot: dict[str, Any],
    listing_duration_days: int | None,
    expand_report: bool = True,
    base_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    questions_data = {
        "lead_source": "automated_letter_prospecting",
        "days_on_market": listing_duration_days,
        "marketing_context": "Rightmove stale listing identified for homeowner letter preview.",
    }
    return await generate_stale_listing_report(
        package="listing_recovery_assessment",
        questions_data=questions_data,
        property_address=property_address,
        listing_url=rightmove_url,
        listing_snapshot=snapshot,
        expand_report=expand_report,
        # We have only ever scraped this listing off Rightmove and mailed the
        # homeowner a letter — nobody has told us about viewings, feedback,
        # or offers. The report must not imply otherwise.
        has_seller_survey=False,
        base_report=base_report,
    )


async def ensure_expanded_report(prospect: StaleListingProspect) -> dict[str, Any]:
    """Enrich the existing report in full detail the first time it's unlocked.

    Discovery creates every prospect with `expand_report=False` (line above)
    to keep bulk scanning fast and cheap — that shallow report is what the
    free preview's `key_issues`/`recommendations` are built from (see
    `build_preview`, which just takes the first 3 of this report's
    key_findings/action_plan). This used to call `generate_prospect_report`
    without passing that report back in, which triggered a brand new,
    independent Groq generation — since Groq's output isn't deterministic,
    the "full" report came back with different findings entirely, so the
    specific issues a homeowner saw in the preview would vanish once they
    unlocked. Passing `base_report=report` skips that redundant fresh
    generation and only runs the richer expansion pass on the SAME
    findings, so every issue in the preview is still there, just expanded.
    This mutates `prospect.report_json` in place; the caller is responsible
    for committing the session.
    """
    report = _safe_json(prospect.report_json)
    if report.get("_expanded"):
        return report
    snapshot = _safe_json(prospect.listing_snapshot_json)
    expanded = await generate_prospect_report(
        property_address=prospect.property_address,
        rightmove_url=prospect.rightmove_url,
        snapshot=snapshot,
        listing_duration_days=prospect.listing_duration_days,
        expand_report=True,
        base_report=report,
    )
    expanded["_expanded"] = True
    prospect.report_json = json.dumps(expanded, ensure_ascii=False)
    return expanded


def is_report_expanded(prospect: StaleListingProspect) -> bool:
    return bool(_safe_json(prospect.report_json).get("_expanded"))


async def expand_report_in_background(prospect_id: str) -> None:
    """Fire-and-forget report expansion — this is the fix for the full report
    page taking too long to load.

    `ensure_expanded_report` above makes a real (now premium-tier, two-pass)
    LLM call. Running that inline inside the `/prospects/report` GET request
    meant the homeowner's browser sat waiting on a multi-second Groq round
    trip before the page could render anything. Scheduled as a background
    task the moment a prospect is unlocked (promo code, confirmed payment),
    it runs while the browser is still redirecting/polling, so by the time
    the report page actually loads the expansion has usually already
    finished — and the report GET endpoint itself never blocks on it.

    Five separate call sites in stale_listings.py schedule this same task
    for the same prospect (checkout confirm, promo unlock, retried "already
    unlocked" clicks, ...), deliberately, so a slow or failed earlier attempt
    always gets another chance. But two of those schedulings landing close
    together raced: both read is_report_expanded() as False before either
    had committed, so both proceeded to expand. The second one's "existing
    report" was then whatever the first had already merged in, and the
    model's fresh addendum on top of that came back substantially restating
    that already-merged text - the net result was every finding/action
    description containing the same paragraphs twice. `with_for_update()`
    below closes that: it takes a row lock for the life of this
    transaction, so a second concurrent call blocks until the first commits,
    then re-reads is_report_expanded() as True and returns without expanding
    again - the same guard, just no longer raceable.
    """
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(StaleListingProspect)
                .where(StaleListingProspect.id == uuid.UUID(prospect_id))
                .with_for_update()
            )
            prospect = result.scalar_one_or_none()
            if not prospect or prospect.payment_status != "completed":
                return
            if is_report_expanded(prospect):
                return
            await ensure_expanded_report(prospect)
            await db.commit()
    except Exception:
        logger.exception("Background report expansion failed for prospect %s", prospect_id)


# ── Letter PDF drawing helpers ──────────────────────────────────────────────
#
# Two-page homeowner letter matching the "Property Performance Snapshot"
# design reference (Aug 2026 redesign). All measurements below were taken
# directly off the reference PDF via pixel-run analysis at 2x zoom (so
# img_px / 2 = pt), not eyeballed — in particular the corner flourish is a
# plain rounded rect bleeding off the top+right edges (left edge x=565pt,
# bottom edge y=725pt), not the diagonal ribbon it first looks like in a
# casual crop.

_LETTER_MARGIN = 44.0
_LETTER_INK = colors.HexColor("#141414") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_MUTED = colors.HexColor("#6B7280") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_ACCENT = colors.HexColor("#A409D2") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_ACCENT_PALE = colors.HexColor("#F3E6FB") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_CARD_BG = colors.HexColor("#F7F7F8") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_CARD_BORDER = colors.HexColor("#E7E7EA") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_GREEN = colors.HexColor("#0E7D4C") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_RED = colors.HexColor("#DE2921") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_ORANGE = colors.HexColor("#B14F0A") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_TRUST_GREEN = colors.HexColor("#00B67A") if not _PDF_LIBS_IMPORT_ERROR else None
_LETTER_LOGO_PATH = Path("havlo_frontend/Havlo Black Transparent.png")

if not _PDF_LIBS_IMPORT_ERROR:
    _LETTER_BODY_STYLE = ParagraphStyle("LetterBody", fontName="Helvetica", fontSize=10, leading=14.5, textColor=_LETTER_INK)
    _LETTER_LEGAL_TEXT = (
        "Havlo Ltd, registered in England and Wales (Company No. 15369975). Office: 2nd Floor, Berkeley Square, "
        "London, England, W1J 6BD. Havlo provides property marketing intelligence to help sellers understand and "
        "improve the performance of their property listings. We identified your property using publicly available "
        "listing information. You have the right to opt out of future marketing communications from us at any time. "
        "To opt out, email <a href=\"mailto:hello@heyhavlo.com\">hello@heyhavlo.com</a> and we will remove your address "
        "from our marketing records."
    )
    _LETTER_STYLE_LEGAL = ParagraphStyle("LetterLegal", fontName="Helvetica-Oblique", fontSize=6.8, leading=9.4, textColor=_LETTER_MUTED, alignment=1)
    _LETTER_STYLE_NOTE = ParagraphStyle("LetterNote", fontName="Helvetica-Oblique", fontSize=7.6, leading=10.2, textColor=_LETTER_MUTED, alignment=1)

_LETTER_GAUGE_START = 205.0
_LETTER_GAUGE_END = -25.0
_LETTER_GAUGE_SPAN = _LETTER_GAUGE_START - _LETTER_GAUGE_END


def _letter_esc(text: Any) -> str:
    return _xml_escape(str(text))


def _letter_para(page, text: str, x: float, y: float, w: float, style: "ParagraphStyle") -> float:
    p = Paragraph(text, style)
    _, h = p.wrap(w, 200 * mm)
    p.drawOn(page, x, y - h)
    return y - h


def _letter_draw_checkmark(page, cx: float, cy: float, r: float = 6.5) -> None:
    page.setFillColor(_LETTER_ACCENT)
    page.circle(cx, cy, r, stroke=0, fill=1)
    page.setStrokeColor(colors.white)
    page.setLineWidth(1.3)
    page.setLineCap(1)
    page.setLineJoin(1)
    p = page.beginPath()
    p.moveTo(cx - r * 0.45, cy - r * 0.02)
    p.lineTo(cx - r * 0.12, cy - r * 0.38)
    p.lineTo(cx + r * 0.48, cy + r * 0.35)
    page.drawPath(p, stroke=1, fill=0)


def _letter_icon_coins(page, cx, cy, s, color) -> None:
    page.setStrokeColor(color)
    page.setLineWidth(1.1)
    for dy in (-s * 0.42, -s * 0.08, s * 0.26):
        page.ellipse(cx - s * 0.62, cy + dy - s * 0.16, cx + s * 0.62, cy + dy + s * 0.16, stroke=1, fill=0)


def _letter_icon_hourglass(page, cx, cy, s, color) -> None:
    page.setStrokeColor(color)
    page.setLineWidth(1.15)
    page.setLineJoin(1)
    top = page.beginPath()
    top.moveTo(cx - s * 0.55, cy + s * 0.62)
    top.lineTo(cx + s * 0.55, cy + s * 0.62)
    top.lineTo(cx, cy)
    top.close()
    page.drawPath(top, stroke=1, fill=0)
    bot = page.beginPath()
    bot.moveTo(cx - s * 0.55, cy - s * 0.62)
    bot.lineTo(cx + s * 0.55, cy - s * 0.62)
    bot.lineTo(cx, cy)
    bot.close()
    page.drawPath(bot, stroke=1, fill=0)
    page.line(cx - s * 0.62, cy + s * 0.62, cx + s * 0.62, cy + s * 0.62)
    page.line(cx - s * 0.62, cy - s * 0.62, cx + s * 0.62, cy - s * 0.62)


def _letter_icon_trending_up(page, cx, cy, s, color) -> None:
    page.setStrokeColor(color)
    page.setLineWidth(1.3)
    page.setLineCap(1)
    page.setLineJoin(1)
    p = page.beginPath()
    p.moveTo(cx - s * 0.62, cy - s * 0.4)
    p.lineTo(cx - s * 0.12, cy + s * 0.05)
    p.lineTo(cx + s * 0.2, cy - s * 0.15)
    p.lineTo(cx + s * 0.62, cy + s * 0.5)
    page.drawPath(p, stroke=1, fill=0)
    page.line(cx + s * 0.62, cy + s * 0.5, cx + s * 0.22, cy + s * 0.5)
    page.line(cx + s * 0.62, cy + s * 0.5, cx + s * 0.62, cy + s * 0.1)


def _letter_icon_people(page, cx, cy, s, color) -> None:
    page.setStrokeColor(color)
    page.setLineWidth(1.1)
    for dx in (-s * 0.32, s * 0.32):
        page.circle(cx + dx, cy + s * 0.3, s * 0.24, stroke=1, fill=0)
        arcbox = (cx + dx - s * 0.42, cy - s * 0.5, cx + dx + s * 0.42, cy + s * 0.1)
        page.arc(*arcbox, 0, 180)


def _letter_icon_scan_frame(page, cx, cy, s, color) -> None:
    page.setStrokeColor(color)
    page.setLineWidth(1.5)
    page.setLineCap(0)
    L = s * 0.85
    c = s * 0.45
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x0, y0 = cx + sx * L, cy + sy * L
        page.line(x0, y0, x0 - sx * c, y0)
        page.line(x0, y0, x0, y0 - sy * c)


def _letter_draw_gauge(page, cx, cy, radius, score, color) -> None:
    """Semicircle-ish gauge (a ~230deg sweep, not a plain 180deg semicircle
    — also measured off the reference, not assumed). score 0 -> needle/arc
    at the start angle, 100 -> needle/arc at the end angle."""
    fraction = max(0, min(100, score or 0)) / 100.0
    value_angle = _LETTER_GAUGE_START - fraction * _LETTER_GAUGE_SPAN
    page.setLineCap(1)
    page.setStrokeColor(colors.HexColor("#ECECEE"))
    page.setLineWidth(radius * 0.24)
    page.arc(cx - radius, cy - radius, cx + radius, cy + radius, _LETTER_GAUGE_END, _LETTER_GAUGE_SPAN)
    page.setStrokeColor(color)
    page.arc(cx - radius, cy - radius, cx + radius, cy + radius, value_angle, _LETTER_GAUGE_START - value_angle)
    needle_len = radius * 0.55
    nx = cx + needle_len * math.cos(math.radians(value_angle))
    ny = cy + needle_len * math.sin(math.radians(value_angle))
    page.setStrokeColor(colors.HexColor("#111111"))
    page.setLineWidth(1.6)
    page.setLineCap(1)
    page.line(cx, cy, nx, ny)
    page.setFillColor(colors.HexColor("#111111"))
    page.circle(cx, cy, radius * 0.065, stroke=0, fill=1)


def _letter_draw_trustpilot(page, right_x, top_y) -> None:
    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica-Bold", 10.5)
    label_w = page.stringWidth("Excellent", "Helvetica-Bold", 10.5)
    total_w = label_w + 8 + 5 * 15
    start_x = right_x - total_w
    page.drawString(start_x, top_y, "Excellent")
    sx = start_x + label_w + 8
    for i in range(5):
        bx = sx + i * 15
        page.setFillColor(_LETTER_TRUST_GREEN)
        page.rect(bx, top_y - 2, 13, 13, stroke=0, fill=1)
        page.setFillColor(colors.white)
        cx, cy_ = bx + 6.5, top_y + 4.5
        pts = []
        for k in range(10):
            ang = math.radians(90 + k * 36)
            rad = 4.8 if k % 2 == 0 else 1.9
            pts.append((cx + rad * math.cos(ang), cy_ + rad * math.sin(ang)))
        p = page.beginPath()
        p.moveTo(*pts[0])
        for pt in pts[1:]:
            p.lineTo(*pt)
        p.close()
        page.drawPath(p, stroke=0, fill=1)
    page.setFont("Helvetica-Bold", 8)
    page.setFillColor(_LETTER_INK)
    page.drawRightString(right_x, top_y - 16, "Based on verified customer feedback")


def _letter_draw_corner_flag(page, width, height) -> None:
    x0, y0 = 565.0, 725.0
    w, h = 90.0, 147.0  # generous bleed so the top/right edges stay off-page
    r = 20.0
    page.setFillColor(_LETTER_ACCENT_PALE)
    page.roundRect(x0 - 7, y0 + 7, w, h, r, stroke=0, fill=1)
    page.setFillColor(_LETTER_ACCENT)
    page.roundRect(x0, y0, w, h, r, stroke=0, fill=1)


def _letter_draw_header(page, width, height) -> None:
    top = height - 46
    if _LETTER_LOGO_PATH.is_file():
        page.drawImage(str(_LETTER_LOGO_PATH), _LETTER_MARGIN, top - 22, width=100, height=23.3, mask="auto", preserveAspectRatio=True)
    else:
        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 24)
        page.drawString(_LETTER_MARGIN, top - 18, "HAVLO")
    page.setFillColor(colors.HexColor("#3A3A3C"))
    page.setFont("Helvetica", 9.5)
    page.drawString(_LETTER_MARGIN + 1, top - 34, "StaleListings")

    page.setFillColor(_LETTER_ACCENT)
    page.setFont("Helvetica-Bold", 17)
    right_x = width - _LETTER_MARGIN
    page.drawRightString(right_x, top, "See your property through the")
    page.drawRightString(right_x, top - 20, "eyes of the market")
    _letter_draw_trustpilot(page, right_x, top - 46)

    _letter_draw_corner_flag(page, width, height)


def _letter_make_qr(url: str) -> BytesIO:
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _letter_fetch_photo(url: str | None) -> "ImageReader | None":
    """Best-effort fetch of the listing's hero photo for page 2's property
    card. Deliberately swallows every failure (bad URL, timeout, non-image
    response) — a missing photo should never be the reason a prospect
    letter fails to generate, same spirit as the optional background art
    in the old single-page design."""
    if not url:
        return None
    try:
        import httpx

        resp = httpx.get(url, timeout=5.0, follow_redirects=True)
        resp.raise_for_status()
        return ImageReader(BytesIO(resp.content))
    except Exception:
        logger.warning("Could not fetch listing photo for letter PDF: %s", url, exc_info=True)
        return None


def _letter_draw_qr_box(page, x, y, w, h, qr_reader: BytesIO, property_code: str) -> None:
    page.setFillColor(_LETTER_CARD_BG)
    page.setStrokeColor(_LETTER_CARD_BORDER)
    page.setLineWidth(1)
    page.roundRect(x, y, w, h, 14, stroke=1, fill=1)

    id_box_w = 138
    id_x = x + w - id_box_w
    page.setFillColor(_LETTER_ACCENT)
    p = page.beginPath()
    r = 14
    p.moveTo(id_x, y)
    p.lineTo(id_x + id_box_w - r, y)
    p.curveTo(id_x + id_box_w, y, id_x + id_box_w, y, id_x + id_box_w, y + r)
    p.lineTo(id_x + id_box_w, y + h - r)
    p.curveTo(id_x + id_box_w, y + h, id_x + id_box_w, y + h, id_x + id_box_w - r, y + h)
    p.lineTo(id_x, y + h)
    p.close()
    page.drawPath(p, stroke=0, fill=1)

    page.setFillColor(colors.white)
    page.setFont("Helvetica-Bold", 8)
    page.drawCentredString(id_x + id_box_w / 2, y + h - 22, "YOUR PROPERTY ID")
    page.setFont("Helvetica-Bold", 26)
    page.drawCentredString(id_x + id_box_w / 2, y + h / 2 - 6, property_code)
    small = ParagraphStyle("LetterIdSmall", fontName="Helvetica", fontSize=7.4, leading=9.6, textColor=colors.white, alignment=1)
    _letter_para(page, "Scan the QR code, then enter this code to access your assessment.", id_x + 10, y + 30, id_box_w - 20, small)

    _letter_icon_scan_frame(page, x + 26, y + h - 24, 15, _LETTER_INK)
    label_style = ParagraphStyle("LetterScanLabel", fontName="Helvetica-Bold", fontSize=13.5, leading=16, textColor=_LETTER_INK)
    _letter_para(page, "Scan to view your property findings", x + 52, y + h - 14, 190, label_style)

    qr_size = h - 24
    page.drawImage(ImageReader(qr_reader), x + 300, y + (h - qr_size) / 2, qr_size, qr_size)


def _letter_footer_height(width: float, extra_note: str) -> float:
    """Total vertical space the footer (divider through legal paragraph)
    needs, so the QR box above it can be anchored with a fixed gap instead
    of colliding with it — the legal paragraph's wrapped height depends on
    exactly how it breaks at this column width, so this has to actually
    measure it rather than guess a fixed offset."""
    w = width - 2 * _LETTER_MARGIN
    _, h_legal = Paragraph(_LETTER_LEGAL_TEXT, _LETTER_STYLE_LEGAL).wrap(w, 200 * mm)
    _, h_note = Paragraph(_letter_esc(extra_note), _LETTER_STYLE_NOTE).wrap(w, 200 * mm)
    return 22 + h_legal + 3 + h_note + 24 + 8


def _letter_draw_footer(page, width: float, extra_note: str) -> None:
    w = width - 2 * _LETTER_MARGIN
    _, h_legal = Paragraph(_LETTER_LEGAL_TEXT, _LETTER_STYLE_LEGAL).wrap(w, 200 * mm)
    _, h_note = Paragraph(_letter_esc(extra_note), _LETTER_STYLE_NOTE).wrap(w, 200 * mm)

    legal_top = 22 + h_legal
    note_top = legal_top + 3 + h_note
    havlo_top = note_top + 24
    divider_y = havlo_top + 8

    page.setStrokeColor(colors.HexColor("#DDDDDD"))
    page.setLineWidth(0.6)
    page.line(_LETTER_MARGIN, divider_y, width - _LETTER_MARGIN, divider_y)
    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica-Bold", 9.5)
    page.drawString(_LETTER_MARGIN, havlo_top, "Havlo")
    page.setFont("Helvetica-Oblique", 8.5)
    page.drawString(_LETTER_MARGIN, havlo_top - 11, "Property Advisory")

    _letter_para(page, _letter_esc(extra_note), _LETTER_MARGIN, note_top, w, _LETTER_STYLE_NOTE)
    _letter_para(page, _LETTER_LEGAL_TEXT, _LETTER_MARGIN, legal_top, w, _LETTER_STYLE_LEGAL)


def _letter_draw_checklist_grid(page, x, y, w, items, cols, row_h=30) -> float:
    col_w = w / cols
    for i, item in enumerate(items):
        col = i % cols
        row = i // cols
        cx0 = x + col * col_w
        cy0 = y - row * row_h
        _letter_draw_checkmark(page, cx0 + 7, cy0)
        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 9.6)
        page.drawString(cx0 + 20, cy0 - 3.4, item)
    rows = math.ceil(len(items) / cols)
    return y - rows * row_h


def _letter_draw_stat_row(page, x, y, w, stats) -> None:
    n = len(stats)
    col_w = w / n
    for i, (icon_fn, label, value) in enumerate(stats):
        cx = x + col_w * i + col_w / 2
        icon_fn(page, cx, y, 15, _LETTER_INK)
        page.setFillColor(_LETTER_MUTED)
        page.setFont("Helvetica", 8.6)
        page.drawCentredString(cx, y - 26, label)
        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 13.5)
        page.drawCentredString(cx, y - 44, value)
        if i > 0:
            page.setStrokeColor(colors.HexColor("#E2E2E5"))
            page.setLineWidth(0.75)
            page.line(x + col_w * i, y - 48, x + col_w * i, y + 14)


def _letter_draw_gauge_row(page, x, y_top, w, cards, card_h=178) -> None:
    gap = 14
    n = len(cards)
    card_w = (w - gap * (n - 1)) / n
    for i, (title, status_text, status_color, score, result_label, desc_html) in enumerate(cards):
        cx0 = x + i * (card_w + gap)
        cy0 = y_top - card_h
        page.setFillColor(_LETTER_CARD_BG)
        page.roundRect(cx0, cy0, card_w, card_h, 12, stroke=0, fill=1)

        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 10.5)
        page.drawCentredString(cx0 + card_w / 2, cy0 + card_h - 22, title)
        page.setFillColor(status_color)
        page.setFont("Helvetica-Bold", 8.6)
        page.drawCentredString(cx0 + card_w / 2, cy0 + card_h - 35, status_text)
        page.setStrokeColor(colors.HexColor("#E2E2E5"))
        page.setLineWidth(0.75)
        page.line(cx0 + 14, cy0 + card_h - 43, cx0 + card_w - 14, cy0 + card_h - 43)

        gauge_cy = cy0 + card_h - 92
        _letter_draw_gauge(page, cx0 + card_w / 2, gauge_cy, 45, score, status_color)

        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 10.5)
        page.drawCentredString(cx0 + card_w / 2, cy0 + 48, result_label)
        desc_style = ParagraphStyle("LetterGaugeDesc", fontName="Helvetica", fontSize=8.1, leading=11.2, textColor=_LETTER_MUTED, alignment=1)
        _letter_para(page, desc_html, cx0 + 12, cy0 + 36, card_w - 24, desc_style)


def _letter_parse_money(text: Any) -> float | None:
    if not text:
        return None
    m = re.search(r"[\d,]+(?:\.\d+)?", str(text))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def _letter_price_position(asking_price: float | None, comparable_sales: list[dict]) -> tuple[str, str, str, Any]:
    """Compares asking_price to the average of the comparable SOLD prices
    (comparable_sales always has exactly 4 entries per the Groq schema —
    3 sold comps + 1 is_subject entry, which is excluded) to produce a
    factual above/in-line/below verdict, rather than guessing a direction
    from the abstract 0-100 pricing score."""
    sold = [v for s in comparable_sales if not s.get("is_subject") for v in [_letter_parse_money(s.get("sold_asking"))] if v]
    if not asking_price or not sold:
        return "In Line with Market", "in line with", "Fairly positioned", _LETTER_ORANGE
    avg = sum(sold) / len(sold)
    diff = (asking_price - avg) / avg
    if diff > 0.03:
        return "Above Market", "above", "Potential concern identified", _LETTER_ORANGE
    if diff < -0.03:
        return "Below Market", "below", "Room to reprice", _LETTER_GREEN
    return "In Line with Market", "in line with", "Fairly positioned", _LETTER_GREEN


def _letter_score_tier(score: float) -> str:
    if score < 45:
        return "low"
    if score < 65:
        return "mid"
    return "high"


def _letter_fmt_gbp(value: float | None) -> str:
    if not value:
        return "N/A"
    return f"£{value:,.0f}"


def generate_letter_pdf(prospect: StaleListingProspect, token: str, public_base_url: str) -> str:
    """Generate the printable two-page homeowner letter PDF and return its
    absolute path (page 1: intro + initial checklist; page 2: property
    snapshot with the pricing/competition/presentation gauges), matching
    the "Property Performance Snapshot" design reference."""
    if _PDF_LIBS_IMPORT_ERROR:
        raise RuntimeError("Install reportlab and qrcode to generate prospect letters.") from _PDF_LIBS_IMPORT_ERROR

    output_dir = Path("generated") / "stale-prospect-letters"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"stale-listing-{prospect.property_code}.pdf"
    # Query-string form (not a path segment) so scanning the QR auto-resumes
    # the homeowner straight past "Enter Property ID" on the new wizard
    # landing page — but the Property ID is now also printed visibly below,
    # since the whole premise of that landing page is "enter the Property ID
    # shown in your Havlo letter", and a token-only QR code never showed one.
    preview_url = f"{public_base_url.rstrip('/')}/stale-listings/prospect?token={token}"
    qr_reader = _letter_make_qr(preview_url)

    report = _safe_json(prospect.report_json)
    snapshot = _safe_json(prospect.listing_snapshot_json)
    scores = report.get("scores") or {}
    active_competition = report.get("active_competition") or []
    comparable_sales = report.get("comparable_sales") or []
    photo_url = snapshot.get("image") or next(iter(snapshot.get("images") or []), None)
    photo_reader = _letter_fetch_photo(photo_url)

    M = _LETTER_MARGIN
    page = rl_canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    # ── Page 1 ──
    _letter_draw_header(page, width, height)
    y = height - 150

    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica", 10.5)
    address_lines = [part.strip() for part in re.split(r",|\n", prospect.property_address) if part.strip()]
    for line in ["Regarding your property for sale"] + address_lines[:5]:
        page.drawString(M, y, line)
        y -= 14.5
    y -= 22

    headline_style = ParagraphStyle("LetterHeadline", fontName="Helvetica-Bold", fontSize=22.5, leading=26, textColor=_LETTER_ACCENT)
    y = _letter_para(page, "Your property has been on the market for more than six months.", M, y, width - 2 * M, headline_style)
    y -= 16

    y = _letter_para(page, "We have reviewed the available market information for this property and identified several factors that may be affecting its ability to attract the right buyer.", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 8
    y = _letter_para(page, "Havlo specialises in analysing properties that have remained unsold for an extended period, looking at factors such as <b>pricing, competition, positioning and listing presentation.</b>", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 8
    y = _letter_para(page, f"We have prepared a <b>Property Saleability Assessment specifically for {_letter_esc(prospect.property_address)}.</b>", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 14

    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica-Bold", 11)
    page.drawString(M, y, "WHAT WE FOUND")
    y -= 18
    y = _letter_para(page, "Our initial assessment has identified <b>several areas worth your attention,</b> including potential opportunities around:", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 14

    y = _letter_draw_checklist_grid(page, M, y, width - 2 * M, ["Pricing & Positioning", "Listing Presentation", "Market Competition", "Buyer Appeal"], 2, row_h=26)
    y -= 6
    y = _letter_para(page, "We've summarised some of our initial findings on the following page.", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 16

    page.setFont("Helvetica-Bold", 11)
    page.drawString(M, y, "YOUR FULL ASSESSMENT")
    y -= 18
    y = _letter_para(page, "Your complete property assessment contains our detailed analysis and recommendations.", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 4
    _letter_para(page, "Your report is specific to this property.", M, y, width - 2 * M, _LETTER_BODY_STYLE)

    footer_note = "This is a property marketing and saleability analysis, not a formal valuation, survey or structural assessment."
    qr_h = 91
    qr_bottom = _letter_footer_height(width, footer_note) + 18
    _letter_draw_qr_box(page, M, qr_bottom, width - 2 * M, qr_h, qr_reader, prospect.property_code)
    _letter_draw_footer(page, width, footer_note)
    page.showPage()

    # ── Page 2 ──
    _letter_draw_header(page, width, height)
    y = height - 128
    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica-Bold", 17)
    page.drawString(M, y, "Property Performance Snapshot")
    y -= 26

    card_h = 70
    page.setFillColor(colors.white)
    page.setStrokeColor(_LETTER_CARD_BORDER)
    page.roundRect(M, y - card_h, width - 2 * M, card_h, 12, stroke=1, fill=1)
    photo_w = 96
    if photo_reader is not None:
        try:
            page.drawImage(photo_reader, M + 12, y - card_h + 12, photo_w, card_h - 24, mask="auto", preserveAspectRatio=True, anchor="c")
        except Exception:
            photo_reader = None
    if photo_reader is None:
        page.setFillColor(colors.HexColor("#E5E7EB"))
        page.roundRect(M + 12, y - card_h + 12, photo_w, card_h - 24, 8, stroke=0, fill=1)
    tx = M + 12 + photo_w + 18
    page.setFillColor(_LETTER_MUTED)
    page.setFont("Helvetica", 9)
    page.drawString(tx, y - 26, "Prepared specifically for this property")
    addr_style = ParagraphStyle("LetterAddr", fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=_LETTER_INK)
    _letter_para(page, _letter_esc(prospect.property_address), tx, y - 38, width - 2 * M - (tx - M) - 12, addr_style)
    y -= card_h + 20

    page.setFont("Helvetica-Bold", 11)
    page.drawString(M, y, "PROPERTY AT A GLANCE")
    y -= 36

    days = prospect.listing_duration_days
    months = max(1, round(days / 30)) if days else 0
    competing_count = len(active_competition) or 3
    stats = [
        (_letter_icon_coins, "Current asking price", _letter_fmt_gbp(prospect.asking_price)),
        (_letter_icon_hourglass, "Time on market", f"{months} months" if months else "—"),
        # No price-history tracking exists for cold-outreach discovery
        # (the q4_price_reduction seller-survey answer this would otherwise
        # come from never runs here — has_seller_survey=False) — show "—"
        # rather than fabricate a number, same rule the report prompt
        # itself enforces for cold outreach.
        (_letter_icon_trending_up, "Price changes", "—"),
        (_letter_icon_people, "Competing properties", str(competing_count)),
    ]
    _letter_draw_stat_row(page, M, y, width - 2 * M, stats)
    y -= 62

    page.setFont("Helvetica-Bold", 11)
    page.drawString(M, y, "OUR INITIAL FINDINGS")
    y -= 14

    price_label, price_dir, price_status, price_color = _letter_price_position(prospect.asking_price, comparable_sales)
    comp_score = scores.get("competition", 50)
    comp_tier = _letter_score_tier(comp_score)
    comp_label = {"low": "High Competition", "mid": "Moderate Competition", "high": "Low Competition"}[comp_tier]
    comp_status = {"low": "Highly competitive", "mid": "Some competition", "high": "Well positioned"}[comp_tier]
    comp_color = {"low": _LETTER_RED, "mid": _LETTER_ORANGE, "high": _LETTER_GREEN}[comp_tier]

    pres_score = scores.get("listing_presentation", 50)
    pres_tier = _letter_score_tier(pres_score)
    pres_label = {"low": "Needs Improvement", "mid": "Average", "high": "Strong"}[pres_tier]
    pres_status = {"low": "Needs attention", "mid": "Opportunity identified", "high": "Performing well"}[pres_tier]
    pres_color = {"low": _LETTER_RED, "mid": _LETTER_ORANGE, "high": _LETTER_GREEN}[pres_tier]

    gauge_cards = [
        ("Pricing and Positioning", price_status, price_color, scores.get("pricing", 50), price_label, f"Current asking price appears <b>{price_dir}</b> comparable properties."),
        ("Market Competition", comp_status, comp_color, comp_score, comp_label, f"<b>{competing_count}</b> similar properties are currently competing for the same buyers."),
        ("Listing Presentation", pres_status, pres_color, pres_score, pres_label, "Opportunities identified to improve how the property is presented to buyers."),
    ]
    _letter_draw_gauge_row(page, M, y, width - 2 * M, gauge_cards)
    y -= 178 + 16

    page.setFont("Helvetica-Bold", 11)
    page.drawString(M, y, "WHAT'S IN THE FULL ASSESSMENT?")
    y -= 16
    y = _letter_draw_checklist_grid(page, M, y, width - 2 * M, ["Pricing analysis", "Comparable-property analysis", "Buyer positioning", "Competition analysis", "Listing presentation review", "Recommended changes"], 3, row_h=24)
    y -= 4

    y = _letter_para(page, "Your Havlo assessment works alongside your existing estate agent, providing recommendations to strengthen your property's market position. <b>You stay fully in control of your property and agent relationship.</b>", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 12

    _letter_draw_qr_box(page, M, y - qr_h, width - 2 * M, qr_h, qr_reader, prospect.property_code)
    y -= qr_h + 22

    bottom_stats = [
        ("61%", "Of assessed stale listings sold within 9 weeks"),
        ("87%", "of Havlo recommendations implemented led to renewed buyer interest"),
        ("10K+", "Stale listings analysed nationwide"),
        ("YOU", "Stay in Control. We Provide Insight."),
    ]
    page.setStrokeColor(colors.HexColor("#DDDDDD"))
    page.setLineWidth(0.6)
    page.line(M, y, width - M, y)
    col_w = (width - 2 * M) / 4
    for i, (num, label) in enumerate(bottom_stats):
        cx = M + col_w * i + col_w / 2
        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 16)
        page.drawCentredString(cx, y - 24, num)
        stat_style = ParagraphStyle("LetterBottomStat", fontName="Helvetica", fontSize=7.4, leading=9.6, textColor=_LETTER_MUTED, alignment=1)
        _letter_para(page, label, cx - col_w / 2 + 8, y - 37, col_w - 16, stat_style)

    page.save()
    return os.path.abspath(pdf_path)


def attachment_from_file(path: str) -> dict[str, str]:
    """Build a Resend attachment from a generated PDF.

    Resend accepts base64 content for outbound attachments. Keep this helper
    strict: sending an email without the promised letter is worse than
    reporting the email as failed and retrying it after the file issue is
    fixed.
    """
    pdf_path = Path(path).expanduser()
    if not path or not pdf_path.is_file():
        raise FileNotFoundError(f"Prospect letter PDF does not exist: {path!r}")
    file_size = pdf_path.stat().st_size
    if file_size <= 0:
        raise ValueError(f"Prospect letter PDF is empty: {pdf_path}")

    with pdf_path.open("rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return {
        "filename": pdf_path.name,
        "content": encoded,
        "content_type": "application/pdf",
    }
