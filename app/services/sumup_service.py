"""SumUp Checkout API integration for dynamic payment links."""
import logging
import uuid
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

SUMUP_API_BASE = "https://api.sumup.com/v0.1"


async def create_checkout(
    amount: float,
    currency: str,
    description: str,
    reference: Optional[str] = None,
    redirect_url: Optional[str] = None,
) -> dict:
    """
    Create a SumUp checkout and return the full response dict.

    Returns a dict with at minimum:
        {
          "id": "<checkout_id>",
          "checkout_reference": "...",
          "amount": ...,
          "currency": "...",
          "checkout_url": "https://pay.sumup.com/..."   # if available
        }
    """
    settings = get_settings()

    if reference is None:
        reference = str(uuid.uuid4())

    payload: dict = {
        "checkout_reference": reference,
        "amount": round(amount, 2),
        "currency": currency.upper(),
        "merchant_code": settings.SUMUP_MERCHANT_CODE,
        "description": description,
    }
    if redirect_url:
        payload["redirect_url"] = redirect_url

    headers = {
        "Authorization": f"Bearer {settings.SUMUP_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{SUMUP_API_BASE}/checkouts",
            json=payload,
            headers=headers,
        )

    if response.status_code not in (200, 201):
        logger.error(
            "SumUp checkout creation failed: %s %s",
            response.status_code,
            response.text,
        )
        response.raise_for_status()

    data = response.json()
    # Build the checkout URL so the frontend can redirect users
    checkout_id = data.get("id", "")
    if checkout_id and "checkout_url" not in data:
        data["checkout_url"] = f"https://pay.sumup.com/b2c/{checkout_id}"

    logger.info("SumUp checkout created: %s", checkout_id)
    return data


async def get_checkout_status(checkout_id: str) -> dict:
    """Retrieve the current status of a SumUp checkout."""
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.SUMUP_API_KEY}",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{SUMUP_API_BASE}/checkouts/{checkout_id}",
            headers=headers,
        )
    response.raise_for_status()
    return response.json()
