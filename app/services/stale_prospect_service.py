"""Helpers for automated Stale Listings prospect letters and unlock flow."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import random
import re
import secrets
from io import BytesIO
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
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
            select(StaleListingProspect.id).where(StaleListingProspect.property_code == code)
        )
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError("Could not allocate a unique property code.")


def is_specific_address(address: str) -> bool:
    text = (address or "").strip()
    vague_terms = ("area", "near", "close to", "within", "surrounding", "undisclosed")
    return len(text) >= 12 and bool(re.search(r"\d", text)) and not any(term in text.lower() for term in vague_terms)


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
    )


def generate_letter_pdf(prospect: StaleListingProspect, token: str, public_base_url: str) -> str:
    """Generate the printable homeowner letter PDF and return its absolute path."""
    try:
        import qrcode
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
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
    margin = 22 * mm
    purple = colors.HexColor("#a900d6")

    page.setFont("Helvetica-Bold", 22)
    page.drawString(margin, height - 34 * mm, "StaleListings")
    page.setFont("Helvetica", 8)
    page.drawString(margin + 45 * mm, height - 34 * mm, "By HAVLO")

    page.setFillColor(purple)
    page.roundRect(margin, height - 58 * mm, 74 * mm, 10 * mm, 5 * mm, fill=1, stroke=0)
    page.setFillColor(colors.white)
    page.setFont("Helvetica-Bold", 11)
    page.drawCentredString(margin + 37 * mm, height - 51.5 * mm, f"Property ID: {prospect.property_code}")

    page.setFillColor(colors.black)
    page.setFont("Helvetica-Bold", 20)
    page.drawString(margin, height - 82 * mm, "We reviewed your property listing.")
    page.setFont("Helvetica", 11)
    text = page.beginText(margin, height - 96 * mm)
    text.setLeading(17)
    lines = [
        f"Property: {prospect.property_address}",
        "",
        "Your home appears to have been on the market for a prolonged period, so Havlo has",
        "prepared an initial listing assessment showing possible visibility, pricing,",
        "presentation and marketing issues that may be slowing buyer interest.",
        "",
        "Scan the QR code or visit the page below to view your free preview. Use the",
        "property ID above if you enter the website manually.",
    ]
    for line in lines:
        text.textLine(line)
    page.drawText(text)

    page.drawImage(ImageReader(qr_buffer), margin, height - 170 * mm, 38 * mm, 38 * mm)
    page.setFont("Helvetica-Bold", 12)
    page.drawString(margin + 48 * mm, height - 142 * mm, "Scan to view your assessment")
    page.setFont("Helvetica", 9)
    page.drawString(margin + 48 * mm, height - 150 * mm, preview_url[:90])

    page.setStrokeColor(colors.HexColor("#eeeeee"))
    page.line(margin, 36 * mm, width - margin, 36 * mm)
    page.setFont("Helvetica", 9)
    page.setFillColor(colors.HexColor("#555555"))
    page.drawString(margin, 27 * mm, "Havlo Ltd. This letter is informational and does not replace estate-agent advice.")
    page.save()
    return os.path.abspath(pdf_path)


def attachment_from_file(path: str) -> dict[str, str]:
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return {"filename": Path(path).name, "content": encoded}
