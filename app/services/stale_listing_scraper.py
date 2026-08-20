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
from app.services.stale_listing_discovery import run_automatic_discovery_once

logger = logging.getLogger(__name__)


def _positive_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


async def run_direct_stale_listing_cycle() -> dict:
    target = max(30, _positive_int("STALE_LISTINGS_TARGET_EMAILS", 30))
    # Keep one delivery cycle bounded.  Crawling hundreds of pages before
    # processing any qualifying listing lets the advisory lock stay occupied
    # for hours and prevents the 15-minute delivery target from being met.
    # Six candidates per target is enough headroom for normal stale-listing
    # hit rates while keeping the search phase short.
    batch_candidates = max(180, target * 6)
    batch_pages = max(8, (batch_candidates + 23) // 24)
    return await run_automatic_discovery_once(
        target_emails=target,
        max_candidates=batch_candidates,
        max_pages_per_location=batch_pages,
    )


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