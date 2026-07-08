"""Public website form submissions.

These endpoints are public (no auth) and are used by the marketing site for:
- Contact Us form
- Footer newsletter signup
- "Stop Property Marketing by Post" opt-out request

Each submission writes a row to the Google Sheet and (best-effort) emails the
admin address configured by ADMIN_NOTIFY_EMAIL. All side effects run in
FastAPI BackgroundTasks so the user-facing HTTP response is never blocked.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field

from app.services import google_sheets
from app.services.email_service import send_admin_notification_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/public", tags=["Public Forms"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class ContactFormPayload(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone_country_code: str = Field(default="", max_length=8)
    phone_number: str = Field(default="", max_length=40)
    country_of_residence: str = Field(default="", max_length=120)
    message: str = Field(default="", max_length=4000)
    source: Optional[str] = Field(default="", max_length=64)


class NewsletterPayload(BaseModel):
    email: EmailStr
    source: str = Field(default="footer", max_length=64)


class OptOutPayload(BaseModel):
    email: EmailStr
    notes: Optional[str] = Field(default="", max_length=500)


class OkResponse(BaseModel):
    ok: bool = True


# ── Background task helpers ─────────────────────────────────────────────────

def _bg_log_contact(payload: dict) -> None:
    source = (payload.get("source") or "").strip()
    try:
        if source == "buyabroad-uk":
            google_sheets.record_uk_buyer_enquiry(payload)
        elif source == "buyabroad-uk-agents":
            google_sheets.record_uk_agent_partner(payload)
        elif source == "buyabroad-uk-listings":
            google_sheets.record_uk_listing_consultation(payload)
        else:
            google_sheets.record_contact_form(payload)
    except Exception as exc:  # noqa: BLE001
        logger.error("Sheets log failed for Contact Form (source=%s): %s", source, exc)
    try:
        msg = payload.get("message", "") or ""
        # Parse the newline-separated message into a lookup dict
        msg_data: dict[str, str] = {}
        for line in msg.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                msg_data[k.strip()] = v.strip()

        name = f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip()
        email = payload.get("email", "") or "—"
        phone = f"{payload.get('phone_country_code', '')}{payload.get('phone_number', '')}".strip() or "—"
        country = payload.get("country_of_residence", "") or "—"

        if source == "buyabroad-uk":
            sheet_tab = "UK Buyer Enquiries"
            summary = "New UK property buyer enquiry submitted via the eligibility form."
            source_label = "buyabroad/uk — Eligibility Form"
            prop_url = ""
            fields = {
                "Name": name,
                "Email": email,
                "WhatsApp": msg_data.get("WhatsApp", phone),
                "Country": country,
                "Looking to buy": msg_data.get("Looking to buy", "—"),
                "Budget": msg_data.get("Approximate budget", "—"),
                "Timeline": msg_data.get("Timeline", "—"),
                "Outcome": msg_data.get("Outcome", "—"),
            }
        elif source == "buyabroad-uk-agents":
            sheet_tab = "UK Agent Partners"
            summary = "New agent/partner application submitted via /buyabroad/uk/agents."
            source_label = "buyabroad/uk/agents — Agent Application"
            prop_url = ""
            fields = {
                "Name": name,
                "Email": email,
                "WhatsApp": msg_data.get("WhatsApp", phone),
                "Country": country,
                "Address": msg_data.get("Address", "—"),
                "Company / Agency": msg_data.get("Real estate company / agency", "—"),
                "Website / Social": msg_data.get("Company website / social link", "—"),
                "Monthly referrals": msg_data.get("Clients they can refer monthly", "—"),
                "Min. client budget": msg_data.get("Minimum property price their clients can afford", "—"),
            }
        elif source == "buyabroad-uk-listings":
            sheet_tab = "UK Listing Consultations"
            summary = "New free consultation request submitted from a UK property listing."
            source_label = "buyabroad/uk/listings — Free Consultation"
            prop_url = msg_data.get("Havlo Property Page", "")
            fields = {
                "Name": name,
                "Email": email,
                "WhatsApp": msg_data.get("WhatsApp", phone),
                "Property": msg_data.get("Interested in property", "—"),
                "Address": msg_data.get("Address", "—"),
                "Price": msg_data.get("Price", "—"),
                "Bedrooms": msg_data.get("Bedrooms", "—"),
                "Rightmove URL": msg_data.get("Rightmove URL", "—"),
            }
        else:
            sheet_tab = "Contact Form"
            summary = "A new contact enquiry was just submitted on the website."
            source_label = ""
            prop_url = ""
            fields = {
                "Name": name,
                "Email": email,
                "Phone": phone,
                "Country": country,
                "Message": msg or "—",
            }
        send_admin_notification_sync(
            sheet_tab=sheet_tab,
            summary=summary,
            source_label=source_label,
            property_url=prop_url,
            fields=fields,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Admin notify failed for Contact Form (source=%s): %s", source, exc)


def _bg_log_newsletter(email: str, source: str) -> None:
    try:
        google_sheets.record_newsletter(email, source)
    except Exception as exc:  # noqa: BLE001
        logger.error("Sheets log failed for Newsletter: %s", exc)
    try:
        send_admin_notification_sync(
            sheet_tab="Newsletter",
            summary="Someone just joined the Havlo newsletter.",
            fields={"Email": email, "Source": source},
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Admin notify failed for Newsletter: %s", exc)


def _bg_log_opt_out(email: str, notes: str) -> None:
    try:
        google_sheets.record_marketing_opt_out(email, notes)
    except Exception as exc:  # noqa: BLE001
        logger.error("Sheets log failed for Marketing Opt-Out: %s", exc)
    try:
        send_admin_notification_sync(
            sheet_tab="Marketing Opt-Out",
            summary="A new marketing opt-out request was submitted.",
            fields={"Email": email, "Notes": notes or "—"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Admin notify failed for Marketing Opt-Out: %s", exc)


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/contact", response_model=OkResponse)
async def submit_contact_form(
    payload: ContactFormPayload,
    background_tasks: BackgroundTasks,
) -> OkResponse:
    background_tasks.add_task(_bg_log_contact, payload.model_dump())
    return OkResponse()


@router.post("/newsletter", response_model=OkResponse)
async def join_newsletter(
    payload: NewsletterPayload,
    background_tasks: BackgroundTasks,
) -> OkResponse:
    background_tasks.add_task(_bg_log_newsletter, payload.email, payload.source)
    return OkResponse()


@router.post("/marketing-opt-out", response_model=OkResponse)
async def marketing_opt_out(
    payload: OptOutPayload,
    background_tasks: BackgroundTasks,
) -> OkResponse:
    background_tasks.add_task(_bg_log_opt_out, payload.email, payload.notes or "")
    return OkResponse()
