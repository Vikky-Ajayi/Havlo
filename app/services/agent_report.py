"""The agent-facing report on one of an agency's stale listings: how at risk
the instruction is, what the market around it is doing, who the competing
agencies are, and what to do next.

Everything is either measured from data we hold or clearly labelled:
  * the listing itself (price, days on market, reduction, photos, floorplan,
    video tour, description) from its Rightmove page and our record;
  * the homes for sale within half a mile (a mile if that's thin) from a
    Rightmove search: price, status (for sale / under offer / sold STC),
    when each was first listed, recent reductions, and the marketing agency;
  * recorded sold prices in the postcode sector (HM Land Registry);
  * Havlo's assessment of the listing (the existing report's scores,
    findings and plan);
  * the agency's other stale listings.
Estimates say what they are (e.g. the days-on-market benchmark is the
typical age of similar homes still for sale nearby, not how long sold
homes took). Commission is worked out on the page from a fee the agent can
change. compute_intel() is pure; gather() and refresh_agent_intel() do the
fetching and caching (StaleListingProspect.agent_intel_json).
"""
from __future__ import annotations

import asyncio
import json
import logging
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx

logger = logging.getLogger(__name__)

INTEL_MAX_AGE = timedelta(days=7)
SIMILAR_MIN = 4  # fewer similar homes than this: compare with every home nearby
# Read the whole local stock (not just the newest homes), so the typical age
# of homes for sale isn't skewed young. 6 pages = up to 144 homes.
NEARBY_PAGES = 6
LEVELS_RISK = ("Low", "Moderate", "High", "Critical")
PRIORITY_ORDER = {"Immediate": 0, "High": 1, "Medium": 2, "Low": 3}


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


def _level(value: int, cuts: tuple[int, ...], names: tuple[str, ...]) -> str:
    """names[i] for the first cut value is below; the last name otherwise."""
    for cut, name in zip(cuts, names):
        if value < cut:
            return name
    return names[-1]


def compute_intel(
    subject: dict[str, Any],
    nearby: list[dict[str, Any]],
    sales: list[dict[str, Any]],
    report: dict[str, Any],
    portfolio: list[dict[str, Any]],
    *,
    radius: float | None,
    today: date,
) -> dict[str, Any]:
    """subject: price, dom, listed_date (ISO), reduced_date (ISO or None),
    bedrooms, type, agent, branch_id, photos, floorplans, virtual_tours,
    description_words, features, last_update (ISO or None), address.
    nearby: listing_monitor.nearby_row()s, the subject excluded.
    portfolio: the agency's stale listings ({id, address, price, dom}),
    this one included (id == subject["id"])."""
    from app.services.listing_monitor import broad_type, is_similar

    price = subject.get("price")
    dom = subject.get("dom")
    # "Since" counts from when it went live, or (for a listing we only know
    # as "reduced on ...") from its last reduction.
    listed = subject.get("listed_date") or subject.get("reduced_date")
    since_label = "since this property was listed" if subject.get("listed_date") else "since its last price reduction"
    own_agent = (subject.get("agent") or "").strip().lower()

    similar = [r for r in nearby if is_similar(r, subject.get("bedrooms"), subject.get("type") or "")]
    basis = "similar"
    if len(similar) < SIMILAR_MIN:
        same_type = [r for r in nearby if broad_type(r.get("type") or "") == broad_type(subject.get("type") or "")]
        similar, basis = (same_type, "same_type") if len(same_type) >= SIMILAR_MIN else (nearby, "nearby")
    basis_label = {
        "similar": "similar homes (same type, a bedroom either way)",
        "same_type": "homes of the same type",
        "nearby": "homes for sale",
    }[basis]
    for_sale = [r for r in similar if r.get("status") == "on_market"]
    agreed = [r for r in similar if r.get("status") in ("under_offer", "sold_stc")]

    # ── Days on market against the local picture ─────────────────────────
    ages = [a for a in (_days_since(r.get("first_listed"), today) for r in for_sale) if a is not None]
    benchmark = round(_median(ages)) if len(ages) >= 3 else None
    dom_gap = (dom - benchmark) if (dom is not None and benchmark is not None) else None
    staleness = _pct(sum(1 for a in ages if a < dom), len(ages)) if (dom is not None and ages) else None

    # ── Market movement since the listing went live ──────────────────────
    since_listed = [r for r in similar if listed and (r.get("first_listed") or "") >= listed]
    new_30 = [r for r in similar if (_days_since(r.get("first_listed"), today) or 999) <= 30]
    sold_since = [r for r in agreed if listed and (r.get("first_listed") or "") >= listed]
    reduced_nearby = [r for r in for_sale if r.get("update") == "price_reduced"]
    alternatives = [r for r in for_sale if price and r.get("price") and abs(r["price"] - price) <= 0.15 * price]

    # ── Competing agencies ───────────────────────────────────────────────
    by_agent: dict[str, dict[str, Any]] = defaultdict(lambda: {"listings": 0, "agreed": 0, "new_30": 0, "similar": 0})
    for r in nearby:
        name = r.get("agent") or "Private / unknown"
        a = by_agent[name]
        a["listings"] += 1
        a["agreed"] += r.get("status") in ("under_offer", "sold_stc")
        a["new_30"] += (_days_since(r.get("first_listed"), today) or 999) <= 30
        a["similar"] += r in similar
    total_nearby = len(nearby)
    agencies = sorted(
        ({"agent": k, **v, "share": _pct(v["listings"], total_nearby), "you": k.strip().lower() == own_agent}
         for k, v in by_agent.items()),
        key=lambda a: (-a["agreed"], -a["listings"], a["agent"]),
    )
    competitors = [a for a in agencies if not a["you"] and a["agent"] != "Private / unknown"]
    competitors_agreed_segment = len({r.get("agent") for r in agreed if r.get("agent") and r["agent"].strip().lower() != own_agent})
    competitors_in_segment = len({r.get("agent") for r in similar if r.get("agent") and r["agent"].strip().lower() != own_agent})
    momentum = sorted((a for a in competitors if a["new_30"]), key=lambda a: -a["new_30"])[:5]
    pressure = _level(len(alternatives), (4, 8), ("Low", "Moderate", "High"))
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
    type_word = broad_type(subject.get("type") or "")
    type_sales = [s for s in sales if type_word and broad_type(s.get("type") or "") == type_word] or sales
    sold_median = _median([s["price"] for s in type_sales])
    reduced = subject.get("reduced_date")
    days_since_reduction = _days_since(reduced, today) if reduced else None
    if premium is not None and premium > 10 and (staleness or 0) >= 75:
        reduction_pressure = "High"
    elif premium is not None and premium > 0 and (staleness or 0) >= 50:
        reduction_pressure = "Moderate"
    else:
        reduction_pressure = "Low"
    price_score = None if premium is None else max(5, min(95, round(70 - premium * 2.5)))

    # ── Presentation ─────────────────────────────────────────────────────
    comp_photos = _median([r["photos"] for r in similar if r.get("photos") is not None])
    share_floorplans = _pct(sum(1 for r in similar if (r.get("floorplans") or 0) > 0), len(similar))
    share_tours = _pct(sum(1 for r in similar if (r.get("virtual_tours") or 0) > 0), len(similar))
    gaps: list[str] = []
    measured = 100
    photos = subject.get("photos")
    if photos is not None and comp_photos and photos < 0.8 * comp_photos:
        gaps.append(f"{photos} photos, against {round(comp_photos)} on a typical similar listing")
        measured -= 15
    if subject.get("floorplans") == 0 and share_floorplans >= 50:
        gaps.append(f"no floorplan, while {share_floorplans}% of similar listings have one")
        measured -= 20
    if subject.get("virtual_tours") == 0 and share_tours >= 25:
        gaps.append(f"no video or virtual tour, while {share_tours}% of similar listings have one")
        measured -= 10
    words = subject.get("description_words")
    if words is not None and words < 150:
        gaps.append(f"a short description ({words} words)")
        measured -= 10
    if subject.get("features") is not None and subject["features"] < 5:
        gaps.append(f"only {subject['features']} key features")
        measured -= 5
    scores = report.get("scores") or {}
    ai_presentation = scores.get("listing_presentation") if isinstance(scores.get("listing_presentation"), (int, float)) else None
    presentation = round((measured + ai_presentation) / 2) if ai_presentation is not None else measured
    buyer_appeal = scores.get("buyer_appeal") if isinstance(scores.get("buyer_appeal"), (int, float)) else None

    # ── Freshness and relaunch ───────────────────────────────────────────
    since_update = _days_since(subject.get("last_update"), today)
    ratio = (dom / benchmark) if (dom is not None and benchmark) else None
    if ratio is not None and ratio > 2 and (since_update is None or since_update > 60):
        fatigue = "High"
    elif ratio is not None and ratio > 1.3:
        fatigue = "Moderate"
    else:
        fatigue = "Low"
    if len(gaps) >= 2 or (fatigue == "High" and gaps):
        relaunch = "Strong"
    elif gaps or fatigue != "Low":
        relaunch = "Moderate"
    else:
        relaunch = "Limited"

    # ── Risk ─────────────────────────────────────────────────────────────
    points = 0
    points += 3 if (staleness or 0) >= 90 else 2 if (staleness or 0) >= 75 else 1 if (staleness or 0) >= 50 else 0
    points += 3 if len(sold_since) >= 5 else 2 if len(sold_since) >= 2 else 1 if sold_since else 0
    points += {"High": 2, "Moderate": 1}.get(pressure, 0)
    points += 2 if (premium or 0) > 10 else 1 if (premium or 0) > 0 else 0
    points += 1 if (days_since_reduction is not None and days_since_reduction > 60) else 0
    risk = _level(points, (3, 6, 9), LEVELS_RISK)
    frustration_points = (2 if (ratio or 0) > 2 else 1 if (ratio or 0) > 1.3 else 0) + (1 if reduced else 0) + (1 if sold_since else 0)
    frustration = _level(frustration_points, (2, 3), ("Low", "Elevated", "High"))
    priority = {"Critical": "Immediate review", "High": "Priority", "Moderate": "Soon", "Low": "Routine"}[risk]

    components = {
        "Time on the market": None if staleness is None else 100 - staleness,
        "Price position": price_score,
        "Presentation": presentation,
        "Competition": {"Low": 80, "Moderate": 55, "High": 30}[pressure],
        "Similar homes selling": max(5, 100 - 15 * len(sold_since)),
    }
    known = [v for v in components.values() if v is not None]
    health = round(sum(known) / len(known)) if known else None

    # ── Vendor ───────────────────────────────────────────────────────────
    questions: list[str] = []
    if dom_gap is not None and dom_gap > 0:
        questions.append("Why has ours been on the market longer than similar homes?")
    if sold_since:
        verb = "sell (subject to contract)" if sold_since[0].get("status") == "sold_stc" else "go under offer"
        questions.append(f"Why did {sold_since[0]['address']} {verb} before ours?")
    if reduced:
        questions.append("We reduced the price — why hasn't it worked?")
    if premium is not None and premium > 0:
        questions.append("Are we priced right against what's for sale nearby?")
    if gaps:
        questions.append("Could the way it's presented online be holding it back?")
    if competitors_agreed_segment >= 2:
        questions.append("Would another agent sell it faster?")
    if len(new_30) >= 3:
        questions.append("New homes like ours keep coming on — how do we stand out?")

    talking: list[str] = []
    if dom is not None and benchmark is not None:
        talking.append(f"It has been on the market {dom} days; similar homes still for sale nearby have typically been listed {benchmark} days.")
    if agreed:
        talking.append(f"{len(agreed)} {basis_label} nearby are under offer or sold STC, {len(sold_since)} of them listed after this one.")
    if median_price and price:
        direction = "above" if price > median_price else "below"
        talking.append(f"The asking price is {abs(premium)}% {direction} the middle of {len(comp_prices)} {basis_label} for sale nearby (£{round(median_price):,}).")
    if photos is None and subject.get("floorplans") is None:
        talking.append("We couldn't read the listing's photos and floorplan this time; check them against the similar listings below.")
    if sold_median and sales:
        talking.append(f"Land Registry recorded {len(type_sales)} sales in the postcode sector in the last year; the middle price was £{round(sold_median):,}.")
    if gaps:
        talking.append("Presentation: " + "; ".join(gaps) + ".")
    if reduced_nearby:
        talking.append(f"{len(reduced_nearby)} competing homes nearby have recently cut their price.")

    # ── What to do now (the five steps, ordered by urgency) ──────────────
    def pri(level: str) -> str:
        return {"Critical": "Immediate", "High": "High", "Moderate": "Medium", "Elevated": "High", "Strong": "High"}.get(level, "Low")

    actions = [
        {"title": "Contact the vendor", "priority": pri(risk) if risk != "Low" else "Medium",
         "why": f"Instruction risk is {risk.lower()}; get ahead of the conversation with the evidence below."},
        {"title": "Review the pricing position", "priority": pri(reduction_pressure),
         "why": (f"Asking price is {abs(premium)}% {'above' if (premium or 0) > 0 else 'below'} similar homes for sale nearby."
                 if premium is not None else "Compare the asking price with what's for sale and recently sold nearby.")},
        {"title": "Refresh the presentation", "priority": "High" if len(gaps) >= 2 else "Medium" if gaps else "Low",
         "why": ("Fix: " + "; ".join(gaps) + ".") if gaps else "The listing's presentation compares well with similar homes."},
        {"title": "Reassess the buyer audience", "priority": "High" if (buyer_appeal or 100) < 50 else "Medium" if (buyer_appeal or 100) < 65 else "Low",
         "why": (f"Havlo's assessment scores buyer appeal {round(buyer_appeal)}/100." if buyer_appeal is not None
                 else "Check who the listing is speaking to.")},
        {"title": "Prepare a relaunch", "priority": pri(relaunch) if relaunch != "Limited" else "Low",
         "why": f"Relaunch opportunity is {relaunch.lower()}; listing fatigue risk is {fatigue.lower()}."},
    ]
    actions.sort(key=lambda a: PRIORITY_ORDER[a["priority"]])

    # ── Branch view ──────────────────────────────────────────────────────
    others = sorted(portfolio, key=lambda p: -(p.get("dom") or 0))
    rank = next((i + 1 for i, p in enumerate(others) if p.get("id") == subject.get("id")), None)

    def row(r: dict[str, Any]) -> dict[str, Any]:
        return {k: r.get(k) for k in ("address", "price", "bedrooms", "type", "status", "first_listed", "distance", "agent", "url")}

    return {
        "generated_at": today.isoformat(),
        "radius": radius,
        "basis": basis,
        "basis_label": basis_label,
        "comparables": len(similar),
        "nearby_total": total_nearby,
        "headline": {
            "health": health,
            "risk": risk,
            "vendor_frustration": frustration,
            "dom": dom,
            "dom_benchmark": benchmark,
            "competitor_pressure": pressure,
            "success_gap": len(sold_since),
            "relaunch": relaunch,
            "price": price,
        },
        "health_components": components,
        "vendor_view": {
            "since_label": since_label,
            "new_since_listed": len(since_listed),
            "agreed": len(agreed),
            "agreed_since_listed": len(sold_since),
            "competitor_agencies_agreed": competitors_agreed_segment,
            "reduced_nearby": len(reduced_nearby),
        },
        "market": {
            "staleness": staleness,
            "dom_gap": dom_gap,
            "for_sale": len(for_sale),
            "alternatives": len(alternatives),
            "new_30": [row(r) for r in sorted(new_30, key=lambda r: r.get("first_listed") or "", reverse=True)[:8]],
            "sold_since": [row(r) for r in sold_since[:8]],
            "new_since_listed": len(since_listed),
        },
        "competitors": {
            "agencies": agencies[:10],
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
            "sold_count": len(type_sales),
            "reduced_date": reduced,
            "days_since_reduction": days_since_reduction,
            "reduction_pressure": reduction_pressure,
            "score": price_score,
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


TEASER_KEYS = ("headline", "basis_label", "comparables", "radius", "generated_at")


def teaser(intel: dict[str, Any]) -> dict[str, Any]:
    """What the free assessment shows: the headline figures only."""
    return {k: intel[k] for k in TEASER_KEYS if k in intel}


# ── Gathering and caching ────────────────────────────────────────────────

_refreshing: set[UUID] = set()


def is_fresh(prospect: Any, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    return bool(prospect.agent_intel_json and prospect.agent_intel_at and now - prospect.agent_intel_at < INTEL_MAX_AGE)


async def gather(prospect: Any) -> dict[str, Any]:
    """Fetch what compute_intel needs for an agency's copy of a listing."""
    from sqlalchemy import select

    from app.db.database import AsyncSessionLocal
    from app.models.models import StaleAgentAccount, StaleListingProspect
    from app.services import agent_campaign, listing_monitor as lm, listing_scraper
    from app.services import stale_prospect_service as sps

    today = datetime.now(timezone.utc).date()
    snapshot = json.loads(prospect.listing_snapshot_json or "{}") or {}
    report = json.loads(sps.current_report_json(prospect) or "{}") or {}
    live: dict[str, Any] = {}
    try:
        live = await lm.fetch_listing_state(prospect.rightmove_url)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent report: live listing read failed for %s: %s", prospect.id, exc)
    listed = prospect.listed_date.date().isoformat() if prospect.listed_date else None
    reduced = sps.reduced_date_info(prospect, snapshot)
    dom = agent_campaign.days_on_market(prospect, today=today) if reduced is None else None
    description = (snapshot.get("description") or "")
    subject = {
        "id": str(prospect.parent_prospect_id or prospect.id),
        "address": prospect.property_address,
        "price": int(prospect.asking_price) if prospect.asking_price else live.get("price"),
        "dom": dom if dom is not None else (prospect.listing_duration_days if reduced is None else None),
        "listed_date": listed if reduced is None else None,
        "reduced_date": reduced or None,
        "bedrooms": prospect.bedrooms,
        "type": prospect.property_type or live.get("property_type") or "",
        "agent": prospect.agent_brand or "",
        "branch_id": prospect.agent_branch_id or "",
        "photos": live.get("image_count") if live else len(snapshot.get("images") or []) or None,
        "floorplans": live.get("floorplans") if live else None,
        "virtual_tours": live.get("virtual_tours") if live else None,
        "description_words": live.get("description_words") if live else (len(description.split()) or None),
        "features": len(live.get("features") or []) if live else (len(snapshot.get("features") or []) or None),
        "last_update": None,
    }
    if reduced:
        subject["last_update"] = reduced

    nearby: list[dict[str, Any]] = []
    radius = None
    try:
        async with httpx.AsyncClient(headers=listing_scraper._browser_headers("https://www.rightmove.co.uk/")) as client:
            location = await lm.resolve_location_id(client, live.get("postcode") or prospect.postcode or "")
            if location:
                own_id = lm.rightmove_listing_id(prospect.rightmove_url)
                for r in lm.NEARBY_RADII:
                    rows = [x for x in await lm.fetch_nearby(client, location, r, pages=NEARBY_PAGES) if x["id"] != own_id]
                    nearby, radius = rows, r
                    if len(rows) > lm.NEARBY_MIN_LISTINGS:
                        break
    except Exception as exc:  # noqa: BLE001
        logger.warning("Agent report: nearby search failed for %s: %s", prospect.id, exc)

    async with AsyncSessionLocal() as db:
        sales = await lm.recent_sales(db, live.get("postcode") or prospect.postcode or "")
        portfolio: list[dict[str, Any]] = []
        if prospect.agent_account_id:
            account = await db.get(StaleAgentAccount, prospect.agent_account_id)
            if account:
                for p in await agent_campaign.portfolio(db, account):
                    portfolio.append({"id": str(p.id), "address": p.property_address,
                                      "price": int(p.asking_price) if p.asking_price else 0,
                                      "dom": agent_campaign.days_on_market(p, today=today)})
    return {"subject": subject, "nearby": nearby, "sales": sales, "report": report, "portfolio": portfolio,
            "radius": radius, "today": today}


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
            data = await gather(prospect)
            intel = compute_intel(data["subject"], data["nearby"], data["sales"], data["report"], data["portfolio"],
                                  radius=data["radius"], today=data["today"])
            prospect.agent_intel_json = json.dumps(intel)
            prospect.agent_intel_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Agent report build failed for %s", prospect_id)
    finally:
        _refreshing.discard(prospect_id)


_tasks: set[asyncio.Task] = set()


def start_refresh(prospect_id: UUID) -> None:
    """Kick off a background build if one isn't already running. The task
    is kept referenced until it ends, or the event loop may drop it."""
    if prospect_id not in _refreshing:
        task = asyncio.get_running_loop().create_task(refresh_agent_intel(prospect_id))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)


def is_refreshing(prospect_id: UUID) -> bool:
    return prospect_id in _refreshing
