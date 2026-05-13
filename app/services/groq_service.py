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
    address_line = f"Property address: {property_address}" if property_address else ""
    url_line = f"Listing URL: {listing_url}" if listing_url else ""
    property_context = "\n".join(filter(None, [address_line, url_line])) or "Property details: not provided"

    tier_instructions = {
        "quick_insight": "Focus on the 4 most critical issues. Keep findings concise but specific.",
        "professional_review": "Provide a thorough analysis with 5 findings and a detailed action plan.",
        "premium_strategy": "Provide a comprehensive strategic analysis with 5-6 findings, full action plan, and rich comparable sales context.",
    }
    depth = tier_instructions.get(package, tier_instructions["professional_review"])

    prompt = f"""You are Mark Williams, a senior UK property sales consultant with 22 years of experience helping homeowners sell stalled listings. You write in a direct, honest, and practical tone. You always reference the specific data the homeowner has given you — never give generic advice.

A homeowner has submitted their property for a StaleListings assessment. Here is the data:

{property_context}

Questionnaire answers:
{questionnaire}

Your task: {depth}

Return ONLY a valid JSON object (absolutely no markdown, no code fences, no text before or after the JSON) with this exact structure:

{{
  "overall_score": <integer 0-100, honest reflection of likelihood to sell in current state>,
  "days_on_market": <integer, estimate the days on market based on questionnaire signals — e.g. multiple price reductions = 90+ days. Return null if completely unclear>,
  "scores": {{
    "photos": <integer 0-100, based on q7_listing_features and q8_photos>,
    "pricing": <integer 0-100, based on q4 price reductions, q9 asking price, q2 buyer feedback about price>,
    "description": <integer 0-100, based on q7_listing_features 'detailed description' answer>,
    "positioning": <integer 0-100, based on q6 marketing channels and overall strategy>
  }},
  "key_findings": [
    {{
      "title": "<concise specific issue or strength, max 8 words>",
      "description": "<1-2 sentences referencing the homeowner's actual questionnaire answers — specific, not generic>",
      "type": "issue",
      "icon": "price"
    }}
  ],
  "action_plan": [
    {{
      "priority": "URGENT",
      "title": "<specific action title>",
      "description": "<one direct sentence: what needs to happen and why>",
      "bullets": [
        "<specific actionable step — what to do, how, where, when>",
        "<follow-through step — measurable outcome or next action>"
      ]
    }}
  ],
  "comparable_sales": [
    {{
      "address": "<plausible street address near the property — use the area from property_address if provided>",
      "beds": <integer>,
      "property_type": "<Semi-det. | Terrace | Detached | Flat>",
      "sold_asking": "<e.g. £370,000 or £385,000 asking>",
      "is_subject": false
    }}
  ],
  "pricing_recommendation": "<one specific sentence pricing advice referencing their actual asking price range and any reductions>",
  "pricing_recommendation_detail": "<2-3 sentences: explain the rationale, what a price change would trigger on Rightmove, and expected outcome>",
  "executive_summary": "<3-4 sentences: honest summary of why this property is stale referencing their specific answers (viewings, feedback, marketing, photos), and the clearest path to a sale. Must sound like a human expert, not AI boilerplate.>"
}}

RULES — follow these exactly:
- overall_score: be honest. Multiple issues with no price reductions and low viewings = 35-50. Strong fundamentals with minor issues = 60-70. Only score above 70 if genuinely strong.
- key_findings: provide exactly 5 findings. Mix of issues (4) and strengths (1) if warranted, or all 5 issues if no clear strengths. Icon values allowed: "price", "photos", "description", "location", "marketing", "condition", "timing"
- action_plan: provide exactly 5 items ordered by priority (URGENT first, then HIGH, then MEDIUM). Priority must be one of: URGENT, HIGH, MEDIUM. Each item must have exactly 2 bullets.
- comparable_sales: provide exactly 4 entries. The last entry must have is_subject: true and represent the subject property at its current asking price. The other 3 show recent sold comparables at lower prices. Use the area/street from the property address if provided.
- Reference specific answers: mention that they had X viewings, that buyers said Y, that they are/are not on Z portals, that they have/haven't reduced the price.
- pricing_recommendation and pricing_recommendation_detail must reference the actual price range from q9_asking_price.
- Do NOT use placeholder text. Write as if you personally reviewed this exact listing."""

    def _call_groq() -> str:
        client = _get_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are Mark Williams, a senior UK property sales consultant. Return only valid JSON as instructed. No markdown, no code fences, no explanation.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=3500,
            temperature=0.5,
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

    try:
        raw = await _aio.to_thread(_call_groq)
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        parsed = json.loads(raw)
        # Ensure backward-compat defaults for new fields
        parsed.setdefault("days_on_market", None)
        parsed.setdefault("comparable_sales", _DEFAULT_REPORT["comparable_sales"])
        parsed.setdefault("pricing_recommendation_detail", "")
        for item in parsed.get("action_plan", []):
            item.setdefault("bullets", [])
        for finding in parsed.get("key_findings", []):
            finding.setdefault("icon", None)
        logger.info("Stale listing report generated successfully (package=%s)", package)
        return parsed
    except Exception as exc:
        logger.error("Stale listing report generation failed, using fallback: %s", exc)
        return _DEFAULT_REPORT
