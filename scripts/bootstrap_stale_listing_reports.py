from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys


ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.db.database import AsyncSessionLocal
from app.services.stale_listing_bootstrap import (  # noqa: E402
    DEFAULT_STALE_BOOTSTRAP_PLANS,
    bootstrap_stale_listing_assessments,
)


DEFAULT_LISTING_URL = (
    "https://www.rightmove.co.uk/properties/166317227"
    "?utm_campaign=property-details&utm_content=buying&utm_medium=sharing"
    "&utm_source=copytoclipboard#/&channel=RES_BUY"
)


async def _run(args: argparse.Namespace) -> list[dict]:
    async with AsyncSessionLocal() as db:
        return await bootstrap_stale_listing_assessments(
            db,
            listing_url=args.listing_url,
            customer_email=args.email,
            plans=args.plans,
            first_name=args.first_name,
            last_name=args.last_name,
            phone_country_code=args.phone_country_code,
            phone=args.phone,
            force=args.force,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create paid stale-listings production assessments and send agent review emails.",
    )
    parser.add_argument("--listing-url", default=DEFAULT_LISTING_URL)
    parser.add_argument("--email", default="vinovestige@yahoo.com")
    parser.add_argument("--first-name", default="Vino")
    parser.add_argument("--last-name", default="Vestige")
    parser.add_argument("--phone-country-code", default="+44")
    parser.add_argument("--phone", default="0000000000")
    parser.add_argument(
        "--plans",
        nargs="+",
        default=list(DEFAULT_STALE_BOOTSTRAP_PLANS),
        choices=list(DEFAULT_STALE_BOOTSTRAP_PLANS),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow another production bootstrap set for the same listing, email, and plans.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = asyncio.run(_run(args))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
