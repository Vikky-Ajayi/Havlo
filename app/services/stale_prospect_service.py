"""Helpers for automated Stale Listings prospect letters and unlock flow."""
from __future__ import annotations

import base64
import asyncio
import hashlib
import json
import os
import random
import re
import secrets
from io import BytesIO
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.models import RightmoveListing, StaleListingProspect
from app.services.groq_service import generate_stale_listing_report


def create_access_token() -> str:
    return secrets.token_urlsafe(32)


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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

    preview_url = f"{public_base_url.rstrip('/')}/stale-listings/prospect/{token}"
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
        "listing_snapshot": _safe_json(prospect.listing_snapshot_json),
        "preview": _safe_json(prospect.preview_json),
        "payment_status": prospect.payment_status,
        "is_unlocked": prospect.payment_status == "completed",
    }


def serialize_report(prospect: StaleListingProspect) -> dict[str, Any]:
    return {
        "prospect_id": str(prospect.id),
        "property_code": prospect.property_code,
        "property_address": prospect.property_address,
        "rightmove_url": prospect.rightmove_url,
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
    )


def generate_letter_pdf(prospect: StaleListingProspect, token: str, public_base_url: str) -> str:
    """Generate the printable homeowner letter PDF and return its absolute path."""
    try:
        import qrcode
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
        from reportlab.platypus import Paragraph
        from reportlab.pdfgen import canvas
    except ImportError as exc:  # pragma: no cover - depends on deployment image
        raise RuntimeError("Install reportlab and qrcode to generate prospect letters.") from exc

    output_dir = Path("generated") / "stale-prospect-letters"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"stale-listing-{prospect.property_code}.pdf"
    preview_url = f"{public_base_url.rstrip('/')}/stale-listings/prospect/{token}"

    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(preview_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_buffer = BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    page = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    margin = 18 * mm
    ink = colors.HexColor("#121212")
    muted = colors.HexColor("#5b6470")
    accent = colors.HexColor("#A800D6")
    pale = colors.HexColor("#F4F3F4")

    def para(text: str, x: float, y: float, w: float, style: ParagraphStyle) -> float:
        p = Paragraph(text, style)
        _, h = p.wrap(w, 120 * mm)
        p.drawOn(page, x, y - h)
        return y - h

    body_style = ParagraphStyle("Body", fontName="Helvetica", fontSize=9.2, leading=12.4, textColor=ink)
    headline_style = ParagraphStyle("Headline", fontName="Helvetica-Bold", fontSize=17.5, leading=20, textColor=accent)
    subhead_style = ParagraphStyle("Subhead", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=ink)

    # The two supplied artwork files are the actual direct-mail background
    # assets, not decorative approximations.  Keep them optional so older
    # deployments can still create a letter if assets are not present.
    pattern_path = Path("attached_assets/IMG_7099_1787157339060.png")
    globe_path = Path("attached_assets/IMG_7100_1787157339060.png")
    if pattern_path.is_file():
        page.drawImage(str(pattern_path), 0, 0, width=width, height=height, mask="auto")
    else:
        page.setFillColor(colors.white)
        page.rect(0, 0, width, height, fill=1, stroke=0)
    if globe_path.is_file():
        page.drawImage(str(globe_path), width - 92 * mm, height - 47 * mm, width=92 * mm, height=42 * mm, mask="auto")

    logo_path = Path("havlo_frontend/Havlo Black Transparent.png")
    if logo_path.is_file():
        page.drawImage(str(logo_path), margin, height - 26 * mm, width=35 * mm, height=8.2 * mm, mask="auto", preserveAspectRatio=True)
    else:
        page.setFillColor(ink)
        page.setFont("Helvetica-Bold", 20)
        page.drawString(margin, height - 23 * mm, "HAVLO")
    page.setFillColor(colors.white)
    for label, y_button in (("Relaunch", height - 15 * mm), ("Reach Buyers", height - 27 * mm), ("Sell Faster", height - 39 * mm)):
        page.setFillColor(accent)
        page.rect(width - 66 * mm, y_button - 4.5 * mm, 57 * mm, 9 * mm, fill=1, stroke=0)
        page.setFillColor(colors.white)
        page.setFont("Helvetica-Bold", 11)
        page.drawRightString(width - 11 * mm, y_button - 1.8 * mm, label)

    # Address block, matching the reference's postal-letter position.
    y = height - 50 * mm
    address_lines = [part.strip() for part in re.split(r",|\n", prospect.property_address) if part.strip()]
    page.setFont("Helvetica-Bold", 8.5)
    page.setFillColor(ink)
    for line in address_lines[:5]:
        page.drawString(margin, y, line.upper()[:64])
        y -= 4.4 * mm

    y -= 14 * mm
    y = para("6+ Months on the Market? There Is a Faster Way to Sell", margin, y, width - (2 * margin), headline_style)
    y -= 3 * mm
    days = prospect.listing_duration_days or 180
    price = f"GBP {prospect.asking_price:,.0f}" if prospect.asking_price else "your current asking price"
    intro = (
        f"We have reviewed the online listing for <b>{prospect.property_address}</b>. "
        f"It appears to have been marketed for around <b>{days} days</b> at <b>{price}</b>, "
        "which usually means the issue is not demand alone. More often, it is presentation, positioning, "
        "pricing signals, portal visibility, or the way the listing is being relaunched to buyers. "
        "Once that initial surge of interest fades, enquiries slow — and the property starts to get overlooked."
    )
    y = para(intro, margin, y, width - (2 * margin), body_style)
    y -= 4 * mm
    y = para("We actively promote your property to qualified UK and international buyers — creating fresh, serious demand and generating enquiries from buyers ready to proceed, without disrupting your current sale process.", margin, y, width - (2 * margin), body_style)
    y -= 2 * mm
    y = para("• You keep full control<br/>• We don't interfere with your agent<br/>• All enquiries go directly to you or your agent<br/>All we need is a link to your current listing.", margin, y, width - (2 * margin), body_style)
    y -= 2 * mm
    y = para("This is a structured marketing programme designed to maximise your property's exposure:<br/>• A one-time setup fee<br/>• Ongoing monthly management<br/>• A dedicated advertising budget<br/>Most clients agree a sale within 4–12 weeks of launching.", margin, y, width - (2 * margin), body_style)
    y -= 2 * mm
    y = para("If you're not ready for a full relaunch, we also offer a <b>Property Sale Audit</b> — a clear breakdown of why your property hasn't sold and what's holding it back.", margin, y, width - (2 * margin), body_style)
    y -= 2 * mm
    y = para("To get started:<br/>• Visit: www.heyhavlo.com<br/>• Or scan the QR code<br/>• Or speak to our team for a no-obligation call", margin, y, width - (2 * margin), body_style)
    y -= 2 * mm
    page.drawImage(ImageReader(qr_buffer), width / 2 - 16 * mm, y - 32 * mm, 32 * mm, 32 * mm)
    page.setFillColor(ink)
    page.setFont("Helvetica", 6.8)
    page.drawCentredString(width / 2, y - 35 * mm, "Scan above for Stale Listings (Havlo's Sell Faster Programme)")
    page.drawCentredString(width / 2, y - 39 * mm, "or visit www.heyhavlo.com/stale-listings")
    page.setFillColor(ink)
    page.setFont("Helvetica-Bold", 8.5)
    page.drawString(margin, y - 52 * mm, "Kind regards,")
    page.drawString(margin, y - 57 * mm, "Cathy Elwell")
    page.setFont("Helvetica", 7.5)
    page.drawString(margin, y - 61 * mm, "Property Marketing Director")

    page.setStrokeColor(colors.HexColor("#D7D7D7"))
    page.line(margin, 25 * mm, width - margin, 25 * mm)
    page.setFillColor(muted)
    page.setFont("Helvetica", 7)
    page.drawRightString(width - margin, 18 * mm, "www.heyhavlo.com")
    page.drawCentredString(width / 2, 14 * mm, "2nd Floor, Berkeley Square, London, England, W1J 6BD")
    page.drawCentredString(width / 2, 10 * mm, "Phone: 0333 339 0423, 0791 948 3480")
    page.drawCentredString(width / 2, 6 * mm, "Email: hello@heyhavlo.com")
    page.setFont("Helvetica", 5.3)
    page.drawCentredString(width / 2, 2.5 * mm, "Havlo is a trading style of Sprint Technologies Ltd, registered in England and Wales (Company No. 14949095).")
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
