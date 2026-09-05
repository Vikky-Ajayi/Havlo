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
    # Clear the whole retry backlog each cycle rather than the ~30-per-cycle
    # `target` floor -- that floor is a "did we hit the minimum" alerting
    # threshold (used below), not a deliberate cap on retries. The 5000
    # ceiling here is just a sanity bound against a pathological runaway
    # query, not a real expected size.
    retry_result = await retry_pending_stale_prospect_emails(
        target=_positive_int("STALE_LISTINGS_RETRY_LIMIT", 5000)
    )
    # Rightmove does not consistently honour its oldest-first sort flag. A
    # small page window therefore contains almost entirely new listings and
    # cannot reach the 180-day inventory. Search a broad, bounded window while
    # the discovery service handles detail requests concurrently.
    #
    # STALE_LISTINGS_MAX_CANDIDATES / STALE_LISTINGS_MAX_PAGES_PER_LOCATION
    # override these scale-with-target defaults when set. Previously this
    # function always computed its own values and passed them explicitly to
    # run_automatic_discovery_once(), which only falls back to reading those
    # env vars itself when its max_candidates/max_pages_per_location
    # arguments are falsy (`x or _env_int(...)`) -- an explicit non-zero
    # value here meant that fallback never ran, so those two env vars were
    # silently dead no matter what they were set to. Confirmed live: raising
    # them on Railway had zero effect on the "Dedicated direct stale-listing
    # scrape starting" log line, which kept reporting the old computed
    # defaults after multiple redeploys.
    default_batch_candidates = max(1200, target * 40)
    batch_candidates = _positive_int("STALE_LISTINGS_MAX_CANDIDATES", default_batch_candidates)
    default_batch_pages = max(25, (batch_candidates + 23) // 24)
    batch_pages = _positive_int("STALE_LISTINGS_MAX_PAGES_PER_LOCATION", default_batch_pages)
    # target_emails=0 means "no cap" -- run_automatic_discovery_once's
    # _should_stop() only latches target_reached when target_emails is
    # truthy (`if state.params.target_emails and state.emails_sent >= ...`).
    # This used to be passed a ~30-email remaining_target, which meant every
    # 15-minute cycle stopped emailing as soon as it hit ~30 sends even when
    # max_candidates/max_pages_per_location (already raised well above that)
    # left thousands of unscanned, plausibly-eligible candidates on the
    # table. That was an undocumented daily throughput ceiling completely
    # independent of the Rightmove IP-block issue. There must be no cap on
    # emails/day: every eligible stale listing found in a cycle should be
    # emailed, not just the first ~30.
    result = await run_automatic_discovery_once(
        target_emails=0,
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