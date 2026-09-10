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
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        Flowable, HRFlowable, Image as RLImage, KeepTogether, PageBreak,
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    from reportlab.pdfgen import canvas as rl_canvas
    _PDF_LIBS_IMPORT_ERROR: ImportError | None = None
except ImportError as _pdf_libs_exc:  # pragma: no cover - depends on deployment image
    _PDF_LIBS_IMPORT_ERROR = _pdf_libs_exc

# Real brand fonts for the letter, embedded rather than approximated with
# built-in PDF fonts (Helvetica/Helvetica-Bold). Each registration is
# independently guarded — a missing/broken font asset falls back to the
# closest built-in rather than failing letter generation entirely.
#
# Inter (Regular/Bold/ExtraBold): OFL-licensed, the same font already used
# site-wide (see havlo_frontend/src/index.css). Instantiated to static
# weights from Google's variable-font source with fontTools, since
# reportlab's TTFont can't target a specific weight inside a variable font
# directly. IMPORTANT: fontTools' instancer pins the glyph outlines for the
# requested weight correctly but does NOT update the font's internal name
# table to match (confirmed directly — three static instances pinned to
# wght=400/700/800 all still self-reported as "Inter Regular" / PostScript
# name "Inter-Regular"). reportlab keys off that internal identity, so
# without renaming each instance's name table (nameID 1/2/4/6/16/17) before
# registering, all three render as the same (regular) weight regardless of
# which reportlab font name is used to draw with — confirmed by rendering
# and visually comparing all three side by side before and after the fix.
#
# Millik (Regular): commercial (Zealab Fonts Division) — licensed copy
# supplied directly by the business, not downloaded from an arbitrary
# source; verified via its embedded name-table metadata before use.
# reportlab's TTFont refuses PostScript/CFF-outline OpenType fonts outright
# ("postscript outlines are not supported") — Millik-Regular.ttf is a
# TrueType-outline conversion of the licensed .otf via fontTools/otf2ttf
# (a glyph-format conversion, not a different or re-licensed font);
# Millik-Regular-source.otf is kept as the licensed file exactly as supplied.
_LETTER_FONT_REGULAR = "Helvetica"
_LETTER_FONT_BOLD = "Helvetica-Bold"
_LETTER_FONT_EXTRABOLD = "Helvetica-Bold"  # Helvetica has no ExtraBold weight
_LETTER_FONT_METRIC = "Helvetica-Bold"

if not _PDF_LIBS_IMPORT_ERROR:
    _fonts_dir = Path(__file__).resolve().parent.parent / "assets" / "fonts"
    for _pdf_name, _file_name, _fallback_attr in (
        ("Inter-Regular", "Inter-Regular.ttf", "_LETTER_FONT_REGULAR"),
        ("Inter-Bold", "Inter-Bold.ttf", "_LETTER_FONT_BOLD"),
        ("Inter-ExtraBold", "Inter-ExtraBold.ttf", "_LETTER_FONT_EXTRABOLD"),
        ("Millik-Regular", "Millik-Regular.ttf", "_LETTER_FONT_METRIC"),
    ):
        try:
            pdfmetrics.registerFont(TTFont(_pdf_name, str(_fonts_dir / _file_name)))
            globals()[_fallback_attr] = _pdf_name
        except Exception:
            logger.warning(
                "%s not found/registrable — falling back to %s for the letter.",
                _file_name, globals()[_fallback_attr], exc_info=True,
            )
    # Lets <b>/<i> tags inside a Paragraph resolve to whichever font each
    # weight actually ended up as above (Inter-Bold, or Helvetica-Bold if
    # that registration failed) — used by generate_full_report_pdf's
    # Platypus-based layout below, not by the letter's raw-canvas drawing
    # (which never uses inline markup, so never needed this).
    pdfmetrics.registerFontFamily(
        _LETTER_FONT_REGULAR, normal=_LETTER_FONT_REGULAR, bold=_LETTER_FONT_BOLD,
        italic=_LETTER_FONT_REGULAR, boldItalic=_LETTER_FONT_BOLD,
    )


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


def sms_unsubscribe_short_token(property_code: str) -> str:
    """Short (12-char) deterministic token for the SMS unsubscribe link —
    keyed by property_code (4 digits, already public — printed on the
    letter/every text) rather than the prospect's UUID, and truncated much
    further than unsubscribe_token's 32 chars. The long email-unsubscribe
    URL (UUID + 32-char token, 140+ chars) was blowing out the SMS
    character budget on its own. 12 hex chars (48 bits) is a deliberately
    weaker guarantee than the email token, but proportionate: the only
    thing this gates is opting a number out of further marketing texts,
    not anything sensitive — cheaper to over-unsubscribe by brute force
    than to keep texting someone a link they can't realistically tap."""
    secret = (get_settings().SECRET_KEY or "").encode("utf-8")
    return hmac.new(secret, f"sms:{property_code}".encode("utf-8"), hashlib.sha256).hexdigest()[:12]


def verify_sms_unsubscribe_short_token(property_code: str, token: str) -> bool:
    expected = sms_unsubscribe_short_token(property_code)
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
        return 499.99
    if price > 700_000:
        return 399.99
    if price >= 500_000:
        return 299.99
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
        "postcode": scraped.get("postcode") or "",
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
        "price_reduced": bool(scraped.get("price_reduced")),
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
    city: str | None = None,
    is_manual: bool = False,
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
        postcode=listing_snapshot.get("postcode") or None,
        city=city or listing_snapshot.get("city") or None,
        is_manual=is_manual,
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
        property_address = address_with_full_postcode(prospect.property_address, prospect.postcode)
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


# Rightmove's own displayAddress text caps a UK postcode at the outward code
# plus (sometimes) just the first digit of the inward code — e.g. "BH8 9"
# instead of "BH8 9BG" (see the postcode column's comment in models.py). The
# real full code is scraped separately from outcode/incode and stored on
# StaleListingProspect.postcode, but property_address itself is stored
# verbatim from Rightmove, so every prospect-facing surface that prints the
# address (this letter, the admin-notify email, the console's report/preview
# payloads) inherited that truncation. Matches the SAME partial-or-full
# pattern Rightmove actually produces, anchored at the end of the string.
_PARTIAL_OR_FULL_POSTCODE_RE = re.compile(r"[A-Z]{1,2}\d[A-Z\d]?(?:\s?\d[A-Z]{0,2})?$", re.IGNORECASE)


def address_with_full_postcode(address: str, postcode: str | None) -> str:
    """Patch a full postcode into a display address whose trailing postcode
    (if any) Rightmove truncated.

    Only ever *extends* what's already there — replaces the tail with
    `postcode` when `postcode` is a genuine full code (has the inward-code
    space, so not just a bare outcode) and is consistent with what's
    already printed (its own text, minus spaces, starts with the same);
    appends it when the address has no postcode-looking tail at all.
    Never touches an address that already ends with the full code, and
    never substitutes a `postcode` that looks like a different property's
    address entirely — better to leave Rightmove's own (possibly partial)
    text than print a wrong one.
    """
    full = (postcode or "").strip()
    if not full or " " not in full:
        return address
    stripped = address.rstrip()
    match = _PARTIAL_OR_FULL_POSTCODE_RE.search(stripped)
    if not match:
        return f"{stripped}, {full}" if stripped else full
    existing = match.group(0)
    if existing.upper().replace(" ", "") == full.upper().replace(" ", ""):
        return address
    if not full.upper().replace(" ", "").startswith(existing.upper().replace(" ", "")):
        return address
    return stripped[: match.start()] + full + stripped[match.end():]


# Full postcode only (has the inward-code space/digit-letter pair) - a bare
# outcode like "L18" or "SK7" is short enough that it reads fine tacked onto
# a "City, Outcode" line, and usually already lands on its own comma-split
# line anyway. A full postcode glued onto the end of a line with no comma
# before it (Rightmove's own raw format is frequently "Town POSTCODE" with
# just a space) is the case that actually needs splitting out.
_FULL_POSTCODE_TAIL_RE = re.compile(r"([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$", re.IGNORECASE)


def _isolate_postcode_line(lines: list[str]) -> list[str]:
    """Force a trailing full postcode onto its own line, splitting it out of
    whatever line it's currently glued to. Used for the printed letter's
    address block, per design feedback: the postcode should never share a
    line with other address text, even when the source address has no comma
    separating them ("...Macclesfield SK11 9LL" -> "...Macclesfield" /
    "SK11 9LL")."""
    if not lines:
        return lines
    last = lines[-1]
    match = _FULL_POSTCODE_TAIL_RE.search(last)
    if not match:
        return lines
    prefix = last[: match.start()].strip(" ,")
    postcode = match.group(1).upper()
    if not prefix:
        return lines  # Already alone on its own line - nothing to do.
    return [*lines[:-1], prefix, postcode]


def serialize_preview(prospect: StaleListingProspect) -> dict[str, Any]:
    return {
        "prospect_id": str(prospect.id),
        "property_code": prospect.property_code,
        "property_address": address_with_full_postcode(prospect.property_address, prospect.postcode),
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


def current_report_json(prospect: StaleListingProspect) -> str | None:
    """The report actually in effect for this prospect: an ops-console edit
    (agent_edited_report_json) always wins over the original AI output
    (report_json) once one exists — same precedence as
    StaleListingAssessment.agent_edited_report_json elsewhere."""
    return prospect.agent_edited_report_json or prospect.report_json


def serialize_report(prospect: StaleListingProspect) -> dict[str, Any]:
    return {
        "prospect_id": str(prospect.id),
        "property_code": prospect.property_code,
        "property_address": address_with_full_postcode(prospect.property_address, prospect.postcode),
        "rightmove_url": prospect.rightmove_url,
        "asking_price": prospect.asking_price,
        "listing_duration_days": prospect.listing_duration_days,
        "contact_name": prospect.contact_name,
        "listing_snapshot": _safe_json(prospect.listing_snapshot_json),
        "report_data": _safe_json(current_report_json(prospect)),
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
# One fixed QR code shared by every prospect letter, replacing a unique
# per-prospect QR encoding that prospect's own magic-link token. The wizard
# landing page already has a "Enter Property ID" step that works with no
# token or code in the URL at all (StaleProspectWizard.tsx), so a single
# static QR pointing at the plain landing page — with the Property ID typed
# in manually, which the letter already prints right next to the code — is
# a fully supported flow, not a new one.
_LETTER_STATIC_QR_PATH = Path("havlo_frontend/public/stale-listing-qr.png")

if not _PDF_LIBS_IMPORT_ERROR:
    _LETTER_BODY_STYLE = ParagraphStyle("LetterBody", fontName="Helvetica", fontSize=10, leading=14.5, textColor=_LETTER_INK)
    _LETTER_LEGAL_TEXT = (
        "Havlo Ltd, registered in England and Wales (Company No. 15369975). Office: 2nd Floor, Berkeley Square, "
        "London, England, W1J 6BD. Telephone: 0333 339 0423. Email: "
        "<a href=\"mailto:hello@heyhavlo.com\">hello@heyhavlo.com</a>. Havlo provides property marketing intelligence "
        "to help sellers understand and improve the performance of their property listings. We identified your "
        "property using publicly available listing information. You have the right to opt out of future marketing "
        "communications from us at any time. To opt out, "
        "<a href=\"mailto:hello@heyhavlo.com\">email us</a> and we will remove your address from our marketing records."
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


def _letter_draw_tracked_text(
    page, text: str, x: float, y: float, *, font: str, size: float,
    char_space: float, color, align: str = "left",
    max_w: float | None = None, leading: float | None = None,
) -> float:
    """Draw text with true character tracking (letter-spacing).

    reportlab 4.2.5's Paragraph markup has no tracking attribute (its
    <span> tag only accepts font/size/color — confirmed by testing against
    the exact pinned version, not just whatever's newest). setCharSpace
    does exist, but only on the low-level PDFTextObject from
    canvas.beginText(), not on Canvas itself.

    With max_w given, does its own greedy word-wrap first (accounting for
    char_space in each line's measured width, which stringWidth alone
    doesn't) so tracked text can still span multiple lines; without it,
    draws text as a single line. align controls how each line is
    positioned relative to x ("left", "center", or "right"). Returns the y
    just below the last line drawn (== y when there's only one line).
    """
    def tracked_width(s: str) -> float:
        w = page.stringWidth(s, font, size)
        if len(s) > 1:
            w += char_space * (len(s) - 1)
        return w

    if max_w is None:
        lines = [text]
    else:
        words = text.split()
        lines = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and tracked_width(candidate) > max_w:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)

    cur_y = y
    for i, line in enumerate(lines):
        if i > 0:
            cur_y -= leading
        w = tracked_width(line)
        if align == "center":
            line_x = x - w / 2
        elif align == "right":
            line_x = x - w
        else:
            line_x = x
        t = page.beginText(line_x, cur_y)
        t.setFont(font, size)
        t.setFillColor(color)
        t.setCharSpace(char_space)
        t.textOut(line)
        page.drawText(t)
    return cur_y


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


def _letter_icon_scan_badge(page, cx, cy, r) -> None:
    """Circular pale-accent badge with a smaller scan-frame glyph inside,
    matching the design reference's "Scan to view your property findings"
    icon (a filled lavender circle, not a bare black viewfinder outline)."""
    page.setFillColor(_LETTER_ACCENT_PALE)
    page.circle(cx, cy, r, stroke=0, fill=1)
    _letter_icon_scan_frame(page, cx, cy, r * 0.5, _LETTER_ACCENT)


def _letter_draw_gauge(page, cx, cy, radius, score, color) -> None:
    """Semicircle-ish gauge (a ~230deg sweep, not a plain 180deg semicircle
    — also measured off the reference, not assumed). score 0 -> needle/arc
    at the start angle, 100 -> needle/arc at the end angle."""
    fraction = max(0, min(100, score or 0)) / 100.0
    value_angle = _LETTER_GAUGE_START - fraction * _LETTER_GAUGE_SPAN
    page.setLineCap(1)
    page.setStrokeColor(colors.HexColor("#ECECEE"))
    page.setLineWidth(radius * 0.24 * 0.7)  # 30% thinner than the original track width
    page.arc(cx - radius, cy - radius, cx + radius, cy + radius, _LETTER_GAUGE_END, _LETTER_GAUGE_SPAN)
    page.setStrokeColor(color)
    page.arc(cx - radius, cy - radius, cx + radius, cy + radius, value_angle, _LETTER_GAUGE_START - value_angle)
    # The needle pivots level with the arc's two open ends (_LETTER_GAUGE_START
    # / _LETTER_GAUGE_END, symmetric about straight-down), not the circle's
    # true center — matching a real dashboard gauge, where the needle sits at
    # the track's baseline rather than floating above it.
    pivot_y = cy + radius * math.sin(math.radians(_LETTER_GAUGE_START))
    needle_len = radius * 0.55
    nx = cx + needle_len * math.cos(math.radians(value_angle))
    ny = pivot_y + needle_len * math.sin(math.radians(value_angle))
    page.setStrokeColor(colors.HexColor("#111111"))
    page.setLineWidth(1.6)
    page.setLineCap(1)
    page.line(cx, pivot_y, nx, ny)
    page.setFillColor(colors.HexColor("#111111"))
    page.circle(cx, pivot_y, radius * 0.065, stroke=0, fill=1)


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

    _letter_icon_scan_badge(page, x + 30, y + h / 2, 17)
    # Spec: Inter/500/14px/120% line-height/-2% letter-spacing/CAP_HEIGHT
    # leading-trim, not underlined. No Inter Medium (500) static instance is
    # registered — only Regular/Bold/ExtraBold (see the font-registration
    # block above) — and the spec's own "font-style: Bold" field points at
    # the one we do have, so this uses _LETTER_FONT_BOLD rather than
    # building a fourth static weight for one label. Needs real character
    # tracking (the -2% letter-spacing) and no underline, so it's drawn
    # with _letter_draw_tracked_text instead of a ParagraphStyle/<u>
    # Paragraph like before — reportlab's Paragraph markup has no tracking
    # attribute (see that helper's docstring).
    label_w = 185
    label_size = 14
    label_leading = label_size * 1.2
    label_char_space = label_size * -0.02
    scan_label = "Scan to view your property findings or visit heyhavlo.com/check"
    _label_words = scan_label.split()
    _label_lines: list[str] = []
    _label_current = ""
    for _word in _label_words:
        _candidate = f"{_label_current} {_word}".strip()
        _cw = page.stringWidth(_candidate, _LETTER_FONT_BOLD, label_size) + label_char_space * max(len(_candidate) - 1, 0)
        if _label_current and _cw > label_w:
            _label_lines.append(_label_current)
            _label_current = _word
        else:
            _label_current = _candidate
    if _label_current:
        _label_lines.append(_label_current)
    # CAP_HEIGHT leading-trim means the block's visual bounds run from the
    # first line's cap-height top to the last line's baseline, with no
    # extra leading padding above/below — so centering uses cap-height
    # (~0.72 of font size for Inter) rather than the font's full leading.
    _label_cap_h = label_size * 0.72
    _label_block_h = (len(_label_lines) - 1) * label_leading + _label_cap_h
    _label_first_baseline = y + h / 2 + _label_block_h / 2 - _label_cap_h
    _letter_draw_tracked_text(
        page, scan_label, x + 60, _label_first_baseline,
        font=_LETTER_FONT_BOLD, size=label_size, char_space=label_char_space, color=_LETTER_INK,
        max_w=label_w, leading=label_leading,
    )

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

    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica-Bold", 9.5)
    page.drawString(_LETTER_MARGIN, havlo_top, "HAVLO")
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


def _letter_draw_gauge_row(page, x, y_top, w, cards, card_h=160.2) -> None:
    # card_h is 178 * 0.9 (10% shorter, per design feedback) — every
    # VERTICAL offset below is scaled by the same ratio so the internal
    # layout (title/status/divider/gauge/label/description) stays
    # proportionally identical to the original 178pt design instead of
    # bunching up in a shorter box. Horizontal measurements (insets, line
    # extents, paragraph width) are untouched since only height changed.
    #
    # NOT shrunk further than this: the longest description ("Listing
    # Presentation"'s, the only one of the three that wraps to 3 lines at
    # this card width — measured directly with reportlab's own Paragraph
    # .wrap()) already only just fits below the gauge at this height
    # (~1-2pt to spare). Any further reduction pushes that 3-line text up
    # into the gauge circle and past the card's bottom edge — verified by
    # computing the actual available space (card_h * 35/178, the fraction
    # left below the gauge's bottom edge) against the fixed 33.6pt the
    # 3-line description needs at its unscaled font size. Card height and
    # the space this needs to fit the description do NOT shrink together,
    # since only positions scale here, not font size/leading — so this is
    # a real ceiling, not just a look I chose not to push further. See the
    # gap added after this row's call site for how "more space before the
    # heading below" is achieved without touching card height.
    scale = card_h / 178
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
        page.drawCentredString(cx0 + card_w / 2, cy0 + card_h - 22 * scale, title)
        page.setFillColor(status_color)
        page.setFont("Helvetica-Bold", 8.6)
        page.drawCentredString(cx0 + card_w / 2, cy0 + card_h - 35 * scale, status_text)
        page.setStrokeColor(colors.HexColor("#E2E2E5"))
        page.setLineWidth(0.75)
        page.line(cx0 + 14, cy0 + card_h - 43 * scale, cx0 + card_w - 14, cy0 + card_h - 43 * scale)

        # 6pt lower than before (was card_h - 92) — the arc's top point sits
        # at gauge_cy + radius, which was only 4pt below the divider line
        # above it; this opens that up to a clearer ~10pt gap.
        gauge_cy = cy0 + card_h - 98 * scale
        _letter_draw_gauge(page, cx0 + card_w / 2, gauge_cy, 45 * scale, score, status_color)

        page.setFillColor(_LETTER_INK)
        page.setFont("Helvetica-Bold", 10.5)
        page.drawCentredString(cx0 + card_w / 2, cy0 + 48 * scale, result_label)
        desc_style = ParagraphStyle("LetterGaugeDesc", fontName="Helvetica", fontSize=8.1, leading=11.2, textColor=_LETTER_MUTED, alignment=1)
        _letter_para(page, desc_html, cx0 + 12, cy0 + 36 * scale, card_w - 24, desc_style)


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
    if _LETTER_STATIC_QR_PATH.is_file():
        qr_reader: BytesIO | str = str(_LETTER_STATIC_QR_PATH)
    else:
        # Fallback only — should not normally trigger. Same per-prospect
        # dynamic QR this replaced, kept so a missing/moved static asset
        # degrades to a working letter instead of a hard failure.
        logger.warning("Static QR asset missing at %s — falling back to a per-prospect dynamic QR.", _LETTER_STATIC_QR_PATH)
        preview_url = f"{public_base_url.rstrip('/')}/stale-listings/prospect?token={token}"
        qr_reader = _letter_make_qr(preview_url)

    report = _safe_json(current_report_json(prospect))
    snapshot = _safe_json(prospect.listing_snapshot_json)
    scores = report.get("scores") or {}
    active_competition = report.get("active_competition") or []
    comparable_sales = report.get("comparable_sales") or []
    photo_url = snapshot.get("image") or next(iter(snapshot.get("images") or []), None)
    photo_reader = _letter_fetch_photo(photo_url)
    # Rightmove's displayAddress (prospect.property_address) truncates the
    # postcode; prospect.postcode has the real one. Every address printed
    # in this letter should use the patched-in full version.
    display_address = address_with_full_postcode(prospect.property_address, prospect.postcode)

    M = _LETTER_MARGIN
    page = rl_canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    # ── Page 1 ──
    _letter_draw_header(page, width, height)
    y = height - 150

    page.setFillColor(_LETTER_INK)
    page.setFont("Helvetica", 10.5)
    address_lines = [part.strip() for part in re.split(r",|\n", display_address) if part.strip()]
    address_lines = _isolate_postcode_line(address_lines)
    address_line_h = 14.5
    # In from the margin — not flush with the body text below it (that read
    # as visually mis-aligned/floating). Measured in actual space-widths at
    # this font/size rather than a guessed constant: 2 per the original
    # design feedback, then 5, then 7 total per later rounds of feedback
    # moving it further right each time.
    address_x = M + 7 * page.stringWidth(" ", "Helvetica", 10.5)
    # Dateline: the date this specific letter was first downloaded from the
    # prospects console (see download_console_letter_pdf) — set once and
    # never updated on a later re-download, so it stays accurate even
    # though the PDF file itself may be regenerated again after that (e.g.
    # Railway's ephemeral filesystem losing the cached copy between
    # deploys). Blank until the letter has actually been downloaded once.
    # Right-aligned at the top-right of the page, level with the first
    # address line, rather than stacked above the address block on the
    # left — a conventional letter layout (recipient address left, date
    # right), per design feedback.
    if prospect.letter_first_downloaded_at:
        page.drawRightString(width - M, y, prospect.letter_first_downloaded_at.strftime("%d/%m/%Y"))
    # Cap at 6 lines, but never let the postcode (always last, once
    # _isolate_postcode_line has run) be the one a plain [:6] would drop for
    # an unusually long address - trim from the middle instead so the
    # postcode line always survives.
    capped_address_lines = (
        address_lines if len(address_lines) <= 6
        else [*address_lines[:5], address_lines[-1]]
    )
    for line in ["Regarding your property for sale"] + capped_address_lines:
        page.drawString(address_x, y, line)
        y -= address_line_h
    y -= 22

    headline_style = ParagraphStyle("LetterHeadline", fontName="Helvetica-Bold", fontSize=22.5, leading=26, textColor=_LETTER_ACCENT)
    y = _letter_para(page, "Your property has been on the market for more than six months.", M, y, width - 2 * M, headline_style)
    y -= 16

    y = _letter_para(page, "We have reviewed the available market information for this property and identified several factors that may be affecting its ability to attract the right buyer.", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 8
    y = _letter_para(page, "Havlo specialises in analysing properties that have remained unsold for an extended period, looking at factors such as <b>pricing, competition, positioning and listing presentation.</b>", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 8
    y = _letter_para(page, f"We have prepared a <b>Property Saleability Assessment specifically for {_letter_esc(display_address)}.</b>", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 24

    page.setFillColor(_LETTER_INK)
    # Same section-heading spec as page 2's headings (Inter Bold 10px/-3%)
    # — applied here too for consistency across the two pages, since this
    # is the same kind of section header, not literally one of the three
    # named in the spec request.
    _letter_draw_tracked_text(
        page, "WHAT WE FOUND", M, y,
        font=_LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=_LETTER_INK,
    )
    y -= 10
    y = _letter_para(page, "Our initial assessment has identified <b>several areas worth your attention,</b> including potential opportunities around:", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 14

    y = _letter_draw_checklist_grid(page, M, y, width - 2 * M, ["Pricing & Positioning", "Listing Presentation", "Market Competition", "Buyer Appeal"], 2, row_h=26)
    y -= 6
    y = _letter_para(page, "We've summarised some of our initial findings on the following page.", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    y -= 24

    _letter_draw_tracked_text(
        page, "YOUR FULL ASSESSMENT", M, y,
        font=_LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=_LETTER_INK,
    )
    y -= 10
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
    # Spec: Inter/ExtraBold(800)/14px/110% line-height/-3% letter-spacing.
    _letter_draw_tracked_text(
        page, "Property Performance Snapshot", M, y,
        font=_LETTER_FONT_EXTRABOLD, size=14, char_space=14 * -0.03, color=_LETTER_INK,
    )
    y -= 22

    card_h = 70
    page.setFillColor(colors.white)
    page.setStrokeColor(_LETTER_CARD_BORDER)
    page.setLineWidth(1)
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
    _letter_para(page, _letter_esc(display_address), tx, y - 38, width - 2 * M - (tx - M) - 12, addr_style)
    y -= card_h + 12

    # Spec: Inter/Bold(700)/10px/150% line-height/-3% letter-spacing/
    # CAP_HEIGHT leading-trim — same spec as OUR INITIAL FINDINGS and
    # WHAT'S IN THE FULL ASSESSMENT? below.
    _letter_draw_tracked_text(
        page, "PROPERTY AT A GLANCE", M, y,
        font=_LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=_LETTER_INK,
    )
    y -= 24

    days = prospect.listing_duration_days
    months = max(1, round(days / 30)) if days else 0
    competing_count = len(active_competition) or 3
    stats = [
        (_letter_icon_coins, "Current asking price", _letter_fmt_gbp(prospect.asking_price)),
        (_letter_icon_hourglass, "Time on market", f"{months} months" if months else "—"),
        # Real signal from Rightmove's own listingHistory (see
        # listing_scraper.py's price_reduced detection) when the snapshot
        # was scraped after that field existed. Snapshots taken before this
        # change won't have the key at all — bool(None) is False, so those
        # correctly show "Nil" rather than a fabricated number, same rule
        # the report prompt itself enforces for cold outreach.
        (_letter_icon_trending_up, "Price changes", "Reduced" if snapshot.get("price_reduced") else "Nil"),
        (_letter_icon_people, "Competing properties", str(competing_count)),
    ]
    _letter_draw_stat_row(page, M, y, width - 2 * M, stats)
    y -= 70

    _letter_draw_tracked_text(
        page, "OUR INITIAL FINDINGS", M, y,
        font=_LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=_LETTER_INK,
    )
    y -= 8

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
    # 4pt was too tight: drawString's y is the text baseline, and an 11pt
    # bold heading's ascent puts its glyph tops within a couple of points
    # of the gauge cards' rounded-rect bottom edge at that gap — reading as
    # the heading touching the card row above it. Raised to 12, then to 24
    # (doubled again per design feedback, asking for more separation from
    # "WHAT'S IN THE FULL ASSESSMENT?" below) — the cards themselves stay
    # at their current height rather than shrinking further; see
    # _letter_draw_gauge_row's card_h comment for why that's a real ceiling,
    # not a style choice. The extra 12pt this adds is reclaimed by trimming
    # the paragraph/QR gaps below by the same total (4->0, 10->2) so this
    # page's total consumed height is unchanged either way — the last
    # bottom-stat column ("of Havlo recommendations implemented...", the
    # longest label) already wraps to enough lines to run close to the
    # page's bottom margin at the original height budget; this must not
    # make that worse.
    _gauge_card_h = 160.2
    y -= _gauge_card_h + 24

    _letter_draw_tracked_text(
        page, "WHAT'S IN THE FULL ASSESSMENT?", M, y,
        font=_LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=_LETTER_INK,
    )
    y -= 10
    y = _letter_draw_checklist_grid(page, M, y, width - 2 * M, ["Pricing analysis", "Comparable-property analysis", "Buyer positioning", "Competition analysis", "Listing presentation review", "Recommended changes"], 3, row_h=24)
    y -= 4

    y = _letter_para(page, "Your Havlo assessment works alongside your existing estate agent, providing recommendations to strengthen your property's market position. <b>You stay fully in control of your property and agent relationship.</b>", M, y, width - 2 * M, _LETTER_BODY_STYLE)
    # Trimmed further (4->0, and qr_h+10->qr_h+2 below) to offset the extra
    # 12pt added above (12->24) between the gauge cards and "WHAT'S IN THE
    # FULL ASSESSMENT?" — net zero change to this page's total height.
    _letter_draw_qr_box(page, M, y - qr_h, width - 2 * M, qr_h, qr_reader, prospect.property_code)
    y -= qr_h + 2

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
        # Metrics number spec: Millik/Regular(400)/13.87px/0 letter-spacing/
        # CAP_HEIGHT leading-trim.
        _letter_draw_tracked_text(
            page, num, cx, y - 22,
            font=_LETTER_FONT_METRIC, size=13.87, char_space=0, color=_LETTER_INK,
            align="center",
        )
        # Small-text spec: Inter/Regular(400)/8.55px/105% line-height/
        # -0.43px letter-spacing.
        _letter_draw_tracked_text(
            page, label, cx, y - 30,
            font=_LETTER_FONT_REGULAR, size=8.55, char_space=-0.43, color=_LETTER_MUTED,
            align="center", max_w=col_w - 16, leading=8.55 * 1.05,
        )

    page.save()
    return os.path.abspath(pdf_path)


# ── Full Property Assessment PDF ─────────────────────────────────────────────
# Replaces the console's previous "export" of this report: window.print() on
# the on-screen preview modal (#spc-print-target in StaleProspectsConsole.tsx)
# — a plain browser print of a page never laid out for paper, which is what
# was actually producing pages of near-blank browser-paginated output with
# Chrome's own date/URL/page-number chrome stamped on it. This builds a real
# document instead, via reportlab's Platypus flow layout (automatic, sane
# pagination) rather than the letter's raw-canvas placement above — the two
# have very different shapes (a fixed two-page letter vs. a report whose
# length depends entirely on how much content this particular property has)
# and Platypus is the right tool for the latter. Shares this file's proven
# brand constants (_LETTER_INK etc., the exact same font files, the same
# _letter_draw_gauge arc/needle math) rather than redefining them.

_REPORT_GREEN_BG = colors.HexColor("#E7F7EF") if not _PDF_LIBS_IMPORT_ERROR else None
_REPORT_RED_BG = colors.HexColor("#FDECEC") if not _PDF_LIBS_IMPORT_ERROR else None
_REPORT_ORANGE_BG = colors.HexColor("#FDF1E7") if not _PDF_LIBS_IMPORT_ERROR else None

_REPORT_PAGE_W, _REPORT_PAGE_H = A4 if not _PDF_LIBS_IMPORT_ERROR else (None, None)
_REPORT_MARGIN = 20 * mm if not _PDF_LIBS_IMPORT_ERROR else None
_REPORT_CONTENT_W = (_REPORT_PAGE_W - 2 * _REPORT_MARGIN) if not _PDF_LIBS_IMPORT_ERROR else None


def _report_score_color(v: float):
    if v >= 65:
        return _LETTER_GREEN
    if v >= 45:
        return _LETTER_ORANGE
    return _LETTER_RED


def _report_styles() -> dict[str, "ParagraphStyle"]:
    # Built fresh per call rather than at module import time: ParagraphStyle
    # construction is cheap, and this avoids any risk of a shared mutable
    # style object being mutated by one report generation (concurrent
    # requests each get their own dict).
    B, BOLD, XBOLD = _LETTER_FONT_REGULAR, _LETTER_FONT_BOLD, _LETTER_FONT_EXTRABOLD
    return {
        "h1": ParagraphStyle("h1", fontName=XBOLD, fontSize=20, leading=24, textColor=_LETTER_INK, spaceAfter=2),
        "h2": ParagraphStyle("h2", fontName=XBOLD, fontSize=14, leading=18, textColor=_LETTER_INK, spaceBefore=4, spaceAfter=8),
        "h3": ParagraphStyle("h3", fontName=BOLD, fontSize=11.5, leading=15, textColor=_LETTER_INK, spaceAfter=3),
        "body": ParagraphStyle("body", fontName=B, fontSize=9.3, leading=14, textColor=_LETTER_INK, alignment=TA_JUSTIFY),
        "body_left": ParagraphStyle("body_left", fontName=B, fontSize=9.3, leading=14, textColor=_LETTER_INK),
        "muted": ParagraphStyle("muted", fontName=B, fontSize=8.6, leading=12.5, textColor=_LETTER_MUTED),
        "addr": ParagraphStyle("addr", fontName=BOLD, fontSize=13, leading=16.5, textColor=_LETTER_INK),
        "meta": ParagraphStyle("meta", fontName=B, fontSize=8.8, leading=13, textColor=_LETTER_MUTED),
        "score_num": ParagraphStyle("score_num", fontName=XBOLD, fontSize=26, leading=28, textColor=_LETTER_INK, alignment=TA_CENTER),
        "score_lbl": ParagraphStyle("score_lbl", fontName=B, fontSize=8, leading=10, textColor=_LETTER_MUTED, alignment=TA_CENTER),
        "week_num": ParagraphStyle("week_num", fontName=BOLD, fontSize=8, leading=10, textColor=_LETTER_ACCENT),
        "week_title": ParagraphStyle("week_title", fontName=BOLD, fontSize=9.5, leading=13, textColor=_LETTER_INK),
        "callout_lbl": ParagraphStyle("callout_lbl", fontName=BOLD, fontSize=8, leading=11, textColor=colors.white),
        "callout_body": ParagraphStyle("callout_body", fontName=B, fontSize=9.5, leading=14, textColor=colors.white),
        "callout_body_bold": ParagraphStyle("callout_body_bold", fontName=BOLD, fontSize=11.5, leading=15, textColor=colors.white),
        "bullet": ParagraphStyle("bullet", fontName=B, fontSize=8.8, leading=13, textColor=_LETTER_INK, leftIndent=10),
    }


class _ReportScoreGauge(Flowable):
    """Thin Flowable wrapper around _letter_draw_gauge (same proven arc/
    needle math the letter's page 2 uses) so it can sit inline in a
    Platypus flow. _letter_draw_gauge takes an absolute (cx, cy) chosen by
    the caller and draws the needle pivot BELOW that point — cy has to
    leave enough room under it for the pivot + dot, or they'd render
    outside this flowable's reported box and overlap whatever Platypus
    stacks next; derived from radius so it holds at any size."""

    def __init__(self, score: float, w=100, radius=42, bottom_pad=4):
        super().__init__()
        self.score = score
        self.w = w
        self.radius = radius
        self._cy = bottom_pad + radius * abs(math.sin(math.radians(_LETTER_GAUGE_START)))
        self.h = self._cy + radius + 2

    def wrap(self, *args):
        return self.w, self.h

    def draw(self):
        _letter_draw_gauge(self.canv, self.w / 2, self._cy, self.radius,
                            self.score, _report_score_color(self.score or 0))


class _ReportScoreBar(Flowable):
    """One labelled horizontal progress bar (Pricing 40/100, etc.)."""

    def __init__(self, label: str, value: int, w, h=26):
        super().__init__()
        self.label = label
        self.value = max(0, min(100, value))
        self.w = w
        self.h = h

    def wrap(self, *args):
        return self.w, self.h

    def draw(self):
        c = self.canv
        c.setFont(_LETTER_FONT_REGULAR, 9)
        c.setFillColor(_LETTER_INK)
        c.drawString(0, self.h - 11, self.label)
        c.setFont(_LETTER_FONT_BOLD, 9)
        c.drawRightString(self.w, self.h - 11, f"{self.value}/100")
        track_h = 6
        c.setFillColor(colors.HexColor("#EEEEF0"))
        c.roundRect(0, 0, self.w, track_h, track_h / 2, stroke=0, fill=1)
        fill_w = self.w * (self.value / 100.0)
        if fill_w > track_h:
            c.setFillColor(_report_score_color(self.value))
            c.roundRect(0, 0, fill_w, track_h, track_h / 2, stroke=0, fill=1)


class _ReportPill(Flowable):
    """Small rounded label pill — used for both the ISSUE/STRENGTH finding
    tag and the URGENT/HIGH/MEDIUM priority tag (colour set by caller)."""

    def __init__(self, text: str, color, bg):
        super().__init__()
        self.text = (text or "").upper()
        self.color = color
        self.bg = bg
        self.w = 8 + pdfmetrics.stringWidth(self.text, _LETTER_FONT_BOLD, 6.6) + 10
        self.h = 13

    def wrap(self, *args):
        return self.w, self.h

    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.w, self.h, self.h / 2, stroke=0, fill=1)
        c.setFillColor(self.color)
        c.setFont(_LETTER_FONT_BOLD, 6.6)
        c.drawCentredString(self.w / 2, self.h / 2 - 2.3, self.text)


def _report_type_pill(finding_type: str) -> "_ReportPill":
    is_strength = (finding_type == "strength")
    return _ReportPill("STRENGTH" if is_strength else "ISSUE",
                        _LETTER_GREEN if is_strength else _LETTER_RED,
                        _REPORT_GREEN_BG if is_strength else _REPORT_RED_BG)


def _report_priority_pill(priority: str) -> "_ReportPill":
    p = (priority or "MEDIUM").upper()
    color_map = {"URGENT": (_LETTER_RED, _REPORT_RED_BG), "HIGH": (_LETTER_ORANGE, _REPORT_ORANGE_BG),
                 "MEDIUM": (_LETTER_ACCENT, _LETTER_ACCENT_PALE)}
    color, bg = color_map.get(p, (_LETTER_ACCENT, _LETTER_ACCENT_PALE))
    return _ReportPill(p, color, bg)


def _report_hr(space_before=10, space_after=10):
    return HRFlowable(width="100%", thickness=0.75, color=_LETTER_CARD_BORDER,
                       spaceBefore=space_before, spaceAfter=space_after)


def _report_card(flowables, pad=12, bg=None, border=None, radius=8, width=None):
    """Wrap flowables in a padded, rounded-corner card via a single-cell
    Table (reportlab has no native rounded-rect flowable background).

    `width` is the card's OUTER width (defaults to the full content width;
    pass e.g. half of it inside a 2-column grid) — padding then insets the
    content inside that, so any inner flowable sized to `width - 2*pad`
    fills it exactly. Getting this wrong (colWidth already narrowed by the
    padding amount, then padding applied again on top) double-counts the
    inset and clips anything sized to fill the card — confirmed live on an
    early version of this layout, where it clipped the priority/type pills
    on the right edge of every card's header row."""
    width = _REPORT_CONTENT_W if width is None else width
    bg = _LETTER_CARD_BG if bg is None else bg
    border = _LETTER_CARD_BORDER if border is None else border
    t = Table([[flowables]], colWidths=[width])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), pad), ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), pad), ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.75, border),
        ("ROUNDEDCORNERS", [radius, radius, radius, radius]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _report_header_row(title_para, pill: "_ReportPill", width):
    """Title on the left, a pill right-aligned on the same line — the
    2-column-table trick, sized to `width` (must be the card's inner
    content width, i.e. card_width - 2*pad, same reasoning as _report_card
    above)."""
    pill_col = pill.w
    t = Table([[title_para, pill]], colWidths=[width - pill_col, pill_col])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    return t


def _report_dedupe_bullets(bullets):
    # The model sometimes returns the same generic filler bullet twice for
    # one action (seen live) — a report is not the place to show a
    # customer the same sentence back to back.
    seen = set()
    out = []
    for b in bullets or []:
        key = (b or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(b)
    return out


def _report_multi_para(text, style, space_between=6):
    """Split on blank lines into separate Paragraph flowables — several of
    the standing-advisory action items (Neighbourhood Buyer Outreach etc.)
    are genuinely multi-paragraph copy; a bare Paragraph() ignores \\n\\n
    and renders it as one dense justified block. Escapes each part (see
    _letter_esc) since this always takes raw AI-generated text, never
    markup this function writes itself."""
    parts = [p.strip() for p in (text or "").split("\n\n") if p.strip()]
    if not parts:
        return [Paragraph("", style)]
    out = []
    for i, p in enumerate(parts):
        if i > 0:
            out.append(Spacer(1, space_between))
        out.append(Paragraph(_letter_esc(p), style))
    return out


def _report_money(v) -> str:
    try:
        return f"£{float(v):,.0f}"
    except (TypeError, ValueError):
        return str(v) if v else "—"


def _fetch_report_photo_bytesio(url: str | None) -> BytesIO | None:
    """Same best-effort fetch as _letter_fetch_photo, but returns a BytesIO
    rather than an ImageReader — reportlab.platypus.Image requires either a
    path string or a file-like object with .read(); ImageReader exposes
    neither (confirmed against the installed reportlab), so the letter's
    existing helper isn't reusable as-is for this Platypus-based layout."""
    if not url:
        return None
    try:
        import httpx
        resp = httpx.get(url, timeout=5.0, follow_redirects=True)
        resp.raise_for_status()
        return BytesIO(resp.content)
    except Exception:
        logger.warning("Could not fetch listing photo for full-report PDF: %s", url, exc_info=True)
        return None


def _report_page_chrome(c, doc, subject_address: str):
    c.saveState()
    if _LETTER_LOGO_PATH.is_file():
        c.drawImage(str(_LETTER_LOGO_PATH), _REPORT_MARGIN, _REPORT_PAGE_H - 15 * mm,
                    width=26 * mm, height=8 * mm, preserveAspectRatio=True, mask="auto")
    c.setFont(_LETTER_FONT_BOLD, 7.5)
    c.setFillColor(_LETTER_MUTED)
    c.drawString(_REPORT_MARGIN + 30 * mm, _REPORT_PAGE_H - 12.2 * mm, "STALE LISTINGS · FULL PROPERTY ASSESSMENT")
    c.setStrokeColor(_LETTER_CARD_BORDER)
    c.setLineWidth(0.75)
    c.line(_REPORT_MARGIN, _REPORT_PAGE_H - 17 * mm, _REPORT_PAGE_W - _REPORT_MARGIN, _REPORT_PAGE_H - 17 * mm)
    c.line(_REPORT_MARGIN, 14 * mm, _REPORT_PAGE_W - _REPORT_MARGIN, 14 * mm)
    c.setFont(_LETTER_FONT_REGULAR, 7)
    c.setFillColor(_LETTER_MUTED)
    c.drawString(_REPORT_MARGIN, 10 * mm, subject_address[:70])
    c.drawCentredString(_REPORT_PAGE_W / 2, 10 * mm, "Prepared by Havlo — heyhavlo.com")
    c.drawRightString(_REPORT_PAGE_W - _REPORT_MARGIN, 10 * mm, f"Page {doc.page}")
    c.restoreState()


def generate_full_report_pdf(prospect: StaleListingProspect) -> str:
    """Generate the multi-page Full Property Assessment PDF (the paid
    report's content — executive summary, saleability score, key findings,
    competition/comparable-sales tables, 30-day plan, full action plan) and
    return its absolute path. Always regenerates from the prospect's
    current report_json rather than caching to disk: unlike the letter
    (generate_letter_pdf, whose printed date must never change once a
    physical copy has been mailed), this has no such lock-in reason, and a
    report an admin has just edited should never serve a stale cached copy.
    """
    if _PDF_LIBS_IMPORT_ERROR:
        raise RuntimeError("Install reportlab to generate the full report PDF.") from _PDF_LIBS_IMPORT_ERROR

    styles = _report_styles()
    report = _safe_json(current_report_json(prospect))
    snapshot = _safe_json(prospect.listing_snapshot_json)
    address = address_with_full_postcode(prospect.property_address, prospect.postcode)

    output_dir = Path("generated") / "stale-full-reports"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"full-report-{prospect.property_code}.pdf"

    photo_bytes = _fetch_report_photo_bytesio(
        snapshot.get("image") or next(iter(snapshot.get("images") or []), None)
    )

    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=A4,
        leftMargin=_REPORT_MARGIN, rightMargin=_REPORT_MARGIN,
        topMargin=24 * mm, bottomMargin=18 * mm,
        title=f"Havlo Full Property Assessment — {prospect.property_code}", author="Havlo",
    )
    story: list = []

    # ── Cover / property summary ────────────────────────────────────────────
    story.append(Paragraph("Full Property Assessment", styles["h1"]))
    story.append(Paragraph(f"Prepared {datetime.now(timezone.utc):%d %B %Y}", styles["muted"]))
    story.append(Spacer(1, 12))

    img_flow = None
    if photo_bytes is not None:
        try:
            img_flow = RLImage(photo_bytes, width=52 * mm, height=36 * mm)
            img_flow.hAlign = "LEFT"
        except Exception:
            logger.warning("Could not decode listing photo for full-report PDF", exc_info=True)
            img_flow = None
    meta_line = " · ".join(filter(None, [
        prospect.postcode, prospect.property_type,
        f"{prospect.bedrooms} bed" if prospect.bedrooms else None,
        f"{prospect.bathrooms} bath" if prospect.bathrooms else None,
    ]))
    summary_cell = [
        Paragraph(_letter_esc(address), styles["addr"]),
        Spacer(1, 4),
        Paragraph(_letter_esc(meta_line), styles["meta"]),
        Spacer(1, 8),
        Paragraph(f'<font color="#A409D2" size="16"><b>{_report_money(prospect.asking_price)}</b></font>'
                   f'  <font color="#6B7280" size="9">asking</font>', styles["body_left"]),
        Spacer(1, 3),
        Paragraph(_letter_esc(f'{prospect.listing_duration_days if prospect.listing_duration_days is not None else "—"} days on market'), styles["meta"]),
    ]
    gauge_cell = [
        _ReportScoreGauge(report.get("overall_score", 0), w=100, radius=42),
        Spacer(1, 6),
        Paragraph(f'<font size="18"><b>{_letter_esc(report.get("overall_score", "—"))}</b></font>/100', styles["score_num"]),
        Paragraph("SALEABILITY SCORE", styles["score_lbl"]),
    ]
    header_table = Table(
        [[img_flow, summary_cell, gauge_cell]] if img_flow else [[summary_cell, gauge_cell]],
        colWidths=([58 * mm, _REPORT_CONTENT_W - 58 * mm - 42 * mm, 42 * mm] if img_flow
                   else [_REPORT_CONTENT_W - 42 * mm, 42 * mm]),
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 14))
    story.append(_report_hr())

    # ── Executive summary ───────────────────────────────────────────────────
    if report.get("executive_summary"):
        story.append(Paragraph("Executive summary", styles["h2"]))
        story.append(Paragraph(_letter_esc(report["executive_summary"]), styles["body"]))
        story.append(Spacer(1, 16))

    # ── Score breakdown ──────────────────────────────────────────────────────
    scores = report.get("scores") or {}
    score_labels = {
        "pricing": "Pricing", "listing_presentation": "Listing presentation",
        "market_positioning": "Market positioning", "competition": "Competition",
        "buyer_appeal": "Buyer appeal",
    }
    bars = []
    for key, label in score_labels.items():
        if key in scores:
            bars.append(_ReportScoreBar(label, scores[key], w=_REPORT_CONTENT_W - 24))
            bars.append(Spacer(1, 6))
    if bars:
        story.append(Paragraph("Saleability score breakdown", styles["h2"]))
        story.append(_report_card(bars))
        story.append(Spacer(1, 16))

    # ── Pricing recommendation callout ──────────────────────────────────────
    if report.get("pricing_recommendation_detail") or report.get("pricing_recommendation"):
        pricing_flow = [
            Paragraph("PRICING RECOMMENDATION", styles["callout_lbl"]), Spacer(1, 4),
            Paragraph(_letter_esc(report.get("pricing_recommendation", "")), styles["callout_body_bold"]), Spacer(1, 5),
            Paragraph(_letter_esc(report.get("pricing_recommendation_detail", "")), styles["callout_body"]),
        ]
        story.append(_report_card(pricing_flow, bg=_LETTER_INK, border=_LETTER_INK))
        story.append(Spacer(1, 16))

    # ── Key findings ─────────────────────────────────────────────────────────
    findings = report.get("key_findings") or []
    if findings:
        story.append(Paragraph("Key findings", styles["h2"]))
        for f in findings:
            inner_w = _REPORT_CONTENT_W - 24
            finding_flow = [
                _report_header_row(Paragraph(_letter_esc(f.get("title", "")), styles["h3"]),
                                    _report_type_pill(f.get("type", "issue")), inner_w),
                Spacer(1, 4),
                Paragraph(_letter_esc(f.get("description", "")), styles["body"]),
            ]
            for label, key, color_hex in (("EVIDENCE", "evidence", "A409D2"), ("IMPACT", "impact", "DE2921"),
                                           ("RECOMMEND", "recommend", "0E7D4C")):
                if f.get(key):
                    finding_flow += [
                        Spacer(1, 5), Paragraph(f'<font color="#{color_hex}"><b>{label}</b></font>', styles["body_left"]),
                        Paragraph(_letter_esc(f[key]), styles["muted"]),
                    ]
            story.append(KeepTogether(_report_card(finding_flow)))
            story.append(Spacer(1, 10))
        story.append(Spacer(1, 6))

    # ── Competition analysis ────────────────────────────────────────────────
    competitors = report.get("active_competition") or []
    if competitors:
        story.append(Paragraph("Competition analysis", styles["h2"]))
        story.append(Paragraph("Properties currently competing for the same buyers:", styles["muted"]))
        story.append(Spacer(1, 8))
        rows = [["Address", "Price", "Beds", "Distance", "Listed", "Edge"]]
        for comp in competitors:
            rows.append([
                comp.get("address", ""), comp.get("price", ""), str(comp.get("beds", "")),
                comp.get("distance", ""), f'{comp.get("days_listed", "")}d', comp.get("differentiator", ""),
            ])
        t = Table(rows, colWidths=[_REPORT_CONTENT_W * w for w in (0.32, 0.13, 0.08, 0.12, 0.1, 0.25)])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), _LETTER_FONT_BOLD), ("FONTSIZE", (0, 0), (-1, 0), 7.6),
            ("TEXTCOLOR", (0, 0), (-1, 0), _LETTER_MUTED), ("FONTNAME", (0, 1), (-1, -1), _LETTER_FONT_REGULAR),
            ("FONTSIZE", (0, 1), (-1, -1), 8.6), ("TEXTCOLOR", (0, 1), (-1, -1), _LETTER_INK),
            ("LINEBELOW", (0, 0), (-1, 0), 0.75, _LETTER_CARD_BORDER),
            ("LINEBELOW", (0, 1), (-1, -2), 0.5, colors.HexColor("#F0F0F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t)
        story.append(Spacer(1, 16))

    # ── Comparable sold prices ──────────────────────────────────────────────
    comps = report.get("comparable_sales") or []
    if comps:
        story.append(Paragraph("Comparable sold prices", styles["h2"]))
        rows = [["Address", "Beds", "Type", "Price"]]
        highlight_row = None
        for i, comp in enumerate(comps):
            if comp.get("is_subject"):
                highlight_row = i + 1
            rows.append([comp.get("address", ""), str(comp.get("beds", "")),
                         comp.get("property_type", ""), comp.get("sold_asking", "")])
        t = Table(rows, colWidths=[_REPORT_CONTENT_W * w for w in (0.46, 0.13, 0.2, 0.21)])
        tstyle = [
            ("FONTNAME", (0, 0), (-1, 0), _LETTER_FONT_BOLD), ("FONTSIZE", (0, 0), (-1, 0), 7.6),
            ("TEXTCOLOR", (0, 0), (-1, 0), _LETTER_MUTED), ("FONTNAME", (0, 1), (-1, -1), _LETTER_FONT_REGULAR),
            ("FONTSIZE", (0, 1), (-1, -1), 8.6), ("TEXTCOLOR", (0, 1), (-1, -1), _LETTER_INK),
            ("LINEBELOW", (0, 0), (-1, 0), 0.75, _LETTER_CARD_BORDER),
            ("LINEBELOW", (0, 1), (-1, -2), 0.5, colors.HexColor("#F0F0F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
        if highlight_row:
            tstyle += [("BACKGROUND", (0, highlight_row), (-1, highlight_row), _LETTER_ACCENT_PALE),
                       ("FONTNAME", (0, highlight_row), (-1, highlight_row), _LETTER_FONT_BOLD)]
        t.setStyle(TableStyle(tstyle))
        story.append(t)
        story.append(Paragraph("Highlighted row is the subject property.", styles["muted"]))
        story.append(Spacer(1, 16))

    if findings or competitors or comps:
        story.append(PageBreak())

    # ── 30-day plan ──────────────────────────────────────────────────────────
    plan = report.get("thirty_day_plan") or []
    if plan:
        story.append(Paragraph("30-day action plan", styles["h2"]))
        gutter = 8
        col_w = _REPORT_CONTENT_W / 2 - gutter
        week_cells = [
            _report_card([
                Paragraph(f"WEEK {_letter_esc(wk.get('week', ''))}", styles["week_num"]), Spacer(1, 3),
                Paragraph(_letter_esc(wk.get("title", "")), styles["week_title"]),
            ], pad=10, width=col_w)
            for wk in plan
        ]
        rows2 = [week_cells[i:i + 2] for i in range(0, len(week_cells), 2)]
        gt = Table(rows2, colWidths=[_REPORT_CONTENT_W / 2, _REPORT_CONTENT_W / 2])
        gt.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(gt)
        story.append(Spacer(1, 18))

    # ── Full action plan ────────────────────────────────────────────────────
    actions = report.get("action_plan") or []
    if actions:
        story.append(Paragraph("Recommended actions", styles["h2"]))
        for i, action in enumerate(actions, start=1):
            title_para = Paragraph(f"{i}. {_letter_esc(action.get('title', ''))}", styles["h3"])
            if action.get("priority"):
                action_flow = [_report_header_row(title_para, _report_priority_pill(action["priority"]), _REPORT_CONTENT_W - 24)]
            else:
                action_flow = [title_para]
            action_flow += [Spacer(1, 4)] + _report_multi_para(action.get("description", ""), styles["body"])
            if action.get("why_it_matters"):
                action_flow += [Spacer(1, 5),
                                 Paragraph(f'<i>Why it matters: {_letter_esc(action["why_it_matters"])}</i>', styles["muted"])]
            bullets = _report_dedupe_bullets(action.get("bullets"))
            if bullets:
                action_flow.append(Spacer(1, 6))
                action_flow += [Paragraph(f"•  {_letter_esc(b)}", styles["bullet"]) for b in bullets]
            story.append(KeepTogether(_report_card(action_flow)))
            story.append(Spacer(1, 10))

    story.append(Spacer(1, 10))
    story.append(_report_hr())
    story.append(Paragraph(
        "This assessment is generated from publicly available listing data and market signals. "
        "It is intended as guidance to support your property's sale and does not constitute formal "
        "valuation or financial advice.", styles["muted"]))

    def _on_page(c, d):
        _report_page_chrome(c, d, address)

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
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
