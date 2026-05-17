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

    # ── Plan-specific prompts ────────────────────────────────────────────────────
    # Each tier assesses genuinely different dimensions, not just depth of the same
    # things. The JSON schema is identical across all tiers so the frontend stays
    # the same; the richness of the content varies dramatically.

    if package == "quick_insight":
        task_block = """Your task is to produce a QUICK INSIGHT report — fast, punchy, opinionated.

Identify the 4 most critical blockers that are preventing a sale RIGHT NOW. Be
ruthlessly specific: name the actual number of viewings, the specific feedback
buyers gave, the exact portals they are or aren't on, the price range they stated.
Every sentence must feel like it was written for THIS property, not a template.

Focus exclusively on these four areas (pick the 4 worst performers):
  1. Listing performance signals — viewings vs. time ratio, portal click-through signals
  2. Pricing & market position — current ask vs. what buyers are actually offering
  3. Listing quality — photos, description completeness, assets present
  4. Buyer appeal — feedback themes, presentation friction, first-impression issues

QUICK INSIGHT format rules:
- key_findings: EXACTLY 4 items. At most 1 strength ("type":"strength"); the rest must be "issue".
  Each description: 1 tight sentence. No padding. Reference the homeowner's actual answers directly.
- action_plan: EXACTLY 4 items. 2 URGENT, 2 HIGH. No MEDIUM items.
  Each action must be doable within 2 weeks without professional consultancy.
  Each bullet: a single clear instruction, ≤20 words.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Keep street names realistic for the area given.
- executive_summary: 2–3 sentences. Open with the single biggest reason the property isn't selling.
  Close with what one change would have the fastest impact. No soft language — be direct."""

        max_tokens_val = 3500
        system_msg = "You are Mark Williams, a senior UK property sales consultant. Produce a Quick Insight report: concise, punchy, 100% specific to this homeowner's data. Return only valid JSON. No markdown, no code fences."

    elif package == "premium_strategy":
        task_block = """Your task is to produce a PREMIUM STRATEGY report — the most comprehensive property analysis
available, equivalent to a paid consultant briefing. This report covers six distinct assessment dimensions
that go well beyond surface-level listing advice.

Assess ALL SIX of the following dimensions thoroughly:

  1. Listing Performance & Visibility Analysis
     — How the listing is performing on portals relative to days on market, viewings, and engagement signals.
     — Estimate where the listing appears in search results based on staleness, pricing tier, and marketing activity.
     — Identify whether the property has been de-indexed or de-prioritised by portal algorithms.

  2. Pricing Intelligence & Buyer Psychology
     — Detailed analysis of the gap between asking price and market absorption price.
     — What the price signals to buyers psychologically (overconfidence, desperation, or indifference).
     — Specific impact of any prior price reductions on buyer perception ("damaged goods" risk).
     — Recommended repositioning strategy including whether to reduce, withdraw, or relaunch.

  3. Photography & Presentation Intelligence
     — Forensic assessment of listing photography based on what the homeowner reported.
     — Specific critique of likely issues: lighting, angles, clutter, emotional triggers missing.
     — What the photos are communicating to a buyer before they read a single word of the description.
     — Precise staging recommendations: which rooms to restyle, what to remove, what to add.

  4. Digital Marketing & Portal Strategy
     — Analysis of all portals the property is currently on (and those it isn't).
     — Whether the listing has been Rightmove Featured, Premium Listing, or spotlight boosted.
     — Social media exposure: what channels to target and the type of content that converts.
     — Specific recommendations for relaunching with fresh assets to trigger portal algorithm refresh.

  5. Estate Agent Performance Review
     — Honest, direct assessment of whether the agent is actively selling or passively waiting.
     — Whether the marketing channels selected suggest a low-effort instruction.
     — Signs the agent relationship may need to be reviewed (re-listed without fresh strategy, no proactive outreach).
     — Clear language the homeowner can use with their agent to demand performance.

  6. Property Liquidity & Exit Risk
     — Realistic assessment of this property's liquidity in the current market.
     — Risk factors that could prevent a sale regardless of price (structural issues signalled, niche appeal, location detractors).
     — Exit strategies available to the seller beyond a traditional sale.
     — What a realistic timeline to sale looks like given current signals.

PREMIUM STRATEGY format rules:
- key_findings: EXACTLY 6 items. Draw one finding from EACH of the 6 dimensions above (label the title clearly so the homeowner knows which dimension it addresses). Mix: 4–5 issues, 1–2 strengths.
  Each description: 2–3 sentences. Reference questionnaire answers explicitly.
  Do NOT use generic language. Every sentence must feel like it was personally written for this property.
- action_plan: EXACTLY 6 items — 2 URGENT, 2 HIGH, 2 MEDIUM. Ordered URGENT → HIGH → MEDIUM.
  Each action: a multi-part recommendation covering not just WHAT but HOW and in what sequence.
  Each bullet: a complete, specific instruction ≥15 words with a measurable outcome.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Include sold dates (within 90 days).
  Comp selection must reflect the specific property type and price range from q9_asking_price.
- pricing_recommendation: One decisive sentence. Include the exact adjusted price or percentage.
- pricing_recommendation_detail: 3–4 sentences covering: current position vs. market, psychological impact
  of the current price, what a reduction unlocks on Rightmove (e.g. search price bracket re-entry),
  and the expected timeline to next viewing after a price change.
- executive_summary: 4–5 sentences. Written as a professional consultant briefing for the homeowner.
  Cover: why this property is stale (referencing specific questionnaire answers), the biggest single
  opportunity, the biggest single risk, and the recommended first action this week. Authoritative, not reassuring."""

        max_tokens_val = 7000
        system_msg = "You are Mark Williams, a senior UK property sales consultant with 22 years of experience. Produce a Premium Strategy report: comprehensive, analytical, deeply specific to this homeowner's data. This is the most detailed report available — cover all six assessment dimensions fully. Return only valid JSON. No markdown, no code fences."

    else:
        # professional_review (default)
        task_block = """Your task is to produce a PROFESSIONAL REVIEW report — thorough, behavioural, and positioning-focused.
This goes beyond surface-level issues to analyse why buyers are choosing other properties instead.

Assess these five dimensions in depth:

  1. Listing Performance & Portal Signals
     — How viewings, feedback, and time on market combine to indicate where the listing is in the buyer funnel.
     — Whether the listing is getting portal impressions but not clicks (presentation problem) or clicks but not viewings (pricing/detail problem).
     — Estimate the listing's search result position based on age, price bracket, and marketing activity.

  2. Advanced Pricing Intelligence
     — Not just whether the price is right, but WHY buyers are rejecting it.
     — What price reductions (or the lack of them) are signalling to buyers psychologically.
     — How the price compares to what similar properties have actually sold for (not just listed at) in the past 90 days.
     — The specific price bracket on Rightmove this property sits in — and whether a small reduction would unlock a much larger buyer pool.

  3. Photography, Description & Listing Psychology
     — What the current photos are communicating subconsciously to buyers (warmth, space, neglect, value).
     — Whether the listing description leads with benefits or buries them — and how that affects booking rates.
     — Listing assets that are missing (floor plan, virtual tour, video) and the statistical impact on booking rates.
     — The specific improvements that would make the biggest click-to-viewing conversion difference.

  4. Local Competition Benchmarking
     — How this property stacks up against active competition in the same price bracket.
     — What competing listings are doing better: photos, price per sq ft, portal features, description quality.
     — Where this property has a genuine competitive advantage that isn't being communicated.

  5. Marketing & Agent Strategy Analysis
     — Which marketing channels are being used and which critical ones are missing.
     — Whether the estate agent is running a proactive or reactive marketing strategy.
     — The most effective low-cost interventions the homeowner can request immediately.

PROFESSIONAL REVIEW format rules:
- key_findings: EXACTLY 5 items. One finding from each dimension above. Mix: 3–4 issues, 1–2 strengths.
  Each description: 2 sentences. First sentence states the specific issue with evidence from the answers.
  Second sentence explains why this is costing them viewings or offers.
- action_plan: EXACTLY 5 items — 2 URGENT, 2 HIGH, 1 MEDIUM. Ordered URGENT → HIGH → MEDIUM.
  Each action: specific, with named tools, portals, or techniques (e.g. "Rightmove Premium Listing", "Zoopla Spotlight").
  Each bullet: a complete, specific instruction with a measurable outcome.
- comparable_sales: EXACTLY 4 entries (3 sold comps + 1 subject). Note sold dates where possible.
- pricing_recommendation: One specific sentence including the recommended adjusted price or range.
- pricing_recommendation_detail: 3 sentences: current position analysis, what a reduction triggers on Rightmove,
  and the expected change in viewings within 14 days.
- executive_summary: 3–4 sentences. Reference viewings count, buyer feedback, marketing gaps, and the
  single most impactful action. Sound like a human professional, not an AI summary."""

        max_tokens_val = 5500
        system_msg = "You are Mark Williams, a senior UK property sales consultant with 22 years of experience. Produce a Professional Review report: thorough, behavioural, and deeply specific to this homeowner's data. Cover all five assessment dimensions. Return only valid JSON. No markdown, no code fences."

    # ── Shared JSON schema instruction (all tiers) ───────────────────────────────
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
        return parsed
    except Exception as exc:
        logger.error("Stale listing report generation failed, using fallback: %s", exc)
        return _DEFAULT_REPORT
