"""The agent-facing report on one of an agency's stale listings: how at risk
the instruction is, what the market around it is doing, who the competing
agencies are, and what to do next.

Everything is either measured from data we hold or clearly labelled:
  * the listing itself (price, days on market, reduction, photos, floorplan,
    video tour, description) from its Rightmove page and our record;
  * the homes for sale within half a mile (a mile, then three, if that's
    thin) from a Rightmove search: price, status (for sale / under offer /
    sold STC), when each was first listed, recent reductions, and the
    marketing agency. When that search doesn't answer, the latest weekly
    search around another monitored listing in the same postcode district
    fills in, then the listings Havlo itself found on Rightmove there;
  * recorded sold prices around the property (HM Land Registry: our copy of
    the price paid data, for the postcodes within half a mile, else the
    postcode sector or district), and the comparable sold prices the
    assessment shows (the same Land Registry rows);
  * Havlo's assessment of the listing (the existing report's scores,
    findings and plan);
  * the agency's other stale listings.
Estimates say what they are (e.g. the days-on-market benchmark is the
typical age of similar homes still for sale nearby, not how long sold
homes took). Every headline figure has a fallback, so none is ever blank.
Commission is worked out on the page from a fee the agent can change.
compute_intel() is pure; gather() and refresh_agent_intel() do the
fetching and caching (StaleListingProspect.agent_intel_json).
"""
from __future__ import annotations

import asyncio
import json
import logging
import statistics
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx

logger = logging.getLogger(__name__)

# Bumped when the report's shape changes, so stored reports are rebuilt.
INTEL_VERSION = 2
INTEL_MAX_AGE = timedelta(days=7)
# A report built without Rightmove's nearby search (it didn't answer) is
# rebuilt much sooner, so the listings fill in on the next visit.
INTEL_RETRY_AGE = timedelta(hours=1)
SIMILAR_MIN = 4  # fewer similar homes than this: compare with every home nearby
# Read the whole local stock (not just the newest homes), so the typical age
# of homes for sale isn't skewed young. 6 pages = up to 144 homes.
NEARBY_PAGES = 6
# Radius (miles) and result pages per Rightmove search, widened while thin.
SEARCH_STEPS = ((0.5, NEARBY_PAGES), (1.0, NEARBY_PAGES), (3.0, 3))
# Time for the whole search; a wider step that would run past it is skipped
# (or cut short), keeping what the narrower one found.
SEARCH_BUDGET = 150.0
# Land Registry: the postcodes within ~half a mile, then ~a mile.
SALES_RADII = ((800, "within half a mile"), (1600, "within a mile"))
SALES_MIN = 12  # widen the area when fewer sales than this
SALES_LOOKBACK_DAYS = 3 * 365
# A recorded sale counts as a "similar home" within this share of the price.
SALES_PRICE_BAND = 0.25
# Listings Havlo found on Rightmove itself, used when the search is thin.
RECORDS_MAX_AGE_DAYS = 150
LEVELS_RISK = ("Low", "Moderate", "High", "Critical")
PRIORITY_ORDER = {"Immediate": 0, "High": 1, "Medium": 2, "Low": 3}
AGREED = ("under_offer", "sold_stc")
# Rows from these sources were seen in a live Rightmove search, so their ages
# and statuses describe the market. "records" rows (listings Havlo found)
# were picked for being on the market a long time: fine for prices and
# agencies, but not for how quickly homes sell.
OBSERVED_SOURCES = (None, "rightmove", "monitor")


def _days_since(iso: str | None, today: date) -> int | None:
    try:
        return (today - date.fromisoformat((iso or "")[:10])).days
    except ValueError:
        return None


def _median(values: list[float]) -> float | None:
    values = [v for v in values if v is not None]
    return statistics.median(values) if values else None


def _pct(n: int, d: int) -> int:
    return round(100 * n / d) if d else 0


def _clamp(value: float, low: int = 5, high: int = 95) -> int:
    return max(low, min(high, round(value)))


def _level(value: int, cuts: tuple[int, ...], names: tuple[str, ...]) -> str:
    """names[i] for the first cut value is below; the last name otherwise."""
    for cut, name in zip(cuts, names):
        if value < cut:
            return name
    return names[-1]


def _money(n: float | None) -> str:
    return f"£{round(n):,}" if n else "—"


def _plural(n: int, one: str, many: str | None = None) -> str:
    return one if n == 1 else (many or f"{one}s")


def _nice_date(iso: str | None) -> str:
    try:
        d = date.fromisoformat((iso or "")[:10])
    except ValueError:
        return ""
    return f"{d.day} {d:%b %Y}"


def radius_label(radius: float | None) -> str:
    if not radius:
        return "nearby"
    if radius == 0.5:
        return "within half a mile"
    if radius == 1:
        return "within a mile"
    return f"within {radius:g} miles"


def _family(text: str | None) -> str:
    """A property type as one of Land Registry's families (or "house" for a
    bungalow/cottage/house of unknown kind, "" when unclear)."""
    t = (text or "").lower()
    if "semi" in t:
        return "semi"
    if "detached" in t:
        return "detached"
    if any(w in t for w in ("terrace", "town house", "townhouse", "mews")):
        return "terrace"
    if any(w in t for w in ("flat", "apartment", "maisonette", "penthouse", "studio")):
        return "flat"
    if any(w in t for w in ("bungalow", "cottage", "house", "villa", "chalet")):
        return "house"
    return ""


FAMILY_WORDS = {
    "semi": "semi-detached homes", "detached": "detached homes", "terrace": "terraced homes",
    "flat": "flats", "house": "houses", "": "homes",
}


def sale_matches(subject_type: str | None, sale_type: str | None) -> bool:
    subject, sale = _family(subject_type), _family(sale_type)
    if not subject:
        return True
    if subject == "house":
        return sale != "flat"
    return subject == sale


def _time_score(days: int | None) -> int | None:
    """How fresh a listing still is on its own (100 fresh .. 5 very stale):
    a day on the market costs a third of a point, so 90 days scores 70 and
    a year scores the minimum. Used when there's no local benchmark."""
    return None if days is None else _clamp(100 - days / 3)


def compute_intel(
    subject: dict[str, Any],
    nearby: list[dict[str, Any]],
    sales: list[dict[str, Any]],
    report: dict[str, Any],
    portfolio: list[dict[str, Any]],
    *,
    radius: float | None,
    today: date,
    comparables: list[dict[str, Any]] | None = None,
    sources: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """subject: price, dom, listed_date (ISO), reduced_date (ISO, "" when
    unreadable, or None), bedrooms, type, agent, branch_id, photos,
    floorplans, virtual_tours, description_words, features, last_update.
    nearby: listing_monitor.nearby_row()s, the subject excluded, each with an
    optional "source" (see OBSERVED_SOURCES).
    sales: recorded Land Registry sales around the property ({address,
    price, date (ISO), type}), newest first.
    comparables: the assessment's comparable sold prices ({address,
    property_type, price, date}).
    portfolio: the agency's stale listings ({id, address, price, dom}),
    this one included (id == subject["id"])."""
    from app.services.listing_monitor import broad_type, is_similar

    sources = dict(sources or {})
    area = sources.get("nearby_area") or radius_label(radius)
    sales_area = sources.get("sales_area") or "nearby"
    price = subject.get("price") or None
    dom = subject.get("dom")
    listed_date = subject.get("listed_date") or None
    reduced = subject.get("reduced_date")
    # "Since" counts from when it went live, or (for a listing we only know
    # as "reduced on ...") from its last reduction.
    listed = listed_date or reduced or None
    since_label = "since this property was listed" if listed_date else "since its last price reduction"
    own_agent = (subject.get("agent") or "").strip().lower()
    subject_type = subject.get("type") or ""
    family = _family(subject_type)
    homes_word = FAMILY_WORDS[family]

    def pick(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
        similar = [r for r in rows if is_similar(r, subject.get("bedrooms"), subject_type)]
        if len(similar) >= SIMILAR_MIN:
            return similar, "similar"
        same_type = [r for r in rows if broad_type(r.get("type") or "") == broad_type(subject_type)]
        if len(same_type) >= SIMILAR_MIN:
            return same_type, "same_type"
        return list(rows), "nearby"

    similar, basis = pick(nearby)
    basis_label = {
        "similar": "similar homes (same type, a bedroom either way)",
        "same_type": "homes of the same type",
        "nearby": "homes for sale",
    }[basis]
    short_basis = {"similar": "similar homes", "same_type": f"{homes_word}", "nearby": "homes"}[basis]
    observed = [r for r in nearby if r.get("source") in OBSERVED_SOURCES]
    similar_seen = [r for r in similar if r.get("source") in OBSERVED_SOURCES]
    for_sale = [r for r in similar if r.get("status") == "on_market"]
    for_sale_seen = [r for r in similar_seen if r.get("status") == "on_market"]
    agreed = [r for r in similar_seen if r.get("status") in AGREED]

    # ── Days on market against the local picture ─────────────────────────
    ages = [a for a in (_days_since(r.get("first_listed"), today) for r in for_sale_seen) if a is not None]
    benchmark_basis = short_basis
    if len(ages) < 3:
        wider = [a for a in (_days_since(r.get("first_listed"), today) for r in observed if r.get("status") == "on_market") if a is not None]
        if len(wider) >= 3:
            ages, benchmark_basis = wider, "homes"
    benchmark = round(_median(ages)) if len(ages) >= 3 else None
    dom_gap = (dom - benchmark) if (dom is not None and benchmark is not None) else None
    staleness = _pct(sum(1 for a in ages if a < dom), len(ages)) if (dom is not None and len(ages) >= 3) else None
    days_since_reduction = _days_since(reduced, today) if reduced else None
    time_score = _time_score(dom)

    # ── Market movement since the listing went live ──────────────────────
    since_listed = [r for r in similar_seen if listed and (r.get("first_listed") or "") >= listed]
    new_30 = [r for r in similar_seen if (_days_since(r.get("first_listed"), today) or 999) <= 30]
    sold_since = [r for r in agreed if listed and (r.get("first_listed") or "") >= listed]
    reduced_nearby = [r for r in for_sale if r.get("update") == "price_reduced"]
    alternatives = [r for r in for_sale if price and r.get("price") and abs(r["price"] - price) <= 0.15 * price]

    # ── Recorded sales (HM Land Registry) ────────────────────────────────
    def sale_day(s: dict[str, Any]) -> str:
        return str(s.get("date") or "")[:10]

    type_sales = [s for s in sales if s.get("price") and sale_matches(subject_type, s.get("type"))]
    sales_word = homes_word
    if not type_sales and sales:
        type_sales, sales_word = [s for s in sales if s.get("price")], "homes"
    sales_12m = [s for s in type_sales if (_days_since(sale_day(s), today) or 99999) <= 365]
    sold_median = _median([s["price"] for s in sales_12m])
    sold_premium = round(100 * (price - sold_median) / sold_median) if (price and sold_median) else None
    in_band = [s for s in type_sales if not price or abs(s["price"] - price) <= SALES_PRICE_BAND * price]
    sales_since = [s for s in in_band if listed and sale_day(s) >= listed]
    success_gap = len(sold_since) + len(sales_since)

    # ── Competing agencies ───────────────────────────────────────────────
    by_agent: dict[str, dict[str, Any]] = defaultdict(lambda: {"listings": 0, "agreed": 0, "new_30": 0, "similar": 0})
    for r in nearby:
        name = (r.get("agent") or "").strip() or "Private / unknown"
        a = by_agent[name]
        a["listings"] += 1
        seen = r.get("source") in OBSERVED_SOURCES
        a["agreed"] += bool(seen and r.get("status") in AGREED)
        a["new_30"] += bool(seen and (_days_since(r.get("first_listed"), today) or 999) <= 30)
        a["similar"] += r in similar
    total_nearby = len(nearby)
    agencies = sorted(
        ({"agent": k, **v, "share": _pct(v["listings"], total_nearby), "you": bool(own_agent) and k.strip().lower() == own_agent}
         for k, v in by_agent.items()),
        key=lambda a: (a["agent"] == "Private / unknown", -a["agreed"], -a["listings"], a["agent"]),
    )
    competitors = [a for a in agencies if not a["you"] and a["agent"] != "Private / unknown"]
    competitors_agreed_segment = len({r.get("agent") for r in agreed if r.get("agent") and r["agent"].strip().lower() != own_agent})
    competitors_in_segment = len({r.get("agent") for r in similar if r.get("agent") and r["agent"].strip().lower() != own_agent})
    momentum = sorted((a for a in competitors if a["new_30"]), key=lambda a: -a["new_30"])[:5]
    pressure = _level(len(alternatives), (4, 8), ("Low", "Moderate", "High"))
    ai_competition = (report.get("scores") or {}).get("competition")
    pressure_from_assessment = not nearby and isinstance(ai_competition, (int, float))
    if pressure_from_assessment:
        # No listings to count this time (they're re-read within the hour):
        # Havlo's assessment of the competition stands in, and says so.
        pressure = "High" if ai_competition < 45 else "Moderate" if ai_competition < 65 else "Low"
    threat = _level(competitors_agreed_segment, (1, 3), ("Low", "Moderate", "High"))
    exposure = _level(competitors_in_segment, (3, 6), ("Low", "Moderate", "High"))

    # ── Price ────────────────────────────────────────────────────────────
    comp_prices = [r["price"] for r in for_sale if r.get("price")]
    median_price = _median(comp_prices)
    premium = round(100 * (price - median_price) / median_price) if (price and median_price) else None
    cheaper_share = _pct(sum(1 for p in comp_prices if p < price), len(comp_prices)) if (price and comp_prices) else None
    beds = subject.get("bedrooms") if isinstance(subject.get("bedrooms"), int) and subject.get("bedrooms") else None
    ppb = round(price / beds) if (price and beds) else None
    comp_ppb = _median([r["price"] / r["bedrooms"] for r in for_sale if r.get("price") and r.get("bedrooms")])
    scores = report.get("scores") or {}

    def ai_score(key: str) -> float | None:
        value = scores.get(key)
        return value if isinstance(value, (int, float)) else None

    # Asking prices sit a few percent above what homes sell for, so against
    # recorded sales the first 5% doesn't count as overpricing.
    price_gap = premium if premium is not None else (sold_premium - 5 if sold_premium is not None else None)
    if premium is not None:
        price_score = _clamp(70 - premium * 2.5)
    elif sold_premium is not None:
        price_score = _clamp(70 - (sold_premium - 5) * 2.5)
    else:
        price_score = round(ai_score("pricing")) if ai_score("pricing") is not None else None
    # How stale it is: against similar homes for sale when we have them, else
    # on its own clock, else (a reduced listing whose start we don't know)
    # Havlo's assessment of its market position.
    if staleness is not None:
        time_component = max(5, 100 - staleness)
    elif time_score is not None:
        time_component = time_score
    elif ai_score("market_positioning") is not None:
        time_component = round(ai_score("market_positioning"))
    else:
        time_component = 40
    stale_signal = 100 - time_component
    if price_gap is not None and price_gap > 10 and stale_signal >= 75:
        reduction_pressure = "High"
    elif price_gap is not None and price_gap > 0 and stale_signal >= 50:
        reduction_pressure = "Moderate"
    else:
        reduction_pressure = "Low"

    # ── Presentation ─────────────────────────────────────────────────────
    photo_counts = [r["photos"] for r in similar if isinstance(r.get("photos"), int)]
    comp_photos = _median(photo_counts) if len(photo_counts) >= 3 else None
    known_plans = [r for r in similar if isinstance(r.get("floorplans"), int)]
    share_floorplans = _pct(sum(1 for r in known_plans if r["floorplans"] > 0), len(known_plans)) if known_plans else None
    known_tours = [r for r in similar if isinstance(r.get("virtual_tours"), int)]
    share_tours = _pct(sum(1 for r in known_tours if r["virtual_tours"] > 0), len(known_tours)) if known_tours else None
    gaps: list[str] = []
    measured = 100
    photos = subject.get("photos")
    if isinstance(photos, int) and comp_photos and photos < 0.8 * comp_photos:
        gaps.append(f"{photos} photos, against {round(comp_photos)} on a typical similar listing")
        measured -= 15
    elif isinstance(photos, int) and comp_photos is None and photos < 15:
        gaps.append(f"only {photos} photos")
        measured -= 15
    if subject.get("floorplans") == 0 and (share_floorplans is None or share_floorplans >= 50):
        gaps.append(f"no floorplan, while {share_floorplans}% of similar listings have one" if share_floorplans is not None else "no floorplan")
        measured -= 20
    if subject.get("virtual_tours") == 0 and share_tours is not None and share_tours >= 25:
        gaps.append(f"no video or virtual tour, while {share_tours}% of similar listings have one")
        measured -= 10
    words = subject.get("description_words")
    if words is not None and words < 150:
        gaps.append(f"a short description ({words} words)")
        measured -= 10
    if subject.get("features") is not None and subject["features"] < 5:
        gaps.append(f"only {subject['features']} key features")
        measured -= 5
    ai_presentation = ai_score("listing_presentation")
    presentation = round((measured + ai_presentation) / 2) if ai_presentation is not None else measured
    buyer_appeal = ai_score("buyer_appeal")

    # ── Freshness and relaunch ───────────────────────────────────────────
    since_update = _days_since(subject.get("last_update"), today)
    ratio = (dom / benchmark) if (dom is not None and benchmark) else None
    long_listed = dom if dom is not None else days_since_reduction
    if ratio is not None:
        fatigue = "High" if ratio > 2 and (since_update is None or since_update > 60) else "Moderate" if ratio > 1.3 else "Low"
    elif long_listed is not None:
        fatigue = "High" if long_listed >= 270 and (since_update is None or since_update > 60) else "Moderate" if long_listed >= 150 else "Low"
    else:
        fatigue = "Moderate"
    if len(gaps) >= 2 or (fatigue == "High" and gaps):
        relaunch = "Strong"
    elif gaps or fatigue != "Low":
        relaunch = "Moderate"
    else:
        relaunch = "Limited"
    relaunch_reason = (
        f"{len(gaps)} presentation {_plural(len(gaps), 'gap')} to fix; listing fatigue risk is {fatigue.lower()}."
        if gaps else f"Presentation compares well; listing fatigue risk is {fatigue.lower()}."
    )

    # ── Risk ─────────────────────────────────────────────────────────────
    points = 0
    points += 3 if stale_signal >= 90 else 2 if stale_signal >= 75 else 1 if stale_signal >= 50 else 0
    points += 3 if success_gap >= 5 else 2 if success_gap >= 2 else 1 if success_gap else 0
    points += {"High": 2, "Moderate": 1}.get(pressure, 0)
    points += 2 if (price_gap or 0) > 10 else 1 if (price_gap or 0) > 0 else 0
    points += 1 if (days_since_reduction is not None and days_since_reduction > 60) else 0
    points += 1 if (long_listed or 0) >= 180 else 0
    risk = _level(points, (3, 6, 9), LEVELS_RISK)
    priority = {"Critical": "Immediate review", "High": "Priority", "Moderate": "Soon", "Low": "Routine"}[risk]
    risk_bits = []
    if dom is not None:
        risk_bits.append(f"{dom} days on the market")
    if success_gap:
        risk_bits.append(f"{success_gap} similar {_plural(success_gap, 'home')} sold or agreed since it was listed")
    if price_gap is not None and price_gap > 0:
        risk_bits.append("priced above the local evidence")
    risk_reason = (", ".join(risk_bits) + ".") if risk_bits else "Few warning signs in the local market."
    risk_reason = risk_reason[:1].upper() + risk_reason[1:]

    # ── Vendor pressure ──────────────────────────────────────────────────
    # A vendor whose home has sat unsold this long is under pressure: it's
    # always High on these listings; the reasons say why for this one.
    pressure_reasons: list[str] = []
    if dom is not None:
        line = f"On the market {dom} days without a sale"
        if ratio is not None and ratio >= 1.2:
            line += f", {ratio:.1f}× the {benchmark}-day local norm"
        pressure_reasons.append(line + ".")
    if reduced:
        pressure_reasons.append(
            f"Price already reduced on {_nice_date(reduced)} ({days_since_reduction} days ago) and still unsold."
            if days_since_reduction is not None else "Price already reduced and still unsold."
        )
    elif reduced == "":
        pressure_reasons.append("Price already reduced and still unsold.")
    if sold_since:
        pressure_reasons.append(f"{len(sold_since)} similar {_plural(len(sold_since), 'home')} listed after it {'is' if len(sold_since) == 1 else 'are'} already under offer or sold STC.")
    if sales_since:
        pressure_reasons.append(f"{len(sales_since)} similar {_plural(len(sales_since), 'home')} {sales_area} {'has' if len(sales_since) == 1 else 'have'} completed a sale {since_label} (HM Land Registry).")
    if reduced_nearby:
        pressure_reasons.append(f"{len(reduced_nearby)} competing {_plural(len(reduced_nearby), 'home')} nearby {'has' if len(reduced_nearby) == 1 else 'have'} cut {'its' if len(reduced_nearby) == 1 else 'their'} price.")
    if not pressure_reasons:
        pressure_reasons.append("Still unsold after a long time on the market.")
    vendor_pressure = "High"

    # ── Health ───────────────────────────────────────────────────────────
    # A part we have no local data for counts as neutral (50), not as good.
    components = {
        "Time on the market": time_component,
        "Price position": price_score if price_score is not None else 50,
        "Presentation": presentation,
        "Competition": {"Low": 80, "Moderate": 55, "High": 30}[pressure] if similar else 50,
        "Similar homes selling": max(5, 100 - 15 * success_gap) if (similar_seen or sales) else 50,
    }
    health = round(sum(components.values()) / len(components))

    # ── Vendor ───────────────────────────────────────────────────────────
    questions: list[str] = []
    if dom_gap is not None and dom_gap > 0:
        questions.append("Why has ours been on the market longer than similar homes?")
    elif dom is not None and dom >= 180:
        questions.append(f"Why is ours still unsold after {dom} days?")
    if sold_since:
        verb = "sell (subject to contract)" if sold_since[0].get("status") == "sold_stc" else "go under offer"
        questions.append(f"Why did {sold_since[0]['address']} {verb} before ours?")
    if sales_since:
        questions.append("Similar homes nearby are selling — why isn't ours?")
    if reduced or reduced == "":
        questions.append("We reduced the price — why hasn't it worked?")
    if price_gap is not None and price_gap > 0:
        questions.append("Are we priced right against what's for sale and what's selling nearby?")
    if gaps:
        questions.append("Could the way it's presented online be holding it back?")
    if competitors_agreed_segment >= 2:
        questions.append("Would another agent sell it faster?")
    if len(new_30) >= 3:
        questions.append("New homes like ours keep coming on — how do we stand out?")
    if len(questions) < 3:
        questions.append("What would you change first, and how soon would we see a difference?")

    talking: list[str] = []
    if dom is not None and benchmark is not None:
        talking.append(f"It has been on the market {dom} days; {benchmark_basis} still for sale nearby have typically been listed {benchmark} days.")
    elif dom is not None:
        talking.append(f"It has been on the market {dom} days without a sale.")
    if agreed:
        talking.append(f"{len(agreed)} {basis_label} nearby are under offer or sold STC, {len(sold_since)} of them listed after this one.")
    if median_price and price:
        direction = "above" if price > median_price else "below"
        talking.append(f"The asking price is {abs(premium)}% {direction} the middle of {len(comp_prices)} {short_basis} for sale nearby ({_money(median_price)}).")
    if sold_median and sales_12m:
        talking.append(f"HM Land Registry recorded {len(sales_12m)} sales of {sales_word} {sales_area} in the last 12 months; the middle price was {_money(sold_median)}.")
    if sales_since:
        talking.append(f"{len(sales_since)} similar {_plural(len(sales_since), 'home')} {sales_area} {'has' if len(sales_since) == 1 else 'have'} completed a sale {since_label}.")
    if photos is None and subject.get("floorplans") is None:
        talking.append("We couldn't read the listing's photos and floorplan this time; check them against the similar listings below.")
    if gaps:
        talking.append("Presentation: " + "; ".join(gaps) + ".")
    if reduced_nearby:
        talking.append(f"{len(reduced_nearby)} competing {_plural(len(reduced_nearby), 'home')} nearby {'has' if len(reduced_nearby) == 1 else 'have'} recently cut {'its' if len(reduced_nearby) == 1 else 'their'} price.")

    # ── What to do now (the five steps, ordered by urgency) ──────────────
    def pri(level: str) -> str:
        return {"Critical": "Immediate", "High": "High", "Moderate": "Medium", "Elevated": "High", "Strong": "High"}.get(level, "Low")

    if premium is not None:
        pricing_why = f"Asking price is {abs(premium)}% {'above' if premium > 0 else 'below'} similar homes for sale nearby."
    elif sold_premium is not None:
        pricing_why = f"Asking price is {abs(sold_premium)}% {'above' if sold_premium > 0 else 'below'} the middle recorded sale of {sales_word} {sales_area}."
    else:
        pricing_why = "Compare the asking price with what's for sale and recently sold nearby."
    actions = [
        {"title": "Contact the vendor", "priority": pri(risk) if risk != "Low" else "High",
         "why": f"Vendor pressure is high and instruction risk is {risk.lower()}; get ahead of the conversation with the evidence below."},
        {"title": "Review the pricing position", "priority": pri(reduction_pressure) if reduction_pressure != "Low" else "Medium",
         "why": pricing_why},
        {"title": "Refresh the presentation", "priority": "High" if len(gaps) >= 2 else "Medium" if gaps else "Low",
         "why": ("Fix: " + "; ".join(gaps) + ".") if gaps else "The listing's presentation compares well with similar homes."},
        {"title": "Reassess the buyer audience", "priority": "High" if (buyer_appeal or 100) < 50 else "Medium" if (buyer_appeal or 100) < 65 else "Low",
         "why": (f"Havlo's assessment scores buyer appeal {round(buyer_appeal)}/100." if buyer_appeal is not None
                 else "Check who the listing is speaking to.")},
        {"title": "Prepare a relaunch", "priority": pri(relaunch) if relaunch != "Limited" else "Low",
         "why": f"Relaunch opportunity is {relaunch.lower()}; listing fatigue risk is {fatigue.lower()}."},
    ]
    actions.sort(key=lambda a: PRIORITY_ORDER[a["priority"]])

    # ── What the vendor can see ──────────────────────────────────────────
    view_items: list[dict[str, Any]] = []
    if dom is not None:
        view_items.append({"value": f"{dom} days", "text": "on the market without a sale" + (f"; {benchmark_basis} still for sale nearby have typically been listed {benchmark} days" if benchmark else "")})
    elif reduced:
        view_items.append({"value": _nice_date(reduced), "text": f"the last price reduction, {days_since_reduction} days ago" if days_since_reduction is not None else "the last price reduction"})
    if similar_seen:
        view_items.append({"value": len(since_listed), "text": f"{short_basis} have come to market {area} {since_label}"})
        view_items.append({"value": len(agreed), "text": "are under offer or sold STC" + (f", {len(sold_since)} of them listed after this one" if sold_since else "")})
    if sales:
        view_items.append({"value": len(sales_since), "text": f"similar {_plural(len(sales_since), 'home')} {sales_area} {'has' if len(sales_since) == 1 else 'have'} completed a sale {since_label} (HM Land Registry)"})
    if sold_median:
        view_items.append({"value": _money(sold_median), "text": f"was the middle recorded sale of {sales_word} {sales_area} in the last 12 months ({len(sales_12m)} {_plural(len(sales_12m), 'sale')})"})
    if alternatives:
        view_items.append({"value": len(alternatives), "text": f"competing {_plural(len(alternatives), 'home')} for sale within 15% of the asking price"})
    if competitors_agreed_segment:
        view_items.append({"value": competitors_agreed_segment, "text": f"other {_plural(competitors_agreed_segment, 'agency has', 'agencies have')} homes in this segment under offer or sold STC"})
    if reduced_nearby:
        view_items.append({"value": len(reduced_nearby), "text": f"competing {_plural(len(reduced_nearby), 'home')} nearby {'has' if len(reduced_nearby) == 1 else 'have'} recently reduced {'its' if len(reduced_nearby) == 1 else 'their'} price"})
    # The listing itself is always there to compare: what buyers see first.
    if len(view_items) < 3 and isinstance(photos, int):
        view_items.append({"value": photos, "text": "photos on the listing" + (f"; similar listings show {round(comp_photos)}" if comp_photos else "")})
    if len(view_items) < 3 and gaps:
        view_items.append({"value": len(gaps), "text": f"presentation {_plural(len(gaps), 'gap')} buyers will notice: " + "; ".join(gaps)})
    if len(view_items) < 3 and price:
        view_items.append({"value": _money(price), "text": "asking price, " + (f"{_money(ppb)} a bedroom" if ppb else "on Rightmove")})

    # ── Headline cards for the competition section (always four) ─────────
    cards: list[dict[str, Any]] = []
    if staleness is not None:
        cards.append({"label": "Staleness", "value": f"{staleness}/100", "sub": f"share of {benchmark_basis} for sale listed more recently"})
    if similar:
        cards.append({"label": f"{short_basis.capitalize()} for sale", "value": str(len(for_sale)), "sub": area})
        cards.append({"label": "Within 15% of your price", "value": str(len(alternatives)), "sub": "buyers' alternatives"})
    if similar_seen:
        cards.append({"label": "New in the last 30 days", "value": str(len(new_30)), "sub": f"{short_basis} {area}"})
    if sales:
        cards.append({"label": "Sold since it was listed", "value": str(len(sales_since)), "sub": f"similar {homes_word} {sales_area}, HM Land Registry"})
        cards.append({"label": "Recorded sales (12 months)", "value": str(len(sales_12m)), "sub": f"{sales_word} {sales_area}"})
    if dom is not None:
        cards.append({"label": "Days on the market", "value": str(dom), "sub": f"vs {benchmark}-day local benchmark" if benchmark else "without a sale"})
    if price_score is not None:
        cards.append({"label": "Price position", "value": f"{price_score}/100", "sub": "against the local evidence" if (comp_prices or sold_median) else "Havlo's assessment"})
    if price:
        cards.append({"label": "Asking price", "value": _money(price), "sub": f"{_money(ppb)} a bedroom" if ppb else "on Rightmove"})
    cards.append({"label": "Portal presentation", "value": f"{presentation}/100", "sub": f"{len(gaps)} {_plural(len(gaps), 'gap')} to fix" if gaps else "no gaps found"})
    cards = cards[:4]

    # ── Branch view ──────────────────────────────────────────────────────
    others = sorted(portfolio, key=lambda p: -(p.get("dom") or 0))
    rank = next((i + 1 for i, p in enumerate(others) if p.get("id") == subject.get("id")), None)

    def row(r: dict[str, Any]) -> dict[str, Any]:
        return {k: r.get(k) for k in ("address", "price", "bedrooms", "type", "status", "first_listed", "distance", "agent", "url")}

    def sale_row(s: dict[str, Any]) -> dict[str, Any]:
        return {"address": s.get("address") or "", "price": s.get("price"), "date": sale_day(s), "type": s.get("type") or ""}

    competing = sorted(for_sale, key=lambda r: abs((r.get("price") or 0) - (price or 0)) if price else 0)[:8]
    parts = []
    if similar:
        parts.append(f"{len(similar)} {basis_label} {area}")
    if sales:
        parts.append(f"{len(sales)} recorded {_plural(len(sales), 'sale')} {sales_area} (HM Land Registry)")
    summary = ("Compared with " + " and ".join(parts) + ".") if parts else "Based on the listing itself and Havlo's assessment of it."

    return {
        "version": INTEL_VERSION,
        "generated_at": today.isoformat(),
        "radius": radius,
        "area_label": area,
        "summary": summary,
        "sources": {**sources, "nearby_area": area, "sales_area": sales_area, "nearby_count": total_nearby, "sales_count": len(sales)},
        "basis": basis,
        "basis_label": basis_label,
        "comparables": len(similar),
        "nearby_total": total_nearby,
        "subject": {
            "listed_date": listed_date, "reduced_date": reduced, "days_since_reduction": days_since_reduction,
            "dom": dom, "agent": subject.get("agent") or "",
        },
        "headline": {
            "health": health,
            "risk": risk,
            "risk_reason": risk_reason,
            "vendor_pressure": vendor_pressure,
            "vendor_pressure_reasons": pressure_reasons,
            "vendor_frustration": vendor_pressure,
            "dom": dom,
            "dom_benchmark": benchmark,
            "reduced_date": reduced,
            "days_since_reduction": days_since_reduction,
            "competitor_pressure": pressure,
            "competitor_reason": (
                f"{len(alternatives)} {_plural(len(alternatives), 'home')} for sale within 15% of your price {area}."
                if similar else
                f"Havlo's assessment of the competition ({round(ai_competition)}/100); listings nearby are re-read within the hour."
                if pressure_from_assessment else "No competing listings found nearby."
            ),
            "success_gap": success_gap,
            "success_gap_rightmove": len(sold_since),
            "success_gap_sales": len(sales_since),
            "relaunch": relaunch,
            "relaunch_reason": relaunch_reason,
            "price": price,
        },
        "health_components": components,
        "vendor_view": {
            "since_label": since_label,
            "new_since_listed": len(since_listed),
            "agreed": len(agreed),
            "agreed_since_listed": len(sold_since),
            "sold_since_listed": len(sales_since),
            "competitor_agencies_agreed": competitors_agreed_segment,
            "reduced_nearby": len(reduced_nearby),
            "items": view_items,
        },
        "market": {
            "cards": cards,
            "staleness": staleness,
            "dom_gap": dom_gap,
            "for_sale": len(for_sale),
            "alternatives": len(alternatives),
            "new_30": [row(r) for r in sorted(new_30, key=lambda r: r.get("first_listed") or "", reverse=True)[:8]],
            "sold_since": [row(r) for r in sold_since[:8]],
            "competing": [row(r) for r in competing],
            "new_since_listed": len(since_listed),
        },
        "sold": {
            "area_label": sales_area,
            "homes_label": sales_word,
            "count_12m": len(sales_12m),
            "median_12m": round(sold_median) if sold_median else None,
            "low_12m": min((s["price"] for s in sales_12m), default=None),
            "high_12m": max((s["price"] for s in sales_12m), default=None),
            "since_listed": [sale_row(s) for s in sales_since[:8]],
            "recent": [sale_row(s) for s in sales_12m[:8]],
        },
        "competitors": {
            "agencies": agencies[:12],
            "leading": [a for a in agencies if a["agent"] != "Private / unknown"][:5],
            "alternative_set": competitors[:4],
            "momentum": momentum,
            "threat": threat,
            "exposure": exposure,
            "in_segment": competitors_in_segment,
            "agreed_in_segment": competitors_agreed_segment,
        },
        "pricing": {
            "median_for_sale": round(median_price) if median_price else None,
            "premium_pct": premium,
            "cheaper_share": cheaper_share,
            "price_per_bedroom": ppb,
            "comparable_price_per_bedroom": round(comp_ppb) if comp_ppb else None,
            "sold_median": round(sold_median) if sold_median else None,
            "sold_count": len(sales_12m),
            "sold_premium_pct": sold_premium,
            "reduced_date": reduced,
            "days_since_reduction": days_since_reduction,
            "reduction_pressure": reduction_pressure,
            "score": price_score,
            "comparables": [
                {k: c.get(k) for k in ("address", "property_type", "price", "date")}
                for c in (comparables or []) if isinstance(c, dict) and c.get("price")
            ],
        },
        "presentation": {
            "score": presentation,
            "assessment_score": ai_presentation,
            "photos": photos,
            "comparable_photos": round(comp_photos) if comp_photos else None,
            "floorplans": subject.get("floorplans"),
            "comparable_floorplan_share": share_floorplans,
            "virtual_tours": subject.get("virtual_tours"),
            "comparable_tour_share": share_tours,
            "description_words": words,
            "features": subject.get("features"),
            "gaps": gaps,
            "buyer_appeal": buyer_appeal,
            "findings": [
                {"title": f.get("title"), "detail": f.get("description")}
                for f in (report.get("key_findings") or [])
                if isinstance(f, dict) and f.get("icon") in ("photos", "description") and f.get("type") == "issue"
            ][:3],
        },
        "freshness": {"fatigue": fatigue, "days_since_update": since_update, "relaunch": relaunch},
        "vendor": {"priority": priority, "questions": questions[:6], "talking_points": talking},
        "actions": actions,
        "plan": [
            {"week": w.get("week"), "title": w.get("title")}
            for w in (report.get("thirty_day_plan") or []) if isinstance(w, dict)
        ][:4],
        "branch": {
            "stale_listings": len(portfolio),
            "stale_value": sum(p.get("price") or 0 for p in portfolio),
            "rank_by_time": rank,
        },
    }


TEASER_KEYS = ("version", "headline", "basis_label", "comparables", "radius", "area_label", "summary", "generated_at", "subject")


def teaser(intel: dict[str, Any]) -> dict[str, Any]:
    """What the free assessment shows: the headline figures only."""
    return {k: intel[k] for k in TEASER_KEYS if k in intel}


# ── Gathering and caching ────────────────────────────────────────────────

_refreshing: set[UUID] = set()
# A build that failed isn't retried for a couple of minutes (the page polls).
_failed_at: dict[UUID, float] = {}
RETRY_FAILED_AFTER = 120.0


def stored_intel(prospect: Any) -> dict[str, Any] | None:
    try:
        intel = json.loads(prospect.agent_intel_json or "")
    except (TypeError, ValueError):
        return None
    return intel if isinstance(intel, dict) else None


def is_current(intel: dict[str, Any] | None) -> bool:
    """Built by this version of the report (older ones lack figures)."""
    return bool(intel) and intel.get("version") == INTEL_VERSION


def is_fresh(prospect: Any, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    intel = stored_intel(prospect)
    if not is_current(intel) or not prospect.agent_intel_at:
        return False
    at = prospect.agent_intel_at
    if at.tzinfo is None:  # stored as UTC
        at = at.replace(tzinfo=timezone.utc)
    searched = (intel.get("sources") or {}).get("nearby") == "rightmove"
    return now - at < (INTEL_MAX_AGE if searched else INTEL_RETRY_AGE)


async def _search_nearby(location_query: str, own_id: str) -> tuple[list[dict[str, Any]], float | None, dict[str, Any] | None]:
    """Homes for sale around the property from Rightmove's search, widening
    while thin: (rows without the property itself, radius in miles, the
    property's own search row when it appears). Never raises; a step that
    fails or runs out of time keeps what the narrower one found."""
    from app.services import listing_monitor as lm, listing_scraper

    rows: list[dict[str, Any]] = []
    radius: float | None = None
    own: dict[str, Any] | None = None
    if not location_query:
        return rows, radius, own
    deadline = time.monotonic() + SEARCH_BUDGET
    try:
        async with httpx.AsyncClient(headers=listing_scraper._browser_headers("https://www.rightmove.co.uk/")) as client:
            location = await asyncio.wait_for(lm.resolve_location_id(client, location_query), 40)
            if not location:
                logger.warning("Agent report: Rightmove has no location for %r", location_query)
                return rows, radius, own
            for miles, pages in SEARCH_STEPS:
                remaining = deadline - time.monotonic()
                if remaining < 15:
                    break
                try:
                    found = await asyncio.wait_for(lm.fetch_nearby(client, location, miles, pages=pages), remaining)
                except Exception as exc:  # noqa: BLE001 -- keep what the narrower search found
                    logger.warning("Agent report: Rightmove search (%s mi) failed: %s: %s", miles, type(exc).__name__, exc)
                    break
                own = next((x for x in found if x["id"] == own_id), own)
                others = [{**x, "source": "rightmove"} for x in found if x["id"] != own_id]
                if len(others) >= len(rows):
                    rows, radius = others, miles
                if len(rows) > lm.NEARBY_MIN_LISTINGS:
                    break
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent report: nearby search failed for %r: %s", location_query, exc)
    return rows, radius, own


def _record_row(p: Any) -> dict[str, Any] | None:
    """A listing Havlo found on Rightmove, as a nearby_row()."""
    from app.services import listing_monitor as lm
    from app.services import stale_prospect_service as sps

    rm_id = (p.rightmove_id or lm.rightmove_listing_id(p.rightmove_url) or "").strip()
    if not rm_id:
        return None
    try:
        snapshot = json.loads(p.listing_snapshot_json or "{}") or {}
    except ValueError:
        snapshot = {}
    reduced = sps.reduced_date_info(p, snapshot if isinstance(snapshot, dict) else {})
    images = snapshot.get("images") if isinstance(snapshot, dict) else None
    return {
        "id": rm_id, "address": p.property_address, "price": int(p.asking_price) if p.asking_price else None,
        "bedrooms": p.bedrooms, "type": p.property_type or "", "status": "on_market",
        "update": "price_reduced" if reduced is not None else "", "update_date": reduced or "",
        "first_listed": p.listed_date.date().isoformat() if (p.listed_date and reduced is None) else "",
        "distance": None, "url": p.rightmove_url, "image": (snapshot.get("image") if isinstance(snapshot, dict) else "") or "",
        "agent": (p.agent_brand or p.agent_company_name or "").strip(), "branch": p.agent_branch_name or "",
        "branch_id": p.agent_branch_id or "", "photos": len(images) if isinstance(images, list) and images else None,
        "floorplans": None, "virtual_tours": None, "source": "records",
    }


async def _recorded_nearby(prospect: Any, outcode: str, exclude: set[str]) -> list[dict[str, Any]]:
    """When the live search is thin: the latest weekly Rightmove searches
    around monitored listings in the same postcode district, then the
    listings Havlo itself found on Rightmove there. Never raises."""
    from sqlalchemy import or_, select

    from app.db.database import AsyncSessionLocal
    from app.models.models import StaleListingMonitor, StaleListingProspect

    rows: dict[str, dict[str, Any]] = {}
    area = or_(StaleListingProspect.postcode == outcode, StaleListingProspect.postcode.like(f"{outcode} %"))
    now = datetime.now(timezone.utc)
    try:
        async with AsyncSessionLocal() as db:
            snapshots = (await db.execute(
                select(StaleListingMonitor.nearby_json)
                .join(StaleListingProspect, StaleListingProspect.id == StaleListingMonitor.prospect_id)
                .where(area, StaleListingMonitor.nearby_json.is_not(None))
                .where(StaleListingMonitor.last_nearby_check_at >= now - timedelta(days=21))
                .order_by(StaleListingMonitor.last_nearby_check_at.desc())
                .limit(6)
            )).scalars().all()
            for text in snapshots:
                try:
                    listings = (json.loads(text or "{}") or {}).get("listings") or []
                except ValueError:
                    continue
                for r in listings:
                    if isinstance(r, dict) and r.get("id") and r["id"] not in exclude:
                        rows.setdefault(r["id"], {**r, "distance": None, "source": "monitor"})
            found = (await db.execute(
                select(StaleListingProspect)
                .where(area, StaleListingProspect.country == "UK", StaleListingProspect.audience == "owner")
                .where(StaleListingProspect.is_manual.is_(False))
                .where(StaleListingProspect.rightmove_url.ilike("%rightmove.co.uk%"))
                .where(StaleListingProspect.created_at >= now - timedelta(days=RECORDS_MAX_AGE_DAYS))
                .where(StaleListingProspect.id != (prospect.parent_prospect_id or prospect.id))
                .order_by(StaleListingProspect.created_at.desc())
                .limit(150)
            )).scalars().all()
            for p in found:
                r = _record_row(p)
                if r and r["id"] not in exclude:
                    rows.setdefault(r["id"], r)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent report: recorded listings lookup failed for %s: %s", outcode, exc)
    return list(rows.values())


def _sale_dict(s: dict[str, Any]) -> dict[str, Any]:
    from app.services.land_registry import LR_TYPE_LABELS

    when = s.get("date")
    return {
        "address": s.get("address") or "", "price": int(s["price"]),
        "date": when.isoformat() if hasattr(when, "isoformat") else str(when or "")[:10],
        "type": LR_TYPE_LABELS.get(s.get("type") or "", s.get("type") or ""),
    }


async def _area_sales(postcode: str | None, outcode: str | None, since: date, subject_address: str) -> tuple[list[dict[str, Any]], str | None]:
    """Recorded sales around the property since `since` and how the area is
    described: the postcodes within ~half a mile (a mile if thin), else the
    postcode sector or district. ([], None) when our copy of the price paid
    data isn't loaded yet. Never raises."""
    from sqlalchemy import select

    from app.db import database
    from app.models.models import LandRegistrySale
    from app.services import land_registry as lr, listing_monitor as lm, price_paid_data as ppd

    try:
        if not await ppd.ready():
            return [], None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent report: price paid data status unavailable: %s", exc)
        return [], None
    own = lr._house_key(subject_address)

    def keep(found: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [_sale_dict(s) for s in found if not (own and lr._house_key(s.get("address") or "") == own)]

    if (postcode or outcode) and not lr.paused_for():
        try:
            async with lr._client() as client:
                location = await lr._locate(client, postcode, outcode)
                if location:
                    best: list[dict[str, Any]] = []
                    label = None
                    for metres, area_label in SALES_RADII:
                        r = await lr._request(client, "GET", f"{lr.POSTCODES_IO}/postcodes", params={
                            "lat": location[0], "lon": location[1], "radius": metres, "limit": 100,
                        })
                        postcodes = [i["postcode"] for i in (r.json().get("result") or []) if i.get("postcode")] if r.status_code == 200 else []
                        if postcode and postcode not in postcodes:
                            postcodes.insert(0, postcode)
                        if not postcodes:
                            continue
                        best, label = await ppd.recorded_sales(postcodes, since, limit=800), area_label
                        if len(best) >= SALES_MIN:
                            break
                    if label:
                        return keep(best), label
        except Exception as exc:  # noqa: BLE001 -- fall back to the postcode sector below
            logger.warning("Agent report: nearby postcodes lookup failed for %s: %s", postcode or outcode, exc)
    sector = lm.postcode_sector(postcode or "")
    sale = LandRegistrySale
    try:
        async with database.AsyncSessionLocal() as db:
            for prefix, pattern, label in ((sector, f"{sector}%", f"in the {sector} postcode sector"), (outcode, f"{outcode} %", f"in {outcode}")):
                if not prefix:
                    continue
                rows = (await db.execute(
                    select(sale.paon, sale.saon, sale.street, sale.postcode, sale.price, sale.sale_date, sale.property_type)
                    .where(sale.postcode.like(pattern))
                    .where(sale.sale_date >= since)
                    .order_by(sale.sale_date.desc())
                    .limit(800)
                )).all()
                found = ppd.sales_from_rows([tuple(r) for r in rows])
                if len(found) >= SALES_MIN or prefix == outcode:
                    return keep(found), label
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent report: recorded sales lookup failed for %s: %s", postcode or outcode, exc)
    return [], None


async def gather(prospect: Any) -> dict[str, Any]:
    """Fetch what compute_intel needs for an agency's copy of a listing.
    Each source is tried on its own and may come back empty; this never
    raises for a source that didn't answer."""
    from app.db.database import AsyncSessionLocal
    from app.models.models import StaleAgentAccount
    from app.services import agent_campaign, land_registry, listing_monitor as lm
    from app.services import stale_prospect_service as sps

    today = datetime.now(timezone.utc).date()
    snapshot = json.loads(prospect.listing_snapshot_json or "{}") or {}
    report = json.loads(sps.current_report_json(prospect) or "{}") or {}
    sources: dict[str, Any] = {"listing": "saved", "nearby": None, "sales": None}
    own_id = lm.rightmove_listing_id(prospect.rightmove_url)
    known = (prospect.postcode, snapshot.get("postcode"), prospect.property_address)

    async def read_listing() -> dict[str, Any]:
        try:
            state = await asyncio.wait_for(lm.fetch_listing_state(prospect.rightmove_url), 45)
            sources["listing"] = "rightmove"
            return state
        except Exception as exc:  # noqa: BLE001
            logger.warning("Agent report: live listing read failed for %s: %s", prospect.id, exc)
            return {}

    # The listing page and the search around it don't depend on each other
    # (the search goes by the postcode we hold), so they run together.
    query = land_registry.full_postcode(*known) or land_registry.outcode(*known) or ""
    if query:
        live, (nearby, radius, own_row) = await asyncio.gather(read_listing(), _search_nearby(query, own_id))
    else:
        live = await read_listing()
        nearby, radius, own_row = await _search_nearby(
            land_registry.full_postcode(live.get("postcode")) or land_registry.outcode(live.get("postcode")) or "", own_id)
    postcode = land_registry.full_postcode(live.get("postcode"), *known)
    outcode = land_registry.outcode(live.get("postcode"), *known)
    if nearby:
        sources["nearby"] = "rightmove"
    if len(nearby) <= lm.NEARBY_MIN_LISTINGS and outcode:
        extra = await _recorded_nearby(prospect, outcode, {own_id, *(r["id"] for r in nearby)})
        if extra:
            nearby = nearby + extra
            if sources["nearby"]:
                sources["nearby_area"] = f"{radius_label(radius)} and in {outcode}"
            else:
                sources["nearby"] = "monitor" if any(r.get("source") == "monitor" for r in extra) else "records"
                sources["nearby_area"] = f"in {outcode}"
                radius = None
            sources["supplemented"] = True

    reduced = sps.reduced_date_info(prospect, snapshot)
    listed: str | None = None
    if reduced is None:
        if prospect.listed_date:
            listed = prospect.listed_date.date().isoformat()
        elif prospect.listing_duration_days:
            listed = (today - timedelta(days=int(prospect.listing_duration_days))).isoformat()
    first_seen = (own_row or {}).get("first_listed") or None
    if reduced is not None and first_seen:
        # Rightmove's search shows when a reduced listing first went live.
        listed = first_seen
    if reduced is None:
        dom = agent_campaign.days_on_market(prospect, today=today) or None
    else:
        dom = (today - date.fromisoformat(listed[:10])).days if listed else None
    description = (snapshot.get("description") or "")
    own = own_row or {}
    subject = {
        "id": str(prospect.parent_prospect_id or prospect.id),
        "address": prospect.property_address,
        "price": int(prospect.asking_price) if prospect.asking_price else (live.get("price") or own.get("price")),
        "dom": dom,
        "listed_date": listed,
        "reduced_date": reduced,
        "bedrooms": prospect.bedrooms or live.get("bedrooms"),
        "type": prospect.property_type or live.get("property_type") or own.get("type") or "",
        "agent": prospect.agent_brand or live.get("agent") or own.get("agent") or "",
        "branch_id": prospect.agent_branch_id or "",
        "photos": live.get("image_count") if live else (own.get("photos") or len(snapshot.get("images") or []) or None),
        "floorplans": live.get("floorplans") if live else own.get("floorplans"),
        "virtual_tours": live.get("virtual_tours") if live else own.get("virtual_tours"),
        "description_words": live.get("description_words") if live else (len(description.split()) or None),
        "features": len(live.get("features") or []) if live else (len(snapshot.get("features") or []) or None),
        "last_update": reduced or None,
    }

    since = today - timedelta(days=365)
    start = listed or reduced
    if start:
        try:
            since = min(since, date.fromisoformat(start[:10]))
        except ValueError:
            pass
    since = max(since, today - timedelta(days=SALES_LOOKBACK_DAYS))

    async def comparable_sales() -> list[dict[str, Any]]:
        # The assessment's "Comparable sold prices", so both pages show the same sales.
        try:
            return await asyncio.wait_for(sps.refresh_sold_comparables(prospect), 45) or []
        except Exception as exc:  # noqa: BLE001
            logger.warning("Agent report: comparable sold prices unavailable for %s: %s", prospect.id, exc)
            return sps.cached_sold_comparables(prospect) or []

    (sales, sales_area), comparables = await asyncio.gather(
        _area_sales(postcode, outcode, since, prospect.property_address), comparable_sales(),
    )
    if sales_area:
        sources["sales"] = "land_registry"
        sources["sales_area"] = sales_area

    portfolio: list[dict[str, Any]] = []
    if prospect.agent_account_id:
        try:
            async with AsyncSessionLocal() as db:
                account = await db.get(StaleAgentAccount, prospect.agent_account_id)
                if account:
                    for p in await agent_campaign.portfolio(db, account):
                        portfolio.append({"id": str(p.id), "address": p.property_address,
                                          "price": int(p.asking_price) if p.asking_price else 0,
                                          "dom": agent_campaign.days_on_market(p, today=today)})
        except Exception as exc:  # noqa: BLE001
            logger.warning("Agent report: portfolio unavailable for %s: %s", prospect.id, exc)
    return {"subject": subject, "nearby": nearby, "sales": sales, "report": report, "portfolio": portfolio,
            "radius": radius, "today": today, "comparables": comparables, "sources": sources}


async def build_intel(prospect: Any) -> dict[str, Any]:
    data = await gather(prospect)
    return compute_intel(data["subject"], data["nearby"], data["sales"], data["report"], data["portfolio"],
                         radius=data["radius"], today=data["today"], comparables=data["comparables"],
                         sources=data["sources"])


async def refresh_agent_intel(prospect_id: UUID) -> None:
    """Build and store the report data for an agency's copy (background)."""
    from app.db.database import AsyncSessionLocal
    from app.models.models import StaleListingProspect

    if prospect_id in _refreshing:
        return
    _refreshing.add(prospect_id)
    try:
        async with AsyncSessionLocal() as db:
            prospect = await db.get(StaleListingProspect, prospect_id)
            if prospect is None or prospect.audience != "agent":
                return
            intel = await build_intel(prospect)
            prospect.agent_intel_json = json.dumps(intel)
            prospect.agent_intel_at = datetime.now(timezone.utc)
            await db.commit()
            _failed_at.pop(prospect_id, None)
    except Exception:  # noqa: BLE001
        _failed_at[prospect_id] = time.monotonic()
        logger.exception("Agent report build failed for %s", prospect_id)
    finally:
        _refreshing.discard(prospect_id)


_tasks: set[asyncio.Task] = set()


def recently_failed(prospect_id: UUID) -> bool:
    failed = _failed_at.get(prospect_id)
    return failed is not None and time.monotonic() - failed < RETRY_FAILED_AFTER


def start_refresh(prospect_id: UUID) -> None:
    """Kick off a background build if one isn't already running (or just
    failed). The task is kept referenced until it ends, or the event loop
    may drop it."""
    if prospect_id not in _refreshing and not recently_failed(prospect_id):
        task = asyncio.get_running_loop().create_task(refresh_agent_intel(prospect_id))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)


def is_refreshing(prospect_id: UUID) -> bool:
    return prospect_id in _refreshing
