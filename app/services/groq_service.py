"""Groq LLM service for AI property analysis reports."""
from __future__ import annotations

from copy import deepcopy
import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Keep the model in one shared constant because all report generators use the
# same production model.
GROQ_MODEL = "openai/gpt-oss-120b"

# Fixed, non-AI-generated advisory items appended to every stale-listing
# report's action_plan, after whatever property-specific items the model
# generated. Unlike the rest of action_plan, this content never varies
# between reports or reruns — it's universal advice (plus the Sell Faster /
# Havlo Relaunch cross-sell in #2) that should never depend on the model
# choosing to include it. No priority/why_it_matters/bullets on purpose:
# RecommendationContent (StaleProspectWizard.tsx) only renders those fields
# when present, and these are meant to read as plain narrative paragraphs.
STANDING_ADVISORY_ACTIONS: list[dict[str, Any]] = [
    {
        "title": "Neighbourhood Buyer Outreach",
        "description": (
            "Your property's next buyer may already live nearby — or have a reason to want to.\n\n"
            "Neighbouring households are an often-overlooked source of potential buyers. A neighbour may "
            "have family members, adult children, friends or colleagues who would like to live closer, or "
            "they may personally be considering purchasing a larger, smaller or additional property within "
            "the area.\n\n"
            "Some Havlo clients have used targeted neighbourhood outreach to generate buyer interest within "
            "weeks, including from people who were not actively searching for a property.\n\n"
            "We recommend asking your agent to create a dedicated property flyer or letter and distribute it "
            "to carefully selected surrounding households. Rather than simply announcing that the property is "
            "for sale, the communication should clearly present the opportunity and encourage neighbours to "
            "share it with anyone they know who may want to live nearby.\n\n"
            "This creates a direct route to potential buyers who may never have encountered the property "
            "through Rightmove, Zoopla or other portals."
        ),
    },
    {
        "title": "Havlo Premium Digital Buyer Acquisition",
        "description": (
            "You may also wish to explore Sell Faster (Havlo Relaunch™) — Havlo's property-intelligence-led "
            "digital buyer acquisition programme, designed to work alongside your existing estate agent.\n\n"
            "Using insights from your property's market position, Havlo identifies relevant buyer audiences "
            "and develops precision-targeted Meta campaigns designed to reach potential buyers based on "
            "factors such as location, lifestyle, interests and potential buyer profile.\n\n"
            "Rather than relying solely on buyers actively searching property portals, Sell Faster (Havlo "
            "Relaunch™) adds an additional route to market by taking the property directly to potential "
            "buyers who may not yet be searching.\n\n"
            "Your estate agent remains your agent. Havlo's role is to provide additional property intelligence "
            "and buyer reach to support the existing sales process."
        ),
    },
    {
        "title": "Explore Alternative Buyer Profiles",
        "description": (
            "Ask your agent to consider buyer groups beyond the traditional owner-occupier, including private "
            "investors, landlords, relocation buyers and second-home purchasers.\n\n"
            "For example, a buyer may see greater value in purchasing the property as a rental investment "
            "rather than occupying it themselves."
        ),
    },
    {
        "title": "Reposition the Opportunity",
        "description": (
            "Consider whether the property's strongest proposition is being communicated effectively.\n\n"
            "This could include its investment potential, rental opportunity, location, lifestyle appeal or "
            "suitability for a particular type of buyer.\n\n"
            "Sometimes the challenge is not simply finding more buyers, it is reaching the right buyers with "
            "the right proposition."
        ),
    },
]


def _get_client():
    from groq import Groq
    import os

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        try:
            from app.config import get_settings

            api_key = (get_settings().GROQ_API_KEY or "").strip()
        except Exception:
            api_key = ""
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured.")
    return Groq(api_key=api_key)


async def generate_property_report(
    listing_url: str,
    listing_title: Optional[str] = None,
    listing_price: Optional[str] = None,
    listing_description: Optional[str] = None,
    listing_address: Optional[str] = None,
) -> str:
    """
    Generate a detailed AI report explaining why a property hasn't sold
    and what the agent should do to sell it.
    Returns the report as a markdown string.
    """
    import asyncio

    context_parts = [f"Property listing URL: {listing_url}"]
    if listing_title:
        context_parts.append(f"Property: {listing_title}")
    if listing_address:
        context_parts.append(f"Address: {listing_address}")
    if listing_price:
        context_parts.append(f"Listed price: {listing_price}")
    if listing_description:
        context_parts.append(f"Description: {listing_description[:1500]}")

    context = "\n".join(context_parts)

    prompt = f"""You are a senior UK property sales strategist with 20+ years of experience helping estate agents sell stalled listings.

An estate agent has provided the following property listing details:

{context}

Please produce a detailed, practical, and easy-to-understand report covering:

1. **Why This Property May Not Be Selling** — analyse the listing details and common reasons properties stall (pricing, presentation, exposure, timing, market conditions, competition).

2. **Specific Issues to Address** — list concrete problems you can identify from the listing details (e.g. price positioning, description quality, photo strategy, portal visibility drop-off, "seen it before" fatigue).

3. **Action Plan** — give a numbered list of specific, actionable steps the agent should take RIGHT NOW to re-ignite buyer interest. Be direct and practical.

4. **Pricing Strategy** — advise whether the price should be adjusted, repositioned, or reframed — and how to do it without underselling.

5. **Exposure & Marketing Recommendations** — how to get fresh eyes on this property beyond the usual portals (international buyers, social media, email campaigns, etc.).

6. **Typical Outcome** — if these steps are followed, what should the agent realistically expect in terms of enquiries and offers within 30-60 days.

Write in a confident, professional tone that is easy for an estate agent to read and act on immediately. Use clear headings and bullet points where appropriate. Be direct — do not hedge or add unnecessary caveats."""

    def _call_groq() -> str:
        client = _get_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior UK property sales strategist. Produce clear, actionable, professional reports for estate agents.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""

    ADDITIONAL_RECOMMENDATION = (
        "\n\n---\n\n"
        "## Additional Recommendation\n\n"
        "The property shows strong potential to benefit from targeted media exposure and strategic "
        "advertising, which could significantly enhance its visibility and appeal to the right buyer "
        "demographic. It is also recommended to consider Havlo exposure campaigns, which have been "
        "proven to deliver strategic advantages by positioning properties more effectively within the "
        "market and attracting higher-quality enquiries."
    )

    try:
        result = await asyncio.to_thread(_call_groq)
        logger.info("Groq report generated successfully for listing_url=%s", listing_url)
        return result + ADDITIONAL_RECOMMENDATION
    except Exception as exc:
        logger.error("Groq report generation failed: %s", exc)
        raise


async def generate_public_property_report(
    property_info: str,
    listing_title: Optional[str] = None,
    listing_price: Optional[str] = None,
    listing_description: Optional[str] = None,
    listing_address: Optional[str] = None,
) -> str:
    """
    Generate a homeowner-focused AI report for the public sell-faster funnel.
    Explains why the property may not be selling and what Havlo can do.
    Returns the report as a markdown string.
    """
    import asyncio as _asyncio

    context_parts = [property_info]
    if listing_title:
        context_parts.append(f"Property: {listing_title}")
    if listing_address:
        context_parts.append(f"Address: {listing_address}")
    if listing_price:
        context_parts.append(f"Listed price: {listing_price}")
    if listing_description:
        context_parts.append(f"Description: {listing_description[:1500]}")

    context = "\n".join(context_parts)

    prompt = f"""You are a senior UK property sales expert helping homeowners understand why their property isn't selling and what they should do about it.

A homeowner has submitted the following property details:

{context}

Please produce a clear, honest, and actionable report covering:

## Why Your Property May Not Be Selling
Analyse the listing details and explain the most likely reasons a property in this position attracts limited buyer interest. Consider pricing strategy, presentation, market exposure, timing, and competition.

## What's Holding Buyers Back
Identify 3–5 specific, visible issues from the listing (e.g. portal fatigue, price positioning, description quality, photo presentation, limited international exposure). Be direct and specific.

## What You Can Do Right Now
Give 4–6 numbered, practical steps the homeowner can take immediately to improve their chances of selling. Make these actionable and easy to understand — not industry jargon.

## The International Buyer Opportunity
Explain concisely why targeting international buyers (expats, diaspora investors, overseas purchasers) could unlock fresh demand for this specific property, and why UK portals alone cannot reach this audience.

Write in a warm but direct tone — honest, professional, and easy for a homeowner to understand. Use clear headings. Avoid estate agent jargon. Focus on what is genuinely useful to a seller."""

    UPSELL_CLOSE = (
        "\n\n---\n\n"
        "## Your Next Step\n\n"
        "Based on this assessment, your property has clear potential to attract serious buyers — "
        "but it needs fresh exposure beyond the traditional portals. Havlo's international buyer "
        "campaigns are specifically designed for properties in your position: generating qualified "
        "demand from markets your current marketing isn't reaching, without switching agents or "
        "reducing your price.\n\n"
        "**Get started below to see your personalised relaunch plan and pricing.**"
    )

    def _call_groq() -> str:
        client = _get_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior UK property sales expert. Produce clear, honest, and actionable reports for homeowners whose properties are not selling.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.7,
        )
        return response.choices[0].message.content or ""

    try:
        result = await _asyncio.to_thread(_call_groq)
        logger.info("Public property report generated successfully")
        return result + UPSELL_CLOSE
    except Exception as exc:
        logger.error("Public property report generation failed: %s", exc)
        raise



async def generate_stale_listing_report(
    package: str,
    questions_data: dict,
    property_address: str = "",
    listing_url: str = "",
    listing_snapshot: dict | None = None,
    expand_report: bool = True,
    has_seller_survey: bool = True,
    base_report: dict | None = None,
) -> dict:
    """
    Generate a structured stale listing analysis report using Groq LLM.
    Returns a dict matching StaleListingReportData schema.
    Falls back to a sensible default dict on any failure.

    has_seller_survey distinguishes the two ways a report gets generated:

    - True (default): the homeowner filled in the stale-listing form
      themselves, answering real questions about viewings, buyer feedback,
      price flexibility, and so on. The report can and should reference
      those answers directly.
    - False: this is an automated letter-prospect assessment built from
      nothing but the public Rightmove listing (address, price, description,
      photos, days on market). We have never spoken to this homeowner and
      have no idea whether the property has had viewings, what feedback
      buyers gave, or whether it has been under offer. Every prompt and
      narrative fragment below must avoid asserting or implying any of
      that — the report is grounded only in what the public listing itself
      shows.

    base_report: when given, skip the fresh first-pass LLM generation and
    enrich this existing report instead (only the expansion pass runs on
    top of it). This is what keeps the free preview and the unlocked full
    report showing the SAME issues: the preview is built from the first 3
    key_findings of the prospect's stored report, and if unlocking silently
    re-ran the first pass from scratch, Groq's non-determinism would hand
    back a different set of findings with different titles — the exact
    issues the preview showed would vanish from the "full" report.
    """
    import asyncio as _aio
    import json

    # Discovery uses a product-facing package name that is not one of the
    # report-generation tiers. Normalize it before the shared prompt and
    # fallback logic use package-specific maps. This is the automated
    # stale-listing prospect's full report — mapped to premium_strategy (the
    # richest existing tier: 6 findings/6 actions instead of 5, higher
    # per-item length targets, and dimensions that are concretely actionable
    # for a homeowner — e.g. exact language to use with their agent, an
    # exit-risk read, a portal-relaunch plan) rather than a fresh, unproven
    # prompt, so the homeowner-facing report is both more detailed and
    # meaningfully more useful without touching the other paid tiers.
    package = {
        "listing_recovery_assessment": "premium_strategy",
    }.get(package, package)
    if package not in {"quick_insight", "professional_review", "premium_strategy"}:
        package = "professional_review"

    if has_seller_survey:
        label_map = {
            "q1_viewings": "Number of viewings since listing",
            "q2_feedback": "Buyer feedback after viewings (may be multiple answers)",
            "q3_under_offer": "Previously gone under offer and fallen through",
            "q4_price_reduction": "Price reductions since launch",
            "q5_flexibility": "Openness to adjusting pricing or marketing strategy",
            "q6_marketing": "Current marketing channels used",
            "q7_listing_features": "Listing features present (may be multiple)",
            "q8_photos": "Satisfaction with listing photo quality",
            "q9_asking_price": "Approximate asking price range",
            "q10_challenge": "Biggest challenge currently facing",
        }

        q_lines = []
        for key, label in label_map.items():
            val = questions_data.get(key, "Not provided")
            if isinstance(val, list):
                val = "; ".join(val) if val else "None selected"
            q_lines.append(f"  {label}: {val}")

        questionnaire = "\n".join(q_lines)
    else:
        # No homeowner has answered anything for this property — this is a
        # cold letter-prospect assessment built purely from the scraped
        # Rightmove listing. Telling the model that plainly (instead of
        # silently handing it a page of "Not provided" answers) is what
        # keeps it from inventing or implying viewing/feedback/offer detail.
        _known_days = questions_data.get("days_on_market")
        _known_days_line = (
            f" We do know, precisely, that it has been listed for {int(_known_days)} days without selling — use that exact figure, do not estimate a different one."
            if isinstance(_known_days, (int, float)) and _known_days
            else ""
        )
        questionnaire = (
            "No homeowner questionnaire exists for this property. This is an automated "
            "outreach assessment based solely on the public Rightmove listing shown below "
            "(address, asking price, description, photos, and property type)."
            + _known_days_line
            + " We have not spoken to this homeowner and have no information about "
            "viewings, buyer feedback, enquiries, or offers — do not state, estimate, or "
            "imply anything about any of those."
        )

    snapshot = listing_snapshot if isinstance(listing_snapshot, dict) else {}
    property_lines = [
        f"Property address: {snapshot.get('address') or property_address}"
        if (snapshot.get("address") or property_address)
        else "",
        f"Property title: {snapshot.get('title')}"
        if snapshot.get("title")
        else "",
        f"Listing URL: {listing_url}" if listing_url else "",
        f"Portal source: {snapshot.get('platform')}" if snapshot.get("platform") else "",
        f"Asking price: {snapshot.get('price')}" if snapshot.get("price") else "",
        f"Property type: {snapshot.get('property_type')}" if snapshot.get("property_type") else "",
        f"Bedrooms: {snapshot.get('bedrooms')}" if snapshot.get("bedrooms") else "",
        f"Bathrooms: {snapshot.get('bathrooms')}" if snapshot.get("bathrooms") else "",
        f"Listed date: {snapshot.get('listed_date')}" if snapshot.get("listed_date") else "",
        (
            "Key features from listing: "
            + ", ".join(str(feature).strip() for feature in (snapshot.get("features") or []) if str(feature).strip())
        )
        if snapshot.get("features")
        else "",
        f"Listing description: {str(snapshot.get('description') or '').strip()[:1600]}"
        if snapshot.get("description")
        else "",
    ]
    property_context = "\n".join(line for line in property_lines if line) or "Property details: not provided"

    def _clean_scalar(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, list):
            return "; ".join(str(item).strip() for item in value if str(item).strip())
        return str(value).strip()

    def _clean_copy(value: Any) -> str:
        text = _clean_scalar(value)
        replacements = {
            chr(8212): ", ",
            chr(8211): " to ",
            "â€”": ", ",
            "â€“": " to ",
            "Â·": ", ",
            "â€¢": "- ",
            "â€¦": "...",
            "\xa0": " ",
        }
        for needle, replacement in replacements.items():
            text = text.replace(needle, replacement)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    price_anchor = _clean_scalar(snapshot.get("price") or questions_data.get("q9_asking_price") or "the current asking-price range")

    # Only used as a genuinely last-resort filler sentence (see the bullet
    # padding in _normalise_report_output below) when the model returns
    # fewer than 2 bullets for an action — not injected into every report.
    challenge_summary = (
        _clean_scalar(questions_data.get("q10_challenge")) or "slow buyer engagement"
        if has_seller_survey
        else None
    )

    def _ensure_sentence(text: str) -> str:
        cleaned = _clean_copy(text)
        if not cleaned:
            return ""
        if cleaned[-1] not in ".!?":
            cleaned += "."
        return cleaned

    def _min_length_fallback(kind: str) -> str:
        """Genuinely last-resort text — used only when both Groq passes come
        back empty or unusable for a specific field (an API hiccup, not the
        normal path). Previously this was where degenerate output would get
        padded out with the SAME hardcoded template paragraphs on every
        finding and action in every report (a fixed per-icon paragraph, a
        fixed per-tier sentence, one of two fixed "strength"/"issue"
        closers, all reused verbatim across the whole report and across
        every report ever generated) — that's what was producing 90%
        boilerplate: the "content" wasn't being padded, it was being
        replaced. The fix is architectural, not cosmetic: trust the model's
        own two-pass output as the actual description, and only fall back
        to a short, honest placeholder in the rare case there's truly
        nothing to show."""
        if kind == "finding":
            return "This point could not be generated in enough detail this time — it will be covered fully once the report is regenerated."
        return "This action could not be generated in enough detail this time — it will be covered fully once the report is regenerated."

    def _expand_key_finding_copy(finding: dict[str, Any], selected_package: str) -> str:
        # The model's own first-pass description plus (if the expansion
        # pass ran) its addendum, already merged by _merge_expansion before
        # this function ever runs — that combination IS the finding's real,
        # specific analysis. This function used to discard most of that and
        # rebuild the description by concatenating fixed, property-agnostic
        # template paragraphs on top of it; it now only cleans what the
        # model actually wrote.
        merged = _ensure_sentence(finding.get("description"))
        if len(merged) < 120:
            merged = _ensure_sentence(f"{merged} {_min_length_fallback('finding')}".strip()) if merged else _min_length_fallback("finding")
        return merged

    def _expand_action_copy(action: dict[str, Any], selected_package: str) -> str:
        # Same principle as _expand_key_finding_copy above: trust the
        # model's own (first pass + merged expansion) text instead of
        # overwriting it with fixed template paragraphs.
        merged = _ensure_sentence(action.get("description"))
        if len(merged) < 100:
            merged = _ensure_sentence(f"{merged} {_min_length_fallback('action')}".strip()) if merged else _min_length_fallback("action")
        return merged

    def _normalise_scores(raw_scores: Any) -> dict[str, int]:
        """Map onto the 5 score dimensions the report page actually renders.

        The schema used to ask for {photos, pricing, description, positioning}.
        Reports generated before this change (still sitting in stored
        report_json for existing prospects) only have those 4 keys — this
        derives sensible values for the 3 renamed/new keys instead of
        rendering a report with missing score bars.
        """
        scores = raw_scores if isinstance(raw_scores, dict) else {}

        def _num(key: str, default: int = 50) -> int:
            # The model occasionally returns a non-numeric value for a score
            # field (seen live: the literal word "thirty" instead of 30).
            # That used to raise an uncaught ValueError here, which crashed
            # the whole report and silently fell back to the generic
            # _DEFAULT_REPORT template — exactly the boilerplate this fix is
            # meant to eliminate. Fall back to `default` for just this one
            # score instead of losing the entire report over it.
            try:
                return int(scores.get(key) or default)
            except (TypeError, ValueError):
                return default

        new_keys = ("pricing", "listing_presentation", "market_positioning", "competition", "buyer_appeal")
        if all(key in scores for key in new_keys):
            return {key: _num(key) for key in new_keys}

        legacy_photos = _num("photos")
        legacy_description = _num("description")
        legacy_positioning = _num("positioning")
        legacy_pricing = _num("pricing")
        return {
            "pricing": legacy_pricing,
            "listing_presentation": round((legacy_photos + legacy_description) / 2),
            "market_positioning": legacy_positioning,
            # No direct legacy equivalent for these two — old reports never
            # assessed competition or buyer appeal as separate dimensions, so
            # derive a reasonable proxy rather than showing an empty bar.
            "competition": legacy_positioning,
            "buyer_appeal": round((legacy_photos + legacy_pricing) / 2),
        }

    _DEFAULT_THIRTY_DAY_THEMES = (
        "Address pricing and listing positioning",
        "Improve photography and presentation",
        "Review marketing and buyer targeting",
        "Reassess performance and buyer response",
    )

    def _normalise_thirty_day_plan(raw_plan: Any, action_titles: list[str]) -> list[dict[str, Any]]:
        entries = raw_plan if isinstance(raw_plan, list) else []
        plan: list[dict[str, Any]] = []
        for index in range(4):
            week = index + 1
            source = entries[index] if index < len(entries) and isinstance(entries[index], dict) else {}
            title = _clean_scalar(source.get("title"))
            if not title:
                title = action_titles[index] if index < len(action_titles) else _DEFAULT_THIRTY_DAY_THEMES[index]
            plan.append({"week": week, "title": title[:120]})
        return plan

    def _normalise_active_competition(raw_competition: Any, price_anchor_value: str) -> list[dict[str, Any]]:
        entries = raw_competition if isinstance(raw_competition, list) else []
        differentiators = ("Better photography", "Recently renovated", "Larger garden", "Lower asking price")
        street_names = ("Beech Road", "Camden Terrace", "Oldham Road", "Kestrel Close")
        competition: list[dict[str, Any]] = []
        for index in range(3):
            source = entries[index] if index < len(entries) and isinstance(entries[index], dict) else {}
            competition.append(
                {
                    "address": _clean_scalar(source.get("address")) or f"{(index + 1) * 7} {street_names[index % len(street_names)]}",
                    "price": _clean_scalar(source.get("price")) or price_anchor_value,
                    "beds": source.get("beds") if isinstance(source.get("beds"), int) else 3,
                    "distance": _clean_scalar(source.get("distance")) or f"0.{3 + index}mi",
                    "days_listed": source.get("days_listed") if isinstance(source.get("days_listed"), int) else 15 + (index * 10),
                    "differentiator": _clean_scalar(source.get("differentiator")) or differentiators[index % len(differentiators)],
                }
            )
        return competition

    def _normalise_report_output(report: dict[str, Any]) -> dict[str, Any]:
        normalised = deepcopy(report)
        normalised.setdefault("days_on_market", None)
        normalised.setdefault("comparable_sales", [])
        normalised.setdefault("pricing_recommendation_detail", "")
        normalised["scores"] = _normalise_scores(normalised.get("scores"))
        normalised["pricing_recommendation"] = _ensure_sentence(normalised.get("pricing_recommendation") or "")
        # As with findings/actions above: trust the model's own (first pass +
        # merged expansion) text for these two fields. Only fall back to a
        # short, honest placeholder if it's truly missing or unusably thin —
        # never overwrite real analysis with the same fixed sentences on
        # every report.
        pricing_detail = _ensure_sentence(normalised.get("pricing_recommendation_detail"))
        if len(pricing_detail) < 100:
            fallback_price = _ensure_sentence(normalised.get("pricing_recommendation")) or "The price position needs to be reset against genuine buyer expectations."
            pricing_detail = _ensure_sentence(f"{pricing_detail} {fallback_price}".strip()) if pricing_detail else fallback_price
        normalised["pricing_recommendation_detail"] = pricing_detail

        exec_summary = _ensure_sentence(normalised.get("executive_summary"))
        if len(exec_summary) < 150:
            fallback_summary = "The property is behaving like a stale listing and needs a sharper relaunch plan."
            exec_summary = _ensure_sentence(f"{exec_summary} {fallback_summary}".strip()) if exec_summary else fallback_summary
        normalised["executive_summary"] = exec_summary

        findings = normalised.get("key_findings") or []
        for finding in findings:
            finding["title"] = _clean_scalar(finding.get("title")) or "Important sales blocker"
            finding["type"] = (_clean_scalar(finding.get("type")) or "issue").lower()
            finding["icon"] = _clean_scalar(finding.get("icon")) or "timing"
            finding["description"] = _expand_key_finding_copy(finding, package)
            # evidence/impact/recommend are new (2026-08 Full Report redesign).
            # Reports generated before this change won't have them at all —
            # fall back to slicing the (already rich, multi-paragraph)
            # description into thirds rather than leaving the UI's
            # EVIDENCE/IMPACT/RECOMMEND cards blank for old prospects.
            evidence = _clean_scalar(finding.get("evidence"))
            impact = _clean_scalar(finding.get("impact"))
            recommend = _clean_scalar(finding.get("recommend"))
            if not (evidence and impact and recommend):
                sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", finding["description"]) if s.strip()]
                third = max(1, len(sentences) // 3)
                evidence = evidence or " ".join(sentences[:third]) or finding["description"]
                impact = impact or " ".join(sentences[third:third * 2]) or finding["description"]
                recommend = recommend or " ".join(sentences[third * 2:third * 3]) or "Address this before the next relaunch."
            finding["evidence"] = _ensure_sentence(evidence)
            finding["impact"] = _ensure_sentence(impact)
            finding["recommend"] = _ensure_sentence(recommend)

        # Strip any standing advisory items already present (an "unlock the
        # full report" call re-normalises a base_report that was already
        # through this function once, so its action_plan already has them
        # appended) before anything below touches this list — otherwise the
        # AI-oriented loop right below would run _expand_action_copy on their
        # fixed wording and tack on a priority/why_it_matters/bullets that
        # shouldn't be there, and the expansion pass further down would burn
        # a Groq call trying to write "new angle" addenda for them. The
        # canonical copies are appended back, untouched, at the end of this
        # function — see STANDING_ADVISORY_ACTIONS below.
        _standing_titles = {item["title"].lower() for item in STANDING_ADVISORY_ACTIONS}
        actions = [
            a for a in (normalised.get("action_plan") or [])
            if _clean_scalar(a.get("title")).lower() not in _standing_titles
        ]
        for action in actions:
            action["priority"] = (_clean_scalar(action.get("priority")) or "HIGH").upper()
            action["title"] = _clean_scalar(action.get("title")) or "Immediate corrective action"
            action["bullets"] = [_ensure_sentence(item) for item in action.get("bullets", []) if _clean_scalar(item)]
            while len(action["bullets"]) < 2:
                filler = (
                    f"Use this step to address {challenge_summary} and measure whether the market response improves within the next review cycle."
                    if has_seller_survey
                    else "Use this step to strengthen the listing's public position and measure whether portal visibility and enquiries improve within the next review cycle."
                )
                action["bullets"].append(_ensure_sentence(filler))
            action["bullets"] = action["bullets"][:2]
            action["description"] = _expand_action_copy(action, package)
            why_it_matters = _clean_scalar(action.get("why_it_matters"))
            if not why_it_matters:
                why_it_matters = (
                    "pricing is the single strongest driver of enquiry volume"
                    if "price" in action["title"].lower() or "pricing" in action["title"].lower()
                    else "photography drives portal click-through before any viewing is booked"
                    if "photo" in action["title"].lower() or "image" in action["title"].lower()
                    else "this directly affects how quickly buyers move from browsing to enquiring"
                )
            action["why_it_matters"] = _ensure_sentence(why_it_matters)

        # thirty_day_plan's fallback week-titles come from the model's own
        # action_plan titles only — computed before the standing items below
        # are appended, so a generic advisory title never leaks into a week
        # theme meant to summarise this property's specific action plan.
        action_titles = [a.get("title", "") for a in actions if _clean_scalar(a.get("title"))]
        normalised["thirty_day_plan"] = _normalise_thirty_day_plan(normalised.get("thirty_day_plan"), action_titles)

        # Standing advisory items (see STANDING_ADVISORY_ACTIONS) are appended
        # after the model's own property-specific action_plan, not run through
        # the normalisation loop above — that loop's defaulting/expansion is
        # meant for AI-generated content and would overwrite this fixed
        # wording. Numbering in the UI continues from the model's items.
        normalised["action_plan"] = actions + deepcopy(STANDING_ADVISORY_ACTIONS)

        comparable_sales = []
        for sale in normalised.get("comparable_sales", []):
            comparable_sales.append(
                {
                    "address": _clean_scalar(sale.get("address")) or "Comparable property",
                    "beds": sale.get("beds") or 3,
                    "property_type": _clean_scalar(sale.get("property_type")) or "Semi-det.",
                    "sold_asking": _clean_scalar(sale.get("sold_asking")) or "Price not provided",
                    "is_subject": bool(sale.get("is_subject")),
                }
            )
        normalised["comparable_sales"] = comparable_sales
        normalised["active_competition"] = _normalise_active_competition(normalised.get("active_competition"), price_anchor)
        return normalised

    # ── Plan-specific prompts ────────────────────────────────────────────────────
    # Each tier assesses genuinely different dimensions, not just depth of the same
    # things. The JSON schema is identical across all tiers so the frontend stays
    # the same; the richness of the content varies dramatically.

    if package == "quick_insight":
        task_block = """Your task is to produce a QUICK INSIGHT report - fast, punchy, opinionated, and still clearly worth paying for.

Identify the 4 most critical blockers that are preventing a sale RIGHT NOW. Be
ruthlessly specific: name the actual number of viewings, the specific feedback
buyers gave, the exact portals they are or are not on, the price range they stated,
and the immediate buyer consequence. Even though this is the lightest plan, it must
still feel like a paid professional mini-brief, not a skimpy summary.

Focus exclusively on these four areas (pick the 4 worst performers):
  1. Listing performance signals - viewings vs. time ratio, portal click-through signals
  2. Pricing and market position - current ask vs. what buyers are actually offering
  3. Listing quality - photos, description completeness, assets present
  4. Buyer appeal - feedback themes, presentation friction, first-impression issues

QUICK INSIGHT format rules:
- key_findings: EXACTLY 4 items. At most 1 strength ("type":"strength"); the rest must be "issue".
  Each description should be at least 400 characters and read like a paid consultant note, not a thin AI summary — a later expansion pass adds further depth, so this can be a strong, focused core paragraph rather than the full final length.
  Write in natural human paragraphs using clear UK property language, reference the seller's actual answers, and explain both the evidence and the buyer consequence.
  Also fill evidence/impact/recommend for each finding — one crisp sentence each, not the whole story again.
- action_plan: EXACTLY 4 items. 2 URGENT, 2 HIGH. No MEDIUM items.
  Each action must be doable within 2 weeks without professional consultancy.
  Each action description should be at least 300 characters and explain what to do, why it matters now, and what change the seller should expect to see.
  Each bullet must be a complete sentence with a concrete instruction and a practical outcome.
  Also fill why_it_matters — one short sentence, not a repeat of the description.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Keep street names realistic for the area given.
 - pricing_recommendation_detail: give a commercially sharp explanation that references the actual price range, likely buyer reaction, and what a reset should unlock within the next fortnight.
 - executive_summary: write a short human mini-brief that clearly states the main blocker, how buyers are reading the listing, and what to change first this week.
  Be direct, commercial, specific, and natural. Never use em dashes."""

        # Groq's TPM limit includes both prompt and completion tokens. Keep
        # the completion cap below the limit so the request is not rejected
        # when the property snapshot and instructions are included.
        max_tokens_val = 4000
        system_msg = "You are Mark Williams, a senior UK property sales consultant. Produce a Quick Insight report that still feels paid-for, commercially sharp, and highly specific to this homeowner's data. Write like a real person, not an AI system, and never use em dashes. Return only valid JSON. No markdown, no code fences."

    elif package == "premium_strategy":
        task_block = """Your task is to produce a PREMIUM STRATEGY report - the most comprehensive property analysis
available, equivalent to a paid consultant briefing. This report covers six distinct assessment dimensions
that go well beyond surface-level listing advice.

Assess ALL SIX of the following dimensions thoroughly:

  1. Listing Performance & Visibility Analysis
     - How the listing is performing on portals relative to days on market, viewings, and engagement signals.
     - Estimate where the listing appears in search results based on staleness, pricing tier, and marketing activity.
     - Identify whether the property has been de-indexed or de-prioritised by portal algorithms.

  2. Pricing Intelligence & Buyer Psychology
     - Detailed analysis of the gap between asking price and market absorption price.
     - What the price signals to buyers psychologically (overconfidence, desperation, or indifference).
     - Specific impact of any prior price reductions on buyer perception ("damaged goods" risk).
     - Recommended repositioning strategy including whether to reduce, withdraw, or relaunch.
     - If the listing states a rental yield AND separately states service charge, ground rent, or building
       insurance costs, do not just repeat the advertised gross yield — calculate the approximate net yield
       after those annual costs (net yield = (annual rent minus annual running costs) / asking price) and use
       that sharper, harder-to-find number as a genuine differentiator, since most buyers only ever see the
       advertised gross figure.

  3. Photography & Presentation Intelligence
     - Forensic assessment of listing photography based on what the homeowner reported.
     - Specific critique of likely issues: lighting, angles, clutter, emotional triggers missing.
     - What the photos are communicating to a buyer before they read a single word of the description.
     - Precise staging recommendations: which rooms to restyle, what to remove, what to add.

  4. Digital Marketing & Portal Strategy
     - Analysis of all portals the property is currently on and those it is not on.
     - Whether the listing has been Rightmove Featured, Premium Listing, or spotlight boosted.
     - Social media exposure: what channels to target and the type of content that converts.
     - Specific recommendations for relaunching with fresh assets to trigger portal algorithm refresh.

  5. Estate Agent Performance Review
     - Honest, direct assessment of whether the agent is actively selling or passively waiting.
     - Whether the marketing channels selected suggest a low-effort instruction.
     - Signs the agent relationship may need to be reviewed (re-listed without fresh strategy, no proactive outreach).
     - Clear language the homeowner can use with their agent to demand performance.

  6. Property Liquidity & Exit Risk
     - Realistic assessment of this property's liquidity in the current market.
     - Risk factors that could prevent a sale regardless of price (structural issues signalled, niche appeal, location detractors).
     - Exit strategies available to the seller beyond a traditional sale.
     - What a realistic timeline to sale looks like given current signals.

PREMIUM STRATEGY format rules:
- key_findings: EXACTLY 6 items. Draw one finding from EACH of the 6 dimensions above (label the title clearly so the homeowner knows which dimension it addresses). Mix: 4-5 issues, 1-2 strengths.
  Each description should be at least 350 characters and feel materially richer than Professional Review — a later expansion pass adds further depth on top of this, so prioritise a sharp, consultant-grade core paragraph over raw length.
  Write in natural human paragraphs with consultant-level reasoning, tying the evidence to market behaviour, seller risk, and relaunch sequencing.
  Also fill evidence/impact/recommend for each finding — one crisp sentence each, distinct from the description, not a repeat of it.
- action_plan: EXACTLY 6 items - 2 URGENT, 2 HIGH, 2 MEDIUM. Ordered URGENT -> HIGH -> MEDIUM.
  Each action must read like consultant advice, covering not just WHAT but HOW, in what order, and what result to look for.
  Each action description should be at least 300 characters and include sequencing, strategic framing, and the commercial logic behind the recommendation.
  Each bullet must be a complete, specific instruction of at least 16 words with a measurable or observable outcome.
  Also fill why_it_matters — one short, sharp sentence, not a repeat of the description.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Include sold dates (within 90 days).
  Comp selection must reflect the specific property type and price range from q9_asking_price.
- pricing_recommendation: One decisive sentence. Include the exact adjusted price or percentage.
- pricing_recommendation_detail: provide a premium-level pricing note that covers current position versus market, the psychological effect of the current number, what a reset unlocks on Rightmove, and what timeline to expect after the change.
- executive_summary: write a consultant briefing for the homeowner covering why the property is stale, the biggest opportunity, the biggest risk, the recommended first action this week, and the likely outcome if the strategy is followed. It must sound human, commercially sharp, and contain no em dashes."""

        # 6 findings + 6 actions, each now also carrying evidence/impact/
        # recommend (findings) or why_it_matters (actions), plus
        # active_competition and thirty_day_plan, needs more completion
        # budget than the old 4000-token cap gave it (confirmed live: the
        # response silently truncated to 2 of 6 action_plan items). But
        # Groq's account-level limit here is a hard 8000 TOTAL (prompt +
        # completion) tokens per request, not a rolling-window TPM budget —
        # requesting 7000 completion tokens got the whole call rejected
        # outright (413) once prompt tokens were added on top. 4500 leaves
        # headroom under that ceiling; the shortened raw description-length
        # asks above keep real usage comfortably inside it — the expansion
        # pass (_call_groq_expansion) adds the rest of the length afterwards
        # as a genuinely additive paragraph, merged in verbatim rather than
        # replaced with boilerplate (see _expand_key_finding_copy). Confirmed
        # live that 4500 tips a long property_context over the 8000-total
        # ceiling (got a 413) once the anti-repetition rule text was added
        # to the prompt below — 4300 keeps a real safety margin.
        max_tokens_val = 4300
        system_msg = "You are Mark Williams, a senior UK property sales consultant with 22 years of experience. Produce a Premium Strategy report that feels like a high-fee consultant briefing: comprehensive, analytical, commercially sharp, and deeply specific to this homeowner's data. This is the richest plan and must be noticeably more strategic than Professional Review. Write like a strong human consultant and never use em dashes. Return only valid JSON. No markdown, no code fences."

    else:
        # Default depth — this is what property_sale_assessment (the current
        # sole flagship package) gets, along with the older professional_review
        # id kept for historical orders.
        task_block = """Your task is to produce a PROFESSIONAL REVIEW report - thorough, behavioural, and positioning-focused.
This goes beyond surface-level issues to analyse why buyers are choosing other properties instead.

Assess these five dimensions in depth:

  1. Listing Performance & Portal Signals
     - How viewings, feedback, and time on market combine to indicate where the listing is in the buyer funnel.
     - Whether the listing is getting portal impressions but not clicks (presentation problem) or clicks but not viewings (pricing/detail problem).
     - Estimate the listing's search result position based on age, price bracket, and marketing activity.

  2. Advanced Pricing Intelligence
     - Not just whether the price is right, but WHY buyers are rejecting it.
     - What price reductions (or the lack of them) are signalling to buyers psychologically.
     - How the price compares to what similar properties have actually sold for (not just listed at) in the past 90 days.
     - The specific price bracket on Rightmove this property sits in - and whether a small reduction would unlock a much larger buyer pool.

  3. Photography, Description & Listing Psychology
     - What the current photos are communicating subconsciously to buyers (warmth, space, neglect, value).
     - Whether the listing description leads with benefits or buries them - and how that affects booking rates.
     - Listing assets that are missing (floor plan, virtual tour, video) and the statistical impact on booking rates.
     - The specific improvements that would make the biggest click-to-viewing conversion difference.

  4. Local Competition Benchmarking
     - How this property stacks up against active competition in the same price bracket.
     - What competing listings are doing better: photos, price per sq ft, portal features, description quality.
     - Where this property has a genuine competitive advantage that is not being communicated.

  5. Marketing & Agent Strategy Analysis
     - Which marketing channels are being used and which critical ones are missing.
     - Whether the estate agent is running a proactive or reactive marketing strategy.
     - The most effective low-cost interventions the homeowner can request immediately.

PROFESSIONAL REVIEW format rules:
- key_findings: EXACTLY 5 items. One finding from each dimension above. Mix: 3-4 issues, 1-2 strengths.
  Each description should be at least 400 characters and materially more analytical than Quick Insight — a later expansion pass builds on this, so favour a sharp core paragraph over raw length.
  Write in natural human paragraphs that connect the issue to buyer behaviour, market positioning, and what competing listings are doing better.
  Also fill evidence/impact/recommend for each finding — one crisp sentence each, distinct from the description.
- action_plan: EXACTLY 5 items - 2 URGENT, 2 HIGH, 1 MEDIUM. Ordered URGENT -> HIGH -> MEDIUM.
  Each action should feel strategic, linking the recommendation to buyer response, portal positioning, or pricing leverage.
  Each action description should be at least 300 characters and should explain what to do, why it matters, how it should be executed, and what success signal to watch for.
  Each bullet must be a complete, specific instruction with a measurable outcome or clear success signal.
  Also fill why_it_matters — one short sentence, not a repeat of the description.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Note sold dates where possible.
- pricing_recommendation: One specific sentence including the recommended adjusted price or range.
- pricing_recommendation_detail: give a fuller pricing note that references current position, likely buyer interpretation, portal search bands, and the expected effect on enquiry levels within 14 days.
- executive_summary: write a concise but authoritative consultant summary that references viewings, feedback, marketing gaps, and the single most impactful next move. It must sound human and commercially aware, never robotic, and never use em dashes."""

        # 5 findings + 5 actions with the added evidence/impact/recommend/
        # why_it_matters fields plus active_competition/thirty_day_plan —
        # same 8000-total-token account ceiling as premium_strategy (see its
        # comment above), just slightly lighter since there's one fewer
        # finding/action.
        max_tokens_val = 4300
        system_msg = "You are Mark Williams, a senior UK property sales consultant with 22 years of experience. Produce a Professional Review report that is noticeably more analytical and strategic than Quick Insight while staying deeply specific to this homeowner's data. Write like a seasoned human consultant and never use em dashes. Return only valid JSON. No markdown, no code fences."

    if not has_seller_survey:
        # This is a cold letter-prospect assessment: nobody has answered any
        # questions about this property. The tier-specific task_block above
        # was written for the self-service flow and repeatedly tells the
        # model to cite viewings, buyer feedback, and under-offer history —
        # none of which exist here. This override takes precedence over
        # every one of those instructions.
        task_block += """

DATA AVAILABILITY OVERRIDE — this takes precedence over every dimension and format
rule above:
This is a cold outreach assessment. There is no homeowner questionnaire behind it —
nobody has told us anything about viewings, buyer feedback, enquiry levels, or whether
the property has been under offer. You only have the public Rightmove listing itself:
address, asking price, description, photos, property type, and days on market
computed from the listing's own dates.

Wherever the dimensions or format rules above refer to viewings, buyer feedback,
enquiry activity, under-offer history, "the seller reports", or "the homeowner says",
ignore those specific data points entirely. Do not invent, estimate, or imply a number
of viewings, a feedback quote, or an offer history under any circumstance — this is an
absolute rule, not a stylistic preference. Ground every finding and action only in
what is actually knowable: how long the property has been listed, how it is priced,
what the description and photos communicate, and what a buyer scrolling past a
listing this stale would reasonably conclude. Frame every observation as what the
public listing itself suggests to a buyer, never as something the seller told you."""
        system_msg += " This is an automated cold-outreach assessment with no homeowner questionnaire behind it — base every claim only on the public listing itself, and never state or imply a viewing count, buyer feedback, or offer history, since none of that data exists for this property."

    if has_seller_survey:
        overall_score_rule = "honest saleability score — be tough. 0-40 = serious problems, 41-60 = significant issues, 61-75 = moderate issues, 76-100 = minor polish needed. Low viewings + no price drops + poor photos = max 55"
        pricing_score_rule = "low if buyers gave price feedback or if no reductions despite long time on market. 0-35 = confirmed overpriced. 36-55 = likely overpriced. 56-70 = borderline. 71+ = reasonable for the market"
        finding_description_rule = "as per format rules above — specific to THIS property's answers"
        summary_rule = "as per format rules above — written for THIS homeowner, references their specific answers"
        absolute_rule_1 = "NEVER use generic placeholder descriptions. Every sentence must reference THIS homeowner's actual questionnaire answers."
        absolute_rule_2 = "overall_score: calibrate against the number of viewings, buyer feedback, price reductions, portal coverage, and photo quality. Most stale listings score 35–60."
        absolute_rule_price = "pricing_recommendation and pricing_recommendation_detail must reference the actual price range from q9_asking_price."
    else:
        overall_score_rule = "honest saleability score — be tough. 0-40 = serious problems, 41-60 = significant issues, 61-75 = moderate issues, 76-100 = minor polish needed. Long time on market + weak description + few photos = max 55"
        pricing_score_rule = "low if the price looks out of step with a listing that has sat unsold this long. 0-35 = confirmed overpriced for how long it has been on market. 36-55 = likely overpriced. 56-70 = borderline. 71+ = reasonable for the market"
        finding_description_rule = "as per format rules above — specific to THIS property's public listing details, never a viewing count, feedback quote, or offer history"
        summary_rule = "as per format rules above — written for this homeowner based only on the public listing, never referencing viewings, feedback, or offers"
        absolute_rule_1 = "NEVER use generic placeholder descriptions. Every sentence must reference THIS property's actual public listing details (price, description, photos, days on market) — never invent or imply a viewing count, buyer feedback, or offer history, since none of that data exists for this property."
        absolute_rule_2 = "overall_score: calibrate against days on market, price positioning, listing content quality, and photo count. Most stale listings score 35–60."
        absolute_rule_price = "pricing_recommendation and pricing_recommendation_detail must reference the actual asking price from the listing itself."

    schema_block = f"""
{property_context}

Questionnaire answers:
{questionnaire}

{task_block}

Return ONLY a valid JSON object (absolutely no markdown, no code fences, no text before or after the JSON):

{{
  "overall_score": <integer 0-100, {overall_score_rule}>,
  "days_on_market": <integer estimate based on signals: multiple price reductions suggests 90+ days, no reductions + few viewings suggests 60-90 days. Return null only if truly impossible to estimate>,
  "scores": {{
    "pricing": <integer 0-100 — {pricing_score_rule}>,
    "listing_presentation": <integer 0-100 — be strict on photo/description quality. Weak photos or a thin description = 20-45. Adequate = 45-65. Only 70+ if both photos and description are clearly strong AND the listing is not stale>,
    "market_positioning": <integer 0-100 based on portal coverage, marketing channels, and how well the listing is positioned against comparable local stock>,
    "competition": <integer 0-100 — how favourably this property compares to the active_competition entries below on price, presentation, and days listed. Lower if competitors look more attractive>,
    "buyer_appeal": <integer 0-100 — how compelling the property is likely to feel to a buyer scrolling search results: headline features, location, first-impression pull>
  }},
  "key_findings": [
    {{
      "title": "<concise, specific issue or strength — max 8 words, no generic titles>",
      "description": "<{finding_description_rule}>",
      "type": "<'issue' or 'strength'>",
      "icon": "<one of: price | photos | description | location | marketing | condition | timing>",
      "evidence": "<one factual sentence citing the specific number/detail this finding is based on — e.g. an exact price gap, days-on-market figure, or photo count>",
      "impact": "<one sentence on the concrete commercial consequence for the seller — fewer enquiries, lower click-through, buyers hesitating, etc.>",
      "recommend": "<one sentence, direct and actionable, on what to do about it>"
    }}
  ],
  "action_plan": [
    {{
      "priority": "<URGENT | HIGH | MEDIUM>",
      "title": "<specific, action-oriented title>",
      "description": "<one direct sentence explaining what and why>",
      "why_it_matters": "<one short sentence explaining why this specific action matters right now — shown to the homeowner as \"Why it matters: ...\">",
      "bullets": [
        "<specific, complete instruction with named tools, portals, or timelines>",
        "<follow-through step with a measurable outcome>"
      ]
    }}
  ],
  "comparable_sales": [
    {{
      "address": "<plausible street address in the same area as property_address — use real-sounding UK street names>",
      "beds": <integer matching the property type>,
      "property_type": "<Semi-det. | Terrace | Detached | Flat | Bungalow>",
      "sold_asking": "<realistic sold price, e.g. £362,500 sold>",
      "is_subject": false
    }}
  ],
  "active_competition": [
    {{
      "address": "<plausible nearby street address, different from comparable_sales and property_address>",
      "price": "<realistic current asking price, e.g. £269,950>",
      "beds": <integer, generally close to the subject property's bedroom count>,
      "distance": "<short distance string, e.g. 0.3mi>",
      "days_listed": <integer, generally under 45 — these are currently ACTIVE listings competing for the same buyers, not sold ones>,
      "differentiator": "<max 4 words on why THIS competitor is winning attention right now, e.g. 'Better photography', 'Recently renovated', 'Larger garden'>"
    }}
  ],
  "thirty_day_plan": [
    {{
      "week": 1,
      "title": "<short (max 6 words) theme for week 1, e.g. 'Address pricing and listing positioning'>"
    }},
    {{"week": 2, "title": "<short theme for week 2, building on week 1>"}},
    {{"week": 3, "title": "<short theme for week 3>"}},
    {{"week": 4, "title": "<short theme for week 4 — reviewing results and adjusting>"}}
  ],
  "pricing_recommendation": "<one decisive sentence with a specific recommended price or percentage adjustment — not vague>",
  "pricing_recommendation_detail": "<as per format rules above — specific, analytical, references actual asking price>",
  "executive_summary": "<{summary_rule}>"
}}

ABSOLUTE RULES — breaking any of these is a failure:
- {absolute_rule_1}
- {absolute_rule_2}
- All scores (pricing, listing_presentation, market_positioning, competition, buyer_appeal) must be individually calibrated to the available evidence, not averaged or approximated.
- comparable_sales: always exactly 4 entries. Entry 4 must have is_subject: true and show the current asking price. The first 3 show sold prices (typically 3–12% below asking).
- active_competition: always exactly 3 entries, all currently-active listings (not sold), each with a distinct differentiator — do not repeat the same differentiator twice.
- thirty_day_plan: always exactly 4 entries, weeks 1-4 in order, each theme building logically on the previous week.
- key_findings icons: only use values from: price, photos, description, location, marketing, condition, timing.
- action_plan priorities: only use: URGENT, HIGH, MEDIUM. Must be in descending priority order.
- Each action_plan item must have exactly 2 bullets. Each bullet must be a complete sentence.
- {absolute_rule_price}
- Do NOT use filler phrases like "leveraging synergies", "holistic approach", or "maximise your property's potential". Write like a direct, experienced human professional.
- ANTI-REPETITION: each finding/action must center on a DIFFERENT fact or number from the property context — never reuse a sentence, stat, or framing phrase across two findings/actions. No sentence should read like generic filler that could apply to any property."""
    if not has_seller_survey:
        schema_block += (
            "\n- Never write or imply a specific number of viewings, a buyer feedback quote, an enquiry "
            "count, or an under-offer history anywhere in the report — none of that data exists for this "
            "property. Base every claim only on the public listing (price, description, photos, property "
            "type, days on market)."
        )

    prompt = schema_block

    def _call_groq() -> str:
        client = _get_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens_val,
            temperature=0.35,
            reasoning_effort="low",
            response_format={"type": "json_object"},
        )
        # gpt-oss-120b is a reasoning model: without reasoning_effort="low" it
        # was burning ~50% of max_tokens on hidden chain-of-thought before
        # writing any JSON, which silently truncated action_plan/comparable_
        # sales/etc mid-response (finish_reason="length") once the Python-
        # side boilerplate padding was removed and real content had to fit
        # in the same budget. Keep watching for that regression here rather
        # than only discovering it via a malformed report downstream.
        finish_reason = getattr(response.choices[0], "finish_reason", None)
        if finish_reason != "stop":
            logger.warning(
                "Groq stale-listing first pass did not finish cleanly (package=%s, finish_reason=%s, usage=%s) — output may be truncated.",
                package, finish_reason, response.usage,
            )
        return response.choices[0].message.content or ""

    def _call_groq_expansion(report: dict[str, Any]) -> str:
        """Generate a second, bounded pass that adds detail to the report.

        The first request creates the reliable JSON structure. This pass only
        returns additive copy, keeping each request below Groq's TPM limit
        while allowing the final report to retain the original depth.
        """
        compact_report = {
            "executive_summary": str(report.get("executive_summary") or "")[:700],
            "pricing_recommendation_detail": str(
                report.get("pricing_recommendation_detail") or ""
            )[:700],
            "key_findings": [
                {
                    "title": str(item.get("title") or "")[:120],
                    "description": str(item.get("description") or "")[:450],
                }
                for item in (report.get("key_findings") or [])
                if isinstance(item, dict)
            ],
            "action_plan": [
                {
                    "title": str(item.get("title") or "")[:120],
                    "description": str(item.get("description") or "")[:450],
                }
                for item in (report.get("action_plan") or [])
                if isinstance(item, dict)
            ],
        }
        override_note = (
            ""
            if has_seller_survey
            else (
                "This is a cold outreach assessment with no homeowner questionnaire — never state, "
                "estimate, or imply a viewing count, buyer feedback, or offer history anywhere in "
                "your additions; base every addition only on the public listing described below.\n"
            )
        )
        expansion_prompt = f"""
You are expanding an existing UK property sales report for the {package} package.
Return ONLY valid JSON with additive copy.

Each addendum must introduce a genuinely NEW angle that the existing text below
does not already cover — a different fact, a different consequence, a different
comparison, or a different piece of practical guidance. Do not restate, rephrase,
or summarise anything already present in the existing text for that same
finding/action, and do not reuse a fact, statistic, or sentence you have already
used in a DIFFERENT finding's or action's addendum in this same batch — read all
of the existing findings/actions first so you know what has already been said
before adding to each one. If you cannot find a genuinely new angle for a given
item, write a shorter addendum rather than padding it with repeated content.
Make every addition specific to the property and questionnaire context below.
Use clear UK property language, buyer behaviour, market positioning, and
commercial consequences. Never use em dashes.
{override_note}
Property context:
{property_context[:2600]}

Questionnaire:
{questionnaire[:1800]}

Existing report:
{json.dumps(compact_report, ensure_ascii=False)}

Return this exact shape:
{{
  "executive_summary_addendum": "one detailed paragraph",
  "pricing_recommendation_detail_addendum": "one detailed paragraph",
  "key_findings_addenda": ["one paragraph for each finding, in the same order"],
  "action_plan_addenda": ["one paragraph for each action, in the same order"]
}}
"""
        client = _get_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior UK property sales consultant. "
                        "Return only valid JSON and add useful detail without filler."
                        if has_seller_survey
                        else (
                            "You are a senior UK property sales consultant working from a public "
                            "listing only, with no homeowner questionnaire. Return only valid JSON, "
                            "add useful detail without filler, and never state or imply a viewing "
                            "count, buyer feedback, or offer history."
                        )
                    ),
                },
                {"role": "user", "content": expansion_prompt},
            ],
            max_tokens=2800,
            temperature=0.35,
            reasoning_effort="low",
            response_format={"type": "json_object"},
        )
        finish_reason = getattr(response.choices[0], "finish_reason", None)
        if finish_reason != "stop":
            logger.warning(
                "Groq stale-listing expansion pass did not finish cleanly (package=%s, finish_reason=%s, usage=%s) — addenda may be truncated.",
                package, finish_reason, response.usage,
            )
        return response.choices[0].message.content or ""

    def _merge_expansion(report: dict[str, Any], expansion: dict[str, Any]) -> dict[str, Any]:
        """Append the second-pass copy without changing the report schema."""
        merged = deepcopy(report)

        def append_copy(existing: Any, addition: Any) -> str:
            left = _clean_copy(existing)
            right = _ensure_sentence(addition)
            if not right:
                return left
            return f"{left}\n\n{right}" if left else right

        merged["executive_summary"] = append_copy(
            merged.get("executive_summary"),
            expansion.get("executive_summary_addendum"),
        )
        merged["pricing_recommendation_detail"] = append_copy(
            merged.get("pricing_recommendation_detail"),
            expansion.get("pricing_recommendation_detail_addendum"),
        )
        finding_addenda = expansion.get("key_findings_addenda") or []
        for index, finding in enumerate(merged.get("key_findings") or []):
            if index < len(finding_addenda) and isinstance(finding, dict):
                finding["description"] = append_copy(
                    finding.get("description"), finding_addenda[index]
                )
        action_addenda = expansion.get("action_plan_addenda") or []
        for index, action in enumerate(merged.get("action_plan") or []):
            if index < len(action_addenda) and isinstance(action, dict):
                action["description"] = append_copy(
                    action.get("description"), action_addenda[index]
                )
        return merged

    _DEFAULT_REPORT: dict = {
        "overall_score": 48,
        "days_on_market": None,
        "scores": {"photos": 42, "pricing": 50, "description": 45, "positioning": 40},
        "key_findings": [
            {
                "title": "Low viewing conversion rate",
                "description": "The number of viewings relative to time on market suggests the listing is generating clicks but not convincing buyers to visit — a sign of weak portal presentation.",
                "type": "issue",
                "icon": "marketing",
            },
            {
                "title": "Asking price needs review",
                "description": "Based on your answers, the current asking price may be misaligned with what active buyers in this area are willing to pay.",
                "type": "issue",
                "icon": "price",
            },
            {
                "title": "Photography is undermining first impressions",
                "description": "Listing photos are the single biggest driver of click-through from portals. Substandard photos significantly reduce the number of viewings booked.",
                "type": "issue",
                "icon": "photos",
            },
            {
                "title": "Description doesn't convert viewers",
                "description": "The listing description is not working hard enough to convert portal views into booking requests — key selling points are likely buried or missing.",
                "type": "issue",
                "icon": "description",
            },
            {
                "title": "Location fundamentals are sound",
                "description": "The property's core location attributes are attractive to the right buyer. With improved presentation and realistic pricing, buyer interest should be achievable.",
                "type": "strength",
                "icon": "location",
            },
        ],
        "action_plan": [
            {
                "priority": "URGENT",
                "title": "Commission professional photography immediately",
                "description": "New photos will reset the listing's appearance of freshness and improve click-through rates from portal searches.",
                "bullets": [
                    "Book a local property photographer this week — aim to reshoot within 7 days.",
                    "Update all portal images simultaneously to trigger a 'recently updated' visibility boost.",
                ],
            },
            {
                "priority": "URGENT",
                "title": "Review asking price against recent sold comparables",
                "description": "Compare against properties that actually sold in the past 90 days — not just listed.",
                "bullets": [
                    "Use Rightmove's sold prices tool to find comparables within 0.5 miles sold in the last 90 days.",
                    "Discuss a targeted 3–5% reduction with your agent — this often unlocks a significantly larger active buyer pool.",
                ],
            },
            {
                "priority": "HIGH",
                "title": "Rewrite the listing description",
                "description": "Restructure the copy to lead immediately with the property's strongest selling points.",
                "bullets": [
                    "Open with the top 2–3 benefits — garden, parking, school catchment — in the very first sentence.",
                    "Add a short 'Key Features' bullet list near the top of the portal listing.",
                ],
            },
            {
                "priority": "HIGH",
                "title": "Expand portal and marketing presence",
                "description": "Widen exposure beyond a single portal to reach buyers who search across multiple platforms.",
                "bullets": [
                    "Ensure the listing is live on both Rightmove and Zoopla — and OnTheMarket if not already.",
                    "Ask your agent to share on social media with targeted local buyer groups.",
                ],
            },
            {
                "priority": "MEDIUM",
                "title": "Add missing listing assets",
                "description": "Complete listing assets improve search ranking and buyer confidence.",
                "bullets": [
                    "Add a floor plan if not present — listings with floor plans consistently convert better.",
                    "Ensure the lead photo is the strongest exterior shot, taken in good daylight.",
                ],
            },
        ],
        "comparable_sales": [
            {"address": "14 Maple Street, nearby area", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£362,000", "is_subject": False},
            {"address": "7 Oak Avenue, nearby area", "beds": 3, "property_type": "Terrace", "sold_asking": "£355,000", "is_subject": False},
            {"address": "22 Birch Lane, nearby area", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£368,000", "is_subject": False},
            {"address": "Subject property", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£385,000 asking", "is_subject": True},
        ],
        "pricing_recommendation": "A targeted 3–5% reduction to align with recent comparables would re-enter the property into active buyer searches at a competitive price point.",
        "pricing_recommendation_detail": "A price change triggers a 'Price Reduced' flag on Rightmove, generating renewed attention from buyers who have already saved the listing. Properties that reduce by 3–5% and simultaneously refresh their photos consistently see a surge in enquiries within 2 weeks of relaunching.",
        "executive_summary": "Your property is showing the classic signs of a stale listing: declining portal visibility, discouraging or absent buyer feedback, and presentation that isn't converting views into viewings. The good news is that all of these issues are fixable — and quickly. A combination of fresh photography, a realistic price adjustment, and an updated description can reignite genuine buyer interest within 2–3 weeks.",
    }

    # Used only if the Groq call itself fails outright (rare) for a cold
    # letter-prospect assessment. Must not repeat _DEFAULT_REPORT's viewing/
    # feedback framing above — that would be exactly the misleading claim
    # this whole has_seller_survey path exists to prevent.
    _DEFAULT_REPORT_PUBLIC: dict = {
        "overall_score": 48,
        "days_on_market": None,
        "scores": {"photos": 42, "pricing": 50, "description": 45, "positioning": 40},
        "key_findings": [
            {
                "title": "Listing has been stale for a long stretch",
                "description": "A long, unbroken run on the market without selling is itself a signal to buyers browsing the portal, independent of anything about who has or hasn't looked at it.",
                "type": "issue",
                "icon": "timing",
            },
            {
                "title": "Asking price needs review",
                "description": "The current asking price may be misaligned with what active buyers in this area are willing to pay for a property that has been listed this long.",
                "type": "issue",
                "icon": "price",
            },
            {
                "title": "Photography may be undermining first impressions",
                "description": "Listing photos are the single biggest driver of click-through from portals. Weak or dated photos significantly reduce how many buyers stop to look closer.",
                "type": "issue",
                "icon": "photos",
            },
            {
                "title": "Description doesn't convert browsers",
                "description": "The listing description is not working hard enough to convert portal views into booking requests — key selling points are likely buried or missing.",
                "type": "issue",
                "icon": "description",
            },
            {
                "title": "Location fundamentals are sound",
                "description": "The property's core location attributes are attractive to the right buyer. With improved presentation and realistic pricing, renewed interest should be achievable.",
                "type": "strength",
                "icon": "location",
            },
        ],
        "action_plan": [
            {
                "priority": "URGENT",
                "title": "Commission professional photography immediately",
                "description": "New photos will reset the listing's appearance of freshness and improve click-through rates from portal searches.",
                "bullets": [
                    "Book a local property photographer this week — aim to reshoot within 7 days.",
                    "Update all portal images simultaneously to trigger a 'recently updated' visibility boost.",
                ],
            },
            {
                "priority": "URGENT",
                "title": "Review asking price against recent sold comparables",
                "description": "Compare against properties that actually sold in the past 90 days — not just listed.",
                "bullets": [
                    "Use Rightmove's sold prices tool to find comparables within 0.5 miles sold in the last 90 days.",
                    "Discuss a targeted 3–5% reduction with your agent — this often unlocks a significantly larger active buyer pool.",
                ],
            },
            {
                "priority": "HIGH",
                "title": "Rewrite the listing description",
                "description": "Restructure the copy to lead immediately with the property's strongest selling points.",
                "bullets": [
                    "Open with the top 2–3 benefits — garden, parking, school catchment — in the very first sentence.",
                    "Add a short 'Key Features' bullet list near the top of the portal listing.",
                ],
            },
            {
                "priority": "HIGH",
                "title": "Expand portal and marketing presence",
                "description": "Widen exposure beyond a single portal to reach buyers who search across multiple platforms.",
                "bullets": [
                    "Ensure the listing is live on both Rightmove and Zoopla — and OnTheMarket if not already.",
                    "Ask the agent to share it on social media with targeted local buyer groups.",
                ],
            },
            {
                "priority": "MEDIUM",
                "title": "Add missing listing assets",
                "description": "Complete listing assets improve search ranking and buyer confidence.",
                "bullets": [
                    "Add a floor plan if not present — listings with floor plans consistently convert better.",
                    "Ensure the lead photo is the strongest exterior shot, taken in good daylight.",
                ],
            },
        ],
        "comparable_sales": [
            {"address": "14 Maple Street, nearby area", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£362,000", "is_subject": False},
            {"address": "7 Oak Avenue, nearby area", "beds": 3, "property_type": "Terrace", "sold_asking": "£355,000", "is_subject": False},
            {"address": "22 Birch Lane, nearby area", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£368,000", "is_subject": False},
            {"address": "Subject property", "beds": 3, "property_type": "Semi-det.", "sold_asking": "£385,000 asking", "is_subject": True},
        ],
        "pricing_recommendation": "A targeted 3–5% reduction to align with recent comparables would re-enter the property into active buyer searches at a competitive price point.",
        "pricing_recommendation_detail": "A price change triggers a 'Price Reduced' flag on Rightmove, generating renewed attention from buyers who have already saved the listing. Properties that reduce by 3–5% and simultaneously refresh their photos consistently see a surge in enquiries within 2 weeks of relaunching.",
        "executive_summary": "This property is showing the classic signs of a stale listing: a long stretch on the market, presentation that may not be converting portal views, and a price position worth re-testing against recent comparables. The good news is that these issues are fixable — and quickly. A combination of fresh photography, a realistic price adjustment, and an updated description can reignite genuine buyer interest within 2–3 weeks.",
    }
    _default_report = _DEFAULT_REPORT if has_seller_survey else _DEFAULT_REPORT_PUBLIC

    def _extract_json(raw: str) -> dict:
        """Strip markdown fences and extract the outermost JSON object."""
        import re
        text = raw.strip()

        # Strip ```json ... ``` or ``` ... ``` fences
        if text.startswith("```"):
            lines = text.split("\n")
            # Drop first line (```json) and last line (```) if it closes
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            text = "\n".join(lines[1:end]).strip()

        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Find the outermost { ... } block (handles trailing text after JSON)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            candidate = match.group(0)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        # Last resort: progressively trim from the end to find valid JSON
        # (handles truncated output where closing braces are missing)
        for end in range(len(text), max(len(text) - 200, 0), -1):
            segment = text[:end]
            # Count braces — if balanced, try parsing
            depth = 0
            for ch in segment:
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
            if depth == 0:
                try:
                    return json.loads(segment)
                except json.JSONDecodeError:
                    continue

        raise ValueError("Could not extract valid JSON from Groq response")

    try:
        if base_report is not None:
            # Reuse the findings already shown to the homeowner in the free
            # preview instead of rolling fresh ones — see base_report's
            # docstring above for why a second independent first-pass call
            # here would make the preview and the unlocked report disagree.
            parsed = deepcopy(base_report)
            parsed.pop("_expanded", None)
            # base_report may already carry the standing advisory items
            # (appended by a prior pass through _normalise_report_output) —
            # drop them here too so the expansion call below never spends a
            # Groq addendum trying to add a "new angle" to fixed universal
            # copy. _normalise_report_output re-appends the canonical set
            # unconditionally at the end, so nothing is lost.
            _standing_titles_pre = {item["title"].lower() for item in STANDING_ADVISORY_ACTIONS}
            parsed["action_plan"] = [
                a for a in (parsed.get("action_plan") or [])
                if str(a.get("title") or "").strip().lower() not in _standing_titles_pre
            ]
        else:
            raw = await _aio.to_thread(_call_groq)
            parsed = _extract_json(raw)
        # Ensure backward-compat defaults for new / optional fields
        parsed.setdefault("days_on_market", None)
        parsed.setdefault("comparable_sales", _DEFAULT_REPORT["comparable_sales"])
        parsed.setdefault("pricing_recommendation_detail", "")
        for item in parsed.get("action_plan", []):
            item.setdefault("bullets", [])
        for finding in parsed.get("key_findings", []):
            finding.setdefault("icon", None)
        # The expansion is useful for interactive reports but doubles Groq
        # traffic. Automated prospect delivery only needs the valid first
        # pass so one rate-limited expansion cannot stall the email queue.
        if expand_report:
            try:
                expansion_raw = await _aio.to_thread(_call_groq_expansion, parsed)
                parsed = _merge_expansion(parsed, _extract_json(expansion_raw))
                logger.info("Stale listing report expanded successfully (package=%s)", package)
            except Exception as expansion_exc:
                logger.warning(
                    "Stale listing report expansion skipped (package=%s): %s",
                    package,
                    expansion_exc,
                )
        logger.info("Stale listing report generated successfully (package=%s)", package)
        return _normalise_report_output(parsed)
    except Exception as exc:
        logger.error("Stale listing report generation failed, using fallback: %s", exc)
        # If we had an existing report to enrich, fall back to it unchanged
        # rather than _default_report — that at least keeps the full report
        # consistent with whatever the homeowner already saw in the preview.
        return _normalise_report_output(deepcopy(base_report) if base_report is not None else deepcopy(_default_report))
