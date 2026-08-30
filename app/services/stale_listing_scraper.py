"""Dedicated direct-Rightmove scraper for automated stale-listing letters.

This job is intentionally separate from the marketplace inventory scraper.
It searches Rightmove itself, oldest listings first, applies the stale-listing
filters, and keeps working until the cycle's delivery target is reached.
"""
from __future__ import annotations

import asyncio
import logging
import os

from app.services.scraper_base import run_once_with_advisory_lock
from app.services.stale_listing_discovery import (
    retry_pending_stale_prospect_emails,
    run_automatic_discovery_once,
)

logger = logging.getLogger(__name__)


def _positive_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


async def run_direct_stale_listing_cycle() -> dict:
    target = max(30, _positive_int("STALE_LISTINGS_TARGET_EMAILS", 30))
    retry_result = await retry_pending_stale_prospect_emails(target=target)
    remaining_target = max(0, target - retry_result["sent"])
    # Rightmove does not consistently honour its oldest-first sort flag. A
    # small page window therefore contains almost entirely new listings and
    # cannot reach the 180-day inventory. Search a broad, bounded window while
    # the discovery service handles detail requests concurrently.
    #
    # Floor raised 1200->4000: live cycle logs after the >=500k/houses-only
    # criteria (commit 7980352) show an eligible rate of roughly 0.1-0.3%
    # (e.g. 4 eligible out of 1218 scanned, 0 out of 1228 in the next cycle).
    # Almost every scanned candidate is rejected at the cheap preliminary
    # filter, before any detail fetch — a 1228-candidate, zero-eligible cycle
    # took ~3 minutes end to end. There's clear headroom to scan several
    # times more candidates per cycle without a proportionally longer cycle,
    # which — at this eligible rate — is the most direct lever left for
    # volume without loosening the price/property-type criteria itself.
    batch_candidates = max(4000, target * 40)
    batch_pages = max(25, (batch_candidates + 23) // 24)
    result = await run_automatic_discovery_once(
        target_emails=remaining_target,
        max_candidates=batch_candidates,
        max_pages_per_location=batch_pages,
    )
    result["emails_sent"] = retry_result["sent"] + int(result.get("emails_sent", 0) or 0)
    result["retry_attempted"] = retry_result["attempted"]
    result["retry_sent"] = retry_result["sent"]
    return result


async def start_stale_listing_scraper_loop() -> None:
    """Deliver at least the configured target of new prospect emails per cycle."""
    interval_seconds = 15 * 60
    initial_delay = _positive_int("STALE_LISTINGS_INITIAL_DELAY_SECONDS", 60)
    logger.info(
        "Dedicated stale-listing scraper started "
        "(initial delay=%ss, interval=900s, minimum target=30 emails).",
        initial_delay,
    )
    await asyncio.sleep(initial_delay)
    while True:
        try:
            result = await run_once_with_advisory_lock(
                "stale-listing-direct-scraper",
                run_direct_stale_listing_cycle,
            )
            created = int(result.get("emails_sent", 0) or 0)
            target = max(30, _positive_int("STALE_LISTINGS_TARGET_EMAILS", 30))
            if created < target:
                logger.error(
                    "Stale-listing email target missed: sent=%d target=%d "
                    "eligible=%s skipped=%s failed=%s. "
                    "The next cycle will continue searching.",
                    created,
                    target,
                    result.get("eligible"),
                    result.get("skipped"),
                    result.get("failed"),
                )
            else:
                logger.info("Stale-listing email target met: sent=%d target=%d.", created, target)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Dedicated stale-listing scraper cycle failed.")
        await asyncio.sleep(interval_seconds)