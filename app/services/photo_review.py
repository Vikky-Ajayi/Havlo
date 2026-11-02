"""Real photo feedback: send the listing's actual photos to the vision model
and let it say what a buyer sees.

gpt-oss-120b (text only) never saw the photos — that's why it invented
"the living room appears cluttered" about an empty room. gpt-6.1-terra can
see images, so here it looks at the real photos and gives specific,
grounded presentation feedback. Each observation is flagged
`_photo_verified`, so the claim checks (report_guard) keep it — we have
genuinely seen the photos — while the text report writer still may not
describe photos it hasn't seen.

Every photo on the listing is reviewed (Nov 2026; it used to be the first
eight), each one numbered so the feedback can point at "photo 14". One call
per prospect with low-detail images, reused for the free preview and the
full report. Never raises: if it fails, the report is simply served
without photo feedback.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from app.services import groq_service

logger = logging.getLogger(__name__)

# Every photo on the listing (portals rarely carry more than 60), so the
# review sees the whole set: which rooms are shown, which are missing, the
# order, duplicates and weak shots. Low detail (512px) is plenty for that and
# keeps a 50-photo review to a few thousand input tokens.
MAX_PHOTOS = 80
IMAGE_DETAIL = "low"
# A full set takes longer to read; if it fails or runs over, retry with the
# first FALLBACK_PHOTOS so the report still gets photo feedback.
FULL_TIMEOUT_SECONDS = 90
FALLBACK_PHOTOS = 24
FALLBACK_TIMEOUT_SECONDS = 45

_SYSTEM = (
    "You are a UK estate agent reviewing the photographs on a property listing, exactly as a buyer "
    "scrolling a portal sees them. You can see the images provided. Judge ONLY what is clearly visible in "
    "them. Never invent a room or feature that is not shown, and never guess at anything the photos don't "
    "show. Be specific, practical and fair."
)


def _prompt(shown: int, total: int, address: str, property_type: str | None) -> str:
    whole = "all" if shown >= total else f"{shown} of the {total}"
    return (
        f"These are {whole} photos on the listing for {address} ({property_type or 'home'}), in the order the "
        "portal shows them; each is labelled Photo 1, Photo 2 and so on. Look at every one. Judging only what the "
        "photos actually show, assess how the property is presented to a buyer. Return JSON:\n"
        '{"overall": "one or two sentences on the impression the whole set gives a buyer",\n'
        ' "findings": [{"title": "<=8 words", "description": "2-3 sentences on ONE specific, visible presentation '
        'issue or strength, naming the photo numbers, and why it affects buyer interest", "type": "issue" or "strength"}],\n'
        ' "rooms_shown": ["each room or space that appears, e.g. kitchen, master bedroom, garden"],\n'
        ' "missing_shots": ["key shots a buyer would expect that don\'t appear at all"],\n'
        ' "order_notes": "one or two sentences on whether the order works, and what should come straight after the lead photo",\n'
        ' "weak_photos": [{"photo": <number>, "issue": "dark, blurry, cluttered, duplicate, irrelevant or similar"}],\n'
        ' "actions": ["one concrete fix the seller can make, naming photo numbers where useful", ...]}\n'
        "Cover the lead (first) photo, lighting, clutter or empty rooms, the order the rooms appear in, duplicates, "
        "and whether obvious key shots (exterior, kitchen, living space, bedrooms, bathroom, garden) are missing. "
        "Give 3 to 6 findings, up to 8 weak photos and up to 4 actions. If the photos are genuinely strong, say so "
        "as a strength rather than inventing a problem."
    )


def enabled() -> bool:
    return (os.environ.get("ENABLE_PHOTO_REVIEW", "true").strip().lower() not in ("0", "false", "no")) and bool(
        (os.environ.get("OPENAI_API_KEY") or "").strip()
    )


def _content(urls: list[str], total: int, address: str, property_type: str | None) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "text", "text": _prompt(len(urls), total, address, property_type)}]
    for i, u in enumerate(urls, start=1):
        content.append({"type": "text", "text": f"Photo {i}"})
        content.append({"type": "image_url", "image_url": {"url": u, "detail": IMAGE_DETAIL}})
    return content


async def _ask(urls: list[str], total: int, *, address: str, property_type: str | None, model: str,
               timeout: float) -> dict[str, Any]:
    body = {
        "messages": [{"role": "system", "content": _SYSTEM},
                     {"role": "user", "content": _content(urls, total, address, property_type)}],
        "max_tokens": 1800,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    resp = await asyncio.wait_for(asyncio.to_thread(groq_service._openai_chat, model, body), timeout)
    return json.loads(resp.choices[0].message.content or "{}")


def _strings(items: Any, limit: int) -> list[str]:
    return [str(x).strip() for x in (items or []) if str(x).strip()][:limit]


async def review_photos(
    image_urls: Any, *, address: str, property_type: str | None, photo_count: int | None, model: str,
) -> dict[str, Any] | None:
    """Vision feedback on every listing photo, or None if there's nothing to
    review or the call fails."""
    urls = [u for u in (image_urls or []) if isinstance(u, str) and u.startswith("http")][:MAX_PHOTOS]
    if not urls:
        return None
    total = photo_count if isinstance(photo_count, int) and photo_count >= len(urls) else len(urls)
    seen = urls
    try:
        data = await _ask(urls, total, address=address, property_type=property_type, model=model,
                          timeout=FULL_TIMEOUT_SECONDS)
    except Exception as exc:  # noqa: BLE001 -- retry with fewer before giving up
        logger.warning("Full photo review failed for %s (%d photos): %s; retrying with %d",
                       address, len(urls), exc, FALLBACK_PHOTOS)
        if len(urls) <= FALLBACK_PHOTOS:
            return None
        seen = urls[:FALLBACK_PHOTOS]
        try:
            data = await _ask(seen, total, address=address, property_type=property_type, model=model,
                              timeout=FALLBACK_TIMEOUT_SECONDS)
        except Exception as exc2:  # noqa: BLE001 -- never break report generation
            logger.warning("Photo review failed for %s: %s", address, exc2)
            return None
    findings = [
        {"title": str(f["title"]).strip()[:80], "description": str(f["description"]).strip(),
         "type": "strength" if str(f.get("type")).lower() == "strength" else "issue"}
        for f in (data.get("findings") or [])
        if isinstance(f, dict) and str(f.get("title") or "").strip() and str(f.get("description") or "").strip()
    ]
    if not findings:
        return None
    weak = []
    for w in data.get("weak_photos") or []:
        try:
            n = int(w.get("photo"))
        except (AttributeError, TypeError, ValueError):
            continue
        if 1 <= n <= len(seen) and str(w.get("issue") or "").strip():
            weak.append({"photo": n, "issue": str(w["issue"]).strip()[:120]})
    return {
        "overall": str(data.get("overall") or "").strip(),
        "findings": findings[:6],
        "actions": _strings(data.get("actions"), 4),
        "rooms_shown": _strings(data.get("rooms_shown"), 25),
        "missing_shots": _strings(data.get("missing_shots"), 8),
        "order_notes": str(data.get("order_notes") or "").strip(),
        "weak_photos": weak[:8],
        "model": model,
        "photos_seen": len(seen),
        "photos_total": total,
    }
