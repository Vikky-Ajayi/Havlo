"""SumUp Checkout API integration."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

SUMUP_API_BASE = "https://api.sumup.com/v0.1"
SUMUP_HOSTED_CHECKOUT = "https://pay.sumup.com/b2c"


class SumUpError(Exception):
    """Raised when SumUp returns a non-2xx response or the network call fails."""

    def __init__(self, message: str, status_code: Optional[int] = None, body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _auth_headers() -> dict:
    settings = get_settings()
    api_key = (settings.SUMUP_API_KEY or "").strip()
    if not api_key:
        raise SumUpError("SUMUP_API_KEY is not configured.")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def create_checkout(
    amount: float,
    currency: str,
    description: str,
    reference: Optional[str] = None,
    redirect_url: Optional[str] = None,
) -> dict:
    """Create SumUp checkout and return polling id + hosted checkout URL."""
    settings = get_settings()
    merchant_code = (settings.SUMUP_MERCHANT_CODE or "").strip()
    if not merchant_code:
        raise SumUpError("SUMUP_MERCHANT_CODE is not configured.")

    if reference is None:
        reference = f"HAVLO-{uuid.uuid4().hex[:16].upper()}"

    amount_num = round(float(amount), 2)
    currency_code = currency.strip().upper()
    redirect = redirect_url.strip() if redirect_url else None

    logger.info(
        "SumUp checkout requested ref=%s amount=%.2f currency=%s",
        reference,
        amount_num,
        currency_code,
    )

    payload: dict = {
        "checkout_reference": reference,
        "amount": amount_num,
        "currency": currency_code,
        "merchant_code": merchant_code,
        "description": description,
    }
    if redirect:
        payload["redirect_url"] = redirect

    try:
        logger.info("SumUp API call POST %s/checkouts", SUMUP_API_BASE)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{SUMUP_API_BASE}/checkouts",
                json=payload,
                headers=_auth_headers(),
            )
    except httpx.HTTPError as exc:
        logger.error("SumUp network error reference=%s err=%s", reference, exc)
        raise SumUpError(f"SumUp network error: {exc}") from exc

    if response.status_code not in (200, 201):
        logger.error(
            "SumUp create_checkout failed reference=%s status=%s body=%s",
            reference,
            response.status_code,
            response.text,
        )
        raise SumUpError(
            f"SumUp returned {response.status_code}",
            status_code=response.status_code,
            body=response.text,
        )

    data = response.json()
    logger.info("SumUp create_checkout response body=%s", data)

    internal_id = data.get("id") or ""
    if not internal_id:
        raise SumUpError(
            "SumUp response missing 'id' field.",
            status_code=response.status_code,
            body=response.text,
        )
    checkout_reference = data.get("checkout_reference") or reference
    checkout_url = f"{SUMUP_HOSTED_CHECKOUT}/{checkout_reference}"

    logger.info(
        "SumUp checkout created id=%s ref=%s url=%s status=%s",
        internal_id,
        checkout_reference,
        checkout_url,
        data.get("status"),
    )
    return {
        "id": internal_id,
        "checkout_reference": checkout_reference,
        "checkout_url": checkout_url,
        "amount": data.get("amount", amount_num),
        "currency": data.get("currency", currency_code),
        "status": data.get("status", "PENDING"),
    }


async def get_checkout_status(checkout_id: str) -> dict:
    """Poll SumUp checkout status by internal UUID id."""
    if not checkout_id:
        raise SumUpError("checkout_id is required")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{SUMUP_API_BASE}/checkouts/{checkout_id}",
                headers=_auth_headers(),
            )
    except httpx.HTTPError as exc:
        logger.error("SumUp status network error checkout_id=%s err=%s", checkout_id, exc)
        raise SumUpError(f"SumUp network error: {exc}") from exc

    logger.info(
        "SumUp status poll checkout_id=%s status_code=%s",
        checkout_id,
        response.status_code,
    )
    if response.status_code == 404:
        raise SumUpError(
            "Checkout not found",
            status_code=response.status_code,
            body=response.text,
        )
    if response.status_code != 200:
        logger.error(
            "SumUp status failed checkout_id=%s status=%s body=%s",
            checkout_id,
            response.status_code,
            response.text,
        )
        raise SumUpError(
            f"SumUp returned {response.status_code}",
            status_code=response.status_code,
            body=response.text,
        )
    data = response.json()
    logger.info(
        "SumUp checkout status checkout_id=%s status=%s",
        checkout_id,
        data.get("status"),
    )
    return data


async def verify_credentials() -> dict:
    """Call GET /v0.1/me to verify the API key is valid. Returns the parsed body."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{SUMUP_API_BASE}/me",
                headers=_auth_headers(),
            )
    except httpx.HTTPError as exc:
        raise SumUpError(f"SumUp network error: {exc}") from exc

    return {
        "status_code": response.status_code,
        "ok": response.status_code == 200,
        "body": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
    }
