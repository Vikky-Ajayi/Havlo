"""The senior-partner pass over a 20-factor report.

Writing all twenty factors in two requests still produces some that only
repeat what the seller already knows ("your price was reduced 118 days ago
and it hasn't sold"), stay generic, or repeat another factor. This pass reads
the written factors next to their facts, the way a senior agent checks a
junior's report before it goes to a paying client, and rewrites only the ones
that fail: each must tell the seller something they didn't know and give them
a specific step. Verdicts never change, and the claim checks run afterwards
(report_writer.finalize_report). One AI call; never raises.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.services import groq_service

logger = logging.getLogger(__name__)

# A rewrite may tighten, but not gut, what was there.
MIN_LENGTH_RATIO = 0.6


def _prompt(items: list[dict[str, Any]], *, agent: bool, rules: str, tone: str) -> str:
    whose = "this property" if agent else "your property"
    return "\n".join([
        f"You are the senior partner checking a junior's assessment of {whose} before it goes to a client who has "
        "paid for it. Read every factor against its facts and the guidance on what it should tell them.",
        "",
        "A factor FAILS if it: only repeats what the seller already knows (their price, how long it has been, their "
        "own features) without saying what that means; gives generic advice that would fit any home; hedges instead "
        "of judging; repeats a point another factor already makes; or its action isn't a specific step (a number, "
        "the wording, a deadline, exactly what to ask for and what to do with the answer).",
        "Rewrite ONLY the factors that fail. Keep each one's verdict and every figure it uses correctly. Bring the "
        "insight the guidance asks for: what it means for buyers, why it's happening, what usually fixes it. Keep "
        "the same structure: found (3-5 sentences), why (2-3 sentences), action (2-4 sentences).",
        "",
        rules,
        "",
        f"The factors: {json.dumps(items, ensure_ascii=False, default=str)}",
        "",
        'Return JSON only: {"rewrites": [{"key": "...", "reason": "why it failed, in a few words", "found": "...", '
        '"why": "...", "action": "..."}]} with an empty list if every factor is good.',
        "",
        "Tone:", tone,
    ])


def _long_enough(before: str, after: str) -> bool:
    return bool(after) and len(after) >= MIN_LENGTH_RATIO * len(before or "")


async def edit_report(report: dict[str, Any], facts: dict[str, Any], *, agent: bool = False,
                      keys: set[str] | None = None, snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    """Rewrite the weak factors (all of them, or just `keys`). Returns the
    report with `_edited` listing what changed; unchanged if nothing fails or
    the call fails."""
    import asyncio

    from app.services import report_writer as rw

    factors = [f for f in report.get("factors") or [] if isinstance(f, dict)]
    chosen = [f for f in factors if keys is None or f.get("key") in keys]
    if not chosen:
        return report
    items = [{
        "key": f.get("key"), "factor": f.get("name"), "verdict": f.get("verdict"),
        "found": f.get("found"), "why": f.get("why"), "action": f.get("action"),
        "should_tell_them": rw.FACTOR_GUIDE.get(str(f.get("key")), ""),
        "facts": (facts.get(f.get("key")) or {}).get("data") or {},
    } for f in chosen]
    prompt = _prompt(items, agent=agent, rules=rw.JUDGEMENT_RULES, tone=rw.TONE_INSTRUCTION)
    system = ("You are a senior UK estate agent and valuer reviewing a report for a paying client. "
              "Return only valid JSON.")

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            max_tokens=9000, temperature=0.3, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        data = json.loads(await asyncio.to_thread(_call))
    except Exception:  # noqa: BLE001 -- the report stands as written
        logger.exception("Report editor pass failed")
        return report
    rewrites = {str(r.get("key")): r for r in (data.get("rewrites") or []) if isinstance(r, dict)}
    out = dict(report)
    edited = []
    new_factors = []
    for f in factors:
        r = rewrites.get(str(f.get("key")))
        if r and (keys is None or f.get("key") in keys):
            changed = {}
            for k in ("found", "why", "action"):
                text = str(r.get(k) or "").strip()
                if snapshot is not None:
                    text = rw.scrub_place_names(text, snapshot, agent=agent)
                if _long_enough(str(f.get(k) or ""), text):
                    changed[k] = text
            if changed:
                f = {**f, **changed}
                edited.append({"key": f.get("key"), "reason": str(r.get("reason") or "")[:160]})
        new_factors.append(f)
    out["factors"] = new_factors
    out["_edited"] = edited
    return out
