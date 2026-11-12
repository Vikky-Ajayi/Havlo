"""Writes the 20-factor report (overhaul, Nov 2026).

Two stages. The free preview is one AI request: all 20 factors with a verdict
and a short write-up, plus the score, pricing line and executive summary.
The paid report adds the live market data and rewrites every factor in full
(two requests of ten factors) alongside a third request for the executive
summary and the three most important actions.

Rev 2 (Nov 2026): the first writer gave the model thin facts (a cut-off
description, a price, a list of sales) and told it to say "check with your
agent" when unsure, so the paid report came back as twenty referrals to the
agent. Now every factor is written from report_analysis (the gaps, scenarios,
stamp duty, £/sq ft, description coverage, live competition and demand worked
out in code), with guidance on how an experienced agent would judge it, and
"check with your agent" is kept for the two factors only the agent can see.
The figures the analysis computed are stored on the report (_trusted) so the
claim checks keep the sentences that quote them.

Rules that always hold: exactly 20 factors, the two private-data factors on
"check with your agent", code-decided verdicts where the facts settle it,
the day sentence worked out in code, street and house names scrubbed out.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services import groq_service, report_analysis as ra, report_factors as rf

logger = logging.getLogger(__name__)

REPORT_VERSION = 2
# Which writer produced a report: 1 = the first 20-factor writer (thin facts),
# 2 = the analysis-led writer. The rebuild tool upgrades anything below this.
WRITER_REV = 2

# The voice (owner-approved, Nov 2026), now asking for substance as well.
TONE_INSTRUCTION = (
    "Write like an experienced local estate agent talking to a homeowner at their kitchen table. Be straight, "
    "warm and practical, and give them your honest professional opinion. Every factor must use real details "
    'from their own listing: a price, a figure, a date, a room. Say "your property", never the street or house '
    "name.\n"
    "Rules: plain sentences, mostly under 25 words. Everyday words. Use contractions. Lead with what you found, "
    "then why it matters to them, then exactly what to do. Every sentence adds a fact, a reason or a step; no "
    "filler.\n"
    "Never use these words or habits: leverage, navigate, crucially, it's worth noting, in today's market, "
    'furthermore, proposition, narrative, optimise. No dashes dropped into sentences. No "not just X but Y". '
    "Vary how you open each factor."
)

TONE_EXAMPLES = (
    "Asking price (a problem): Your asking price is £450,000. The three semis recorded as sold nearby went for "
    "£395,000 to £410,000, so you're £40,000 above the best of them. Yours has the extension and a bigger garden, "
    "which is worth something, but buyers and their surveyor need a sale that backs the price, and they don't have "
    "one. You've also been reduced for ten weeks without a sale agreed, which tells you the same thing. Ask your "
    "agent for the two best sales of extended semis within a mile from the last year. If they can't find any above "
    "£420,000, plan to move to £425,000.\n\n"
    "Engagement (check with your agent): We can't see your views or enquiries; Rightmove only shows them to your "
    "agent. Ask for four numbers: total views since launch, views in the last 14 days, enquiries, and viewings "
    "booked. If views have fallen since the reduction, buyers aren't finding you, so the price band or the lead "
    "photo has to change. If views are steady but few people book, the listing isn't convincing them, so fix the "
    "photos and description first. If people view but nobody comes back, it's the price or something they see in "
    "person.\n\n"
    "Floor plan (working well): Your floor plan is there and the room sizes are stated, which is exactly what "
    "buyers at this level use to decide whether to book. Leave it as it is, but check the plan is the second image, "
    "not the last, so people see it before they lose interest."
)

# How an experienced agent judges each factor. The model gets the relevant
# line with each factor, so it reasons from the evidence instead of hedging.
FACTOR_GUIDE: dict[str, str] = {
    "visibility": "Insight: buyers set a maximum price in round steps, and a listing only appears in searches whose "
                  "maximum is at or above it. On a step: working well; say which buyers can't see it today (those "
                  "searching up to the step below) and how many more a move would reach. Just above a step: a "
                  "problem; name the step and say those buyers never see the home at all.",
    "engagement": "Always check_with_agent. The seller can't see these figures, so give them the exact ones to "
                  "request (total views since launch, views in the last 14 days, enquiries, viewings booked) and "
                  "how to read them: falling views mean buyers aren't finding it; steady views but few viewings "
                  "mean the listing isn't convincing; viewings but no second viewings mean price or something "
                  "seen in person. Say what to do in each case.",
    "asking_price": "Insight beyond the gap: compare the price with the recorded sales (range, gap to the highest "
                    "in £ and %). If the home is much bigger or better (floor area, bedrooms, plot), say plainly "
                    "those sales are a weak guide and what evidence the price needs. Explain the hidden risk: a "
                    "buyer's mortgage lender sends a surveyor who values against comparable sales, so without "
                    "evidence the price can be down-valued and the deal renegotiated or lost after an offer. Weigh "
                    "the time since the reduction and demand, and say if price is the main barrier.",
    "pricing_range": "Lay out the scenarios given: hold, the next step down and the one below, with the change, the "
                     "searches each appears in and the buyer's stamp duty saving. Recommend one with a reason and "
                     "a trigger (e.g. hold for 14 days with the fixes, then move if viewings don't pick up). Say why "
                     "one decisive move to a search step beats several small cuts: small cuts tell buyers to wait "
                     "for the next one. Never invent any other price.",
    "comparable_sold": "Walk through the recorded sales with dates and types and say how useful each is as "
                       "evidence (how old, what type, likely size). Say what better comparables look like and why "
                       "they matter: they are what buyers, their agents and lenders' surveyors will use.",
    "active_competition": "Use the live counts: homes for sale now, how many within 15% of the price, new listings "
                          "in 30 days, reductions nearby. Few or no alternatives: buyers at this level have little "
                          "choice, so if they aren't buying it's the price or the home, not competition, and any "
                          "new listing nearby will draw the same buyers fast. Many: say how the home must stand out.",
    "buyer_demand": "The 12-month sales are a different, wider set from the recorded comparables: say what they "
                    "cover (sold_last_12_months_covers) so the two can't read as a contradiction. "
                    "Interpret the sales agreed since listing and the sales in the last 12 months and their range: "
                    "are buyers active at this price level or only below it, and what does that mean for timing "
                    "and for which buyers to target.",
    "time_on_market": "Don't open with how long it's been: the seller knows, and the summary already says it. Lead "
                      "with what it is doing to the sale. "
                      "A price reduction sends an alert to buyers who've saved the home or a matching search; "
                      "since that alert, nothing new has gone out to them, so to active buyers the listing has gone "
                      "quiet. Buyers can see the 'Reduced on' date, and after a few months they wonder what's wrong "
                      "and offer low. Then give the reset plan: what to change, all on the same day, so the next "
                      "alert lands on a listing that looks fresh.",
    "reduction_history": "Say what the last reduction did and didn't achieve, and what that signals: the gap to what "
                         "buyers will pay is still there. Explain that repeated small cuts teach buyers to wait, "
                         "while one clear move to a search step resets interest. Flag an out-of-date guide price "
                         "if one is given. If never reduced, say whether one is due yet.",
    "photography": "Every photo has been reviewed. Use the findings, the rooms shown, the missing shots, the weak "
                   "photos and the order notes. Be specific: name photo numbers, say which room should follow the "
                   "lead photo, which photos to drop or retake, and which shots to add. Buyers decide from the first "
                   "few images whether to open the listing at all.",
    "description": "Judge the full description. Does the opening sell the best thing in the first line, which is "
                   "all most buyers read? Are the details buyers filter and ask about there (floor area, EPC, tenure, "
                   "council tax, parking, transport, schools, garden size)? Rightmove shows some in panels of their own "
                   "(shown_in_listing_sections): those count as given, though the most important can still be "
                   "repeated in the text. Name exactly what's missing from the whole listing and write the line to "
                   "add.",
    "floor_plan": "Floor plan count and whether room sizes and total area are stated (in the text, Rightmove's size "
                  "panel, the room list or printed on the plan itself). Use the layout notes read from the plan. Say "
                  "what buyers at this level use it for (judging space before travelling to view) and whether its "
                  "position or content should change.",
    "positioning": "Pick the two or three strongest selling points from the facts (size, garden, transport, period, "
                   "recent works) and say whether the listing leads with them. Write a sharper headline or opening "
                   "line in advert voice.",
    "target_buyer": "Describe the likely buyer from the facts: who can afford it (deposit, income or equity) and what "
                    "they want (space, schools, commute). At the top end most buyers are moving up from a home they "
                    "must sell, so say why proceedable buyers matter and where and how the agent should reach them.",
    "buyer_objections": "Name the two or three doubts a buyer is likely to have from the evidence (price against "
                        "sales, time on the market, an out-of-date guide price, a missing tour or details) and give "
                        "a specific answer to each that the agent can use before and during viewings. A short lease "
                        "(under 90 years), a high service charge or rising ground rent, a flood history or legal "
                        "restrictions are doubts too when the listing states them.",
    "viewing_conversion": "Always check_with_agent. Give the figures to get (viewings, second viewings, offers, "
                          "feedback from each viewing) and how to act on them: no second viewings points to price "
                          "or a fixable objection; repeated feedback tells you what to fix before the next viewing.",
    "agent_marketing": "Judge the marketing from what's visible: photos, floor plan, virtual tour, the guide price "
                       "wording. At this price a missing virtual tour or video is a problem. Say what a strong "
                       "campaign at this level includes (a filmed tour, a featured or premium portal placement, a "
                       "printed brochure, the agent's own buyer list) and exactly what to ask the agent to add and "
                       "by when.",
    "condition_readiness": "Use the EPC rating (and its potential rating, read from the listing's EPC chart), the "
                           "heating and utilities, any flood risk or legal restrictions the listing states, and any "
                           "works mentioned. List the paperwork a buyer's solicitor will ask "
                           "for (EPC, building regulations and warranties for the works, boiler service and Gas Safe "
                           "records, electrical certificate, FENSA for windows) and say to gather it now: missing "
                           "paperwork is a common reason agreed sales stall or fall through.",
    "affordability": "Use the deposit, loan, income and stamp duty at the asking price and at each scenario, and say "
                     "how the buyer's total cost changes at the next step down. At the top of the market the buyer "
                     "pool is small by nature: that alone isn't a problem. Mark it a problem only if the purchase "
                     "costs themselves look out of line for this kind of buyer; don't repeat the price problem here.",
    "net_proceeds": "Always check_with_agent: the fee and mortgage figures sit with the agent and lender. Use the "
                    "fee per 0.5% and the scenario price changes. Show how to work out what they walk away with at "
                    "each price, which figures to gather (agent fee %, mortgage redemption, early repayment charges, "
                    "legal fees), and that every month unsold has its own cost (mortgage, bills, council tax) to set "
                    "against a lower price that sells sooner.",
}

JUDGEMENT_RULES = (
    "How to judge:\n"
    '- Decide every verdict from the evidence. "problem" only when that factor itself is holding the sale back; '
    '"working_well" when it is helping or fine. Use "check_with_agent" ONLY for listing engagement, viewing-to-offer '
    "and seller net proceeds, where the figures sit with the agent or lender. Never use it because you're unsure: "
    "judge from what you have and say what would change your view.\n"
    "- Where a verdict is given in brackets, use it.\n"
    "- Never just repeat what the seller already knows (their price, how long it has been, their bedrooms). Use "
    "those facts only as the lead-in to something they don't know: what it means, why it's happening, how buyers, "
    "portals and lenders behave as a result, and what usually fixes it. For every factor ask: what does the seller "
    "learn here that they didn't know? If the answer is nothing, rewrite it.\n"
    "- You may use well-established knowledge of how the UK market works (portal searches and alerts, mortgage "
    "surveys, how buyers read reductions), but never a number that isn't in the facts.\n"
    "- Join the dots like a valuer: a price far above every recorded sale, months since the reduction and no "
    "sale agreed all point the same way. Say so plainly, once.\n"
    "- Don't count the same problem twice. Make the price recommendation (which price, and when to move to it) in "
    "Recommended Pricing Range only; elsewhere refer to it in a few words at most. A factor that is fine apart "
    "from the price is working well.\n"
    "- Use the figures given, exactly as given. Never invent a number, a sale, a view count, a viewing or buyer "
    "feedback.\n"
    '- Every action is something the seller can do or decide, with the number, wording or step. "Ask your agent" '
    "is only acceptable as a precise request (exactly which figures or documents) followed by what to do with the "
    'answer. Give a deadline where it matters, but don\'t open every action with "This week".\n'
    "- Each factor must make sense on its own: never open with \"Those sales\", \"This\" or \"That\" pointing back "
    "to something not said in that same factor.\n"
    '- Suggested listing wording is written as the advert would read it ("A refurbished Victorian home offering…"), '
    'not as "your property".\n'
    '- Never mention "the full report", "the figures provided", "the data we were given" or how this was worked '
    "out. You are the expert who has studied their listing.\n"
    "- The only day counts you may state are the fixed day line, the days since a reduction and the local "
    "benchmark, where given."
)

_VALID_VERDICTS = {rf.PROBLEM, rf.WORKING_WELL, rf.CHECK_WITH_AGENT}

# When the model gives nothing usable for a factor (or the claim checks empty
# it): a specific next step for that factor, never a bare "ask your agent".
_FALLBACK: dict[str, dict[str, str]] = {
    "net_proceeds": {
        "found": "What you walk away with depends on your agent's fee, your mortgage and your legal costs.",
        "why": "A price change needs judging against what you'll actually receive, not the headline figure.",
        "action": "Get your agent contract (fee and VAT), a mortgage redemption statement with any early repayment "
                  "charge, and your solicitor's estimate, then work out the figure you'd receive at each price."},
    "engagement": {
        "found": "Rightmove only shows your views and enquiries to your agent.",
        "why": "They tell you whether buyers are finding the listing and whether it convinces them.",
        "action": "Ask for total views since launch, views in the last 14 days, enquiries and viewings booked. "
                  "Falling views mean the price band or lead photo needs to change; steady views with few viewings "
                  "mean the photos and description need work."},
    "viewing_conversion": {
        "found": "Only your agent knows how many viewings and second viewings you've had.",
        "why": "Viewings that don't lead to second visits point to the price or something buyers see in person.",
        "action": "Ask for the number of viewings, second viewings and offers, and the feedback from each viewing. "
                  "If the same concern comes up twice, fix it before the next viewing."},
}
_GENERIC_FALLBACK = {
    "found": "We couldn't check this one properly from the listing.",
    "why": "It still affects how buyers see your property.",
    "action": "Raise it with your agent at your next review and agree one change you'll make this week.",
}


def _fallback(key: str) -> dict[str, str]:
    return dict(_FALLBACK.get(key) or _GENERIC_FALLBACK)


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


def _fmt_sales(sales: list[dict[str, Any]] | None) -> str:
    rows = []
    for s in sales or []:
        try:
            rows.append(f"{s.get('property_type') or 'property'} sold for £{int(s['price']):,} on {s.get('date')}")
        except (TypeError, ValueError, KeyError):
            continue
    return "; ".join(rows[:6])


# ── Facts for each factor, from the analysis ─────────────────────────────
# A listing nobody could read (a Zoopla link, with only the address and asking
# price typed in): the factors about the listing itself can't be judged, so each
# says what to check on it rather than inventing what it shows.
UNSEEN_FACTORS = ("time_on_market", "reduction_history", "photography", "description", "floor_plan",
                  "positioning", "agent_marketing", "condition_readiness")
LISTING_NOT_READ = (
    "Only the address and asking price were typed in: nobody has seen this listing's photos, text, floor plan, "
    "dates or price history. Don't describe, count or judge any of them, and don't say they are missing. Say "
    "exactly what to check on the listing for this factor, what good looks like at this price, and what to change "
    "if it falls short."
)


def factor_facts(a: dict[str, Any], *, agent: bool = False) -> dict[str, Any]:
    """What each factor is written from, and the verdicts the facts settle.
    `forced` verdicts are applied in code whatever the model says."""
    prop = a.get("property") or {}
    pos = a.get("price_position") or {}
    vis = a.get("visibility") or {}
    scen = a.get("scenarios") or []
    timing = a.get("timing") or {}
    guide = a.get("guide_range")
    desc = a.get("description") or {}
    media = a.get("media") or {}
    market = {k: v for k, v in (a.get("market") or {}).items() if v not in (None, "", [], {})}
    gaps = a.get("marketing_gaps") or []
    facts: dict[str, dict[str, Any]] = {}
    sections = a.get("listing") or {}

    def section(*keys: str) -> dict[str, Any]:
        """These sections of the listing page, as they appear on it."""
        return {k: sections[k] for k in keys if sections.get(k) not in (None, "", [], {})}

    def put(key: str, data: dict[str, Any], verdict: str | None = None, forced: bool = False) -> None:
        facts[key] = {"data": {k: v for k, v in data.items() if v not in (None, "", [], {})},
                      "verdict": verdict, "forced": forced}

    put("visibility", {**vis, "scenarios": scen},
        vis.get("verdict") if vis.get("known") else None, forced=bool(vis.get("known")))
    put("engagement", {"asking_price": pos.get("asking_price"), "days_since_reduction": timing.get("days_since_reduction"),
                       "ask_for": "total views since launch, views in the last 14 days, enquiries, viewings booked"},
        rf.CHECK_WITH_AGENT, forced=True)
    put("asking_price", {**pos, "property": prop, "timing": timing, "guide_range": guide,
                         "market": {k: market.get(k) for k in ("median_asking_for_sale", "your_price_premium_pct",
                                                               "sold_12m_median", "agreed_since_you_listed")}})
    put("pricing_range", {"scenarios": scen, "price_position": pos, "visibility": vis, "timing": timing,
                          "guide_range": guide})
    put("comparable_sold", {"recorded_sales": pos.get("recorded_sales"), "sales_low": pos.get("sales_low"),
                            "sales_high": pos.get("sales_high"), "sales_median": pos.get("sales_median"),
                            "sales_are_weak_guide": pos.get("sales_are_weak_guide"), "property": prop},
        None if pos.get("sales_known") else rf.CHECK_WITH_AGENT, forced=not pos.get("sales_known"))
    # No alternatives near the price in the live data: buyers at this level have
    # little choice, so competition isn't what's holding the sale back.
    raw_market = a.get("market") or {}
    no_rivals = raw_market.get("homes_for_sale_now") is not None and not raw_market.get("within_15pct_of_your_price")
    put("active_competition", {"market": market, "asking_price": pos.get("asking_price"), "property": prop},
        rf.WORKING_WELL if no_rivals else None, forced=no_rivals)
    put("buyer_demand", {"market": market, "recorded_sales": pos.get("recorded_sales"), "timing": timing})
    time_problem = timing.get("verdict_hint") == rf.PROBLEM
    put("time_on_market", timing, rf.PROBLEM if time_problem else None, forced=time_problem)
    reduced_stall = (timing.get("days_since_reduction") or 0) >= ra.REDUCTION_STALL_DAYS
    put("reduction_history", {"timing": timing, "guide_range": guide, "asking_price": pos.get("asking_price")},
        rf.PROBLEM if reduced_stall else None, forced=reduced_stall)
    put("photography", {"photo_count": media.get("photos"), "photos_reviewed": media.get("photos_reviewed"),
                        "photo_review": media.get("photo_review"), "overall": media.get("photo_overall"),
                        "rooms_shown": media.get("rooms_shown"), "missing_shots": media.get("missing_shots"),
                        "order_notes": media.get("order_notes"), "weak_photos": media.get("weak_photos"),
                        "suggested_fixes": media.get("photo_actions")})
    put("description", {"description": desc, "full_text": None})
    put("floor_plan", {"floorplans": media.get("floorplans"), "floor_area_sqft": desc.get("floor_area_sqft"),
                       "room_sizes_stated": "floor_area" in (desc.get("covers") or [])
                       or bool(sections.get("rooms_with_sizes")),
                       "rooms": [{k: r[k] for k in ("name", "size") if r.get(k)}
                                 for r in sections.get("rooms") or []][:20] or None,
                       **section("size_sqft", "rooms_with_sizes", "floor_plan_area_sqft", "floor_plan_floors",
                                 "floor_plan_layout_notes", "floor_plan_rooms_labelled")},
        rf.PROBLEM if media.get("floorplans") == 0 else None, forced=media.get("floorplans") == 0)
    put("positioning", {"key_features": desc.get("key_features"), "opening_sentence": desc.get("opening_sentence"),
                        "property": prop, "works_mentioned": desc.get("works_mentioned")})
    put("target_buyer", {"property": prop, "affordability": a.get("affordability"),
                         "schools_mentioned": "schools" in (desc.get("covers") or []),
                         **section("stations", "parking", "garden", "accessibility", "council_tax_band",
                                   "tenure", "shared_ownership")})
    put("buyer_objections", {"price_position": {k: pos.get(k) for k in ("asking_price", "sales_high", "above_highest_by",
                                                                         "above_highest_pct", "sales_are_weak_guide")},
                             "timing": timing, "guide_range": guide, "marketing_gaps": gaps,
                             "description_missing": desc.get("missing"),
                             **section("tenure", "lease_years_remaining", "service_charge_per_year",
                                       "ground_rent_per_year", "ground_rent_review_years", "ground_rent_increase_pct",
                                       "flood_risk", "obligations", "shared_ownership", "council_tax_band_note")})
    put("viewing_conversion", {"ask_for": "viewings, second viewings, offers, feedback from each viewing"},
        rf.CHECK_WITH_AGENT, forced=True)
    put("agent_marketing", {"photos": media.get("photos"), "floorplans": media.get("floorplans"),
                            "virtual_tours": media.get("virtual_tours"), "agent": prop.get("agent"),
                            **section("tour_types", "brochure_count", "featured", "premium_display", "epc_shown",
                                      "price_qualifier"),
                            "photos_with_room_captions": len(sections.get("photo_captions") or []) or None,
                            "marketing_gaps": gaps, "guide_range": guide})
    put("condition_readiness", {"epc_rating": desc.get("epc_rating"), "works_mentioned": desc.get("works_mentioned"),
                                "period_or_style": prop.get("period_or_style"),
                                **section("epc_rating_score", "epc_potential", "epc_potential_score", "heating",
                                          "electricity", "water", "sewerage", "broadband", "flood_risk",
                                          "obligations")})
    put("affordability", {**(a.get("affordability") or {}), "scenarios": scen,
                          **section("council_tax_band", "service_charge_per_year", "ground_rent_per_year",
                                    "shared_ownership")})
    put("net_proceeds", a.get("net_proceeds") or {}, rf.CHECK_WITH_AGENT, forced=True)
    if a.get("listing_seen") is False:
        for key in UNSEEN_FACTORS:
            put(key, {"listing_not_read": LISTING_NOT_READ}, rf.CHECK_WITH_AGENT, forced=True)
    return facts


def build_free_facts(
    snapshot: dict[str, Any], *, asking_price: float | None, country: str,
    reduced_days: int | None, advertised_days: int | None,
    sales: list[dict[str, Any]] | None, photo_review: dict[str, Any] | None, agent: bool = False,
    intel: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Each factor's facts (from report_analysis) for the free preview, or the
    paid report when `intel` (live market data) is given."""
    a = ra.analyse(snapshot, asking_price=asking_price, country=country, reduced_days=reduced_days,
                   advertised_days=advertised_days, sales=sales, photo_review=photo_review, intel=intel)
    return factor_facts(a, agent=agent)


def _description_text(snapshot: dict[str, Any]) -> str:
    return str(snapshot.get("description") or "").replace("&amp;", "&")[:4000]


def _factor_lines(specs, facts: dict[str, Any], *, extra: dict[str, str] | None = None) -> list[str]:
    lines = []
    for f in specs:
        entry = facts.get(f["key"]) or {}
        verdict = entry.get("verdict") if entry.get("forced") else None
        data = entry.get("data") or {}
        lines.append(
            f'{f["num"]}. {f["name"]} [key: {f["key"]}]' + (f" [verdict: {verdict}]" if verdict else "")
            + f'\n   how to judge: {FACTOR_GUIDE.get(f["key"], "")}'
            + (f'\n   {extra[f["key"]]}' if extra and extra.get(f["key"]) else "")
            + f'\n   facts: {json.dumps(data, ensure_ascii=False, default=str) if data else "none"}')
    return lines


# ── The free preview writer ───────────────────────────────────────────────
def _free_prompt(facts: dict[str, Any], *, agent: bool, day_sentence: str | None,
                 description: str = "") -> str:
    whose = "this property" if agent else "your property"
    lines = [
        f"Write the free assessment for {whose}: all 20 numbered factors, each with a verdict, so the seller sees "
        "exactly what's holding the sale back.",
        "",
        JUDGEMENT_RULES,
        "",
        "The fixed day line is: " + (f'"{day_sentence}"' if day_sentence else "none, so don't mention days") + ".",
        "",
    ]
    if description:
        lines += ["The full listing description:", description, ""]
    lines += ["The factors:"] + _factor_lines(rf.FACTORS, facts) + [
        "",
        "Length: found = two sentences with at least one figure from the facts; why = one sentence; action = one or "
        "two sentences with a specific step.",
        "Give every problem a severity from 1 (minor) to 5 (the main reason it isn't selling).",
        "",
        "Return JSON only:",
        '{"overall_score": <0-100, lower when serious problems>, "pricing_line": "one sentence on the price with the '
        'key figure", "executive_summary": "three sentences: open with the fixed day line if there is one, then the '
        'main reason it isn\'t selling, then the first thing to do",',
        ' "factors": [{"key": "visibility", "verdict": "problem", "severity": 4, "found": "...", "why": "...", '
        '"action": "..."}, ... all 20]}',
        "",
        "Tone:", TONE_INSTRUCTION, "", "Examples of the voice:", TONE_EXAMPLES,
    ]
    return "\n".join(lines)


def reconcile_verdicts(factors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Verdicts that must agree. If the asking price is a problem, the pricing
    plan is to change it, so Recommended Pricing Range can't read as working
    well next to it."""
    by_key = {f.get("key"): f for f in factors if isinstance(f, dict)}
    price, plan = by_key.get("asking_price"), by_key.get("pricing_range")
    if price and plan and price.get("verdict") == rf.PROBLEM and plan.get("verdict") != rf.PROBLEM:
        plan["verdict"] = rf.PROBLEM
        plan["severity"] = plan.get("severity") or price.get("severity") or 4
    return factors


def _severity(value: Any) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return max(1, min(5, n))


def normalize_report(
    raw: dict[str, Any], facts: dict[str, Any], snapshot: dict[str, Any], *, agent: bool, day_sentence: str | None,
) -> dict[str, Any]:
    """Force the output into exactly 20 valid factors: fill any the AI missed,
    apply the code-decided verdicts, scrub place names, keep the fixed day line."""
    written = {str(f.get("key")): f for f in (raw.get("factors") or []) if isinstance(f, dict)}
    factors = []
    for spec in rf.FACTORS:
        key = spec["key"]
        entry = facts.get(key) or {}
        forced = entry.get("verdict") if entry.get("forced") else None
        w = written.get(key) or {}
        verdict = forced or (str(w.get("verdict")) if str(w.get("verdict")) in _VALID_VERDICTS else None)
        found = scrub_place_names(str(w.get("found") or ""), snapshot, agent=agent)
        why = scrub_place_names(str(w.get("why") or ""), snapshot, agent=agent)
        action = scrub_place_names(str(w.get("action") or ""), snapshot, agent=agent)
        if not found:
            fb = _fallback(key)
            found, why, action = fb["found"], fb["why"], fb["action"]
        verdict = verdict or rf.CHECK_WITH_AGENT
        item = {"num": spec["num"], "key": key, "name": spec["name"],
                "verdict": verdict, "found": found, "why": why, "action": action}
        if verdict == rf.PROBLEM:
            item["severity"] = _severity(w.get("severity")) or 3
        factors.append(item)
    reconcile_verdicts(factors)
    summary = scrub_place_names(str(raw.get("executive_summary") or ""), snapshot, agent=agent)
    if day_sentence and day_sentence.lower() not in summary.lower():
        summary = f"{day_sentence} {summary}".strip()
    try:
        score = max(0, min(100, int(raw.get("overall_score"))))
    except (TypeError, ValueError):
        score = 50
    return {
        "version": REPORT_VERSION,
        "_writer_rev": WRITER_REV,
        "overall_score": score,
        "pricing_line": scrub_place_names(str(raw.get("pricing_line") or ""), snapshot, agent=agent),
        "executive_summary": summary,
        "day_sentence": day_sentence,
        "factors": factors,
    }


def _system(agent: bool) -> str:
    who = "an estate agency about one of its listings" if agent else "a homeowner whose property hasn't sold"
    return (f"You are a senior UK estate agent and valuer advising {who}. You give clear, honest, specific advice "
            "from the evidence. Return only valid JSON. Follow the tone exactly.")


async def write_free_report(
    snapshot: dict[str, Any], *, asking_price: float | None, country: str = "UK",
    reduced_days: int | None = None, advertised_days: int | None = None,
    sales: list[dict[str, Any]] | None = None, photo_review: dict[str, Any] | None = None, agent: bool = False,
) -> dict[str, Any]:
    """The free-preview report: all 20 factors with verdicts, from one AI call."""
    import asyncio

    if snapshot.get("manual_details"):  # typed in: no date was seen, so no day line
        reduced_days = advertised_days = None
    analysis = ra.analyse(snapshot, asking_price=asking_price, country=country, reduced_days=reduced_days,
                          advertised_days=advertised_days, sales=sales, photo_review=photo_review)
    facts = factor_facts(analysis, agent=agent)
    day = rf.day_sentence(reduced_days, advertised_days, agent=agent)
    prompt = _free_prompt(facts, agent=agent, day_sentence=day, description=_description_text(snapshot))

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": _system(agent)}, {"role": "user", "content": prompt}],
            max_tokens=7000, temperature=0.4, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        raw = json.loads(await asyncio.to_thread(_call))
    except Exception:  # noqa: BLE001 -- a bad call must not crash; fall back per factor
        logger.exception("Free 20-factor report generation failed")
        raw = {}
    report = normalize_report(raw if isinstance(raw, dict) else {}, facts, snapshot, agent=agent, day_sentence=day)
    # The three revealed on the free preview are what sells the report: give
    # them the senior-partner check (report_editor) before anyone sees them.
    from app.services import report_editor

    revealed = {f.get("key") for f in v2_preview(report).get("revealed") or []}
    report = await report_editor.edit_report(report, facts, agent=agent, keys=revealed, snapshot=snapshot)
    _mark_photography_verified(report, photo_review)
    report["_sales_given"] = bool(_fmt_sales(sales)) or bool((analysis.get("price_position") or {}).get("sales_known"))
    report["_media_given"] = bool((snapshot.get("media") or {}))
    report["_trusted"] = analysis["trusted"]
    return report


# ── Paid report: live market data + a full write of every factor ──────────
def build_market_facts(intel: dict[str, Any]) -> dict[str, Any]:
    """The live-market numbers, by the factor that uses them (kept for older
    callers; the paid writer now reads them through report_analysis)."""
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
                 *, agent: bool, day_sentence: str | None, description: str = "") -> str:
    whose = "this property" if agent else "your property"
    previews = {s["key"]: f'free verdict: {(free_by_key.get(s["key"]) or {}).get("verdict")}; free preview said: '
                          f'{(free_by_key.get(s["key"]) or {}).get("found") or ""}' for s in specs}
    lines = [
        f"Write the full paid assessment for {whose}, factor by factor. The seller paid for an expert's detailed "
        "view: make each factor specific, complete and useful.",
        "",
        JUDGEMENT_RULES,
        "",
        "The fixed day line is: " + (f'"{day_sentence}"' if day_sentence else "none, so don't mention days") + ".",
        "",
    ]
    if description:
        lines += ["The full listing description:", description, ""]
    lines += ["The factors:"] + _factor_lines(specs, facts, extra=previews) + [
        "",
        "Length for every factor: found = three to five sentences using the specific figures and details; why = two "
        "or three sentences on how it affects buyers and the sale; action = two to four sentences, each a concrete "
        "step with the number, wording or deadline.",
        "",
        'Return JSON only: {"factors": [{"key": "...", "verdict": "problem|working_well|check_with_agent", '
        '"found": "...", "why": "...", "action": "..."}, ...]}',
        "", "Tone:", TONE_INSTRUCTION, "", "Examples of the voice:", TONE_EXAMPLES,
    ]
    return "\n".join(lines)


def _summary_prompt(free_report: dict[str, Any], analysis: dict[str, Any], *, agent: bool,
                    day_sentence: str | None) -> str:
    whose = "this property" if agent else "your property"
    verdicts = [{"factor": f.get("name"), "verdict": f.get("verdict"), "found": f.get("found")}
                for f in free_report.get("factors") or [] if isinstance(f, dict)]
    key = {k: analysis.get(k) for k in ("property", "price_position", "scenarios", "timing", "guide_range",
                                         "marketing_gaps", "market")}
    return "\n".join([
        f"Write the executive summary and the three most important actions for {whose}'s full assessment.",
        "",
        JUDGEMENT_RULES,
        "",
        "The fixed day line is: " + (f'"{day_sentence}"' if day_sentence else "none, so don't mention days") + ".",
        "",
        f"The factor verdicts: {json.dumps(verdicts, ensure_ascii=False)}",
        f"The analysis: {json.dumps(key, ensure_ascii=False, default=str)}",
        "",
        "executive_summary: four to six sentences. Open with the fixed day line if there is one. Then the main reason "
        "it hasn't sold, stated in full with its figures (e.g. how far the price is above which recorded sales), what "
        "is genuinely working, and the specific moves you recommend with their figures (the new price, the top "
        "fixes). It is read on its own: never refer to \"those sales\" or anything not stated in the summary itself, "
        "and never end on a generic line.",
        "pricing_line: one sentence on the price with the key figure.",
        "top_actions: exactly three, most important first. Each has a short title (at most eight words) and a detail "
        "of two or three sentences with the specific figure, wording or deadline. Each is self-contained: state the "
        "price or wording itself, never \"the price in the pricing line\" or another section's name.",
        "",
        'Return JSON only: {"executive_summary": "...", "pricing_line": "...", "overall_score": <0-100>, '
        '"top_actions": [{"title": "...", "detail": "..."}, ...]}',
        "", "Tone:", TONE_INSTRUCTION,
    ])


async def _ask(prompt: str, *, agent: bool, max_tokens: int, what: str) -> dict[str, Any]:
    import asyncio

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": _system(agent)}, {"role": "user", "content": prompt}],
            max_tokens=max_tokens, temperature=0.4, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        data = json.loads(await asyncio.to_thread(_call))
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        logger.exception("Paid 20-factor %s failed", what)
        return {}


async def _paid_half(specs, free_by_key, facts, *, agent, day_sentence, description: str = "") -> dict[str, Any]:
    prompt = _paid_prompt(specs, free_by_key, facts, agent=agent, day_sentence=day_sentence, description=description)
    data = await _ask(prompt, agent=agent, max_tokens=7000, what="half")
    return {str(f.get("key")): f for f in (data.get("factors") or []) if isinstance(f, dict)}


async def write_paid_report(
    prospect: Any, free_report: dict[str, Any], snapshot: dict[str, Any], *,
    asking_price: float | None, country: str = "UK", reduced_days: int | None = None,
    advertised_days: int | None = None, sales: list[dict[str, Any]] | None = None,
    photo_review: dict[str, Any] | None = None, agent: bool = False,
) -> dict[str, Any]:
    """The full report: live market data gathered first, then every factor
    written in full (two requests) and the summary + top three actions (a
    third), all at once. The three factors the customer saw on the preview keep
    their verdicts; the others may firm up now that the live data is in."""
    import asyncio

    from app.services import agent_report

    if snapshot.get("manual_details"):
        reduced_days = advertised_days = None
    try:
        intel = await asyncio.wait_for(agent_report.build_intel(prospect), 45)
    except Exception:  # noqa: BLE001 -- the market search can fail; the factors still have the analysis
        logger.warning("Paid report: live market data unavailable for %s", getattr(prospect, "id", "?"))
        intel = {}
    analysis = ra.analyse(snapshot, asking_price=asking_price, country=country, reduced_days=reduced_days,
                          advertised_days=advertised_days, sales=sales, photo_review=photo_review, intel=intel)
    facts = factor_facts(analysis, agent=agent)
    free_by_key = {f["key"]: f for f in free_report.get("factors") or [] if isinstance(f, dict)}
    revealed = {f.get("key") for f in v2_preview(free_report).get("revealed") or []}
    day = free_report.get("day_sentence") or rf.day_sentence(reduced_days, advertised_days, agent=agent)
    description = _description_text(snapshot)
    half = len(rf.FACTORS) // 2
    first, second, summary = await asyncio.gather(
        _paid_half(rf.FACTORS[:half], free_by_key, facts, agent=agent, day_sentence=day, description=description),
        _paid_half(rf.FACTORS[half:], free_by_key, facts, agent=agent, day_sentence=day, description=description),
        _ask(_summary_prompt(free_report, analysis, agent=agent, day_sentence=day), agent=agent,
             max_tokens=2000, what="summary"))
    written = {**first, **second}

    factors = []
    for spec in rf.FACTORS:
        key = spec["key"]
        free = free_by_key.get(key) or {}
        w = written.get(key) or {}
        entry = facts.get(key) or {}
        forced = entry.get("verdict") if entry.get("forced") else None
        paid_verdict = str(w.get("verdict")) if str(w.get("verdict")) in _VALID_VERDICTS else None
        if key in revealed and free.get("verdict"):
            verdict = free["verdict"]  # what the customer saw on the preview
        else:
            verdict = forced or paid_verdict or free.get("verdict") or rf.CHECK_WITH_AGENT
        found = scrub_place_names(str(w.get("found") or free.get("found") or ""), snapshot, agent=agent)
        why = scrub_place_names(str(w.get("why") or free.get("why") or ""), snapshot, agent=agent)
        action = scrub_place_names(str(w.get("action") or free.get("action") or ""), snapshot, agent=agent)
        if not found:
            fb = _fallback(key)
            found, why, action = fb["found"], fb["why"], fb["action"]
        item = {"num": spec["num"], "key": key, "name": spec["name"], "verdict": verdict,
                "found": found, "why": why, "action": action}
        if verdict == rf.PROBLEM:
            item["severity"] = free.get("severity") or 3
        factors.append(item)

    reconcile_verdicts(factors)
    paid = dict(free_report)
    paid["factors"] = factors
    # The senior-partner check over all twenty: rewrite the ones that only
    # repeat what the seller knows, stay generic or repeat another factor.
    from app.services import report_editor

    paid = await report_editor.edit_report(paid, facts, agent=agent, snapshot=snapshot)
    exec_summary = scrub_place_names(str(summary.get("executive_summary") or ""), snapshot, agent=agent)
    if exec_summary:
        if day and day.lower() not in exec_summary.lower():
            exec_summary = f"{day} {exec_summary}"
        paid["executive_summary"] = exec_summary
    pricing_line = scrub_place_names(str(summary.get("pricing_line") or ""), snapshot, agent=agent)
    if pricing_line:
        paid["pricing_line"] = pricing_line
    try:
        paid["overall_score"] = max(0, min(100, int(summary.get("overall_score"))))
    except (TypeError, ValueError):
        pass
    paid["top_actions"] = [
        {"title": scrub_place_names(str(t.get("title") or ""), snapshot, agent=agent),
         "detail": scrub_place_names(str(t.get("detail") or ""), snapshot, agent=agent)}
        for t in (summary.get("top_actions") or []) if isinstance(t, dict) and t.get("title")
    ][:3]
    _mark_photography_verified(paid, photo_review)
    paid["_expanded"] = True
    # Both full-write requests came back empty (the model was down): the report
    # is marked done so the page doesn't retry every few seconds, but flagged
    # so the console's upgrade tool rebuilds it properly.
    if not written:
        paid["_paid_degraded"] = True
        logger.error("Paid 20-factor write returned nothing for %s; flagged for rebuild", getattr(prospect, "id", "?"))
    paid["_market_data"] = bool(intel)
    paid["_writer_rev"] = WRITER_REV
    paid["_trusted"] = analysis["trusted"]
    paid["_sales_given"] = bool((analysis.get("price_position") or {}).get("sales_known")) or paid.get("_sales_given", False)
    scenarios = analysis.get("scenarios") or []
    if len(scenarios) > 1:
        paid["_next_price_step"] = scenarios[1]["price"]  # the dashboard's day-21 decision point
    paid["competition"] = competition_table(intel)
    return paid


def competition_table(intel: dict[str, Any] | None) -> dict[str, Any] | None:
    """The homes for sale now that buyers are comparing with this one, for the
    report's price comparison (from the live market data). None when the
    market search didn't run."""
    if not isinstance(intel, dict) or not intel:
        return None
    market = intel.get("market") or {}
    rows = []
    for r in (market.get("competing") or [])[:8]:
        if not isinstance(r, dict) or not r.get("price"):
            continue
        rows.append({k: r.get(k) for k in ("address", "price", "bedrooms", "type", "status", "first_listed", "distance")
                     if r.get(k) not in (None, "")})
    return {
        "area": intel.get("area_label"),
        "compared_with": intel.get("basis_label"),
        "for_sale_now": market.get("for_sale"),
        "within_15pct": market.get("alternatives"),
        "listings": rows,
    }


def _mark_photography_verified(report: dict[str, Any], photo_review: dict[str, Any] | None) -> None:
    """Flag the photography factor as photo-verified when the vision step ran,
    so the accuracy checks keep its photo descriptions."""
    if not photo_review or not photo_review.get("photos_seen"):
        return  # no review, or only the EPC chart and floor plan were read
    for f in report.get("factors") or []:
        if isinstance(f, dict) and f.get("key") == "photography":
            f["_photo_verified"] = True


# Factors that are all, at heart, about the price.
PRICE_THEME = {"visibility", "asking_price", "pricing_range", "comparable_sold", "reduction_history",
               "affordability", "net_proceeds", "buyer_demand"}


def report_is_v2(report: Any) -> bool:
    return isinstance(report, dict) and (report.get("version") == REPORT_VERSION or bool(report.get("factors")))


def v2_preview(report: dict[str, Any]) -> dict[str, Any]:
    """The free-preview shape for a 20-factor report: the 3 most serious
    problems revealed in full (by severity, then factor order), the other 17
    locked as names and subtext. Gaps in the 3 are filled with check-with-agent
    factors, never strengths."""
    factors = [f for f in (report.get("factors") or []) if isinstance(f, dict)]
    order = {s["key"]: s["num"] for s in rf.FACTORS}
    problems = sorted((f for f in factors if f.get("verdict") == rf.PROBLEM),
                      key=lambda f: (-(f.get("severity") or 3), order.get(f.get("key"), 99)))
    # Show the range of what's wrong, not three takes on the price: one price
    # factor when there are at least two other problems to show, else two.
    others = sum(f.get("key") not in PRICE_THEME for f in problems)
    price_cap = 1 if others >= 2 else 2
    picked: list[dict[str, Any]] = []
    for f in problems:
        if len(picked) == 3:
            break
        if f.get("key") in PRICE_THEME and sum(p.get("key") in PRICE_THEME for p in picked) >= price_cap:
            continue
        picked.append(f)
    for f in problems:  # top up from the skipped ones if there weren't enough others
        if len(picked) < 3 and f not in picked:
            picked.append(f)
    checks = [f for f in factors if f.get("verdict") == rf.CHECK_WITH_AGENT]
    revealed = (picked + checks)[:3]
    revealed_keys = {f.get("key") for f in revealed}
    locked = [{"num": s["num"], "key": s["key"], "name": s["name"], "subtext": s["locked_subtext"]}
              for s in rf.FACTORS if s["key"] not in revealed_keys]
    return {
        "version": REPORT_VERSION,
        "overall_score": report.get("overall_score", 50),
        "pricing_line": report.get("pricing_line", ""),
        "executive_summary": report.get("executive_summary", ""),
        "day_sentence": report.get("day_sentence"),
        "total_factors": len(rf.FACTORS),
        "revealed_count": len(revealed),
        "locked_count": len(locked),
        "revealed": [{"num": f.get("num"), "key": f.get("key"), "name": f.get("name"),
                      "verdict": f.get("verdict"), "found": f.get("found"), "why": f.get("why", "")}
                     for f in revealed],
        "locked": locked,
    }


# ── Finish a report: accuracy checks, tone fix, accuracy again ────────────
async def finalize_report(report: dict[str, Any], facts: Any, *, agent: bool = False,
                          trusted_keys: tuple[str, ...] = ()) -> dict[str, Any]:
    """The last pass over a written report: check every factor's claims, rewrite
    only the paragraphs that read as AI, then check again (report_guard +
    report_tone). A factor flagged _photo_verified (photography, when the vision
    step ran) keeps its photo descriptions."""
    from app.services import report_guard, report_tone

    removed: list[dict[str, Any]] = []
    report = report_guard.clean_factor_report(report, facts, trusted_keys=trusted_keys, removed=removed)
    report = await report_tone.fix_report_tone(report, agent=agent)
    report = report_guard.clean_factor_report(report, facts, trusted_keys=trusted_keys, removed=removed)
    if isinstance(report.get("top_actions"), list):
        report["top_actions"] = [
            {"title": t.get("title"), "detail": report_guard.clean_text(t.get("detail"), facts, removed, "top_actions")}
            for t in report["top_actions"] if isinstance(t, dict)
        ]
        report["top_actions"] = [t for t in report["top_actions"] if t.get("title") and t.get("detail")]
    # What the checks took out, kept so a weak or broken paragraph can be
    # traced to the rule that cut it (never shown to the customer).
    report["_removed"] = removed[:60]
    return report
