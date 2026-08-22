"""One-off cleanup: Canada listings now come from realtor.ca, not Rightmove.

`rightmove_overseas_scraper.py` no longer scrapes Canada (see its COUNTRIES
tuple) and `realtor_ca_scraper.py` is now scheduled instead — but rows it
already wrote (country="canada", source="rightmove") are still sitting in
the database and would keep showing up on the listings page mixed in with
real realtor.ca data, since the public API only filters by `country`, not
`source`.

This soft-deactivates those old rows (`is_active = False`, same flag every
other listing query already respects) rather than deleting them, so the
change is easy to undo if needed. Realtor.ca listings for Canada are
untouched.

Run from the project root:

    python scripts/deactivate_rightmove_canada_listings.py [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update

from app.db.database import AsyncSessionLocal
from app.models.models import RightmoveListing


async def deactivate(*, dry_run: bool) -> int:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(RightmoveListing).where(
                RightmoveListing.country == "canada",
                RightmoveListing.source == "rightmove",
                RightmoveListing.is_active.is_(True),
            )
        )
        rows = result.scalars().all()
        if dry_run:
            for row in rows:
                print(f"[DRY-RUN] would deactivate {row.rightmove_id} | {row.title} | {row.url}")
            return len(rows)

        if not rows:
            return 0

        await db.execute(
            update(RightmoveListing)
            .where(
                RightmoveListing.country == "canada",
                RightmoveListing.source == "rightmove",
                RightmoveListing.is_active.is_(True),
            )
            .values(is_active=False)
        )
        await db.commit()
        return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    count = asyncio.run(deactivate(dry_run=args.dry_run))
    verb = "Would deactivate" if args.dry_run else "Deactivated"
    print(f"{verb} {count} Rightmove-sourced Canada listing(s).")


if __name__ == "__main__":
    main()
