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
    try:
        google_sheets.record_contact_form(payload)
    except Exception as exc:  # noqa: BLE001
        logger.error("Sheets log failed for Contact Form: %s", exc)
    try:
        send_admin_notification_sync(
            sheet_tab="Contact Form",
            summary="A new contact enquiry was just submitted on the website.",
            fields={
                "Name": f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip(),
                "Email": payload.get("email", ""),
                "Phone": f"{payload.get('phone_country_code', '')}{payload.get('phone_number', '')}".strip(),
                "Country": payload.get("country_of_residence", "") or "—",
                "Message": payload.get("message", "") or "—",
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Admin notify failed for Contact Form: %s", exc)


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
