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
# Three adjectives before a noun: "a bright, spacious and modern home". A
# plain list of three things ("views, enquiries and viewings") is fine.
_THREE_ADJECTIVES = re.compile(r"\b(?:a|an)\s+\w+,\s+\w+,?\s+and\s+\w+\s+(?:home|house|property|flat|space|room|kitchen|garden)\b",
                               re.IGNORECASE)
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
MAX_SENTENCE_WORDS = 40
# Only flag repeated openings when this many factors start the same way.
REPEATED_OPENING_MIN = 4
_FIGURE = re.compile(r"£\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|million))?|\d+(?:\.\d+)?\s?%", re.IGNORECASE)


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
        if len(words) >= 3:
            openings.setdefault(" ".join(words[:3]).lower(), []).append(key)
    for opening, keys in openings.items():
        if len(keys) >= REPEATED_OPENING_MIN:
            for key in keys[1:]:  # leave the first as it is; vary the rest
                issues.setdefault(key, []).append(f"repeated opening: {opening}")
    return issues


def _rewrite_prompt(factors: list[dict[str, Any]], *, agent: bool, issues: dict[str, list[str]] | None = None) -> str:
    whose = "this property" if agent else "your property"
    items = [
        {"key": f.get("key"), "fix": (issues or {}).get(str(f.get("key"))) or [],
         "found": f.get("found"), "why": f.get("why"), "action": f.get("action")}
        for f in factors
    ]
    return (
        f"Edit these property-report paragraphs for {whose}. Fix only the problems listed under \"fix\" for each "
        "one, in plain, natural English.\n"
        "Keep every fact, every figure, every step and the same length. Don't summarise or shorten. Don't add "
        "anything new.\n"
        "Rules: sentences under 30 words. Everyday words. Use contractions. No dashes dropped into sentences. Never "
        "use: leverage, navigate, crucially, it's worth noting, in today's market, furthermore, proposition, "
        'narrative, optimise. No "not just X but Y". For a repeated opening, start that paragraph a different way.\n\n'
        f"Paragraphs:\n{json.dumps(items, ensure_ascii=False)}\n\n"
        'Return JSON: {"rewrites": [{"key": "...", "found": "...", "why": "...", "action": "..."}, ...]}'
    )


def _keeps_substance(before: str, after: str) -> bool:
    """A rewrite is only taken if it keeps every £ figure and percentage and
    isn't much shorter: a tone fix must never cost the seller content."""
    if not after:
        return False
    norm = lambda s: re.sub(r"\s+", "", s.lower())  # noqa: E731
    figures_before = {norm(m.group(0)) for m in _FIGURE.finditer(before or "")}
    figures_after = {norm(m.group(0)) for m in _FIGURE.finditer(after)}
    if not figures_before <= figures_after:
        return False
    return len(after) >= 0.75 * len(before or "")


async def fix_report_tone(report: dict[str, Any], *, agent: bool = False) -> dict[str, Any]:
    """Rewrite only the factors that read as AI, in one call. A rewritten field
    is kept only if it keeps all the figures and most of the length; the report
    is returned unchanged when nothing fails or the rewrite call fails."""
    import asyncio

    issues = report_tone_issues(report)
    if not issues:
        return report
    failing = [f for f in report.get("factors") or [] if isinstance(f, dict) and str(f.get("key")) in issues]
    prompt = _rewrite_prompt(failing, agent=agent, issues=issues)

    def _call() -> str:
        resp = groq_service._report_chat(
            messages=[{"role": "system", "content": "You edit text into a plain human voice. Return only JSON."},
                      {"role": "user", "content": prompt}],
            max_tokens=9000, temperature=0.3, response_format={"type": "json_object"})
        return resp.choices[0].message.content or "{}"

    try:
        data = json.loads(await asyncio.to_thread(_call))
        rewrites = {str(r.get("key")): r for r in (data.get("rewrites") or []) if isinstance(r, dict)}
    except Exception:  # noqa: BLE001 -- a failed rewrite leaves the report as it was
        logger.exception("Tone rewrite failed")
        return report
    out = dict(report)
    factors = []
    fixed = []
    for f in report.get("factors") or []:
        r = rewrites.get(str(f.get("key"))) if isinstance(f, dict) else None
        if r:
            changed = {k: str(r[k]) for k in ("found", "why", "action")
                       if r.get(k) and _keeps_substance(str(f.get(k) or ""), str(r[k]))}
            if changed:
                f = {**f, **changed}
                fixed.append(str(f.get("key")))
        factors.append(f)
    out["factors"] = factors
    out["_tone_fixed"] = sorted(fixed)
    return out
