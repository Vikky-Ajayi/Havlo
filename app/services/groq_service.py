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
