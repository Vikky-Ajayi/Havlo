"""Removes claims from AI-written reports that nobody has checked.

The report model only reads the listing's text: it never sees the photos.
It still wrote things like "the living room appears cluttered" about an
empty room, which cost a sale. So any sentence that describes what the
photos or rooms look like is removed, along with "no floor plan" / "no
virtual tour" claims we can't confirm, and the made-up competing listings
the model was once asked for. Applied when a report is read, so reports
already stored are cleaned as well.
"""
from __future__ import annotations

import re
from typing import Any

_SUBJECT = re.compile(
    r"\b(photo\w*|image\w*|picture\w*|gallery|shots?|visual\w*|camera|living room|lounge|kitchen|bedrooms?|"
    r"bathrooms?|conservatory|garden|hallway|dining|reception|interiors?|exterior|frontage|fa[cç]ade|rooms?)\b",
    re.IGNORECASE,
)
# What a room or photo looks like: only someone who saw it can say.
_SEEN_STATE = re.compile(
    r"(clutter|personal (items|belongings|effects|possessions)|natural light|poorly lit|badly lit|\bdim(ly)?\b|"
    r"\bdark(er)?\b|\bdated\b|gloomy|cramped|single angle|one angle|same angle|unfurnished|without furniture|no furniture|"
    r"\bempty\b|\bbare\b|messy|untidy|\btired\b|blurr|grainy|low[- ]resolution|countertop|worktop finish|"
    r"over-?exposed|under-?exposed|washed[- ]out|lifeless|uninviting|sterile|unfinished|well[- ]lit|"
    r"\bbright(ly)?\b|\bstaged\b|unstaged|d[eé]cor|wallpaper|overcast|handful of|only a few|sparse|"
    r"limited (number of )?(photo|image|picture))",
    re.IGNORECASE,
)
_MISSING_MEDIA = re.compile(
    r"\b(no|without|lacks?|lacking|missing|absence of|absent|not include|doesn'?t include|does not include|"
    r"not available|unavailable)\b[^.]{0,60}\b(floor ?plans?|virtual tours?|video tours?|360|walkthrough|video)\b"
    r"|\b(floor ?plans?|virtual tours?|video tours?|360[- ]degree view|walkthrough)\b[^.]{0,40}"
    r"\b(is|are) (missing|absent|not available|unavailable)\b",
    re.IGNORECASE,
)
# A photo or room described as if seen: "the photos show...", "the lounge
# looks...", "rooms appear...".
_PERCEIVED = re.compile(
    r"\b(photo\w*|image\w*|picture\w*|gallery|shots?|visuals?|living room|lounge|kitchen|bedrooms?|bathrooms?|"
    r"conservatory|garden|hallway|interiors?|exterior|rooms?|spaces?)\b[^.]{0,60}?"
    r"\b(appears?|appearing|looks?|looking|seems?|feels?|shows?|showing|shown|captured|captures|depicts?|reveals?)\b",
    re.IGNORECASE,
)
# A finding whose subject is the listing's photos or media: the model has
# never seen them, so the whole finding goes, title included.
_MEDIA_TOPIC = re.compile(
    r"\b(photo\w*|image\w*|picture\w*|gallery|visual\w*|imagery|virtual tours?|video|floor ?plans?|360)\b",
    re.IGNORECASE,
)
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def _unverified(sentence: str, media: dict[str, Any]) -> bool:
    if _SUBJECT.search(sentence) and _SEEN_STATE.search(sentence):
        return True
    if _PERCEIVED.search(sentence):
        return True
    if _MISSING_MEDIA.search(sentence):
        # Only keep "no floor plan / tour" when Rightmove told us there are none.
        text = sentence.lower()
        checks = []
        if "floor" in text:
            checks.append(media.get("floorplans"))
        if any(w in text for w in ("tour", "360", "walkthrough", "video")):
            checks.append(media.get("virtual_tours"))
        return not checks or any(c != 0 for c in checks)
    return False


def clean_text(text: Any, media: dict[str, Any]) -> str:
    if not isinstance(text, str) or not text:
        return text if isinstance(text, str) else ""
    paragraphs = []
    for para in text.split("\n\n"):
        kept = [s for s in _SENTENCE.split(para.strip()) if s and not _unverified(s, media)]
        if kept:
            paragraphs.append(" ".join(kept))
    return "\n\n".join(paragraphs)


def is_media_finding(item: dict[str, Any]) -> bool:
    """A key finding about the current photos, floor plan or tour."""
    return item.get("icon") == "photos" or bool(_MEDIA_TOPIC.search(str(item.get("title") or "")))


def _clean_items(
    items: Any, fields: tuple[str, ...], media: dict[str, Any], must_keep: str, *, drop_media: bool = False,
) -> list:
    out = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        if drop_media and is_media_finding(item):
            continue
        item = dict(item)
        for f in fields:
            if f in item:
                item[f] = clean_text(item[f], media)
        if "bullets" in item and isinstance(item["bullets"], list):
            item["bullets"] = [b for b in (clean_text(x, media) for x in item["bullets"]) if b]
        if item.get(must_keep):
            out.append(item)
    return out


def clean_findings(findings: Any, media: dict[str, Any] | None = None) -> list:
    """Key findings (or a preview's key_issues) without the ones about the
    photos or media, and without unverified sentences in the rest."""
    return _clean_items(
        findings, ("description", "evidence", "impact", "recommend"), media if isinstance(media, dict) else {},
        "description", drop_media=True,
    )


def clean_report(report: dict[str, Any], media: dict[str, Any] | None = None, *, ai_written: bool = True) -> dict[str, Any]:
    """A copy of the report without unverified claims. A report edited by a
    person (an analyst who looked at the listing) keeps its wording; only the
    invented competing listings go."""
    if not isinstance(report, dict):
        return report
    out = dict(report)
    out["active_competition"] = []
    if not ai_written:
        return out
    media = media if isinstance(media, dict) else {}
    out["key_findings"] = clean_findings(report.get("key_findings"), media)
    out["action_plan"] = _clean_items(
        report.get("action_plan"), ("description", "why_it_matters"), media, "title")
    for key in ("executive_summary", "pricing_recommendation_detail"):
        if key in report:
            out[key] = clean_text(report.get(key), media)
    return out
