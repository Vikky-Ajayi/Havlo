"""The in-house assessment dataset (AssessmentRecord): one anonymous row per
assessment, so the company owns what its reports find, e.g. "out of 10,000
properties this year, 23% had poor photos", and can later build its own
models on listing facts and outcomes.

Each row is pulled from:
- the listing the report was written from (photos, floor plans, tours,
  description, price, days on the market), checked in code with the same
  analysis the reports use (report_analysis), so the 20-factor reports and the
  older ones give comparable figures;
- the report's verdicts (the 20 factors, or the older report's scores and
  findings) and its photo review;
- the funnel (looked up, details, checkout, paid, add-ons);
- the 30-day watch: what the owner changed afterwards and whether it went
  under offer or sold STC.

No names, emails, phone numbers or full address: the area is the postcode
district. sync_batch() fills new rows and refreshes changed ones (a background
loop every few minutes, which also backfilled every report made before this
existed); stats() and export_rows() are read by the console's Dataset tab.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    AssessmentRecord,
    StaleListingMonitor,
    StaleListingMonitorEvent,
    StaleListingProspect,
    StaleProspectAddonOrder,
)

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 2  # bump to re-pull every row after changing what's extracted
SYNC_BATCH = 300

PRICE_BANDS = ((200_000, "under £200k"), (350_000, "£200k–350k"), (500_000, "£350k–500k"),
               (750_000, "£500k–750k"), (1_000_000, "£750k–1m"), (2_000_000, "£1m–2m"), (None, "£2m+"))
DOM_BUCKETS = ((30, "under 30 days"), (90, "30–89 days"), (180, "90–179 days"), (365, "180–364 days"),
               (None, "365+ days"))
PHOTO_BUCKETS = ((10, "under 10"), (15, "10–14"), (20, "15–19"), (30, "20–29"), (None, "30+"))
SCORE_BUCKETS = ((40, "under 40"), (55, "40–54"), (70, "55–69"), (None, "70+"))

# The headline flags: what a report found about a listing. True, False, or
# None when it couldn't be told (e.g. the photo count wasn't read).
FLAG_LABELS = {
    "poor_photos": "Photos flagged as a problem",
    "few_photos": "Fewer than 15 photos",
    "weak_photos_found": "Photo review found weak shots",
    "missing_room_shots": "Photo review found rooms not shown",
    "no_floor_plan": "No floor plan",
    "no_video_or_tour": "No video or virtual tour",
    "pricing_issue": "Asking price flagged as a problem",
    "above_highest_sale": "Priced above every recorded sale nearby",
    "just_above_search_step": "Just above a search price step",
    "description_issue": "Description flagged as a problem",
    "missing_key_details": "Listing misses 2+ of floor area, EPC, tenure, council tax",
    "details_not_in_description": "Description misses 2+ of floor area, EPC, tenure, council tax",
    "no_epc_in_listing": "No EPC on the listing",
    "no_floor_area": "Floor area not given anywhere on the listing",
    "short_lease": "Leasehold with under 90 years left",
    "marketing_issue": "Agent marketing flagged as a problem",
    "positioning_issue": "Positioning flagged as a problem",
    "condition_issue": "Condition / sale readiness flagged",
    "reduced": "Price already reduced",
    "on_market_90": "On the market 90+ days",
    "on_market_180": "On the market 180+ days",
    "on_market_365": "On the market a year or more",
}

# The facts buyers filter on; garden size and transport are missing from
# nearly every listing, so they'd make the flag meaningless.
CORE_DETAILS = {"floor_area", "epc_rating", "tenure", "council_tax_band"}

_PHOTO_WORDS = re.compile(r"\b(photo|photograph|image|picture)", re.IGNORECASE)
_PRICE_WORDS = re.compile(r"\b(price|pricing|valuation|overpriced)", re.IGNORECASE)
_DESC_WORDS = re.compile(r"\b(description|wording|copy)\b", re.IGNORECASE)
_DISTRICT = re.compile(r"^\s*([A-Z]{1,2}\d[A-Z\d]?)\b", re.IGNORECASE)


def _loads(text: str | None) -> dict[str, Any]:
    try:
        value = json.loads(text) if text else {}
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def _bucket(value: float | None, buckets: tuple) -> str | None:
    if value is None:
        return None
    for limit, label in buckets:
        if limit is None or value < limit:
            return label
    return None


def price_band(price: float | None) -> str | None:
    return _bucket(price, PRICE_BANDS) if price else None


def broad_type(text: str | None) -> str | None:
    t = (text or "").lower()
    if not t:
        return None
    for word, label in (("semi", "semi-detached"), ("detached", "detached"), ("terrace", "terraced"),
                        ("end of terrace", "terraced"), ("town house", "terraced"), ("flat", "flat"),
                        ("apartment", "flat"), ("maisonette", "flat"), ("studio", "flat"), ("penthouse", "flat"),
                        ("bungalow", "bungalow"), ("cottage", "house"), ("house", "house")):
        if word in t:
            return label
    return "other"


def postcode_district(postcode: str | None) -> str | None:
    found = _DISTRICT.match(postcode or "")
    return found.group(1).upper() if found else None


def channel_for(prospect: Any) -> str:
    from app.services import ads_funnel

    source = getattr(prospect, "lead_source", None) or ""
    prefix = source.split("_", 1)[0]
    if prefix in ads_funnel.CHANNELS:
        return prefix
    if getattr(prospect, "is_manual", False):
        return "manual"
    return "letter"  # found by discovery for the letter campaign


def _listing_key(prospect: Any) -> str | None:
    raw = getattr(prospect, "rightmove_id", None) or getattr(prospect, "rightmove_url", None)
    if not raw:
        return None
    return hashlib.sha256(str(raw).split("#")[0].encode()).hexdigest()[:32]


def _v1_finding_flag(report: dict[str, Any], words: re.Pattern) -> bool | None:
    findings = [f for f in report.get("key_findings") or [] if isinstance(f, dict)]
    if not findings:
        return None
    return any(f.get("type") == "issue" and words.search(f"{f.get('title') or ''} {f.get('icon') or ''}")
               for f in findings)


def extract(prospect: Any, *, monitor: Any = None, events: list[Any] | None = None,
            addon_paid: bool = False) -> dict[str, Any]:
    """Everything the dataset keeps about one assessment, as AssessmentRecord
    column values. Pure: no database access."""
    from app.services import report_analysis as ra
    from app.services import report_writer
    from app.services import stale_prospect_service as sps

    report = _loads(getattr(prospect, "agent_edited_report_json", None) or getattr(prospect, "report_json", None))
    report.pop(sps.PAID_READY_KEY, None)
    snapshot = _loads(getattr(prospect, "listing_snapshot_json", None))
    v2 = report_writer.report_is_v2(report)
    fmt = "v2" if v2 else "v1" if (report.get("key_findings") or report.get("scores")) else "none"
    asking = getattr(prospect, "asking_price", None) or sps.extract_price(snapshot.get("price"))
    days = getattr(prospect, "listing_duration_days", None)
    reduced = bool(snapshot.get("price_reduced"))
    sales = sps.cached_sold_comparables(prospect) if getattr(prospect, "sold_comparables_at", None) else None
    photo_review = report.get("_photo_review") if isinstance(report.get("_photo_review"), dict) else None

    analysis: dict[str, Any] = {}
    try:
        analysis = ra.analyse(snapshot, asking_price=asking, country=getattr(prospect, "country", None) or "UK",
                              reduced_days=days if reduced else None, advertised_days=None if reduced else days,
                              sales=sales, photo_review=photo_review)
    except Exception:  # noqa: BLE001 -- an odd listing still gets its row
        logger.warning("Dataset: analysis failed for %s", getattr(prospect, "id", "?"), exc_info=True)

    media = snapshot.get("media") if isinstance(snapshot.get("media"), dict) else {}
    photos = media.get("photos") if isinstance(media.get("photos"), int) else None
    floorplans = media.get("floorplans") if isinstance(media.get("floorplans"), int) else None
    tours = media.get("virtual_tours") if isinstance(media.get("virtual_tours"), int) else None
    desc = analysis.get("description") or {}
    position = analysis.get("price_position") or {}
    visibility = analysis.get("visibility") or {}
    seen = not snapshot.get("manual_details")

    factors: dict[str, dict[str, Any]] = {}
    if v2:
        for f in report.get("factors") or []:
            if isinstance(f, dict) and f.get("key"):
                factors[f["key"]] = {k: f.get(k) for k in ("verdict", "severity") if f.get(k) is not None}

    def verdict(key: str) -> bool | None:
        v = (factors.get(key) or {}).get("verdict")
        return None if v in (None, "check_with_agent") else v == "problem"

    scores = report.get("scores") if isinstance(report.get("scores"), dict) else {}

    def v1_score_low(key: str) -> bool | None:
        value = scores.get(key)
        return value < 45 if isinstance(value, (int, float)) else None

    missing = list(desc.get("missing") or []) if seen else []
    # The whole listing (its description plus Rightmove's own panels, EPC
    # chart and floor plan) can only be judged when those sections were read;
    # listings read before Nov 2026 kept the description alone.
    sections = bool(desc.get("sections_read")) and seen
    listing = analysis.get("listing") or {}
    not_in_text = CORE_DETAILS - set(desc.get("in_description") or [])
    lease = listing.get("lease_years_remaining")
    weak = (photo_review or {}).get("weak_photos") or []
    missing_shots = (photo_review or {}).get("missing_shots") or []
    flags: dict[str, bool | None] = {
        "poor_photos": verdict("photography") if v2 else _v1_finding_flag(report, _PHOTO_WORDS),
        "few_photos": (photos < 15) if photos is not None else None,
        "weak_photos_found": bool(weak) if photo_review else None,
        "missing_room_shots": bool(missing_shots) if photo_review else None,
        "no_floor_plan": (floorplans == 0) if floorplans is not None else None,
        "no_video_or_tour": (tours == 0) if tours is not None else None,
        "pricing_issue": verdict("asking_price") if v2 else (
            v1_score_low("pricing") if scores else _v1_finding_flag(report, _PRICE_WORDS)),
        "above_highest_sale": (position.get("above_highest_pct", 0) > 0) if position.get("sales_known") else None,
        "just_above_search_step": bool(visibility.get("just_above_step")) if visibility.get("known") else None,
        "description_issue": verdict("description") if v2 else _v1_finding_flag(report, _DESC_WORDS),
        "missing_key_details": (len(set(missing) & CORE_DETAILS) >= 2) if sections else None,
        "details_not_in_description": (len(not_in_text) >= 2) if seen and snapshot.get("description") else None,
        "no_epc_in_listing": ("epc_rating" not in (desc.get("covers") or [])) if sections else None,
        "no_floor_area": (desc.get("floor_area_sqft") is None) if sections else None,
        "short_lease": (lease < 90 if isinstance(lease, int) else False) if sections and listing.get("tenure") else None,
        "marketing_issue": verdict("agent_marketing"),
        "positioning_issue": verdict("positioning"),
        "condition_issue": verdict("condition_readiness"),
        "reduced": reduced,
        "on_market_90": (days >= 90) if isinstance(days, int) else None,
        "on_market_180": (days >= 180) if isinstance(days, int) else None,
        "on_market_365": (days >= 365) if isinstance(days, int) else None,
    }

    sqft = desc.get("floor_area_sqft")
    problems = [f for f in factors.values() if f.get("verdict") == "problem"]
    metrics = {
        "photos": photos, "floorplans": floorplans, "virtual_tours": tours,
        "photos_reviewed": (photo_review or {}).get("photos_seen"),
        "weak_photos": len(weak) if photo_review else None,
        "description_words": desc.get("description_words") if seen else None,
        "key_features": desc.get("key_features_count") if seen else None,
        "missing_details": len(missing) if sections else None,
        "lease_years_remaining": lease if isinstance(lease, int) else None,
        "service_charge_per_year": listing.get("service_charge_per_year"),
        "rooms_with_sizes": listing.get("rooms_with_sizes"),
        "brochures": listing.get("brochure_count"),
        "station_miles": desc.get("station_miles"),
        "floor_area_sqft": sqft,
        "price_per_sqft": round(asking / sqft) if asking and sqft else None,
        "recorded_sales": position.get("sales_count"),
        "above_highest_sale_pct": position.get("above_highest_pct"),
        "above_median_sale_pct": position.get("above_median_pct"),
        "problems": len(problems) if v2 else None,
        "worst_severity": max((p.get("severity") or 0 for p in problems), default=None) if v2 else None,
        "score_pricing": scores.get("pricing") if not v2 else None,
        "score_presentation": scores.get("listing_presentation") if not v2 else None,
    }
    details = {
        "missing_details": missing if sections else [],
        "missing_shots": [str(s)[:80] for s in missing_shots][:12],
        "rooms_shown": [str(s)[:40] for s in (photo_review or {}).get("rooms_shown") or []][:20],
        "epc_rating": desc.get("epc_rating"),
        "epc_potential": listing.get("epc_potential"),
        "tenure": desc.get("tenure"),
        "council_tax_band": desc.get("council_tax_band"),
        "sections_read": sections,
    }

    outcome, outcome_at, changes = None, None, {}
    if monitor is not None:
        outcome = getattr(monitor, "listing_status", None) or "on_market"
        listing_events = [e for e in events or [] if getattr(e, "scope", None) == "listing"]
        changes = dict(Counter(e.kind for e in listing_events))
        firsts = sorted(e.detected_at for e in listing_events
                        if e.kind in ("status_under_offer", "status_sold_stc", "listing_removed") and e.detected_at)
        outcome_at = firsts[0] if firsts else None

    score = report.get("overall_score")
    return {
        "listing_key": _listing_key(prospect),
        "is_copy": getattr(prospect, "parent_prospect_id", None) is not None,
        "assessed_at": getattr(prospect, "processed_at", None) or getattr(prospect, "created_at", None),
        "report_format": fmt,
        "report_model": str(report.get("_model") or "")[:80] or None,
        "channel": channel_for(prospect),
        "audience": getattr(prospect, "audience", None) or "owner",
        "country": getattr(prospect, "country", None),
        "region": (getattr(prospect, "city", None) or "")[:100] or None,
        "postcode_district": postcode_district(getattr(prospect, "postcode", None) or snapshot.get("postcode")),
        "property_type": broad_type(getattr(prospect, "property_type", None) or snapshot.get("property_type")),
        "bedrooms": getattr(prospect, "bedrooms", None),
        "bathrooms": getattr(prospect, "bathrooms", None),
        "asking_price": float(asking) if asking else None,
        "price_band": price_band(asking),
        "days_on_market": days if isinstance(days, int) else None,
        "reduced": reduced,
        "agency": (getattr(prospect, "agent_brand", None) or getattr(prospect, "agent_company_name", None) or "")[:255] or None,
        "agency_branch_id": getattr(prospect, "agent_branch_id", None),
        "overall_score": int(score) if isinstance(score, (int, float)) else None,
        "looked_up": getattr(prospect, "code_looked_up_at", None) is not None,
        "gave_details": getattr(prospect, "contact_details_submitted_at", None) is not None,
        "reached_checkout": getattr(prospect, "checkout_visited_at", None) is not None,
        "paid": getattr(prospect, "payment_status", None) == "completed",
        "paid_at": getattr(prospect, "unlocked_at", None),
        "addon_paid": addon_paid,
        "outcome": outcome,
        "outcome_at": outcome_at,
        "flags_json": json.dumps(flags),
        "metrics_json": json.dumps({k: v for k, v in metrics.items() if v is not None}),
        "factors_json": json.dumps(factors) if factors else None,
        "details_json": json.dumps({k: v for k, v in details.items() if v}),
        "changes_json": json.dumps(changes) if changes else None,
        "schema_version": SCHEMA_VERSION,
    }


async def sync_batch(db: AsyncSession, limit: int = SYNC_BATCH) -> dict[str, int]:
    """Add rows for assessments without one and refresh rows whose source
    changed (the prospect, its watch or an add-on order since the last sync).
    The caller commits."""
    P, R, M = StaleListingProspect, AssessmentRecord, StaleListingMonitor
    has_report = or_(P.report_json.is_not(None), P.agent_edited_report_json.is_not(None))
    stale = (await db.execute(
        select(P.id).outerjoin(R, R.prospect_id == P.id).where(
            has_report,
            or_(R.id.is_(None), P.updated_at > R.synced_at, R.schema_version < SCHEMA_VERSION),
        ).order_by(R.id.is_not(None), P.created_at.desc()).limit(limit)
    )).scalars().all()
    room = max(0, limit - len(stale))
    watched = []
    if room:
        watched = (await db.execute(
            select(M.prospect_id).join(R, R.prospect_id == M.prospect_id)
            .where(M.last_listing_check_at > R.synced_at).limit(room)
        )).scalars().all()
    paid_addons = []
    if room:
        paid_addons = (await db.execute(
            select(StaleProspectAddonOrder.prospect_id).join(R, R.prospect_id == StaleProspectAddonOrder.prospect_id)
            .where(StaleProspectAddonOrder.status == "completed", StaleProspectAddonOrder.paid_at > R.synced_at,
                   R.addon_paid.is_(False)).limit(room)
        )).scalars().all()
    ids = list(dict.fromkeys([*stale, *watched, *paid_addons]))
    if not ids:
        return {"synced": 0, "added": 0}

    prospects = (await db.execute(select(P).where(P.id.in_(ids)))).scalars().all()
    records = {r.prospect_id: r for r in (await db.execute(select(R).where(R.prospect_id.in_(ids)))).scalars().all()}
    monitors = {m.prospect_id: m for m in (await db.execute(select(M).where(M.prospect_id.in_(ids)))).scalars().all()}
    events: dict[Any, list[Any]] = defaultdict(list)
    if monitors:
        by_monitor = {m.id: pid for pid, m in monitors.items()}
        for e in (await db.execute(select(StaleListingMonitorEvent).where(
                StaleListingMonitorEvent.monitor_id.in_(list(by_monitor))))).scalars().all():
            events[by_monitor[e.monitor_id]].append(e)
    addon_ids = set((await db.execute(select(StaleProspectAddonOrder.prospect_id).where(
        StaleProspectAddonOrder.prospect_id.in_(ids), StaleProspectAddonOrder.status == "completed"))).scalars().all())

    now = datetime.now(timezone.utc)
    added = 0
    for p in prospects:
        values = extract(p, monitor=monitors.get(p.id), events=events.get(p.id), addon_paid=p.id in addon_ids)
        record = records.get(p.id)
        if record is None:
            record = AssessmentRecord(prospect_id=p.id)
            db.add(record)
            added += 1
        for key, value in values.items():
            setattr(record, key, value)
        record.synced_at = now
    return {"synced": len(prospects), "added": added}


async def run_sync() -> dict[str, int]:
    """Background loop body: a few batches per cycle, so the first run works
    through the backlog quickly without holding one long transaction."""
    from app.db.database import AsyncSessionLocal

    total = {"synced": 0, "added": 0}
    for _ in range(5):
        async with AsyncSessionLocal() as db:
            result = await sync_batch(db)
            await db.commit()
        total = {k: total[k] + result[k] for k in total}
        if result["synced"] < SYNC_BATCH:
            break
    return total


# ── Reading the dataset ───────────────────────────────────────────────────
FILTERS = ("date_from", "date_to", "channel", "region", "district", "property_type", "price_band", "audience",
           "report_format", "funnel", "include_copies")


def _where(filters: dict[str, Any]) -> list:
    R = AssessmentRecord
    out = [R.country == (filters.get("country") or "UK")]
    if not filters.get("include_copies"):
        out.append(R.is_copy.is_(False))
    if filters.get("date_from"):
        out.append(R.assessed_at >= filters["date_from"])
    if filters.get("date_to"):
        out.append(R.assessed_at < filters["date_to"])
    for column in ("channel", "region", "property_type", "price_band", "audience", "report_format"):
        if filters.get(column):
            out.append(getattr(R, column) == filters[column])
    if filters.get("district"):
        out.append(R.postcode_district.ilike(f"{filters['district'].strip().upper()}%"))
    funnel = filters.get("funnel")
    if funnel == "engaged":
        out.append(R.looked_up.is_(True))
    elif funnel == "paid":
        out.append(R.paid.is_(True))
    return out


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def _median(values: list[float]) -> float | None:
    return round(statistics.median(values), 1) if values else None


def _distribution(rows: list[dict[str, Any]], key: str, order: tuple | None = None, top: int | None = None) -> list[dict[str, Any]]:
    counts = Counter(r[key] for r in rows if r.get(key) not in (None, ""))
    known = sum(counts.values())
    if order:
        labels = [label for _, label in order if label in counts]
    else:
        labels = [label for label, _ in counts.most_common(top)]
    return [{"label": str(label), "count": counts[label], "pct": _pct(counts[label], known)} for label in labels]


async def load_rows(db: AsyncSession, filters: dict[str, Any]) -> list[dict[str, Any]]:
    R = AssessmentRecord
    records = (await db.execute(select(R).where(and_(*_where(filters))))).scalars().all()
    rows = []
    for r in records:
        row = {c: getattr(r, c) for c in (
            "listing_key", "assessed_at", "report_format", "report_model", "channel", "audience", "region",
            "postcode_district", "property_type", "bedrooms", "bathrooms", "asking_price", "price_band",
            "days_on_market", "reduced", "agency", "overall_score", "looked_up", "gave_details",
            "reached_checkout", "paid", "paid_at", "addon_paid", "outcome", "outcome_at")}
        row["flags"] = _loads(r.flags_json)
        row["metrics"] = _loads(r.metrics_json)
        row["factors"] = _loads(r.factors_json)
        row["details"] = _loads(r.details_json)
        row["changes"] = _loads(r.changes_json)
        row["dom_bucket"] = _bucket(r.days_on_market, DOM_BUCKETS)
        row["photo_bucket"] = _bucket(row["metrics"].get("photos"), PHOTO_BUCKETS)
        row["score_bucket"] = _bucket(r.overall_score, SCORE_BUCKETS)
        row["epc"] = row["details"].get("epc_rating")
        row["month"] = r.assessed_at.strftime("%Y-%m") if r.assessed_at else None
        rows.append(row)
    return rows


AGREED = ("under_offer", "sold_stc")


def compute_stats(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Every statistic the Dataset tab shows, from the filtered rows."""
    from app.services import report_factors as rf

    n = len(rows)
    doms = [r["days_on_market"] for r in rows if isinstance(r["days_on_market"], int)]
    scores_ = [r["overall_score"] for r in rows if isinstance(r["overall_score"], int)]
    watched = [r for r in rows if r["outcome"]]
    agreed = [r for r in watched if r["outcome"] in AGREED]

    flags = []
    for key, label in FLAG_LABELS.items():
        known = [r for r in rows if r["flags"].get(key) is not None]
        yes = [r for r in known if r["flags"][key]]
        no = [r for r in known if not r["flags"][key]]

        def med_dom(group):
            return _median([r["days_on_market"] for r in group if isinstance(r["days_on_market"], int)])

        def paid_rate(group):
            looked = [r for r in group if r["looked_up"]]
            return _pct(sum(r["paid"] for r in looked), len(looked))

        def agreed_rate(group):
            w = [r for r in group if r["outcome"]]
            return _pct(sum(r["outcome"] in AGREED for r in w), len(w))

        flags.append({
            "key": key, "label": label, "known": len(known), "count": len(yes), "pct": _pct(len(yes), len(known)),
            "median_days_with": med_dom(yes), "median_days_without": med_dom(no),
            "paid_rate_with": paid_rate(yes), "paid_rate_without": paid_rate(no),
            "agreed_rate_with": agreed_rate(yes), "agreed_rate_without": agreed_rate(no),
        })

    v2_rows = [r for r in rows if r["factors"]]
    factors = []
    for spec in rf.FACTORS:
        verdicts = [r["factors"].get(spec["key"], {}) for r in v2_rows if spec["key"] in r["factors"]]
        if not verdicts:
            continue
        c = Counter(v.get("verdict") for v in verdicts)
        sev = [v["severity"] for v in verdicts if v.get("verdict") == "problem" and v.get("severity")]
        factors.append({
            "key": spec["key"], "num": spec["num"], "name": spec["name"], "count": len(verdicts),
            "problem_pct": _pct(c["problem"], len(verdicts)), "working_well_pct": _pct(c["working_well"], len(verdicts)),
            "check_pct": _pct(c["check_with_agent"], len(verdicts)),
            "avg_severity": round(sum(sev) / len(sev), 1) if sev else None,
        })

    missing = Counter(item for r in rows for item in r["details"].get("missing_details") or [])
    with_desc = sum(1 for r in rows if r["flags"].get("missing_key_details") is not None)
    shots = Counter(str(s).lower() for r in rows for s in r["details"].get("missing_shots") or [])
    changes = Counter()
    for r in watched:
        changes.update(r["changes"])
    changes.pop("status_under_offer", None)
    changes.pop("status_sold_stc", None)

    def change_effect(kind: str) -> dict[str, Any]:
        made = [r for r in watched if r["changes"].get(kind)]
        not_made = [r for r in watched if not r["changes"].get(kind)]
        return {"kind": kind, "listings": len(made),
                "agreed_rate_with": _pct(sum(r["outcome"] in AGREED for r in made), len(made)),
                "agreed_rate_without": _pct(sum(r["outcome"] in AGREED for r in not_made), len(not_made))}

    agencies = defaultdict(list)
    for r in rows:
        if r["agency"]:
            agencies[r["agency"]].append(r)
    top_agencies = sorted(agencies.items(), key=lambda kv: -len(kv[1]))[:20]

    months = defaultdict(list)
    for r in rows:
        if r["month"]:
            months[r["month"]].append(r)

    def month_row(month: str, group: list[dict[str, Any]]) -> dict[str, Any]:
        def share(flag):
            known = [r for r in group if r["flags"].get(flag) is not None]
            return _pct(sum(bool(r["flags"][flag]) for r in known), len(known))
        return {"month": month, "assessments": len(group), "poor_photos_pct": share("poor_photos"),
                "pricing_issue_pct": share("pricing_issue"), "no_video_pct": share("no_video_or_tour"),
                "paid": sum(r["paid"] for r in group)}

    looked = [r for r in rows if r["looked_up"]]
    return {
        "total": n,
        "listings": len({r["listing_key"] for r in rows if r["listing_key"]}),
        "headline": {
            "median_days_on_market": _median(doms), "average_score": round(sum(scores_) / len(scores_), 1) if scores_ else None,
            "reduced_pct": _pct(sum(1 for r in rows if r["reduced"]), n),
            "over_180_pct": _pct(sum(1 for d in doms if d >= 180), len(doms)),
            "median_price": _median([r["asking_price"] for r in rows if r["asking_price"]]),
            "v2_reports": len(v2_rows),
            "photo_reviewed": sum(1 for r in rows if r["metrics"].get("photos_reviewed")),
        },
        "funnel": {
            "looked_up": len(looked), "gave_details": sum(r["gave_details"] for r in looked),
            "reached_checkout": sum(r["reached_checkout"] for r in looked), "paid": sum(r["paid"] for r in rows),
            "addon_paid": sum(r["addon_paid"] for r in rows),
            "paid_rate": _pct(sum(r["paid"] for r in looked), len(looked)),
        },
        "outcomes": {
            "watched": len(watched), "agreed": len(agreed), "agreed_pct": _pct(len(agreed), len(watched)),
            "by_status": dict(Counter(r["outcome"] for r in watched)),
            "median_days_to_agreed": _median([
                (r["outcome_at"] - r["paid_at"]).days for r in agreed
                if r["outcome_at"] and r.get("paid_at") and r["outcome_at"] >= r["paid_at"]]) if agreed else None,
            "changes_made": [{"kind": k, "count": c} for k, c in changes.most_common()],
            "change_effects": [change_effect(k) for k in ("photos_updated", "price_reduced", "description_updated",
                                                          "features_updated", "featured_added", "premium_added")],
        },
        "flags": flags,
        "factors": factors,
        "missing_details": [{"label": k.replace("_", " "), "count": c, "pct": _pct(c, with_desc)}
                            for k, c in missing.most_common()],
        "missing_shots": [{"label": k, "count": c} for k, c in shots.most_common(12)],
        "distributions": {
            "days_on_market": _distribution(rows, "dom_bucket", DOM_BUCKETS),
            "price_band": _distribution(rows, "price_band", PRICE_BANDS),
            "property_type": _distribution(rows, "property_type"),
            "photos": _distribution(rows, "photo_bucket", PHOTO_BUCKETS),
            "score": _distribution(rows, "score_bucket", SCORE_BUCKETS),
            "epc": _distribution(rows, "epc"),
            "channel": _distribution(rows, "channel"),
            "region": _distribution(rows, "region", top=15),
            "report_model": _distribution(rows, "report_model"),
        },
        "agencies": [{
            "agency": name, "assessments": len(group),
            "poor_photos_pct": _pct(sum(bool(r["flags"].get("poor_photos")) for r in group),
                                    sum(r["flags"].get("poor_photos") is not None for r in group)),
            "pricing_issue_pct": _pct(sum(bool(r["flags"].get("pricing_issue")) for r in group),
                                      sum(r["flags"].get("pricing_issue") is not None for r in group)),
            "no_video_pct": _pct(sum(bool(r["flags"].get("no_video_or_tour")) for r in group),
                                 sum(r["flags"].get("no_video_or_tour") is not None for r in group)),
            "median_days_on_market": _median([r["days_on_market"] for r in group if isinstance(r["days_on_market"], int)]),
        } for name, group in top_agencies],
        "by_month": [month_row(m, months[m]) for m in sorted(months)],
    }


async def stats(db: AsyncSession, filters: dict[str, Any]) -> dict[str, Any]:
    rows = await load_rows(db, filters)
    from sqlalchemy import func

    out = compute_stats(rows)
    out["records_in_dataset"] = int((await db.execute(select(func.count(AssessmentRecord.id)))).scalar() or 0)
    return out


EXPORT_COLUMNS = ("listing_key", "assessed_at", "report_format", "report_model", "channel", "audience", "region",
                  "postcode_district", "property_type", "bedrooms", "bathrooms", "asking_price", "price_band",
                  "days_on_market", "reduced", "agency", "overall_score", "looked_up", "gave_details",
                  "reached_checkout", "paid", "addon_paid", "outcome", "outcome_at")


def export_csv(rows: list[dict[str, Any]]) -> str:
    """The rows as CSV: one column per field, flag, metric, factor verdict
    and listing change."""
    from app.services import report_factors as rf

    metric_keys = sorted({k for r in rows for k in r["metrics"]})
    change_keys = sorted({k for r in rows for k in r["changes"]})
    header = [*EXPORT_COLUMNS, *(f"flag_{k}" for k in FLAG_LABELS), *(f"metric_{k}" for k in metric_keys),
              *(f"factor_{f['key']}" for f in rf.FACTORS), *(f"severity_{f['key']}" for f in rf.FACTORS),
              *(f"change_{k}" for k in change_keys), "missing_details"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for r in rows:
        writer.writerow([
            *(r[c].isoformat() if isinstance(r[c], datetime) else r[c] for c in EXPORT_COLUMNS),
            *(r["flags"].get(k) for k in FLAG_LABELS), *(r["metrics"].get(k) for k in metric_keys),
            *((r["factors"].get(f["key"]) or {}).get("verdict") for f in rf.FACTORS),
            *((r["factors"].get(f["key"]) or {}).get("severity") for f in rf.FACTORS),
            *(r["changes"].get(k, 0) for k in change_keys),
            "; ".join(r["details"].get("missing_details") or []),
        ])
    return buf.getvalue()
