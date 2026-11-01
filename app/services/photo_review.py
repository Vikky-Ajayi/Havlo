"""Real photo feedback: send the listing's actual photos to the vision model
and let it say what a buyer sees.

gpt-oss-120b (text only) never saw the photos — that's why it invented
"the living room appears cluttered" about an empty room. gpt-6.1-terra can
see images, so here it looks at the real photos and gives specific,
grounded presentation feedback. Each observation is flagged
`_photo_verified`, so the claim checks (report_guard) keep it — we have
genuinely seen the photos — while the text report writer still may not
describe photos it hasn't seen.

One cheap call per prospect (low-detail images), reused for the free
preview and the full report. Never raises: if it fails, the report is
simply served without photo feedback.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from app.services import groq_service

logger = logging.getLogger(__name__)

# Enough photos to judge the lead shot, lighting, clutter, staging, order and
# whether key shots are missing, without a big bill. Low detail (512px) is
# plenty for those; raise it if you want finer quality judgements.
MAX_PHOTOS = 8
IMAGE_DETAIL = "low"

_SYSTEM = (
    "You are a UK estate agent reviewing the photographs on a property listing, exactly as a buyer "
    "scrolling a portal sees them. You can see the images provided. Judge ONLY what is clearly visible in "
    "them. Never invent a room or feature that is not shown, and never guess at anything the photos don't "
    "show. Be specific, practical and fair."
)


def _prompt(shown: int, total: int, address: str, property_type: str | None) -> str:
    return (
        f"These are {shown} of the {total} photos on the listing for {address} "
        f"({property_type or 'home'}). Looking only at what the photos actually show, assess how the "
        "property is presented to a buyer. Return JSON:\n"
        '{"overall": "one sentence on the impression the photos give a buyer",\n'
        ' "findings": [{"title": "<=8 words", "description": "2-3 sentences on ONE specific, visible '
        'presentation issue or strength and why it affects buyer interest", "type": "issue" or "strength"}],\n'
        ' "actions": ["one concrete fix the seller can make", ...]}\n'
        "Cover, where visible: the lead (first) photo, lighting and brightness, clutter or empty/unstaged "
        "rooms, the order the rooms are shown in, and whether obvious key shots (exterior/kerb view, kitchen, "
        "bathroom, garden) appear to be missing. Give 2 to 4 findings and up to 3 actions. If the photos are "
        "genuinely strong, say so as a strength rather than inventing a problem."
    )


def enabled() -> bool:
    return (os.environ.get("ENABLE_PHOTO_REVIEW", "true").strip().lower() not in ("0", "false", "no")) and bool(
        (os.environ.get("OPENAI_API_KEY") or "").strip()
    )


async def review_photos(
    image_urls: Any, *, address: str, property_type: str | None, photo_count: int | None, model: str,
) -> dict[str, Any] | None:
    """Vision feedback on the listing photos, or None if there's nothing to
    review or the call fails."""
    urls = [u for u in (image_urls or []) if isinstance(u, str) and u.startswith("http")][:MAX_PHOTOS]
    if not urls:
        return None
    total = photo_count if isinstance(photo_count, int) and photo_count >= len(urls) else len(urls)
    content: list[dict[str, Any]] = [{"type": "text", "text": _prompt(len(urls), total, address, property_type)}]
    content += [{"type": "image_url", "image_url": {"url": u, "detail": IMAGE_DETAIL}} for u in urls]
    body = {
        "messages": [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": content}],
        "max_tokens": 900,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    try:
        resp = await asyncio.to_thread(groq_service._openai_chat, model, body)
        data = json.loads(resp.choices[0].message.content or "{}")
    except Exception as exc:  # noqa: BLE001 -- never break report generation
        logger.warning("Photo review failed for %s: %s", address, exc)
        return None
    findings = [
        {"title": str(f["title"]).strip()[:80], "description": str(f["description"]).strip(),
         "type": "strength" if str(f.get("type")).lower() == "strength" else "issue"}
        for f in (data.get("findings") or [])
        if isinstance(f, dict) and str(f.get("title") or "").strip() and str(f.get("description") or "").strip()
    ]
    if not findings:
        return None
    return {
        "overall": str(data.get("overall") or "").strip(),
        "findings": findings[:4],
        "actions": [str(a).strip() for a in (data.get("actions") or []) if str(a).strip()][:3],
        "model": model,
        "photos_seen": len(urls),
    }
