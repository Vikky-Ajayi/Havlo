#!/usr/bin/env python3
"""Bulk scrape script — run once to push listings from 2.5k → 15k+.

Usage:
    python scripts/bulk_scrape.py

Runs 3 full scrape passes over all 40 cities with a short pause between
each pass so Rightmove sees different-looking traffic. Expect ~45-90 min.
"""
from __future__ import annotations

import asyncio
import os
import sys

# Allow running from the project root without installing the package.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Ensure .env is loaded before any app imports
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from app.services.rightmove_scraper import scrape_all, CITIES  # noqa: E402


async def main() -> None:
    print(f"Bulk scrape starting — {len(CITIES)} cities, up to 10 pages each.")
    print("Expected yield per pass: ~9,600 unique listings (ceiling).\n")

    grand_total = 0

    for run in range(1, 4):
        print(f"{'=' * 50}")
        print(f"Pass {run} / 3")
        print(f"{'=' * 50}")
        results = await scrape_all()
        pass_total = sum(results.values())
        grand_total += pass_total
        print(f"\nPass {run} complete — {pass_total} new rows inserted.")
        print(f"Running total: {grand_total} new listings this session.\n")

        if run < 3:
            wait = 180
            print(f"Cooling down {wait}s before next pass …")
            await asyncio.sleep(wait)

    print(f"\n{'=' * 50}")
    print(f"Bulk scrape finished. {grand_total} net-new rows added this session.")
    print("Existing rows were refreshed (price / images updated) in place.")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
