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
) -> dict:
    """
    Generate a structured stale listing analysis report using Groq LLM.
    Returns a dict matching StaleListingReportData schema.
    Falls back to a sensible default dict on any failure.
    """
    import asyncio as _aio
    import json

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

    minimum_description_length = 1000
    description_targets = {
        "quick_insight": 1000,
        "professional_review": 1150,
        "premium_strategy": 1300,
    }

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

    property_anchor = _clean_scalar(snapshot.get("address") or property_address or snapshot.get("title") or "this property")
    price_anchor = _clean_scalar(snapshot.get("price") or questions_data.get("q9_asking_price") or "the current asking-price range")
    viewings_summary = _clean_scalar(questions_data.get("q1_viewings")) or "an unclear level of viewings"
    feedback_summary = _clean_scalar(questions_data.get("q2_feedback")) or "no detailed buyer feedback"
    price_reduction_summary = _clean_scalar(questions_data.get("q4_price_reduction")) or "no clear record of price changes"
    flexibility_summary = _clean_scalar(questions_data.get("q5_flexibility")) or "no clear statement on flexibility"
    marketing_summary = _clean_scalar(questions_data.get("q6_marketing")) or "limited visibility on marketing channels"
    features_summary = _clean_scalar(snapshot.get("features") or questions_data.get("q7_listing_features")) or "few standout listing assets"
    photo_summary = _clean_scalar(questions_data.get("q8_photos")) or "uncertain confidence in the current photo set"
    challenge_summary = _clean_scalar(questions_data.get("q10_challenge")) or "slow buyer engagement"
    portal_summary = _clean_scalar(snapshot.get("platform")) or "the main portals already in use"
    description_summary = _clean_scalar(snapshot.get("description"))[:380]
    comparable_anchor = f"The home is currently framed around {price_anchor}, the seller reports {viewings_summary}, buyer feedback has been recorded as {feedback_summary}, and the current marketing mix is {marketing_summary}."

    def _ensure_sentence(text: str) -> str:
        cleaned = _clean_copy(text)
        if not cleaned:
            return ""
        if cleaned[-1] not in ".!?":
            cleaned += "."
        return cleaned

    def _pad_to_length(text: str, minimum: int, supplements: list[str]) -> str:
        output = _clean_copy(text)
        used: set[str] = set()
        for supplement in supplements:
            addition = _clean_copy(supplement)
            if not addition or addition in used or len(output) >= minimum:
                continue
            output = f"{output}\n\n{addition}" if output else addition
            used.add(addition)
        fallback = (
            f"For {property_anchor}, the seller's own answers already tell a coherent commercial story. "
            f"They describe {viewings_summary}, mention {feedback_summary}, and identify {challenge_summary} as the main obstacle. "
            f"That is exactly the sort of evidence a good local valuer or instruction-winning agent would probe before deciding whether the next step should be pricing, presentation, marketing pressure, or a full relaunch."
        )
        while len(output) < minimum:
            output = f"{output}\n\n{fallback}" if output else fallback
        return output

    def _finding_focus(icon: str, finding_type: str) -> str:
        if icon == "price":
            return (
                f"Pricing is the first credibility check buyers apply, especially in the {price_anchor} bracket. "
                f"When the market sees {price_reduction_summary} alongside {viewings_summary}, buyers start deciding whether the seller is realistic before they ever pick up the phone. "
                f"If the number feels out of line, buyers do not negotiate first, they usually move on to the next listing that looks easier to justify."
            )
        if icon == "photos":
            return (
                f"Photos decide whether a home wins a second look, and the seller has described their current imagery as {photo_summary}. "
                f"That matters because buyers scan dozens of options quickly, and weak first-frame presentation makes the property feel older, harder work, or poorer value even when the fundamentals are not the problem. "
                f"Once that impression sets in, the description has to work far too hard to recover interest."
            )
        if icon == "description":
            return (
                f"The written listing has to translate features into buyer motivation, yet the current picture suggests {features_summary}. "
                f"When key selling points are buried, generic, or unsupported by the order of the copy, buyers conclude that the home lacks a compelling reason to book a viewing. "
                f"That is why a flat listing often has poor click-to-viewing conversion even when the location or layout is decent."
            )
        if icon == "marketing":
            return (
                f"Visibility is not just about being online, it is about being visible in the right places with a listing that feels active. "
                f"The owner says the property is being marketed through {marketing_summary}, and the portal context points to {portal_summary}. "
                f"If that mix is narrow or stale, the listing starts slipping out of the active consideration set and becomes background noise to fresh buyers."
            )
        if icon == "location":
            strength_lead = "A location-led strength only helps when the listing makes that advantage easy to recognise." if finding_type == "strength" else "Location can still be a drag if the listing fails to frame the right buyer story."
            return (
                f"{strength_lead} For {property_anchor}, the market context still sits around {price_anchor}, and that means nearby competition will be judged very quickly on convenience, local reputation, and overall ease of living. "
                f"If the listing does not connect those strengths to why the buyer should care, the benefit remains latent rather than commercially useful."
            )
        if icon == "condition":
            return (
                f"Condition issues are rarely judged in isolation. Buyers fold them into their mental estimate of time, effort, and post-move spend. "
                f"When the seller reports {challenge_summary} and the listing still has {features_summary}, even small signs of neglect or unfinished presentation can push cautious buyers toward homes that feel easier to secure and easier to live in from day one."
            )
        return (
            f"Timing matters because stale stock is interpreted differently from fresh stock. "
            f"The mix of {viewings_summary}, {feedback_summary}, and {price_reduction_summary} makes buyers ask why the property is still available and whether somebody else has already rejected it for a good reason. "
            f"That shifts the conversation from desire to doubt, and doubt is expensive in a market where buyers can move on quickly."
        )

    def _action_focus(title: str, priority: str, bullets: list[str]) -> str:
        title_lower = title.lower()
        steps_text = _clean_scalar(bullets) or "a short, specific delivery plan and a visible market response"
        if "photo" in title_lower or "image" in title_lower or "staging" in title_lower:
            return (
                f"This action is about first impressions. The current answers point to {photo_summary}, so the market is probably deciding too much from a weak visual opening frame. "
                f"The supporting steps already suggest {steps_text}, and that matters because stronger imagery changes click-through quality before it changes anything else."
            )
        if "price" in title_lower or "pricing" in title_lower or "reduction" in title_lower:
            return (
                f"This action is about regaining price credibility. The seller has described {price_reduction_summary} and is anchored around {price_anchor}, so any pricing move must look deliberate rather than desperate. "
                f"The suggested execution path, {steps_text}, should be handled as a repositioning exercise, not just a discount."
            )
        if "description" in title_lower or "copy" in title_lower or "listing" in title_lower:
            return (
                f"This action is aimed at conversion quality. The listing currently has {features_summary}, while buyer feedback is recorded as {feedback_summary}. "
                f"That means the wording must do a better job of connecting the strongest features to the practical reasons somebody would choose this home over the competing stock they are reviewing this week."
            )
        if "agent" in title_lower or "competition" in title_lower or "portal" in title_lower or "marketing" in title_lower:
            return (
                f"This action is about market pressure and visibility. The homeowner says the current marketing is {marketing_summary}, and the main challenge is {challenge_summary}. "
                f"The steps already outlined, {steps_text}, need to be executed in a way that makes the listing feel refreshed, better targeted, and commercially easier to act on."
            )
        urgency_line = {
            "URGENT": "This belongs at the top of the queue because it has the strongest chance of changing buyer behaviour in the next few days.",
            "HIGH": "This should follow quickly because it improves the odds that the next wave of portal traffic converts more efficiently.",
            "MEDIUM": "This is still worthwhile, but it delivers best value once the urgent blockers have already been tackled.",
        }.get(priority, "This action matters because it improves the marketability of the property in a practical way.")
        return (
            f"{urgency_line} In this case the seller has reported {viewings_summary}, {feedback_summary}, and {challenge_summary}. "
            f"The recommended delivery route, {steps_text}, should therefore be judged against a clear outcome: more enquiries, cleaner feedback, and a stronger reason for a buyer to move from curiosity into commitment."
        )

    def _expand_key_finding_copy(finding: dict[str, Any], selected_package: str) -> str:
        title = _clean_scalar(finding.get("title")) or "Important sales blocker"
        icon = _clean_scalar(finding.get("icon")) or "timing"
        finding_type = _clean_scalar(finding.get("type")) or "issue"
        base_description = _ensure_sentence(finding.get("description") or f"{title} is affecting saleability.")
        tier_frame = {
            "quick_insight": "Even at Quick Insight level, the point is to isolate the commercial blocker that deserves attention first and explain why it is costing the seller momentum now.",
            "professional_review": "At Professional Review level, the point is to connect the symptom to buyer behaviour, local competition, and the way the listing is currently being interpreted in the market.",
            "premium_strategy": "At Premium Strategy level, the point is to treat the issue as part of a wider relaunch strategy, including how it affects perception, pricing leverage, and the order in which changes should be made.",
        }[selected_package]
        strength_frame = (
            f"This is one of the few areas that can be used as leverage. If the seller and agent frame it properly, it can offset weaker parts of the listing and make the next round of marketing feel more convincing."
            if finding_type == "strength"
            else f"Until this is addressed, buyers will keep rationalising their hesitation with other stock that feels easier, cleaner, or better priced. That is why the issue is not just cosmetic, it is commercial."
        )
        supplements = [
            comparable_anchor,
            _finding_focus(icon, finding_type),
            tier_frame,
            strength_frame,
            (
                f"The questionnaire also says the seller is {flexibility_summary} about changing strategy, and that matters because a stale listing normally improves only when the owner is willing to change either the presentation, the price story, the exposure, or the sequencing of all three."
            ),
            (
                f"Viewed together, the case for {property_anchor} is not abstract. It is rooted in {viewings_summary}, feedback that reads as {feedback_summary}, the current photo position of {photo_summary}, and a stated challenge of {challenge_summary}. A serious agent would use that evidence to decide what to fix first rather than treating every issue as equally important."
            ),
        ]
        return _pad_to_length(
            "\n\n".join([base_description, comparable_anchor, _finding_focus(icon, finding_type), tier_frame, strength_frame]),
            description_targets[selected_package],
            supplements,
        )

    def _expand_action_copy(action: dict[str, Any], selected_package: str) -> str:
        title = _clean_scalar(action.get("title")) or "Immediate corrective action"
        priority = _clean_scalar(action.get("priority")) or "HIGH"
        bullets = [item for item in (_clean_copy(bullet) for bullet in action.get("bullets", [])) if item]
        base_description = _ensure_sentence(action.get("description") or f"{title} should be completed next.")
        tier_frame = {
            "quick_insight": "For this plan, the action still needs to be practical and commercially worthwhile, but it should be something the seller and agent can start within days rather than weeks.",
            "professional_review": "For this plan, the action should not just fix a symptom. It should also improve how the property is positioned against the homes buyers are comparing it with right now.",
            "premium_strategy": "For this plan, the action should be treated as part of a broader relaunch sequence. It needs a clear owner, a clear order, and a clear test for whether it has improved the market response.",
        }[selected_package]
        supplements = [
            _action_focus(title, priority, bullets),
            comparable_anchor,
            tier_frame,
            (
                f"The owner has identified {challenge_summary} as the biggest challenge, so this step only earns its place if it tackles that obstacle directly. If it does not change the quality of enquiry, the tone of buyer feedback, or the speed of the next viewing request, it should be tightened and re-run quickly rather than left to drift."
            ),
            (
                f"The delivery details matter. Current answers indicate {marketing_summary}, {price_reduction_summary}, and {photo_summary}. That combination means the action must be visible in the listing, obvious to the agent, and easy to monitor so the seller can judge whether it has improved click-through, viewings, or the seriousness of incoming conversations."
            ),
            (
                f"For {property_anchor}, this is ultimately about recovering momentum. The aim is not just to complete a task list, it is to remove enough friction that a buyer who currently hesitates can picture a cleaner decision path and is more willing to book, revisit, or offer."
            ),
        ]
        return _pad_to_length(
            "\n\n".join([base_description, _action_focus(title, priority, bullets), tier_frame]),
            description_targets[selected_package],
            supplements,
        )

    def _normalise_report_output(report: dict[str, Any]) -> dict[str, Any]:
        normalised = deepcopy(report)
        normalised.setdefault("days_on_market", None)
        normalised.setdefault("comparable_sales", [])
        normalised.setdefault("pricing_recommendation_detail", "")
        normalised["pricing_recommendation"] = _ensure_sentence(normalised.get("pricing_recommendation") or "")
        normalised["pricing_recommendation_detail"] = _pad_to_length(
            _ensure_sentence(normalised.get("pricing_recommendation_detail") or normalised.get("pricing_recommendation") or "The price position needs to be reset against genuine buyer expectations."),
            max(520, minimum_description_length // 2),
            [
                comparable_anchor,
                f"Price sensitivity is tied directly to {viewings_summary} and {feedback_summary}. In this bracket, buyers respond quickly when a reduction or repositioning looks intentional and is paired with a refreshed listing rather than a tired one.",
                f"The seller is currently dealing with {challenge_summary}, so price should be discussed as a lever for momentum, not as a standalone admission that the property was wrong before.",
            ],
        )
        normalised["executive_summary"] = _pad_to_length(
            _ensure_sentence(normalised.get("executive_summary") or "The property is behaving like a stale listing and needs a sharper relaunch plan."),
            620,
            [
                comparable_anchor,
                f"The combination of {photo_summary}, {price_reduction_summary}, and {marketing_summary} is why the home is not currently converting interest with enough authority. A better result depends on sequencing the next changes properly and judging them against real market feedback rather than hope.",
            ],
        )

        findings = normalised.get("key_findings") or []
        for finding in findings:
            finding["title"] = _clean_scalar(finding.get("title")) or "Important sales blocker"
            finding["type"] = (_clean_scalar(finding.get("type")) or "issue").lower()
            finding["icon"] = _clean_scalar(finding.get("icon")) or "timing"
            finding["description"] = _expand_key_finding_copy(finding, package)

        actions = normalised.get("action_plan") or []
        for action in actions:
            action["priority"] = (_clean_scalar(action.get("priority")) or "HIGH").upper()
            action["title"] = _clean_scalar(action.get("title")) or "Immediate corrective action"
            action["bullets"] = [_ensure_sentence(item) for item in action.get("bullets", []) if _clean_scalar(item)]
            while len(action["bullets"]) < 2:
                action["bullets"].append(
                    _ensure_sentence(
                        f"Use this step to address {challenge_summary} and measure whether the market response improves within the next review cycle."
                    )
                )
            action["bullets"] = action["bullets"][:2]
            action["description"] = _expand_action_copy(action, package)

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
  Each description must be no less than 1000 characters and should read like a paid consultant note, not a thin AI summary.
  Write in natural human paragraphs using clear UK property language, reference the seller's actual answers, and explain both the evidence and the buyer consequence.
- action_plan: EXACTLY 4 items. 2 URGENT, 2 HIGH. No MEDIUM items.
  Each action must be doable within 2 weeks without professional consultancy.
  Each action description must be no less than 1000 characters and explain what to do, why it matters now, and what change the seller should expect to see.
  Each bullet must be a complete sentence with a concrete instruction and a practical outcome.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Keep street names realistic for the area given.
 - pricing_recommendation_detail: give a commercially sharp explanation that references the actual price range, likely buyer reaction, and what a reset should unlock within the next fortnight.
 - executive_summary: write a short human mini-brief that clearly states the main blocker, how buyers are reading the listing, and what to change first this week.
  Be direct, commercial, specific, and natural. Never use em dashes."""

        max_tokens_val = 6200
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
  Each description must be no less than 1000 characters and must feel materially richer than Professional Review.
  Write in natural human paragraphs with consultant-level reasoning, tying the evidence to market behaviour, seller risk, and relaunch sequencing.
- action_plan: EXACTLY 6 items - 2 URGENT, 2 HIGH, 2 MEDIUM. Ordered URGENT -> HIGH -> MEDIUM.
  Each action must read like consultant advice, covering not just WHAT but HOW, in what order, and what result to look for.
  Each action description must be no less than 1000 characters and include sequencing, strategic framing, and the commercial logic behind the recommendation.
  Each bullet must be a complete, specific instruction of at least 16 words with a measurable or observable outcome.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Include sold dates (within 90 days).
  Comp selection must reflect the specific property type and price range from q9_asking_price.
- pricing_recommendation: One decisive sentence. Include the exact adjusted price or percentage.
- pricing_recommendation_detail: provide a premium-level pricing note that covers current position versus market, the psychological effect of the current number, what a reset unlocks on Rightmove, and what timeline to expect after the change.
- executive_summary: write a consultant briefing for the homeowner covering why the property is stale, the biggest opportunity, the biggest risk, the recommended first action this week, and the likely outcome if the strategy is followed. It must sound human, commercially sharp, and contain no em dashes."""

        max_tokens_val = 9200
        system_msg = "You are Mark Williams, a senior UK property sales consultant with 22 years of experience. Produce a Premium Strategy report that feels like a high-fee consultant briefing: comprehensive, analytical, commercially sharp, and deeply specific to this homeowner's data. This is the richest plan and must be noticeably more strategic than Professional Review. Write like a strong human consultant and never use em dashes. Return only valid JSON. No markdown, no code fences."

    else:
        # professional_review (default)
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
  Each description must be no less than 1000 characters and must be materially more analytical than Quick Insight.
  Write in natural human paragraphs that connect the issue to buyer behaviour, market positioning, and what competing listings are doing better.
- action_plan: EXACTLY 5 items - 2 URGENT, 2 HIGH, 1 MEDIUM. Ordered URGENT -> HIGH -> MEDIUM.
  Each action should feel strategic, linking the recommendation to buyer response, portal positioning, or pricing leverage.
  Each action description must be no less than 1000 characters and should explain what to do, why it matters, how it should be executed, and what success signal to watch for.
  Each bullet must be a complete, specific instruction with a measurable outcome or clear success signal.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Note sold dates where possible.
- pricing_recommendation: One specific sentence including the recommended adjusted price or range.
- pricing_recommendation_detail: give a fuller pricing note that references current position, likely buyer interpretation, portal search bands, and the expected effect on enquiry levels within 14 days.
- executive_summary: write a concise but authoritative consultant summary that references viewings, feedback, marketing gaps, and the single most impactful next move. It must sound human and commercially aware, never robotic, and never use em dashes."""

        max_tokens_val = 7800
        system_msg = "You are Mark Williams, a senior UK property sales consultant with 22 years of experience. Produce a Professional Review report that is noticeably more analytical and strategic than Quick Insight while staying deeply specific to this homeowner's data. Write like a seasoned human consultant and never use em dashes. Return only valid JSON. No markdown, no code fences."

    schema_block = f"""
{property_context}

Questionnaire answers:
{questionnaire}

{task_block}

Return ONLY a valid JSON object (absolutely no markdown, no code fences, no text before or after the JSON):

{{
  "overall_score": <integer 0-100, honest saleability score — be tough. 0-40 = serious problems, 41-60 = significant issues, 61-75 = moderate issues, 76-100 = minor polish needed. Low viewings + no price drops + poor photos = max 55>,
  "days_on_market": <integer estimate based on signals: multiple price reductions suggests 90+ days, no reductions + few viewings suggests 60-90 days. Return null only if truly impossible to estimate>,
  "scores": {{
    "photos": <integer 0-100 — be strict. "Not satisfied" with photos = 20-40. "Somewhat satisfied" = 40-60. "Very satisfied" (but still stale) = 55-70. Only 80+ if there is clear evidence of professional photography AND the listing is not stale>,
    "pricing": <integer 0-100 — low if buyers gave price feedback or if no reductions despite long time on market. 0-35 = confirmed overpriced. 36-55 = likely overpriced. 56-70 = borderline. 71+ = reasonable for the market>,
    "description": <integer 0-100 based on whether detailed description and key features are present>,
    "positioning": <integer 0-100 based on portal coverage, marketing channels, and listing assets>
  }},
  "key_findings": [
    {{
      "title": "<concise, specific issue or strength — max 8 words, no generic titles>",
      "description": "<as per format rules above — specific to THIS property's answers>",
      "type": "<'issue' or 'strength'>",
      "icon": "<one of: price | photos | description | location | marketing | condition | timing>"
    }}
  ],
  "action_plan": [
    {{
      "priority": "<URGENT | HIGH | MEDIUM>",
      "title": "<specific, action-oriented title>",
      "description": "<one direct sentence explaining what and why>",
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
  "pricing_recommendation": "<one decisive sentence with a specific recommended price or percentage adjustment — not vague>",
  "pricing_recommendation_detail": "<as per format rules above — specific, analytical, references actual asking price>",
  "executive_summary": "<as per format rules above — written for THIS homeowner, references their specific answers>"
}}

ABSOLUTE RULES — breaking any of these is a failure:
- NEVER use generic placeholder descriptions. Every sentence must reference THIS homeowner's actual questionnaire answers.
- overall_score: calibrate against the number of viewings, buyer feedback, price reductions, portal coverage, and photo quality. Most stale listings score 35–60.
- All scores (photos, pricing, description, positioning) must be individually calibrated to the answers, not averaged or approximated.
- comparable_sales: always exactly 4 entries. Entry 4 must have is_subject: true and show the current asking price. The first 3 show sold prices (typically 3–12% below asking).
- key_findings icons: only use values from: price, photos, description, location, marketing, condition, timing.
- action_plan priorities: only use: URGENT, HIGH, MEDIUM. Must be in descending priority order.
- Each action_plan item must have exactly 2 bullets. Each bullet must be a complete sentence.
- pricing_recommendation and pricing_recommendation_detail must reference the actual price range from q9_asking_price.
- Do NOT use filler phrases like "leveraging synergies", "holistic approach", or "maximise your property's potential". Write like a direct, experienced human professional."""

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
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content or ""

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
        logger.info("Stale listing report generated successfully (package=%s)", package)
        return _normalise_report_output(parsed)
    except Exception as exc:
        logger.error("Stale listing report generation failed, using fallback: %s", exc)
        return _normalise_report_output(deepcopy(_DEFAULT_REPORT))
