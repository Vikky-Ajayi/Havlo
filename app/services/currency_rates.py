"""Cached FX helpers — convert local listing prices to GBP for display."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_FALLBACK_GBP_RATES: dict[str, float] = {
    "GBP": 1.0,
    "USD": 1.27,
    "AED": 4.65,
    "CAD": 1.72,
}

_cache: dict[str, Any] = {"rates": dict(_FALLBACK_GBP_RATES), "fetched_at": 0.0}


async def get_gbp_cross_rates() -> dict[str, float]:
    """Return how many units of each currency equal 1 GBP (e.g. USD=1.27)."""
    if time.time() - float(_cache["fetched_at"]) < 3600:
        return dict(_cache["rates"])
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://open.er-api.com/v6/latest/GBP")
            data = resp.json()
            rates = data.get("rates") or {}
            merged = dict(_FALLBACK_GBP_RATES)
            for code in ("USD", "AED", "CAD", "GBP"):
                if code in rates:
                    merged[code] = float(rates[code])
            _cache.update({"rates": merged, "fetched_at": time.time()})
            return merged
    except Exception as exc:
        logger.warning("FX rate fetch failed (%s); using fallbacks.", exc)
        return dict(_cache["rates"])


async def to_gbp(amount_native: int, currency: str) -> int:
    currency = (currency or "GBP").upper()
    if currency == "GBP" or amount_native <= 0:
        return max(0, int(amount_native))
    rates = await get_gbp_cross_rates()
    cross = rates.get(currency) or _FALLBACK_GBP_RATES.get(currency)
    if not cross:
        return max(0, int(amount_native))
    return max(0, int(round(amount_native / cross)))


# US dollars into another currency (e.g. the Buy Abroad deposit paid by
# Naira bank transfer). Live rates only: no fallback figure, because a
# stale rate would charge the wrong price. Cached for an hour.
_usd_cache: dict[str, Any] = {"rates": {}, "fetched_at": 0.0}


async def usd_rate(currency: str) -> float | None:
    """How many units of `currency` equal 1 USD, or None if no live rate."""
    currency = (currency or "").upper()
    if currency == "USD":
        return 1.0
    if time.time() - float(_usd_cache["fetched_at"]) >= 3600 or currency not in _usd_cache["rates"]:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get("https://open.er-api.com/v6/latest/USD")
                data = resp.json()
            rates = {k: float(v) for k, v in (data.get("rates") or {}).items() if isinstance(v, (int, float))}
            if data.get("result") == "success" and rates:
                _usd_cache.update({"rates": rates, "fetched_at": time.time()})
        except Exception as exc:  # noqa: BLE001
            logger.warning("USD FX rate fetch failed (%s).", exc)
    rate = _usd_cache["rates"].get(currency)
    return float(rate) if rate and rate > 0 else None
