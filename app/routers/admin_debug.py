"""
Admin diagnostics — gated by DEBUG_ENDPOINTS=true and X-Admin-Secret header.

GET /admin/debug/sumup
    Reports SumUp configuration health without leaking secrets:
      • API key + merchant code presence (length / value)
      • Live GET /v0.1/me to confirm the key is valid
      • Live POST to create a £0.01 test checkout, returning the full SumUp body

Set the env var DEBUG_ENDPOINTS=true to enable this router. In production keep it
disabled or behind ADMIN_SECRET.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, status

from app.config import get_settings
from app.services import sumup_service
from app.services.sumup_service import SumUpError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/debug", tags=["Admin Debug"])


def _require_admin(x_admin_secret: Optional[str]) -> None:
    settings = get_settings()
    if os.environ.get("DEBUG_ENDPOINTS", "").strip().lower() not in ("1", "true", "yes"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Debug endpoints disabled. Set DEBUG_ENDPOINTS=true to enable.",
        )
    if not settings.ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_SECRET is not configured on the server.",
        )
    if not x_admin_secret or x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Admin-Secret header.",
        )


@router.get("/sumup")
async def diagnose_sumup(
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
) -> dict:
    """End-to-end SumUp health check. Returns a structured report of every step."""
    _require_admin(x_admin_secret)

    settings = get_settings()
    api_key = (settings.SUMUP_API_KEY or "").strip()
    merchant = (settings.SUMUP_MERCHANT_CODE or "").strip()
    frontend = (settings.FRONTEND_URL or "").strip()

    report: dict = {
        "config": {
            "SUMUP_API_KEY": (
                f"SET (length={len(api_key)})" if api_key else "MISSING"
            ),
            "SUMUP_MERCHANT_CODE": (
                f"SET (value={merchant})" if merchant else "MISSING"
            ),
            "SESSION_FEE_AMOUNT": settings.SESSION_FEE_AMOUNT,
            "SESSION_FEE_CURRENCY": settings.SESSION_FEE_CURRENCY,
            "FRONTEND_URL": frontend or "MISSING",
            "FRONTEND_URL_https": frontend.startswith("https://") if frontend else False,
        },
        "verify_me": None,
        "test_checkout": None,
    }

    if not api_key or not merchant:
        report["error"] = "Missing SUMUP_API_KEY and/or SUMUP_MERCHANT_CODE — cannot run live checks."
        return report

    # 1. Verify credentials via /me
    try:
        report["verify_me"] = await sumup_service.verify_credentials()
    except SumUpError as exc:
        report["verify_me"] = {
            "ok": False,
            "status_code": exc.status_code,
            "body": exc.body or str(exc),
        }
        return report

    if not report["verify_me"]["ok"]:
        report["error"] = "GET /v0.1/me failed — API key likely invalid or lacks scopes."
        return report

    # 2. Try to create a £0.01 test checkout
    test_ref = f"DIAG-{uuid.uuid4().hex[:10].upper()}"
    try:
        checkout = await sumup_service.create_checkout(
            amount=0.01,
            currency="GBP",
            description="Havlo SumUp diagnostic check",
            reference=test_ref,
            redirect_url=(frontend or "https://example.com") + "/diagnostic",
        )
        report["test_checkout"] = {
            "ok": True,
            "reference": test_ref,
            "checkout_id": checkout.get("id"),
            "checkout_reference": checkout.get("checkout_reference"),
            "checkout_url": checkout.get("checkout_url"),
            "checkout_url_correct": test_ref in str(checkout.get("checkout_url", "")),
            "raw": checkout,
        }
    except SumUpError as exc:
        report["test_checkout"] = {
            "ok": False,
            "reference": test_ref,
            "status_code": exc.status_code,
            "body": exc.body or str(exc),
        }

    return report


@router.get("/sumup-full")
async def diagnose_sumup_full(
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
) -> dict:
    """Deep SumUp diagnostic with /me check and full checkout response payload."""
    _require_admin(x_admin_secret)
    settings = get_settings()
    api_key = (settings.SUMUP_API_KEY or "").strip()
    merchant_code = (settings.SUMUP_MERCHANT_CODE or "").strip()

    report: dict = {
        "merchant_code": merchant_code,
        "api_key_length": len(api_key),
        "me_status": None,
        "me_body": None,
        "checkout_status": None,
        "checkout_full_response": None,
        "checkout_response_keys": [],
    }

    if not api_key or not merchant_code:
        report["error"] = "Missing SUMUP_API_KEY and/or SUMUP_MERCHANT_CODE."
        return report

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        me_response = await client.get("https://api.sumup.com/v0.1/me", headers=headers)
    report["me_status"] = me_response.status_code
    report["me_body"] = (
        me_response.json()
        if me_response.headers.get("content-type", "").startswith("application/json")
        else me_response.text
    )

    if me_response.status_code != 200:
        return report

    test_ref = f"HAVLO-TEST-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "checkout_reference": test_ref,
        "amount": 1.00,
        "currency": "GBP",
        "merchant_code": merchant_code,
        "description": "Diagnostic test",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        checkout_response = await client.post(
            "https://api.sumup.com/v0.1/checkouts",
            json=payload,
            headers=headers,
        )
    report["checkout_status"] = checkout_response.status_code
    if checkout_response.status_code in (200, 201):
        checkout_json = checkout_response.json()
        report["checkout_full_response"] = checkout_json
        report["checkout_response_keys"] = list(checkout_json.keys())
    else:
        report["checkout_full_response"] = checkout_response.text

    return report
