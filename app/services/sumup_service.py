"""
SumUp Checkout API integration for dynamic payment links.

Flow (used by bookings, sell_faster, sale_audit, buyer_network routers):
  1. Router calls `create_checkout(amount, currency, description, reference, redirect_url)`.
  2. We POST to https://api.sumup.com/v0.1/checkouts with:
        Authorization: Bearer <SUMUP_API_KEY>     (personal access token, e.g. sup_sk_...)
        body: { checkout_reference, amount, currency, merchant_code, description, redirect_url }
  3. SumUp returns a JSON object with TWO different identifiers:
       * `id`                 — internal UUID. Used to build the hosted payment
                                page URL: https://pay.sumup.com/b2c/{id}
                                AND for status polling via GET /v0.1/checkouts/{id}.
       * `checkout_reference` — the string we sent in the request. Used only
                                for our own tracking and deduplication.
     Using the checkout_reference in the b2c URL causes a 404. The `id` UUID
     is the correct value for the hosted payment page. We always synthesise
     `checkout_url` from the UUID if SumUp didn't include one in the response.
  4. After the user pays, the frontend polls the relevant /status endpoint, which
     calls `get_checkout_status(checkout_id)` -> GET /v0.1/checkouts/<id>. When
     `status == "PAID"` we mark the local DB record + Payment row as completed.

Common SumUp gotchas this module guards against:
  * Whitespace pasted into env values (we `.strip()` API key + merchant code).
  * Currency case (we `.upper()`).
  * Amount must be float w/ 2dp (we `round(amount, 2)`).
  * `id` vs `checkout_id` in response (we always read `id` for polling).
  * `id` (UUID) vs `checkout_reference` (string) — only the UUID works
    in the b2c hosted-page URL; using the reference causes a 404.
  * Missing checkout_url in response (we synthesise the b2c URL from the
    UUID, never the reference).

We deliberately raise a custom `SumUpError` containing the upstream status code +
response body so routers can surface a meaningful error to the user instead of a
generic "Payment gateway unavailable" message.
"""
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
    """Create a SumUp checkout and return the response dict (with `checkout_url`)."""
    settings = get_settings()
    merchant_code = (settings.SUMUP_MERCHANT_CODE or "").strip()
    if not merchant_code:
        raise SumUpError("SUMUP_MERCHANT_CODE is not configured.")

    if reference is None:
        reference = str(uuid.uuid4())

    payload: dict = {
        "checkout_reference": reference,
        "amount": round(float(amount), 2),
        "currency": currency.strip().upper(),
        "merchant_code": merchant_code,
        "description": description,
    }
    if redirect_url:
        payload["redirect_url"] = redirect_url.strip()

    logger.info(
        "SumUp create_checkout request reference=%s amount=%.2f currency=%s merchant=%s",
        reference,
        payload["amount"],
        payload["currency"],
        merchant_code,
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
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

    # `id` is the internal UUID — used ONLY for status polling.
    checkout_id = data.get("id") or ""
    if not checkout_id:
        logger.error(
            "SumUp create_checkout returned no id reference=%s body=%s", reference, data
        )
        raise SumUpError(
            "SumUp response missing 'id' field.",
            status_code=response.status_code,
            body=response.text,
        )

    # `checkout_reference` is echoed back in the response for our own tracking.
    checkout_reference = data.get("checkout_reference") or reference
    data["checkout_reference"] = checkout_reference

    # The hosted payment page URL uses the internal UUID (`id`), NOT the
    # checkout_reference. Using the reference causes a 404 on pay.sumup.com/b2c/.
    if not data.get("checkout_url"):
        data["checkout_url"] = f"{SUMUP_HOSTED_CHECKOUT}/{checkout_id}"

    logger.info(
        "SumUp checkout created reference=%s checkout_id=%s url=%s status=%s",
        checkout_reference,
        checkout_id,
        data["checkout_url"],
        data.get("status"),
    )
    return data


async def get_checkout_status(checkout_id: str) -> dict:
    """Retrieve the current status of a SumUp checkout by its id."""
    if not checkout_id:
        raise SumUpError("checkout_id is required")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{SUMUP_API_BASE}/checkouts/{checkout_id}",
                headers=_auth_headers(),
            )
    except httpx.HTTPError as exc:
        logger.error("SumUp status network error checkout_id=%s err=%s", checkout_id, exc)
        raise SumUpError(f"SumUp network error: {exc}") from exc

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
