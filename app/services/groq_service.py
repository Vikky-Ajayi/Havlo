"""Groq LLM service for AI property analysis reports."""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"


def _get_client():
    import os
    from groq import Groq
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
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
) -> dict:
    """
    Generate a structured stale listing analysis report as a dict.
    Returns a dict with overall_score, scores, key_findings, action_plan,
    pricing_recommendation, executive_summary.
    Falls back to a sensible default dict on any failure.
    """
    import asyncio as _aio
    import json

    q_lines = []
    label_map = {
        "q1_viewings": "Viewings since listing",
        "q2_feedback": "Buyer feedback",
        "q3_time_on_market": "Time on market",
        "q4_price_reduction": "Price changes",
        "q5_marketing": "Current marketing channels",
        "q6_listing_features": "Listing features present",
        "q7_property_type": "Property type",
        "q8_asking_price": "Asking price range",
        "q9_primary_goal": "Seller's primary goal",
        "q10_challenge": "Biggest challenge",
    }
    for key, label in label_map.items():
        val = questions_data.get(key, "Not provided")
        if isinstance(val, list):
            val = "; ".join(val) if val else "None selected"
        q_lines.append(f"- {label}: {val}")

    context = "\n".join(q_lines)
    if property_address:
        context = f"Property address: {property_address}\n" + context
    if listing_url:
        context = context + f"\nListing URL: {listing_url}"

    tier_instructions = {
        "quick_insight": "Provide a concise, data-driven analysis focusing on the 3 most critical issues.",
        "professional_review": "Provide a thorough professional analysis with detailed findings and a comprehensive action plan.",
        "premium_strategy": "Provide a comprehensive strategic analysis with in-depth insights, detailed comparable recommendations, and a full strategic action plan.",
    }
    depth_note = tier_instructions.get(package, tier_instructions["professional_review"])

    prompt = f"""You are a senior UK property sales strategist. A homeowner has completed an assessment questionnaire about their stale listing. {depth_note}

Questionnaire responses:
{context}

Return ONLY a valid JSON object (no markdown code fences, no explanation) with this exact structure:
{{
  "overall_score": <integer 0-100, honest assessment>,
  "scores": {{
    "photos": <integer 0-100>,
    "pricing": <integer 0-100>,
    "description": <integer 0-100>,
    "positioning": <integer 0-100>
  }},
  "key_findings": [
    {{
      "title": "<short title>",
      "description": "<1-2 sentence specific insight>",
      "type": "issue"
    }}
  ],
  "action_plan": [
    {{
      "priority": "URGENT",
      "title": "<action title>",
      "description": "<specific actionable step>"
    }}
  ],
  "pricing_recommendation": "<specific pricing advice based on the answers>",
  "executive_summary": "<2-3 sentence honest summary of why this property is stale and what to do>"
}}

Rules:
- overall_score must reflect the honest likelihood of selling in current state (low if many problems)
- Scores are for each dimension: photos (presentation quality), pricing (market positioning), description (copy quality), positioning (marketing strategy)
- Provide 4-6 key_findings (mix of issues and 1-2 strengths if applicable)
- Provide 4-6 action_plan items ordered by priority (URGENT first, then IMPORTANT, then RECOMMENDED)
- Be specific and actionable — not generic advice
- Do not add any text outside the JSON object"""

    def _call_groq() -> str:
        client = _get_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior UK property sales strategist. Return only valid JSON as instructed.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.6,
        )
        return response.choices[0].message.content or ""

    _DEFAULT_REPORT = {
        "overall_score": 48,
        "scores": {"photos": 45, "pricing": 52, "description": 48, "positioning": 40},
        "key_findings": [
            {
                "title": "Limited buyer exposure",
                "description": "The property is not reaching its full potential audience, particularly international and investor buyers who make up a growing share of the UK market.",
                "type": "issue",
            },
            {
                "title": "Pricing strategy needs review",
                "description": "Based on your answers, the asking price may be misaligned with current buyer expectations in your area.",
                "type": "issue",
            },
            {
                "title": "Marketing assets require updating",
                "description": "Stale portal listings lose algorithmic visibility over time. Fresh photography and an updated description can reset buyer interest.",
                "type": "issue",
            },
            {
                "title": "Portal fatigue is a real risk",
                "description": "Buyers who have already seen the listing multiple times are less likely to enquire. New exposure channels are needed.",
                "type": "issue",
            },
        ],
        "action_plan": [
            {
                "priority": "URGENT",
                "title": "Request fresh portal photography",
                "description": "Book professional property photography immediately. New images reset the listing's appearance of freshness and improve click-through rates.",
            },
            {
                "priority": "URGENT",
                "title": "Reassess asking price against current sold prices",
                "description": "Compare against properties that actually sold (not just listed) in the last 90 days within 0.5 miles.",
            },
            {
                "priority": "IMPORTANT",
                "title": "Rewrite the listing description",
                "description": "Focus on emotional triggers and lifestyle benefits, not just room sizes. Highlight proximity to amenities and unique selling points.",
            },
            {
                "priority": "RECOMMENDED",
                "title": "Expand to international buyer channels",
                "description": "A significant share of UK property buyers are now based overseas. Targeted campaigns in UAE, Singapore, and North America can unlock fresh demand.",
            },
        ],
        "pricing_recommendation": "Review your asking price against the most recent sold prices (not asking prices) for comparable properties within a half-mile radius. A realistic 3-5% adjustment often unlocks a significantly larger pool of active buyers.",
        "executive_summary": "Your property shows the classic signs of a stale listing: declining portal visibility, limited buyer feedback, and insufficient exposure to motivated buyer pools. The good news is that these are all fixable — strategic adjustments to pricing, presentation, and marketing reach can reignite buyer interest within 30 days.",
    }

    try:
        raw = await _aio.to_thread(_call_groq)
        raw = raw.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        parsed = json.loads(raw)
        logger.info("Stale listing report generated successfully (package=%s)", package)
        return parsed
    except Exception as exc:
        logger.error("Stale listing report generation failed, using fallback: %s", exc)
        return _DEFAULT_REPORT
