"""Flutterwave Standard (hosted checkout) for the Buy Abroad consultation
deposit (app/routers/bookings.py, /bookings/buy-abroad/...).

create_payment returns the hosted payment link the buyer is sent to.
Flutterwave sends them back to redirect_url with ?status=&tx_ref=&
transaction_id=, but those query values are never trusted on their own:
verify_by_reference asks Flutterwave for the transaction, and only a
"successful" one for the right reference, amount and currency counts as
paid (payment_confirmed).

Settings: FLUTTERWAVE_SECRET_KEY (required), FLUTTERWAVE_WEBHOOK_HASH (the
"secret hash" set in the Flutterwave dashboard, for the webhook).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

FLUTTERWAVE_API_BASE = "https://api.flutterwave.com/v3"
FLUTTERWAVE_HTTP_TIMEOUT = httpx.Timeout(timeout=20.0, connect=8.0)


class FlutterwaveError(Exception):
    """A non-2xx response from Flutterwave, or the call failed."""

    def __init__(self, message: str, status_code: Optional[int] = None, body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def is_configured() -> bool:
    return bool((get_settings().FLUTTERWAVE_SECRET_KEY or "").strip())


def _headers() -> dict[str, str]:
    key = (get_settings().FLUTTERWAVE_SECRET_KEY or "").strip()
    if not key:
        raise FlutterwaveError("FLUTTERWAVE_SECRET_KEY is not configured.")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


async def _request(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=FLUTTERWAVE_HTTP_TIMEOUT) as client:
            response = await client.request(method, f"{FLUTTERWAVE_API_BASE}{path}", headers=_headers(), **kwargs)
    except httpx.HTTPError as exc:
        raise FlutterwaveError(f"Could not reach Flutterwave: {exc}") from exc
    if response.status_code >= 400:
        raise FlutterwaveError(
            f"Flutterwave returned {response.status_code}", status_code=response.status_code, body=response.text[:2000]
        )
    try:
        return response.json()
    except ValueError as exc:
        raise FlutterwaveError("Flutterwave returned a non-JSON response.", body=response.text[:2000]) from exc


async def create_payment(
    *,
    tx_ref: str,
    amount: float,
    currency: str,
    redirect_url: str,
    customer: dict[str, str],
    title: str,
    description: str,
    payment_options: str | None = None,
) -> str:
    """The hosted checkout link for a new payment."""
    body: dict[str, Any] = {
        "tx_ref": tx_ref,
        "amount": f"{amount:.2f}",
        "currency": currency,
        "redirect_url": redirect_url,
        "customer": customer,
        "customizations": {"title": title, "description": description},
    }
    if payment_options:
        body["payment_options"] = payment_options
    data = await _request("POST", "/payments", json=body)
    link = ((data.get("data") or {}).get("link") or "").strip()
    if data.get("status") != "success" or not link:
        raise FlutterwaveError("Flutterwave did not return a payment link.", body=str(data)[:2000])
    return link


async def verify_by_reference(tx_ref: str) -> dict[str, Any] | None:
    """Flutterwave's record of the transaction with this reference, or None
    if there isn't one (the buyer never paid)."""
    try:
        data = await _request("GET", "/transactions/verify_by_reference", params={"tx_ref": tx_ref})
    except FlutterwaveError as exc:
        if exc.status_code in (400, 404):
            return None
        raise
    return data.get("data") or None


def payment_confirmed(transaction: dict[str, Any] | None, *, tx_ref: str, amount: float, currency: str) -> bool:
    """A successful transaction for this reference, of at least this amount
    in this currency."""
    if not transaction:
        return False
    try:
        paid = float(transaction.get("amount") or 0)
    except (TypeError, ValueError):
        return False
    return (
        str(transaction.get("status") or "").lower() == "successful"
        and transaction.get("tx_ref") == tx_ref
        and str(transaction.get("currency") or "").upper() == currency.upper()
        and paid + 0.005 >= amount
    )
