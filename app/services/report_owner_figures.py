"""The figures only the agent can see, added by the customer.

Listing Engagement (factor 2) and Viewing-to-Offer Conversion (factor 16) are
"check with your agent": Rightmove shows views and enquiries only to the agent,
and only the agent knows the viewings and the feedback. Once the customer has
those figures they type them into the card, and that one factor is written
again from them: ratios worked out here in code, a single AI call for the
words, then the same claim and tone checks as the rest of the report. The
verdict becomes a real one (problem or working well).

The figures and the rewritten factor are kept on the report (`_owner_figures`)
so a later rebuild of the report puts them back (carry_over).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services import report_factors as rf

logger = logging.getLogger(__name__)

# The forms. Keep the field names in step with the report page
# (OWNER_FIGURE_FORMS in StaleProspectWizard.tsx).
FORMS: dict[str, tuple[dict[str, str], ...]] = {
    "engagement": (
        {"name": "views_total", "label": "Total views since the listing went live", "kind": "count"},
        {"name": "views_14d", "label": "Views in the last 14 days", "kind": "count"},
        {"name": "enquiries", "label": "Enquiries (emails and calls)", "kind": "count"},
        {"name": "viewings_booked", "label": "Viewings booked", "kind": "count"},
    ),
    "viewing_conversion": (
        {"name": "viewings", "label": "Viewings so far", "kind": "count"},
        {"name": "second_viewings", "label": "Second viewings", "kind": "count"},
        {"name": "offers", "label": "Offers received", "kind": "count"},
        {"name": "feedback", "label": "Feedback from viewings", "kind": "text"},
    ),
}
MAX_COUNT = 10_000_000
MAX_FEEDBACK = 2000
RUNS_PER_DAY = 5  # rewrites of one factor a day: each is a billed AI call

# When the figures settle the verdict on their own (otherwise the writer judges).
FALLING_VIEWS_SHARE = 0.5  # last 14 days under half the listing's own average fortnight
VIEWS_WITHOUT_ENQUIRY = 400
ENQUIRIES_WITHOUT_VIEWING = 4
VIEWINGS_WITHOUT_OFFER = 8


class FiguresError(ValueError):
    """Figures that can't be right, worded for the customer."""


class TooManyRuns(FiguresError):
    pass


def clean_figures(key: str, raw: dict[str, Any]) -> dict[str, Any]:
    """The typed figures, checked. Blank fields are left out; at least one
    figure is needed."""
    if key not in FORMS:
        raise FiguresError("Figures can only be added to Listing Engagement and Viewing-to-Offer Conversion.")
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, Any] = {}
    for field in FORMS[key]:
        value = raw.get(field["name"])
        if value in (None, ""):
            continue
        if field["kind"] == "text":
            text = " ".join(str(value).split())[:MAX_FEEDBACK]
            if text:
                out[field["name"]] = text
            continue
        try:
            number = float(str(value).replace(",", "").strip())
        except ValueError as exc:
            raise FiguresError(f"Please enter a number for “{field['label']}”.") from exc
        if number < 0 or number > MAX_COUNT or number != int(number):
            raise FiguresError(f"Please enter a whole number for “{field['label']}”.")
        out[field["name"]] = int(number)
    if not any(k for k in out if k != "feedback") and not out.get("feedback"):
        raise FiguresError("Please enter at least one of the figures.")
    if "views_14d" in out and "views_total" in out and out["views_14d"] > out["views_total"]:
        raise FiguresError("Views in the last 14 days can't be more than the total views.")
    if "second_viewings" in out and "viewings" in out and out["second_viewings"] > out["viewings"]:
        raise FiguresError("Second viewings can't be more than the viewings.")
    return out


def _pct(part: float, whole: float) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def derive(key: str, figures: dict[str, Any], days_live: int | None) -> dict[str, Any]:
    """What the figures show, worked out in code (the writer quotes these and
    never computes its own), plus the verdict when the figures settle it."""
    d: dict[str, Any] = {}
    forced: str | None = None
    if key == "engagement":
        total, recent = figures.get("views_total"), figures.get("views_14d")
        enquiries, booked = figures.get("enquiries"), figures.get("viewings_booked")
        if total is not None and days_live and days_live >= 28:
            fortnight = total / days_live * 14
            d["average_views_per_fortnight"] = round(fortnight)
            d["average_views_per_week"] = round(total / days_live * 7)
            if recent is not None and fortnight:
                share = recent / fortnight
                d["last_14_days_vs_average_pct"] = round((share - 1) * 100)
                if share < FALLING_VIEWS_SHARE and total >= 100:
                    d["views_trend"] = "falling: the last 14 days are well below the listing's own average"
                    forced = rf.PROBLEM
                elif share < 0.85:
                    d["views_trend"] = "slowing"
                else:
                    d["views_trend"] = "holding up"
        if total and enquiries is not None:
            d["enquiries_per_100_views"] = round(enquiries / total * 100, 2)
            if enquiries:
                d["views_per_enquiry"] = round(total / enquiries)
            elif total >= VIEWS_WITHOUT_ENQUIRY:
                d["no_enquiries"] = f"{total} views and no enquiries: buyers look and move on"
                forced = rf.PROBLEM
        if enquiries and booked is not None:
            d["enquiries_that_became_viewings_pct"] = _pct(booked, enquiries)
            if booked == 0 and enquiries >= ENQUIRIES_WITHOUT_VIEWING:
                d["no_viewings"] = f"{enquiries} enquiries and no viewings booked: the follow-up isn't converting"
                forced = rf.PROBLEM
        if total and booked is not None:
            d["viewings_per_1000_views"] = round(booked / total * 1000, 1)
    elif key == "viewing_conversion":
        viewings, second, offers = figures.get("viewings"), figures.get("second_viewings"), figures.get("offers")
        if viewings:
            if second is not None:
                d["second_viewing_rate_pct"] = _pct(second, viewings)
            if offers is not None:
                d["offers_per_10_viewings"] = round(offers / viewings * 10, 1)
                if offers == 0 and viewings >= VIEWINGS_WITHOUT_OFFER:
                    d["no_offers"] = (f"{viewings} viewings and no offer: buyers who have seen it in person "
                                      "aren't convinced at this price")
                    forced = rf.PROBLEM
        elif viewings == 0:
            d["no_viewings_yet"] = True
        if days_live and days_live >= 14 and viewings is not None:
            d["viewings_per_month"] = round(viewings / days_live * 30.4, 1)
    d["_forced_verdict"] = forced
    return d


def trusted_additions(figures: dict[str, Any], derived: dict[str, Any]) -> dict[str, list]:
    """Percentages and day counts the rewritten factor may quote, so the claim
    checks (report_guard) don't take them out."""
    percents = [abs(float(v)) for k, v in derived.items()
                if isinstance(v, (int, float)) and not isinstance(v, bool) and (k.endswith("_pct") or "per_100" in k)]
    return {"percents": percents, "days": [14]}


GUIDE = {
    "engagement": (
        "Read the figures as a funnel and say where it breaks. Views tell you whether buyers find the listing (price "
        "band and lead photo); enquiries per view whether the listing convinces them (photos, description, price "
        "against what they can see); viewings per enquiry whether the agent's follow-up works. Compare the last 14 "
        "days with the listing's own average fortnight: falling views after the early weeks mean it has dropped down "
        "the results and needs a reason for buyers to look again. Name the weakest stage, link it to the factor it "
        "points to (the price, the photos, the description), and say the one change that fixes it."
    ),
    "viewing_conversion": (
        "Judge what happens once buyers have seen it. Viewings without second viewings or offers mean something "
        "they see in person, or the price against what they've seen, stops them. Use the feedback: group it into "
        "the two or three concerns that keep coming up, say which are fixable before the next viewing (presentation, "
        "a repair, a smell, a room's use) and which point to the price. With offers, say what they suggest about "
        "the price. Few viewings is a factor-2 problem (getting buyers in), not this one: say so in a few words."
    ),
}


def _prompt(factor: dict[str, Any], figures: dict[str, Any], derived: dict[str, Any], report: dict[str, Any], *,
            agent: bool, asking_price: float | None) -> str:
    from app.services import report_writer as rw

    whose = "this property" if agent else "your property"
    others = [
        f"- {f.get('name')}: {f.get('verdict')}. {str(f.get('found') or '')[:240]}"
        for f in report.get("factors") or []
        if isinstance(f, dict) and f.get("key") != factor.get("key") and f.get("verdict") == rf.PROBLEM
    ][:6]
    forced = derived.get("_forced_verdict")
    shown = {k: v for k, v in derived.items() if not k.startswith("_")}
    lines = [
        f"Rewrite one factor of the assessment of {whose}: the owner has now added the figures their agent gave them.",
        "",
        rw.JUDGEMENT_RULES.replace(
            'Use "check_with_agent" ONLY for listing engagement, viewing-to-offer '
            "and seller net proceeds, where the figures sit with the agent or lender.",
            'This factor now has its figures, so the verdict is "problem" or "working_well", never '
            '"check_with_agent".'),
        "",
        "The fixed day line is: " + (f'"{report["day_sentence"]}"' if report.get("day_sentence") else
                                     "none, so don't mention how long it's been on the market") + ".",
        f"Asking price: £{asking_price:,.0f}." if asking_price else "",
        "",
        f"The factor: {factor.get('num')}. {factor.get('name')} [key: {factor.get('key')}]"
        + (f" [verdict: {forced}]" if forced else ""),
        f"How to judge: {GUIDE[factor['key']]}",
        "The owner's figures (exactly as typed; quote them, never change them): "
        + json.dumps(figures, ensure_ascii=False),
        "Worked out from them (quote these, never work out your own): " + json.dumps(shown, ensure_ascii=False),
        "What this factor said before the figures: " + json.dumps(
            {k: factor.get(k) for k in ("found", "why", "action")}, ensure_ascii=False),
        "",
        "Problems the rest of the assessment found (join the dots where the figures point to one; don't repeat them):",
        *(others or ["- none"]),
        "",
        "Length: found = two or three sentences that quote the figures and say what they show; why = one or two "
        "sentences; action = two or three specific steps, each with the number, wording or deadline.",
        "Give a problem a severity from 1 (minor) to 5 (the main reason it isn't selling).",
        "",
        'Return JSON only: {"verdict": "problem" or "working_well", "severity": <1-5 or null>, "found": "...", '
        '"why": "...", "action": "..."}',
        "",
        "Tone:", rw.TONE_INSTRUCTION, "", "Examples of the voice:", rw.TONE_EXAMPLES,
    ]
    return "\n".join(line for line in lines if line is not None)


def _effective_report(prospect: Any) -> tuple[dict[str, Any], str]:
    """The report in effect and the column it lives in (an ops edit wins)."""
    from app.services import stale_prospect_service as sps

    if getattr(prospect, "agent_edited_report_json", None):
        return sps._safe_json(prospect.agent_edited_report_json), "agent_edited_report_json"
    return sps._safe_json(prospect.report_json), "report_json"


def _check_runs(entry: dict[str, Any] | None, now: datetime) -> list[str]:
    runs = [r for r in (entry or {}).get("runs") or [] if isinstance(r, str)]
    recent = []
    for r in runs:
        try:
            when = datetime.fromisoformat(r)
        except ValueError:
            continue
        if now - when < timedelta(days=1):
            recent.append(r)
    if len(recent) >= RUNS_PER_DAY:
        raise TooManyRuns("You've updated this section several times today. Please try again tomorrow.")
    return recent


async def apply_owner_figures(prospect: Any, key: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Rewrite one factor from the customer's figures and save it on the
    prospect's report (the caller commits). Returns the new factor. Raises
    FiguresError for figures that can't be used, or a report without the
    factor."""
    from app.services import report_guard, report_tone, report_writer
    from app.services import stale_prospect_service as sps

    figures = clean_figures(key, raw)
    report, column = _effective_report(prospect)
    if not report_writer.report_is_v2(report):
        raise FiguresError("This report can't take figures. Please contact us and we'll update it for you.")
    factors = [f for f in report.get("factors") or [] if isinstance(f, dict)]
    index = next((i for i, f in enumerate(factors) if f.get("key") == key), None)
    if index is None:
        raise FiguresError("This report doesn't have that section.")
    now = datetime.now(timezone.utc)
    store = report.get("_owner_figures") if isinstance(report.get("_owner_figures"), dict) else {}
    recent = _check_runs(store.get(key), now)

    agent = getattr(prospect, "audience", None) == "agent"
    days_live = getattr(prospect, "listing_duration_days", None)
    derived = derive(key, figures, days_live if isinstance(days_live, int) else None)
    old = factors[index]
    raw_out = await report_writer._ask(
        _prompt(old, figures, derived, report, agent=agent, asking_price=getattr(prospect, "asking_price", None)),
        agent=agent, max_tokens=1500, what=f"owner-figures rewrite of {key}")

    verdict = derived.get("_forced_verdict") or raw_out.get("verdict")
    if verdict not in (rf.PROBLEM, rf.WORKING_WELL):
        verdict = rf.WORKING_WELL
    new = {
        **{k: old.get(k) for k in ("num", "key", "name")},
        "verdict": verdict,
        "severity": report_writer._severity(raw_out.get("severity")) if verdict == rf.PROBLEM else None,
        "found": str(raw_out.get("found") or "").strip(),
        "why": str(raw_out.get("why") or "").strip(),
        "action": str(raw_out.get("action") or "").strip(),
        "owner_figures": {"updated_at": now.isoformat()},
    }
    if not (new["found"] and new["action"]):
        raise FiguresError("We couldn't update this section just now. Please try again in a minute.")
    if new["verdict"] == rf.PROBLEM and new["severity"] is None:
        new["severity"] = 3

    # The same checks as the rest of the report, trusting the figures just given.
    trusted = report.get("_trusted") if isinstance(report.get("_trusted"), dict) else {}
    extra = trusted_additions(figures, derived)
    merged = {**trusted, **{k: list(trusted.get(k) or []) + v for k, v in extra.items()}}
    facts = sps.prospect_report_facts(prospect, {**report, "_trusted": merged})
    one = {"factors": [new]}
    one = report_guard.clean_factor_report(one, facts)
    one = await report_tone.fix_report_tone(one, agent=agent)
    one = report_guard.clean_factor_report(one, facts)
    checked = one["factors"][0]
    if checked.get("verdict") == rf.CHECK_WITH_AGENT:  # the checks emptied it: keep what was there
        raise FiguresError("We couldn't update this section just now. Please try again in a minute.")
    checked["owner_figures"] = new["owner_figures"]

    factors[index] = checked
    report["factors"] = factors
    report["_trusted"] = merged
    store[key] = {"figures": figures, "derived": {k: v for k, v in derived.items() if not k.startswith("_")},
                  "factor": checked, "at": now.isoformat(), "runs": recent + [now.isoformat()]}
    report["_owner_figures"] = store
    setattr(prospect, column, json.dumps(report, ensure_ascii=False))
    return checked


def carry_over(old: dict[str, Any] | None, new: dict[str, Any]) -> dict[str, Any]:
    """A rebuilt report keeps the factors written from the customer's figures
    (the rebuild would otherwise put them back to "check with your agent")."""
    store = (old or {}).get("_owner_figures")
    if not isinstance(store, dict) or not store or not isinstance(new, dict):
        return new
    factors = [dict(f) for f in new.get("factors") or [] if isinstance(f, dict)]
    for f in factors:
        entry = store.get(f.get("key"))
        if isinstance(entry, dict) and isinstance(entry.get("factor"), dict):
            f.update({k: v for k, v in entry["factor"].items() if k not in ("num", "key", "name")})
    new["factors"] = factors
    new["_owner_figures"] = store
    trusted = new.get("_trusted") if isinstance(new.get("_trusted"), dict) else {}
    for entry in store.values():
        if isinstance(entry, dict):
            for k, v in trusted_additions(entry.get("figures") or {}, entry.get("derived") or {}).items():
                trusted[k] = list(trusted.get(k) or []) + v
    new["_trusted"] = trusted
    return new


def figures_for_page(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """The figures already given, to pre-fill the forms."""
    store = report.get("_owner_figures") if isinstance(report.get("_owner_figures"), dict) else {}
    return {k: dict(v.get("figures") or {}) for k, v in store.items() if isinstance(v, dict) and k in FORMS}
