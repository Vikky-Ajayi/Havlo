"""Writes the 20-factor report (overhaul, Nov 2026).

Two stages. The free preview is one AI request: a short version of all 20
factors with verdicts, plus the score, pricing line and executive summary.
The paid report (report_writer_paid, next slice) adds the detail and the
live market data. This module owns the free stage, the facts each factor is
allowed to use, and the rules that always hold: exactly 20 factors, the two
private-data factors forced to "check with your agent", the day sentence
worked out in code (never by the AI), and street or house names scrubbed
out. The existing model plumbing (groq_service._report_chat) and the claim
checks (report_guard) are reused unchanged.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services import groq_service, report_factors as rf

logger = logging.getLogger(__name__)

REPORT_VERSION = 2

# The tone the whole report is written in (owner-approved, Nov 2026). The
# examples teach it better than the rules, so a few go in every prompt.
TONE_INSTRUCTION = (
    "Write like an experienced local estate agent talking to a homeowner at their kitchen table. Be straight, "
    "warm and practical. Every factor must use a real detail from their own listing: a price, a date, a room, a "
    'figure. Say "your property", never the street or house name.\n'
    "Rules: short sentences. Everyday words. Use contractions. One idea per sentence. Lead with what you found, "
    "then why it matters to them, then what to do.\n"
    "Never use these words or habits: leverage, navigate, crucially, it's worth noting, in today's market, "
    'furthermore, proposition, narrative, optimise. No dashes dropped into sentences. No "not just X but Y". '
    "No lists of three adjectives. Don't start every paragraph the same way. Don't pad."
)

TONE_EXAMPLES = (
    "Visibility (a problem): Your asking price is £390,000. Most buyers search in round numbers, and a lot of "
    "them set £375,000 as their top limit. Because £390,000 sits just above that, anyone searching up to "
    "£375,000 never sees your home. Move to £375,000 and you land in front of all those buyers who can't find "
    "you today. The £15,000 matters less than who gets to see the listing.\n\n"
    "Engagement (check with your agent): We can't see how many people have viewed or enquired about your "
    "listing, because Rightmove keeps those numbers private. Your agent can, and it's the quickest way to know "
    "where you stand. Ask them how many views the listing has had, how many enquiries turned into viewings, and "
    "whether views have dropped off since it went live.\n\n"
    "Description (working well): Your description does its job. It leads with what buyers care about, the "
    "extended kitchen and the south-facing garden, and it's specific instead of full of filler. The room sizes "
    "are there, which saves buyers guessing. Leave it as it is."
)

_VALID_VERDICTS = {rf.PROBLEM, rf.WORKING_WELL, rf.CHECK_WITH_AGENT}
_CHECK_FALLBACK = {
    "found": "We don't hold the data for this one.",
    "why": "It still matters to your sale, so it's worth checking.",
    "action": "Ask your agent about this.",
}


# ── Street / house name scrubbing ─────────────────────────────────────────
_STREET_SUFFIX = re.compile(
    r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(Road|Close|Street|Lane|Avenue|Drive|Way|Grove|Gardens?|Crescent|"
    r"Court|Place|Terrace|Hill|Rise|View|Tops?|Walk|Row|Mews|Green|Square|Park|Meadow|Fields?)\b"
)


def _address_phrases(snapshot: dict[str, Any]) -> list[str]:
    """Street/house names from the listing address, longest first, so the
    exact address never survives in the AI's text."""
    address = str(snapshot.get("address") or snapshot.get("title") or "")
    phrases: set[str] = set()
    for part in address.split(",")[:2]:
        part = part.strip()
        # Drop a leading house number ("12 Hoo Road" -> "Hoo Road").
        part_no_num = re.sub(r"^\d+[A-Za-z]?\s+", "", part).strip()
        for candidate in (part, part_no_num):
            if candidate and not candidate.isdigit() and len(candidate) > 2:
                phrases.add(candidate)
    postcode = str(snapshot.get("postcode") or "").strip()
    if postcode:
        phrases.add(postcode)
    return sorted(phrases, key=len, reverse=True)


def scrub_place_names(text: str, snapshot: dict[str, Any], *, agent: bool = False) -> str:
    """Remove the exact street, house name and postcode from AI text, and any
    other "<Name> Road/Close/..." that slips through."""
    if not isinstance(text, str) or not text:
        return text or ""
    replacement = "this property" if agent else "your property"
    for phrase in _address_phrases(snapshot):
        text = re.sub(rf"\b{re.escape(phrase)}\b", replacement, text, flags=re.IGNORECASE)
    text = _STREET_SUFFIX.sub("your street" if not agent else "the street", text)
    return re.sub(r"\s{2,}", " ", text).strip()


# ── Facts for each factor (free preview) ──────────────────────────────────
def _fmt_sales(sales: list[dict[str, Any]] | None) -> str:
    rows = []
    for s in sales or []:
        try:
            rows.append(f"{s.get('property_type') or 'property'} sold for £{int(s['price']):,} on {s.get('date')}")
        except (TypeError, ValueError, KeyError):
            continue
    return "; ".join(rows[:6])


def build_free_facts(
    snapshot: dict[str, Any], *, asking_price: float | None, country: str,
    reduced_days: int | None, advertised_days: int | None,
    sales: list[dict[str, Any]] | None, photo_review: dict[str, Any] | None, agent: bool = False,
) -> dict[str, Any]:
    """What each factor may be written from, for the free preview. Verdicts the
    code can decide are set here; the AI decides the rest from these facts."""
    price = rf.visibility(asking_price)
    media = snapshot.get("media") if isinstance(snapshot.get("media"), dict) else {}
    description = str(snapshot.get("description") or "")
    features = [str(f) for f in snapshot.get("features") or [] if str(f).strip()]
    sales_line = _fmt_sales(sales)
    has_room_sizes = bool(re.search(r"\b\d+(\.\d+)?\s?m\b|\bx\s?\d|\bsq\s?(ft|m)\b", description, re.IGNORECASE))
    afford = rf.affordability(asking_price, country)
    facts: dict[str, dict[str, Any]] = {}

    def put(key: str, data: dict[str, Any], verdict: str | None = None) -> None:
        facts[key] = {"data": data, "verdict": verdict}

    put("visibility", price, price.get("verdict") if price.get("known") else rf.CHECK_WITH_AGENT)
    put("engagement", {"ask_for": "views, enquiries, how many became viewings, trend since launch"}, rf.CHECK_WITH_AGENT)
    put("asking_price", {"asking_price": price.get("price"), "recorded_sales_nearby": sales_line or None})
    put("pricing_range", {"asking_price": price.get("price"), "sales": sales_line or None, "visibility": price})
    put("comparable_sold", {"recorded_sales_nearby": sales_line or None},
        None if sales_line else rf.CHECK_WITH_AGENT)
    put("active_competition", {"note": "Live competitor data is in the full report."}, rf.CHECK_WITH_AGENT)
    put("buyer_demand", {"note": "Live demand data is in the full report."}, rf.CHECK_WITH_AGENT)
    put("time_on_market", {"reduced_days": reduced_days, "advertised_days": advertised_days})
    put("reduction_history", {"price_reduced": bool(snapshot.get("price_reduced")), "reduced_days": reduced_days})
    put("photography", {"photo_count": media.get("photos"),
                        "photo_review": (photo_review or {}).get("findings") if photo_review else None,
                        "overall": (photo_review or {}).get("overall") if photo_review else None})
    put("description", {"description": description[:1500], "features": features, "has_room_sizes": has_room_sizes})
    put("floor_plan", {"floorplans": media.get("floorplans"), "has_room_sizes": has_room_sizes})
    put("positioning", {"features": features, "property_type": snapshot.get("property_type"),
                        "asking_price": price.get("price")})
    put("target_buyer", {"property_type": snapshot.get("property_type"), "bedrooms": snapshot.get("bedrooms"),
                         "asking_price": price.get("price")})
    put("buyer_objections", {"asking_price": price.get("price"), "advertised_days": advertised_days,
                             "reduced_days": reduced_days, "has_room_sizes": has_room_sizes})
    put("viewing_conversion", {"ask_for": "viewings, second viewings, buyer feedback"}, rf.CHECK_WITH_AGENT)
    put("agent_marketing", {"photo_count": media.get("photos"), "floorplans": media.get("floorplans"),
                            "virtual_tours": media.get("virtual_tours"), "agent": (snapshot.get("agent") or {}).get("brand")})
    put("condition_readiness", {"description": description[:800], "ask_for": "EPC rating, boiler/service records, any works done"})
    put("affordability", afford)
    put("net_proceeds", {"asking_price": price.get("price"),
                         "ask_for": "agent fee, mortgage redemption, early repayment charges"})
    return facts


# ── The free preview writer ───────────────────────────────────────────────
def _free_prompt(facts: dict[str, Any], *, agent: bool, day_sentence: str | None) -> str:
    whose = "this property" if agent else "your property"
    lines = [
        f"Write a short property assessment for {whose}, as 20 numbered factors. Use ONLY the facts given for "
        "each factor. Do not invent viewings, enquiries, sold prices or anything not listed.",
        "",
        "Each factor needs a verdict: \"problem\", \"working_well\" or \"check_with_agent\". Where a verdict is "
        "given below, use it. Where it isn't, decide from the facts; if the facts are empty, use "
        "\"check_with_agent\".",
        "",
        "Never state any number of days on the market. The day line is fixed: "
        + (f'"{day_sentence}"' if day_sentence else "no day line is available, so don't mention days") + ".",
        "",
        "The factors and their facts:",
    ]
    for f in rf.FACTORS:
        entry = facts.get(f["key"]) or {}
        verdict = entry.get("verdict")
        data = {k: v for k, v in (entry.get("data") or {}).items() if v not in (None, "", [], {})}
        lines.append(f'{f["num"]}. {f["name"]} [key: {f["key"]}]'
                     + (f' [verdict: {verdict}]' if verdict else "")
                     + f'\n   facts: {json.dumps(data, ensure_ascii=False) if data else "none"}')
    lines += [
        "",
        "Return JSON only:",
        '{"overall_score": <0-100>, "pricing_line": "one sentence on the price",',
        ' "executive_summary": "2-3 sentences; open with the fixed day line if there is one",',
        ' "factors": [{"key": "visibility", "verdict": "problem", "found": "one short sentence on what we found",'
        ' "why": "one short sentence on why it matters", "action": "one short sentence on what to do"}, ... all 20]}',
        "",
        "Tone:",
        TONE_INSTRUCTION,
        "",
        "Examples of the voice:",
        TONE_EXAMPLES,
    ]
    return "\n".join(lines)


def normalize_report(
    raw: dict[str, Any], facts: dict[str, Any], snapshot: dict[str, Any], *, agent: bool, day_sentence: str | None,
) -> dict[str, Any]:
    """Force the output into exactly 20 valid factors: fill any the AI missed,
    force the always-check verdicts, scrub place names, keep the fixed day line."""
    written = {str(f.get("key")): f for f in (raw.get("factors") or []) if isinstance(f, dict)}
    factors = []
    for spec in rf.FACTORS:
        key = spec["key"]
        forced = (facts.get(key) or {}).get("verdict") if key in rf.ALWAYS_CHECK_KEYS else None
        w = written.get(key) or {}
        verdict = forced or (str(w.get("verdict")) if str(w.get("verdict")) in _VALID_VERDICTS else None)
        found = scrub_place_names(str(w.get("found") or ""), snapshot, agent=agent)
        why = scrub_place_names(str(w.get("why") or ""), snapshot, agent=agent)
        action = scrub_place_names(str(w.get("action") or ""), snapshot, agent=agent)
        if not found or verdict == rf.CHECK_WITH_AGENT or verdict is None:
            # Empty or undecided: fall back to a clean "check with your agent".
            verdict = verdict or rf.CHECK_WITH_AGENT
            if not found:
                found, why, action = _CHECK_FALLBACK["found"], _CHECK_FALLBACK["why"], _CHECK_FALLBACK["action"]
        factors.append({"num": spec["num"], "key": key, "name": spec["name"],
                        "verdict": verdict, "found": found, "why": why, "action": action})
    summary = scrub_place_names(str(raw.get("executive_summary") or ""), snapshot, agent=agent)
    if day_sentence and day_sentence.lower() not in summary.lower():
        summary = f"{day_sentence} {summary}".strip()
    try:
        score = max(0, min(100, int(raw.get("overall_score"))))
    except (TypeError, ValueError):
        score = 50
    return {
        "version": REPORT_VERSION,
        "overall_score": score,
        "pricing_line": scrub_place_names(str(raw.get("pricing_line") or ""), snapshot, agent=agent),
        "executive_summary": summary,
        "day_sentence": day_sentence,
        "factors": factors,
    }


async def write_free_report(
    snapshot: dict[str, Any], *, asking_price: float | None, country: str = "UK",
    reduced_days: int | None = None, advertised_days: int | None = None,
    sales: list[dict[str, Any]] | None = None, photo_review: dict[str, Any] | None = None, agent: bool = False,
) -> dict[str, Any]:
    """The free-preview report: all 20 factors with verdicts, from one AI call."""
    import asyncio

    facts = build_free_facts(
        snapshot, asking_price=asking_price, country=country, reduced_days=reduced_days,
        advertised_days=advertised_days, sales=sales, photo_review=photo_review, agent=agent)
    day = rf.day_sentence(reduced_days, advertised_days, agent=agent)
    prompt = _free_prompt(facts, agent=agent, day_sentence=day)
    system = "You are a senior UK estate agent. Return only valid JSON. Follow the tone exactly."

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            max_tokens=4000, temperature=0.4, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        raw = json.loads(await asyncio.to_thread(_call))
    except Exception:  # noqa: BLE001 -- a bad call must not crash; return all-check report
        logger.exception("Free 20-factor report generation failed")
        raw = {}
    report = normalize_report(raw if isinstance(raw, dict) else {}, facts, snapshot, agent=agent, day_sentence=day)
    report["_sales_given"] = bool(_fmt_sales(sales))
    report["_media_given"] = bool((snapshot.get("media") or {}))
    return report


# ── Paid report: live market data + a detailed two-call write ─────────────
def build_market_facts(intel: dict[str, Any]) -> dict[str, Any]:
    """The live-market numbers the paid factors use, pulled from
    agent_report.compute_intel. Anything missing stays absent, and that
    factor keeps its free verdict."""
    if not isinstance(intel, dict):
        return {}
    market = intel.get("market") or {}
    headline = intel.get("headline") or {}
    vendor = intel.get("vendor_view") or {}
    sold = intel.get("sold") or {}
    out: dict[str, Any] = {}
    if market.get("for_sale") is not None:
        out["active_competition"] = {
            "homes_for_sale_nearby": market.get("for_sale"),
            "typical_days_listed": headline.get("dom_benchmark"),
            "competing": [{"price": r.get("price"), "type": r.get("type")} for r in (market.get("competing") or [])[:5]],
        }
    if vendor.get("agreed_since_listed") is not None or sold.get("count_12m") is not None:
        out["buyer_demand"] = {
            "since_label": vendor.get("since_label"),
            "agreed_since_you_listed": vendor.get("agreed_since_listed"),
            "sold_since_you_listed": vendor.get("sold_since_listed"),
            "sold_last_12_months": sold.get("count_12m"),
        }
    if headline.get("dom_benchmark") is not None:
        out["time_on_market"] = {"typical_days_for_similar": headline.get("dom_benchmark")}
    if sold.get("median_12m") is not None:
        out["asking_price"] = {"median_sold_nearby_12m": sold.get("median_12m"),
                               "low_12m": sold.get("low_12m"), "high_12m": sold.get("high_12m")}
    return out


def _paid_prompt(specs: tuple[dict[str, Any], ...], free_by_key: dict[str, Any], facts: dict[str, Any],
                 *, agent: bool, day_sentence: str | None) -> str:
    whose = "this property" if agent else "your property"
    lines = [
        f"Expand these property factors for {whose} into a detailed version. Use ONLY the facts given. Keep each "
        "factor's verdict exactly as stated. Never state a number of days on the market; the fixed day line is "
        + (f'"{day_sentence}".' if day_sentence else "not available, so don't mention days."),
        "",
    ]
    for spec in specs:
        key = spec["key"]
        free = free_by_key.get(key) or {}
        data = {k: v for k, v in (facts.get(key, {}).get("data") or {}).items() if v not in (None, "", [], {})}
        preview = free.get("found") or ""
        rendered = json.dumps(data, ensure_ascii=False) if data else "none"
        lines.append(
            f'{spec["num"]}. {spec["name"]} [key: {key}] [verdict: {free.get("verdict")}]'
            + f'\n   preview said: {preview}'
            + f'\n   facts: {rendered}')
    lines += [
        "",
        'Return JSON: {"factors": [{"key": "...", "found": "2-3 sentences on what we found", '
        '"why": "1-2 sentences on why it matters", "action": "1-2 sentences on what to do"}, ...]}',
        "", "Tone:", TONE_INSTRUCTION, "", "Examples of the voice:", TONE_EXAMPLES,
    ]
    return "\n".join(lines)


async def _paid_half(specs, free_by_key, facts, *, agent, day_sentence) -> dict[str, Any]:
    import asyncio

    prompt = _paid_prompt(specs, free_by_key, facts, agent=agent, day_sentence=day_sentence)
    system = "You are a senior UK estate agent. Return only valid JSON. Follow the tone exactly."

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            max_tokens=3200, temperature=0.4, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        data = json.loads(await asyncio.to_thread(_call))
        return {str(f.get("key")): f for f in (data.get("factors") or []) if isinstance(f, dict)}
    except Exception:  # noqa: BLE001
        logger.exception("Paid 20-factor half failed")
        return {}


async def write_paid_report(
    prospect: Any, free_report: dict[str, Any], snapshot: dict[str, Any], *,
    asking_price: float | None, country: str = "UK", reduced_days: int | None = None,
    advertised_days: int | None = None, sales: list[dict[str, Any]] | None = None,
    photo_review: dict[str, Any] | None = None, agent: bool = False,
) -> dict[str, Any]:
    """The full report: the free verdicts kept, each factor expanded with the
    live market data. Two AI calls (10 factors each) run together."""
    import asyncio

    from app.services import agent_report

    async def _intel() -> dict[str, Any]:
        try:
            return await asyncio.wait_for(agent_report.build_intel(prospect), 45)
        except Exception:  # noqa: BLE001 -- the market search can fail; factors stay on free facts
            logger.warning("Paid report: live market data unavailable for %s", getattr(prospect, "id", "?"))
            return {}

    intel = await _intel()
    market = build_market_facts(intel)
    facts = build_free_facts(
        snapshot, asking_price=asking_price, country=country, reduced_days=reduced_days,
        advertised_days=advertised_days, sales=sales, photo_review=photo_review, agent=agent)
    for key, extra in market.items():  # fold live data into the relevant factors
        facts.setdefault(key, {"data": {}, "verdict": None})
        facts[key]["data"] = {**(facts[key].get("data") or {}), **extra}

    free_by_key = {f["key"]: f for f in free_report.get("factors") or []}
    day = free_report.get("day_sentence") or rf.day_sentence(reduced_days, advertised_days, agent=agent)
    half = len(rf.FACTORS) // 2
    first, second = await asyncio.gather(
        _paid_half(rf.FACTORS[:half], free_by_key, facts, agent=agent, day_sentence=day),
        _paid_half(rf.FACTORS[half:], free_by_key, facts, agent=agent, day_sentence=day))
    written = {**first, **second}

    factors = []
    for spec in rf.FACTORS:
        key = spec["key"]
        free = free_by_key.get(key) or {}
        w = written.get(key) or {}
        found = scrub_place_names(str(w.get("found") or free.get("found") or ""), snapshot, agent=agent)
        why = scrub_place_names(str(w.get("why") or free.get("why") or ""), snapshot, agent=agent)
        action = scrub_place_names(str(w.get("action") or free.get("action") or ""), snapshot, agent=agent)
        factors.append({"num": spec["num"], "key": key, "name": spec["name"],
                        "verdict": free.get("verdict") or rf.CHECK_WITH_AGENT,
                        "found": found, "why": why, "action": action})
    paid = dict(free_report)
    paid["factors"] = factors
    paid["_expanded"] = True
    paid["_market_data"] = bool(market)
    return paid
