"""The list for Meta's "left their details but didn't buy" custom audience
(the marketing team, Nov 2026): so Meta stops spending on people who've
already been through and puts the budget into new sellers.

Everyone who left their details on one of our seller pages
(ads_funnel.SELLER_SOURCES) and hasn't bought. Left out: anyone who has
bought (any of their properties, by email or phone, promo-code customers
too), internal addresses (TEST_ORDER_EMAILS), and anyone who unsubscribed
from our emails or texts. One row per person, in the columns Meta's customer
list upload reads (email, phone, fn, ln, country); Meta hashes them itself on
upload. Admin only (the console's Stats tab).

And the buyers (buyers()): every homeowner who has bought a report, on any
page, promo-code customers included, so Meta keeps them out of the ads for
new customers too. Same columns, same people left out (internal addresses,
anyone unsubscribed).
"""
from __future__ import annotations

import csv
import io
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import StaleListingProspect
from app.services import ads_funnel, attribution

COLUMNS = ["email", "phone", "fn", "ln", "country"]


def _phone(raw: str | None) -> str:
    from app.services.twilio_service import normalize_to_e164

    return normalize_to_e164(raw or "").lstrip("+")


def _email(raw: str | None) -> str:
    email = (raw or "").strip().lower()
    return email if "@" in email else ""


def _row(p: Any, email: str, phone: str) -> dict[str, str]:
    parts = (p.contact_name or "").strip().split()
    return {"email": email, "phone": phone, "fn": parts[0] if parts else "", "ln": " ".join(parts[1:]),
            "country": "GB" if (p.country or "UK") == "UK" else p.country.lower()}


def pick_buyers(rows: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for p in rows:
        email, phone = _email(p.contact_email), _phone(p.contact_phone)
        if p.payment_status != "completed" or (not email and not phone):
            continue
        if attribution.internal_email(email) or p.unsubscribed_at or p.sms_unsubscribed_at:
            continue
        key = email or phone
        if key in seen:
            continue
        seen.add(key)
        out.append(_row(p, email, phone))
    return out


def pick(rows: list[Any]) -> list[dict[str, str]]:
    """The audience from every seller-page prospect with contact details."""
    bought_emails: set[str] = set()
    bought_phones: set[str] = set()
    for p in rows:
        if p.payment_status == "completed":
            if _email(p.contact_email):
                bought_emails.add(_email(p.contact_email))
            if _phone(p.contact_phone):
                bought_phones.add(_phone(p.contact_phone))

    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for p in rows:
        email, phone = _email(p.contact_email), _phone(p.contact_phone)
        if not email and not phone:
            continue
        if p.payment_status == "completed" or email in bought_emails or (phone and phone in bought_phones):
            continue
        if attribution.internal_email(email) or p.unsubscribed_at or p.sms_unsubscribed_at:
            continue
        key = email or phone
        if key in seen:
            continue
        seen.add(key)
        out.append(_row(p, email, phone))
    return out


async def rows(db: AsyncSession) -> list[dict[str, str]]:
    P = StaleListingProspect
    found = (await db.execute(
        select(P.contact_email, P.contact_phone, P.contact_name, P.payment_status, P.unsubscribed_at,
               P.sms_unsubscribed_at, P.country)
        .where(P.lead_source.in_(ads_funnel.SELLER_SOURCES), P.audience == "owner",
               P.parent_prospect_id.is_(None))
    )).all()
    return pick(list(found))


async def buyers(db: AsyncSession) -> list[dict[str, str]]:
    P = StaleListingProspect
    found = (await db.execute(
        select(P.contact_email, P.contact_phone, P.contact_name, P.payment_status, P.unsubscribed_at,
               P.sms_unsubscribed_at, P.country)
        .where(P.audience == "owner", P.payment_status == "completed")
    )).all()
    return pick_buyers(list(found))


def to_csv(audience: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=COLUMNS)
    writer.writeheader()
    writer.writerows(audience)
    return buffer.getvalue()
