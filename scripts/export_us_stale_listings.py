"""Export stale US for-sale listings to a CSV, from RentCast's listings API.

Licensed data for the America stale-prospects pipeline: active sale listings
at or above a price, on the market at least N days, with the listing agent
and office. RentCast returns up to 500 listings per request.

Setup: create a RentCast account (the free tier gives 50 requests a month),
copy the API key from https://app.rentcast.io/app/api, and put it in .env:

    RENTCAST_API_KEY=...

Examples:
    # Every $500k+ listing that's been on the market 180+ days, largest
    # states first, until 2,000 are found:
    python scripts/export_us_stale_listings.py

    # Weekly run: only listings that crossed 180 days in the last week
    python scripts/export_us_stale_listings.py --weekly

    # A few states, a small test on the free tier
    python scripts/export_us_stale_listings.py --states CA,FL --target 200 --max-requests 5
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any

import httpx

API_URL = "https://api.rentcast.io/v1/listings/sale"
PAGE_SIZE = 500  # RentCast's maximum per request
# Roughly largest housing markets first, so a capped run covers the most ground.
STATES = (
    "CA,TX,FL,NY,PA,IL,OH,GA,NC,MI,NJ,VA,WA,AZ,MA,TN,IN,MD,MO,WI,CO,MN,SC,AL,LA,KY,OR,OK,CT,UT,"
    "IA,NV,AR,MS,KS,NM,NE,ID,WV,HI,NH,ME,MT,RI,DE,SD,ND,AK,DC,VT,WY"
).split(",")
DEFAULT_TYPES = "Single Family|Condo|Townhouse|Multi-Family"
COLUMNS = [
    "address", "city", "state", "zip_code", "county", "price", "days_on_market", "listed_date",
    "times_listed", "previous_listing_price", "property_type", "bedrooms", "bathrooms",
    "square_footage", "lot_size", "year_built", "hoa_fee", "agent_name", "agent_phone",
    "agent_email", "office_name", "office_phone", "office_email", "mls_name", "mls_number",
    "last_seen", "rentcast_id",
]


def load_api_key() -> str:
    key = os.environ.get("RENTCAST_API_KEY", "").strip()
    if not key:
        env = Path(__file__).resolve().parent.parent / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.strip().startswith("RENTCAST_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("RENTCAST_API_KEY isn't set (in the environment or .env). See the top of this file.")
    return key


def listing_row(item: dict[str, Any]) -> dict[str, Any]:
    agent = item.get("listingAgent") or {}
    office = item.get("listingOffice") or {}
    listed = (item.get("listedDate") or "")[:10]
    # history: {"YYYY-MM-DD": {event, price, listedDate, ...}}, one entry per
    # listing period. More than one sale listing means it's been relisted.
    periods = sorted(
        (entry for entry in (item.get("history") or {}).values()
         if isinstance(entry, dict) and entry.get("event") == "Sale Listing"),
        key=lambda entry: entry.get("listedDate") or "",
    )
    earlier = [p for p in periods if (p.get("listedDate") or "")[:10] != listed]
    return {
        "address": item.get("formattedAddress") or item.get("addressLine1") or "",
        "city": item.get("city") or "",
        "state": item.get("state") or "",
        "zip_code": item.get("zipCode") or "",
        "county": item.get("county") or "",
        "price": item.get("price") or "",
        "days_on_market": item.get("daysOnMarket") if item.get("daysOnMarket") is not None else "",
        "listed_date": listed,
        "times_listed": max(len(periods), 1),
        "previous_listing_price": (earlier[-1].get("price") if earlier else "") or "",
        "property_type": item.get("propertyType") or "",
        "bedrooms": item.get("bedrooms") if item.get("bedrooms") is not None else "",
        "bathrooms": item.get("bathrooms") if item.get("bathrooms") is not None else "",
        "square_footage": item.get("squareFootage") or "",
        "lot_size": item.get("lotSize") or "",
        "year_built": item.get("yearBuilt") or "",
        "hoa_fee": (item.get("hoa") or {}).get("fee") or "",
        "agent_name": agent.get("name") or "",
        "agent_phone": agent.get("phone") or "",
        "agent_email": agent.get("email") or "",
        "office_name": office.get("name") or "",
        "office_phone": office.get("phone") or "",
        "office_email": office.get("email") or "",
        "mls_name": item.get("mlsName") or "",
        "mls_number": item.get("mlsNumber") or "",
        "last_seen": (item.get("lastSeenDate") or "")[:10],
        "rentcast_id": item.get("id") or "",
    }


def keep(item: dict[str, Any], min_price: int, min_days: int, max_days: int) -> bool:
    """Re-check the filters locally, so the CSV is right even if the API's
    range semantics ever differ from what we asked for."""
    if (item.get("status") or "Active") != "Active":
        return False
    price, days = item.get("price"), item.get("daysOnMarket")
    return (
        isinstance(price, (int, float)) and price >= min_price
        and isinstance(days, (int, float)) and min_days <= days <= max_days
    )


class Budget(Exception):
    pass


def fetch_page(client: httpx.Client, params: dict[str, Any], state: dict[str, int], max_requests: int) -> list[dict[str, Any]]:
    for attempt in range(4):
        if state["requests"] >= max_requests:
            raise Budget()
        state["requests"] += 1
        r = client.get(API_URL, params=params)
        if r.status_code == 200:
            return r.json() or []
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(5 * (attempt + 1))
            continue
        if r.status_code in (401, 403):
            sys.exit(f"RentCast rejected the API key (HTTP {r.status_code}): {r.text[:300]}")
        raise RuntimeError(f"HTTP {r.status_code} for {params}: {r.text[:300]}")
    raise RuntimeError(f"RentCast kept failing for {params}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--states", default=",".join(STATES), help="Comma-separated state codes (default: all, largest first)")
    parser.add_argument("--min-price", type=int, default=500_000)
    parser.add_argument("--min-days", type=int, default=180)
    parser.add_argument("--max-days", type=int, default=3650)
    parser.add_argument("--weekly", action="store_true", help="Only listings that crossed --min-days in the last 7 days")
    parser.add_argument("--types", default=DEFAULT_TYPES, help=f'Property types, "|"-separated (default "{DEFAULT_TYPES}")')
    parser.add_argument("--target", type=int, default=2000, help="Stop after this many listings (default 2000)")
    parser.add_argument("--max-requests", type=int, default=45, help="API request budget for this run (free tier: 50/month)")
    parser.add_argument("--out", default=str(Path.home() / "Downloads" / f"us_stale_listings_{date.today().isoformat()}.csv"))
    args = parser.parse_args()

    max_days = args.min_days + 7 if args.weekly else args.max_days
    base = {
        "price": f"{args.min_price}:1000000000",
        "daysOld": f"{args.min_days}:{max_days}",
        "status": "Active",
        "propertyType": args.types,
        "limit": PAGE_SIZE,
    }
    usage = {"requests": 0}
    rows: dict[str, dict[str, Any]] = {}
    per_state: dict[str, int] = {}
    dropped = 0
    with httpx.Client(headers={"X-Api-Key": load_api_key(), "Accept": "application/json"}, timeout=60) as client:
        try:
            for code in [s.strip().upper() for s in args.states.split(",") if s.strip()]:
                offset = 0
                while len(rows) < args.target:
                    page = fetch_page(client, {**base, "state": code, "offset": offset}, usage, args.max_requests)
                    for item in page:
                        if not keep(item, args.min_price, args.min_days, max_days):
                            dropped += 1
                            continue
                        if item.get("id") and item["id"] not in rows and len(rows) < args.target:
                            rows[item["id"]] = listing_row(item)
                            per_state[code] = per_state.get(code, 0) + 1
                    if len(page) < PAGE_SIZE:
                        break
                    offset += PAGE_SIZE
                print(f"  {code}: {per_state.get(code, 0)} listings", flush=True)
                if len(rows) >= args.target:
                    break
        except Budget:
            print(f"Stopped at the request budget ({args.max_requests}); raise --max-requests for more.")

    out = Path(args.out).expanduser()
    with out.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(sorted(rows.values(), key=lambda r: (r["state"], r["city"], r["address"])))
    print(
        f"\n{len(rows)} listings written to {out}\n"
        f"API requests used: {usage['requests']}"
        + (f"; {dropped} returned listings didn't match the filters and were left out" if dropped else "")
    )


if __name__ == "__main__":
    main()
