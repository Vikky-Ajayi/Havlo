"""The numbers behind the 20-factor report, worked out in code.

The first version of the 20-factor writer gave the model thin facts (a cut
description, a price, a list of sales) and told it to say "check with your
agent" when unsure, so most factors came back as a referral to the agent.
This module does the analysis an experienced agent would do before writing:
the gap between the asking price and the recorded sales, the price-step
scenarios with the buyer's stamp duty at each, price per square foot, what
the description and media cover and miss, how long since the reduction, and
the live competition and demand numbers. The model then explains and judges
from these; it never has to invent a figure.

Every figure computed here is also returned in `trusted`, so the claim checks
(report_guard) keep sentences that quote them instead of stripping them as
unsupported market claims. Pure functions, no network.
"""
from __future__ import annotations

import re
import statistics
from typing import Any

from app.services import report_factors as rf

# A price at or above this is expected to carry a virtual tour or video.
TOUR_EXPECTED_FROM = 750_000
# A reduction that hasn't produced a sale after this many days isn't working.
REDUCTION_STALL_DAYS = 45
# Still unsold after this long (or 1.5x the local benchmark) is a problem.
LONG_ON_MARKET_DAYS = 90

_SQFT = re.compile(r"(\d{1,2}[,.]?\d{3}|\d{3,5})\s*(?:sq\.?\s*ft|sqft|square\s+f(?:ee|oo)t|sq\.?\s*feet)", re.IGNORECASE)
_SQM = re.compile(r"(\d{2,4}(?:\.\d+)?)\s*(?:sq\.?\s*m\b|sqm\b|square\s+met(?:re|er)s?|m²)", re.IGNORECASE)
_EPC = re.compile(r"\bEPC(?:\s+rating)?\s*(?:of|is|:|-)?\s*([A-G])\b", re.IGNORECASE)
_TENURE = re.compile(r"\b(share of freehold|freehold|leasehold)\b", re.IGNORECASE)
_COUNCIL = re.compile(r"\bcouncil tax(?:\s+band)?\s*(?:of|is|:|-)?\s*([A-H])\b", re.IGNORECASE)
_STATION = re.compile(r"(\d+(?:\.\d+)?)\s*miles?\b[^.]{0,40}?\bstation\b", re.IGNORECASE)
_GARDEN_FT = re.compile(r"(\d{2,3})\s*(?:ft|feet|')\s+[^.]{0,40}?\bgarden\b", re.IGNORECASE)
_PARKING = re.compile(r"\b(driveway|garage|off[- ]street parking|parking for|carport|ev charg\w*)\b", re.IGNORECASE)
_SCHOOLS = re.compile(r"\bschool(?:s|ing)?\b", re.IGNORECASE)
_PERIOD = re.compile(r"\b(Georgian|Victorian|Edwardian|1930s|Art Deco|period)\b", re.IGNORECASE)
_REFURB = re.compile(r"\b(refurbish\w*|renovat\w*|back[- ]to[- ]brick|extended|extension|new roof|rewired|new boiler)\b", re.IGNORECASE)
_GUIDE = re.compile(r"guide price\s*£\s?([\d,]+)\s*(?:-|–|to)\s*£\s?([\d,]+)", re.IGNORECASE)
_WORD = re.compile(r"\b\w+\b")


def _int(text: str) -> int | None:
    try:
        return int(float(str(text).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _money(n: float | int | None) -> str | None:
    return f"£{int(round(n)):,}" if n else None


def floor_area_sqft(text: str) -> int | None:
    """The total internal area stated in the listing, in square feet."""
    best = None
    for m in _SQFT.finditer(text or ""):
        n = _int(m.group(1).replace(".", ","))
        if n and 300 <= n <= 30_000:
            best = max(best or 0, n)
    if best:
        return best
    for m in _SQM.finditer(text or ""):
        try:
            sqm = float(m.group(1))
        except ValueError:
            continue
        if 30 <= sqm <= 3_000:
            best = max(best or 0, int(round(sqm * 10.764)))
    return best


def listing_text(snapshot: dict[str, Any]) -> str:
    features = " ".join(str(f) for f in snapshot.get("features") or [])
    return " ".join([str(snapshot.get("title") or ""), features, str(snapshot.get("description") or "")]).replace("&amp;", "&")


def description_review(snapshot: dict[str, Any]) -> dict[str, Any]:
    """What the description and key features cover, and what a buyer at this
    level will look for and not find."""
    description = str(snapshot.get("description") or "").replace("&amp;", "&")
    features = [str(f).replace("&amp;", "&") for f in snapshot.get("features") or [] if str(f).strip()]
    text = listing_text(snapshot)
    epc = _EPC.search(text)
    tenure = _TENURE.search(text)
    council = _COUNCIL.search(text)
    station = _STATION.search(text)
    garden = _GARDEN_FT.search(text)
    sqft = floor_area_sqft(text)
    covered = {
        "floor_area": bool(sqft),
        "epc_rating": bool(epc),
        "tenure": bool(tenure),
        "council_tax_band": bool(council),
        "parking": bool(_PARKING.search(text)),
        "transport": bool(station),
        "schools": bool(_SCHOOLS.search(text)),
        "garden_size": bool(garden),
    }
    missing = [k for k, v in covered.items() if not v]
    first = re.split(r"(?<=[.!?])\s+", description.strip())[0] if description.strip() else ""
    return {
        "description_words": len(_WORD.findall(description)),
        "description_complete": not snapshot.get("description_truncated"),
        "opening_sentence": first[:300],
        "key_features": features[:12],
        "key_features_count": len(features),
        "floor_area_sqft": sqft,
        "epc_rating": epc.group(1).upper() if epc else None,
        "tenure": tenure.group(1).lower() if tenure else None,
        "council_tax_band": council.group(1).upper() if council else None,
        "station_miles": float(station.group(1)) if station else None,
        "garden_length_ft": _int(garden.group(1)) if garden else None,
        "period_or_style": (_PERIOD.search(text).group(1) if _PERIOD.search(text) else None),
        "works_mentioned": sorted({m.group(1).lower() for m in _REFURB.finditer(text)})[:5],
        "covers": [k for k, v in covered.items() if v],
        "missing": missing,
    }


def _sale_prices(sales: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out = []
    for s in sales or []:
        price = s.get("price") or s.get("sold_price")
        try:
            price = int(price)
        except (TypeError, ValueError):
            continue
        if price > 0 and not s.get("is_subject"):
            out.append({"price": price, "date": s.get("date") or s.get("sold_date"),
                        "type": s.get("property_type") or s.get("type") or ""})
    return out


def price_position(asking: float | None, sales: list[dict[str, Any]] | None,
                   sqft: int | None, bedrooms: Any) -> dict[str, Any]:
    """Asking price against the recorded nearby sales."""
    rows = _sale_prices(sales)
    out: dict[str, Any] = {"asking_price": int(asking) if asking else None, "recorded_sales": rows[:6]}
    try:
        beds = int(bedrooms) if bedrooms not in (None, "") else None
    except (TypeError, ValueError):
        beds = None
    if asking and sqft:
        out["asking_price_per_sqft"] = int(round(asking / sqft))
    if asking and beds:
        out["asking_price_per_bedroom"] = int(round(asking / beds))
    if not asking or not rows:
        out["sales_known"] = bool(rows)
        return out
    prices = [r["price"] for r in rows]
    top, median = max(prices), statistics.median(prices)
    out.update({
        "sales_known": True,
        "sales_count": len(prices),
        "sales_low": min(prices), "sales_high": top, "sales_median": int(round(median)),
        "above_highest_by": int(asking - top), "above_highest_pct": round((asking / top - 1) * 100, 1),
        "above_median_by": int(asking - median), "above_median_pct": round((asking / median - 1) * 100, 1),
        # When the house is far above every sale, those sales are probably
        # smaller homes: a weak guide, and the price needs other evidence.
        "sales_are_weak_guide": asking > top * 1.25,
    })
    return out


def pricing_scenarios(asking: float | None, country: str) -> list[dict[str, Any]]:
    """Hold, or step down to the next one or two search steps: who each price
    reaches, what it costs the buyer in stamp duty, and the change to you."""
    if not asking:
        return []
    asking = int(round(asking))
    england = str(country or "UK").strip().upper() in ("UK", "ENGLAND", "NI", "")
    steps_below = [s for s in rf.PRICE_STEPS if s < asking][-2:][::-1]
    out = []
    for label, price in [("hold", asking)] + [(f"step_{i + 1}", s) for i, s in enumerate(steps_below)]:
        tax = rf.sdlt_england(price) if england else None
        row = {
            "option": label, "price": price,
            "seen_by_searches_up_to": price if price in rf.PRICE_STEPS else next((s for s in rf.PRICE_STEPS if s >= price), price),
            "change_from_asking": price - asking,
            "change_pct": round((price - asking) / asking * 100, 1),
            "buyer_stamp_duty": tax,
            "buyer_deposit_10pct": int(round(price * rf.DEPOSIT_FRACTION)),
            "buyer_income_needed": int(round(price * (1 - rf.DEPOSIT_FRACTION) / rf.INCOME_MULTIPLE / 1000.0)) * 1000,
        }
        if tax is not None and label != "hold":
            row["buyer_stamp_duty_saving"] = (rf.sdlt_england(asking) or 0) - tax
        out.append(row)
    return out


def guide_range(snapshot: dict[str, Any], asking: float | None) -> dict[str, Any] | None:
    """A "Guide price £X-£Y" left in the key features. When its top is above
    today's asking price (often left over from before a reduction) it anchors
    buyers on the old, higher figure."""
    m = _GUIDE.search(listing_text(snapshot))
    if not m:
        return None
    low, high = _int(m.group(1)), _int(m.group(2))
    if not low or not high:
        return None
    return {"guide_low": low, "guide_high": high,
            "top_above_asking": bool(asking and high > asking),
            "top_above_asking_by": int(high - asking) if asking and high > asking else 0}


def time_facts(reduced_days: int | None, advertised_days: int | None, benchmark: int | None) -> dict[str, Any]:
    days = reduced_days if reduced_days is not None else advertised_days
    out: dict[str, Any] = {
        "days_since_reduction": reduced_days,
        "days_advertised": advertised_days,
        "local_benchmark_days": benchmark,
    }
    if days is not None and benchmark:
        out["vs_benchmark"] = round(days / benchmark, 1)
    long_time = days is not None and (days >= LONG_ON_MARKET_DAYS or (benchmark and days >= benchmark * 1.5))
    out["verdict_hint"] = rf.PROBLEM if long_time else None
    return out


def market_facts(intel: dict[str, Any] | None) -> dict[str, Any]:
    """Live competition and demand from agent_report.compute_intel, with the
    area each count covers so the report can say what it compared against."""
    if not isinstance(intel, dict) or not intel:
        return {}
    market = intel.get("market") or {}
    headline = intel.get("headline") or {}
    vendor = intel.get("vendor_view") or {}
    sold = intel.get("sold") or {}
    pricing = intel.get("pricing") or {}

    def row(r: dict[str, Any]) -> dict[str, Any]:
        return {k: r.get(k) for k in ("price", "bedrooms", "type", "status", "distance") if r.get(k) not in (None, "")}

    return {
        "area": intel.get("area_label"),
        "compared_with": intel.get("basis_label"),
        "similar_homes_seen": intel.get("comparables"),
        "homes_for_sale_now": market.get("for_sale"),
        "within_15pct_of_your_price": market.get("alternatives"),
        "new_listings_last_30_days": len(market.get("new_30") or []),
        "reduced_nearby": vendor.get("reduced_nearby"),
        "agreed_since_you_listed": vendor.get("agreed_since_listed"),
        "sold_since_you_listed": vendor.get("sold_since_listed"),
        "since": vendor.get("since_label"),
        # A different set from the recorded comparables above: every sale of
        # this kind of home in this area in the last year, so say which it is.
        "sold_last_12_months_covers": " ".join(x for x in (sold.get("homes_label"), sold.get("area_label")) if x) or None,
        "sold_last_12_months": sold.get("count_12m"),
        "sold_12m_median": sold.get("median_12m"),
        "sold_12m_low": sold.get("low_12m"),
        "sold_12m_high": sold.get("high_12m"),
        "local_benchmark_days": headline.get("dom_benchmark"),
        "median_asking_for_sale": pricing.get("median_for_sale"),
        "your_price_premium_pct": pricing.get("premium_pct"),
        "your_price_per_bedroom": pricing.get("price_per_bedroom"),
        "similar_price_per_bedroom": pricing.get("comparable_price_per_bedroom"),
        "competing_listings": [row(r) for r in (market.get("competing") or [])[:6]],
    }


def analyse(
    snapshot: dict[str, Any], *, asking_price: float | None, country: str = "UK",
    reduced_days: int | None = None, advertised_days: int | None = None,
    sales: list[dict[str, Any]] | None = None, photo_review: dict[str, Any] | None = None,
    intel: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Everything the 20 factors are written from, plus the figures to trust."""
    # Only an address and asking price typed in (a Zoopla link we couldn't
    # read): no dates, text or media were seen, so none may be judged absent.
    seen = not snapshot.get("manual_details")
    if not seen:
        reduced_days = advertised_days = None
    media = snapshot.get("media") if isinstance(snapshot.get("media"), dict) else {}
    desc = description_review(snapshot)
    if not seen:
        desc["missing"] = []
    position = price_position(asking_price, sales, desc["floor_area_sqft"], snapshot.get("bedrooms"))
    scenarios = pricing_scenarios(asking_price, country)
    vis = rf.visibility(asking_price)
    afford = rf.affordability(asking_price, country)
    market = market_facts(intel)
    timing = time_facts(reduced_days, advertised_days, market.get("local_benchmark_days"))
    guide = guide_range(snapshot, asking_price)
    photos = media.get("photos")
    tours = media.get("virtual_tours")
    floorplans = media.get("floorplans")
    fee_half_pct = int(round(asking_price * 0.005)) if asking_price else None

    marketing_gaps = []
    if asking_price and asking_price >= TOUR_EXPECTED_FROM and tours == 0:
        marketing_gaps.append("no virtual tour or video at a price where buyers expect one")
    if isinstance(photos, int) and photos < 15:
        marketing_gaps.append(f"only {photos} photos")
    if floorplans == 0:
        marketing_gaps.append("no floor plan")
    if guide and guide["top_above_asking"]:
        marketing_gaps.append("an out-of-date guide price range in the key features")

    out = {
        "property": {
            "type": snapshot.get("property_type"), "bedrooms": snapshot.get("bedrooms"),
            "bathrooms": snapshot.get("bathrooms"), "agent": (snapshot.get("agent") or {}).get("brand"),
            "floor_area_sqft": desc["floor_area_sqft"], "epc_rating": desc["epc_rating"],
            "station_miles": desc["station_miles"], "garden_length_ft": desc["garden_length_ft"],
            "period_or_style": desc["period_or_style"],
        },
        "price_position": position,
        "visibility": vis,
        "scenarios": scenarios,
        "affordability": afford,
        "timing": timing,
        "guide_range": guide,
        "description": desc,
        "media": {"photos": photos, "floorplans": floorplans, "virtual_tours": tours,
                  "photo_review": (photo_review or {}).get("findings") if photo_review else None,
                  "photo_overall": (photo_review or {}).get("overall") if photo_review else None,
                  "photos_reviewed": (photo_review or {}).get("photos_seen") if photo_review else None,
                  "rooms_shown": (photo_review or {}).get("rooms_shown") if photo_review else None,
                  "missing_shots": (photo_review or {}).get("missing_shots") if photo_review else None,
                  "order_notes": (photo_review or {}).get("order_notes") if photo_review else None,
                  "weak_photos": (photo_review or {}).get("weak_photos") if photo_review else None,
                  "photo_actions": (photo_review or {}).get("actions") if photo_review else None},
        "marketing_gaps": marketing_gaps,
        "market": market,
        "net_proceeds": {"asking_price": int(asking_price) if asking_price else None,
                         "agent_fee_per_half_percent": fee_half_pct,
                         "scenario_changes": [{"price": s["price"], "change": s["change_from_asking"]} for s in scenarios[1:]]},
    }
    out["listing_seen"] = seen
    out["trusted"] = trusted_figures(out)
    return out


def trusted_figures(a: dict[str, Any]) -> dict[str, list]:
    """Every £ amount, percentage and day count computed above, so the claim
    checks accept a sentence quoting them."""
    amounts: set[float] = set()
    percents: set[float] = set()
    days: set[int] = set()

    def add(value: Any) -> None:
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 1_000:
            amounts.add(float(abs(value)))

    pos = a.get("price_position") or {}
    for k in ("asking_price", "sales_low", "sales_high", "sales_median", "above_highest_by", "above_median_by",
              "asking_price_per_bedroom"):
        add(pos.get(k))
    if pos.get("asking_price_per_sqft"):
        amounts.add(float(pos["asking_price_per_sqft"]))
    for k in ("above_highest_pct", "above_median_pct"):
        if pos.get(k) is not None:
            percents.add(abs(float(pos[k])))
    for r in pos.get("recorded_sales") or []:
        add(r.get("price"))
    for s in a.get("scenarios") or []:
        for k in ("price", "seen_by_searches_up_to", "change_from_asking", "buyer_stamp_duty", "buyer_deposit_10pct",
                  "buyer_income_needed", "buyer_stamp_duty_saving"):
            add(s.get(k))
        if s.get("change_pct") is not None:
            percents.add(abs(float(s["change_pct"])))
    vis = a.get("visibility") or {}
    for k in ("price", "floor_step", "ceil_step", "gap_to_floor"):
        add(vis.get(k))
    aff = a.get("affordability") or {}
    for k in ("price", "deposit", "loan", "required_income", "stamp_duty"):
        add(aff.get(k))
    g = a.get("guide_range") or {}
    for k in ("guide_low", "guide_high", "top_above_asking_by"):
        add(g.get(k))
    m = a.get("market") or {}
    for k in ("sold_12m_median", "sold_12m_low", "sold_12m_high", "median_asking_for_sale",
              "your_price_per_bedroom", "similar_price_per_bedroom"):
        add(m.get(k))
    if m.get("your_price_premium_pct") is not None:
        percents.add(abs(float(m["your_price_premium_pct"])))
    for r in m.get("competing_listings") or []:
        add(r.get("price"))
    np_ = a.get("net_proceeds") or {}
    add(np_.get("agent_fee_per_half_percent"))
    t = a.get("timing") or {}
    for k in ("days_since_reduction", "days_advertised", "local_benchmark_days"):
        if isinstance(t.get(k), int):
            days.add(t[k])
    # Real sale prices only: what a "sold for £X" sentence may quote.
    sale_amounts = {float(r["price"]) for r in pos.get("recorded_sales") or [] if r.get("price")}
    for k in ("sold_12m_median", "sold_12m_low", "sold_12m_high"):
        if isinstance(m.get(k), (int, float)) and m.get(k):
            sale_amounts.add(float(m[k]))
    return {"amounts": sorted(amounts), "sale_amounts": sorted(sale_amounts), "percents": sorted(percents),
            "days": sorted(days), "sqft": (a.get("property") or {}).get("floor_area_sqft")}
