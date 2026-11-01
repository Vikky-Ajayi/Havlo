"""Catches AI-sounding text in a 20-factor report and rewrites only the
paragraphs that fail.

The plan's section C: a tone check in code flags banned phrases, long
sentences, jargon and repeated openings. Only the failing factors get a
quick plain-English rewrite (one AI call), then the accuracy checks run
again. No human review. Detection here is pure and testable; the rewrite
reuses groq_service._report_chat and is easy to mock.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services import groq_service

logger = logging.getLogger(__name__)

# Words and habits that read as AI, from the owner's instruction.
_BANNED_PHRASES = (
    "leverage", "navigate", "crucially", "it's worth noting", "it is worth noting", "in today's market",
    "furthermore", "proposition", "narrative", "optimise", "optimize", "moreover", "utilise", "utilize",
    "in conclusion", "that being said", "when it comes to", "at the end of the day",
)
_BANNED_RE = re.compile(r"\b(" + "|".join(re.escape(p) for p in _BANNED_PHRASES) + r")\b", re.IGNORECASE)
_EM_DASH = re.compile(r"\s[—–]\s|\w—\w")
_NOT_JUST = re.compile(r"\bnot just\b[^.]{0,60}\bbut\b", re.IGNORECASE)
# Three adjectives in a row: "a bright, spacious, modern home".
_THREE_ADJECTIVES = re.compile(r"\b\w+ly?\b,\s+\b\w+\b,\s+and\s+\b\w+\b", re.IGNORECASE)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
MAX_SENTENCE_WORDS = 34


def _sentences(text: str) -> list[str]:
    return [s for s in _SENTENCE_SPLIT.split(str(text or "").strip()) if s]


def tone_issues(text: str) -> list[str]:
    """Every tone problem in a piece of text (empty when it reads clean)."""
    text = str(text or "")
    issues: list[str] = []
    for m in _BANNED_RE.finditer(text):
        issues.append(f"banned phrase: {m.group(0).lower()}")
    if _EM_DASH.search(text):
        issues.append("dash dropped into a sentence")
    if _NOT_JUST.search(text):
        issues.append("'not just X but Y'")
    if _THREE_ADJECTIVES.search(text):
        issues.append("list of three adjectives")
    for s in _sentences(text):
        if len(s.split()) > MAX_SENTENCE_WORDS:
            issues.append("sentence too long")
            break
    return issues


def _factor_text(factor: dict[str, Any]) -> str:
    return " ".join(str(factor.get(k) or "") for k in ("found", "why", "action"))


def report_tone_issues(report: dict[str, Any]) -> dict[str, list[str]]:
    """Which factors read as AI, plus repeated paragraph openings across them."""
    issues: dict[str, list[str]] = {}
    openings: dict[str, list[str]] = {}
    for f in report.get("factors") or []:
        if not isinstance(f, dict):
            continue
        key = str(f.get("key"))
        found = tone_issues(_factor_text(f))
        if found:
            issues[key] = found
        words = str(f.get("found") or "").split()
        if words:
            openings.setdefault(" ".join(words[:2]).lower(), []).append(key)
    for opening, keys in openings.items():
        if len(keys) >= 2:  # same two-word opening on two or more factors
            for key in keys:
                issues.setdefault(key, []).append(f"repeated opening: {opening}")
    return issues


def _rewrite_prompt(factors: list[dict[str, Any]], *, agent: bool) -> str:
    whose = "this property" if agent else "your property"
    items = [
        {"key": f.get("key"), "found": f.get("found"), "why": f.get("why"), "action": f.get("action")}
        for f in factors
    ]
    return (
        f"Rewrite these property-report paragraphs for {whose} in plain, natural English, keeping the exact same "
        "meaning and every real figure. Fix anything that sounds like AI.\n"
        "Rules: short sentences (under 30 words). Everyday words. Use contractions. No dashes dropped into "
        "sentences. Never use: leverage, navigate, crucially, it's worth noting, in today's market, furthermore, "
        'proposition, narrative, optimise. No "not just X but Y". No lists of three adjectives. Don\'t start two '
        "paragraphs the same way.\n\n"
        f"Paragraphs:\n{json.dumps(items, ensure_ascii=False)}\n\n"
        'Return JSON: {"rewrites": [{"key": "...", "found": "...", "why": "...", "action": "..."}, ...]}'
    )


async def fix_report_tone(report: dict[str, Any], *, agent: bool = False) -> dict[str, Any]:
    """Rewrite only the factors that read as AI, in one call. The report is
    returned unchanged when nothing fails or the rewrite call fails."""
    import asyncio

    issues = report_tone_issues(report)
    if not issues:
        return report
    failing = [f for f in report.get("factors") or [] if isinstance(f, dict) and str(f.get("key")) in issues]
    prompt = _rewrite_prompt(failing, agent=agent)

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": "You rewrite text in a plain human voice. Return only JSON."},
                      {"role": "user", "content": prompt}],
            max_tokens=2600, temperature=0.4, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        data = json.loads(await asyncio.to_thread(_call))
        rewrites = {str(r.get("key")): r for r in (data.get("rewrites") or []) if isinstance(r, dict)}
    except Exception:  # noqa: BLE001 -- a failed rewrite leaves the report as it was
        logger.exception("Tone rewrite failed")
        return report
    out = dict(report)
    factors = []
    for f in report.get("factors") or []:
        r = rewrites.get(str(f.get("key"))) if isinstance(f, dict) else None
        if r:
            f = {**f, **{k: str(r[k]) for k in ("found", "why", "action") if r.get(k)}}
        factors.append(f)
    out["factors"] = factors
    out["_tone_fixed"] = sorted(issues)
    return out
