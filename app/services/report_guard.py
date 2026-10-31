"""Checks every claim in an AI-written report against the facts we hold,
and removes the ones that don't hold up, before anyone sees them.

The report model only reads text: it never sees the photos. In Oct 2026 a
report told a seller her empty living room was "cluttered", that her
gallery had "a handful of images" (it had 23), that her description
"stops abruptly mid-sentence" (we had cut it at 800 characters) and that
her price was 7% above "recent sales nearby" (it had been given no sales).
She walked away. So, sentence by sentence:

- what a photo or room looks like: removed (nobody has seen them);
- photo / floor plan / tour counts: only as the Rightmove page counts them;
- "stops abruptly", "cut off": removed (that was our cut, not theirs);
- quotes: must appear word for word in the listing;
- the asking price, bedrooms and bathrooms: must match the listing;
- "on the market for N weeks": must fit how long it has been listed;
- sold prices, area averages, "% above the market": only from the Land
  Registry sales the report was given, and the numbers must check out.

Applied whenever a report is read (current_report_json), so reports stored
before these checks are cleaned too. Each removal is recorded with its
rule, for logging and the console's accuracy check.
"""
from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field
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
# A finding whose subject is the listing's photos or media.
_MEDIA_TOPIC = re.compile(
    r"\b(photo\w*|image\w*|picture\w*|gallery|visual\w*|imagery|virtual tours?|video|floor ?plans?|360)\b",
    re.IGNORECASE,
)
# Our cut of the description, blamed on the seller: "stops abruptly
# mid-sentence". Never something the model can know.
_TRUNCATED = re.compile(
    r"(mid-?sentence|mid-?word|stops? (abruptly|short|suddenly|mid)|ends? (abruptly|suddenly|mid)|"
    r"cut (off|short)|truncat\w*|trails? off|(unfinished|incomplete) (sentence|description|text|copy))",
    re.IGNORECASE,
)
# "No room sizes / measurements": only knowable if the model read it all.
_NO_MEASUREMENTS = re.compile(
    r"\b(no|without|lacks?|lacking|missing|omits?|omitting|absence of|absent|"
    r"(doesn'?t|does not|fails to) (include|mention|give|provide|state|list|quantify))\b[^.]{0,80}"
    r"\b(dimensions?|measurements?|room sizes?|sizes|square (feet|footage|metres|meters)|sq\.? ?ft|floor ?area)\b"
    r"|without quantifying",
    re.IGNORECASE,
)
# Reports written before Oct 2026 saw at most this much of the description
# (the scraper cut it at 800 characters); later ones read up to 4,000.
OLD_DESCRIPTION_CAP = 800
DESCRIPTION_LIMIT = 4000

_QUOTE = re.compile(r"[\"“”]([^\"“”]{3,200})[\"“”]|‘([^‘’]{3,200})’")
_MONEY = re.compile(r"£\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|million)?\b", re.IGNORECASE)
_PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s?(%|per ?cent)", re.IGNORECASE)
_ASKING = re.compile(
    r"\b(asking price|priced at|listed at|on the market at|guide price|marketed at)\b[^.£]{0,40}£", re.IGNORECASE)
# A comparison with sales or other homes: needs real sales behind it.
_MARKET = re.compile(
    r"\b(sold|recent sales|comparable sales|sales (nearby|in the area|data|evidence|history|around)|sold prices?|"
    r"sale prices?|achieved|average (asking |sold |sale )?price|area average|market average|local average|"
    r"price per (bedroom|square|sq)|per (bedroom|square (foot|feet|metre|meter)|sq\.? ?ft)|comparables?|"
    r"(similar|competing|comparable|nearby|neighbouring|other|equivalent) (homes|properties|listings|houses|flats|"
    r"semis|terraces|bungalows|stock))\b",
    re.IGNORECASE,
)
_PER_UNIT = re.compile(r"\bper (bedroom|square (foot|feet|metre|meter)|sq\.? ?ft|sqft)\b", re.IGNORECASE)
_COMPARE = re.compile(r"\b(above|below|higher|lower|more|less|cheaper|dearer|over|under|premium|discount)\b", re.IGNORECASE)
_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "single": 1, "a": 1, "an": 1,
}
_NUM = r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
_BEDS = re.compile(rf"\b{_NUM}[- ]bed(room)?s?\b", re.IGNORECASE)
_BATHS = re.compile(rf"\b{_NUM}[- ]bath(room)?s?\b", re.IGNORECASE)
_MEDIA_COUNT = re.compile(
    rf"\b(only |just )?{_NUM} (photo|photograph|image|picture|floor ?plan|virtual tour)s?\b", re.IGNORECASE)
_DAYS = re.compile(
    rf"\b(on the market|been listed|listed|unsold|for sale|sitting|sat|stale|live)\b[^.]{{0,25}}?"
    rf"\b(over |more than |nearly |almost |about |around |roughly |some |just over |under )?{_NUM} "
    r"(days?|weeks?|months?)\b"
    rf"|\b{_NUM} (days?|weeks?|months?) (on the market|listed|unsold|since (it was )?(listed|launched|going live))\b",
    re.IGNORECASE,
)
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class ReportFacts:
    """What a report's claims are checked against. Unknown facts are None
    (or empty): a claim about an unknown is removed only where the model
    could not have known it either."""

    asking_price: float | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    # Days on market: what the report could have been told (when written)
    # up to now.
    days_min: int | None = None
    days_max: int | None = None
    # Counted from the Rightmove page; media_given: the report was given them.
    media: dict[str, Any] = field(default_factory=dict)
    media_given: bool = False
    # Land Registry sales the report was given (the only ones it may cite).
    sale_prices: list[float] = field(default_factory=list)
    sales_given: bool = False
    # Title, description and key features: where quotes must come from.
    source_text: str = ""
    description_cut: bool = False


def _norm(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9£ ]+", " ", text.lower().replace("’", "'").replace("'", "")).split())


def _number(word: str) -> int | None:
    word = word.lower()
    return int(word) if word.isdigit() else _NUMBER_WORDS.get(word)


def _money(match: re.Match) -> float:
    value = float(match.group(1).replace(",", ""))
    unit = (match.group(2) or "").lower()
    return value * (1_000 if unit == "k" else 1_000_000 if unit in ("m", "million") else 1)


def _close(value: float, target: float, tolerance: float = 0.015) -> bool:
    return target > 0 and abs(value - target) <= target * tolerance


def _check(sentence: str, facts: ReportFacts) -> str | None:
    """The rule a sentence breaks, or None if it holds up."""
    media = facts.media if isinstance(facts.media, dict) else {}
    if _TRUNCATED.search(sentence):
        return "description_cut"
    if facts.description_cut and _NO_MEASUREMENTS.search(sentence):
        return "description_cut"
    if _SUBJECT.search(sentence) and _SEEN_STATE.search(sentence):
        return "unseen_photos"
    if _PERCEIVED.search(sentence):
        return "unseen_photos"
    if _MISSING_MEDIA.search(sentence):
        text = sentence.lower()
        checks = []
        if "floor" in text:
            checks.append(media.get("floorplans"))
        if any(w in text for w in ("tour", "360", "walkthrough", "video")):
            checks.append(media.get("virtual_tours"))
        if not facts.media_given or not checks or any(c != 0 for c in checks):
            return "media"
    for m in _MEDIA_COUNT.finditer(sentence):
        kind = m.group(3).lower().replace(" ", "")
        key = "floorplans" if kind.startswith("floor") else "virtual_tours" if kind.startswith("virtual") else "photos"
        if not facts.media_given or _number(m.group(2)) != media.get(key):
            return "media"
    for m in _QUOTE.finditer(sentence):
        quote = _norm(m.group(1) or m.group(2) or "")
        if len(quote.split()) >= 2 and quote not in _norm(facts.source_text):
            return "quote"
    if _ASKING.search(sentence) and facts.asking_price:
        first = _MONEY.search(sentence, _ASKING.search(sentence).start())
        if first and not _close(_money(first), facts.asking_price, 0.01):
            return "asking_price"
    if facts.bedrooms:
        for m in _BEDS.finditer(sentence):
            if _number(m.group(1)) not in (None, facts.bedrooms):
                return "bedrooms"
    if facts.bathrooms:
        for m in _BATHS.finditer(sentence):
            if _number(m.group(1)) not in (None, facts.bathrooms):
                return "bathrooms"
    for m in _DAYS.finditer(sentence):
        amount = _number(m.group(3) or m.group(5) or "")
        unit = (m.group(4) or m.group(6) or "").lower()
        if amount is None:
            continue
        days = amount * (30.4 if unit.startswith("month") else 7 if unit.startswith("week") else 1)
        if facts.days_min is None or facts.days_max is None:
            return "days_on_market"
        if not (facts.days_min * 0.8 - 7 <= days <= facts.days_max * 1.1 + 14):
            return "days_on_market"
    if _MARKET.search(sentence):
        if _PER_UNIT.search(sentence):
            return "market"  # no floor areas or bedrooms for the sales we hold
        amounts = [_money(m) for m in _MONEY.finditer(sentence)]
        percents = [float(m.group(1)) for m in _PERCENT.finditer(sentence)]
        if not (amounts or percents or _COMPARE.search(sentence)):
            return None  # a general remark, no figures or comparison
        if not facts.sales_given or not facts.sale_prices:
            return "market"
        for amount in amounts:
            if facts.asking_price and _close(amount, facts.asking_price, 0.01):
                continue
            if not any(_close(amount, price) for price in facts.sale_prices):
                return "market"
        if percents and facts.asking_price:
            actual = [
                abs(facts.asking_price / statistics.mean(facts.sale_prices) - 1) * 100,
                abs(facts.asking_price / statistics.median(facts.sale_prices) - 1) * 100,
            ]
            if not any(any(abs(p - a) <= 3 for a in actual) for p in percents):
                return "market"
    return None


def clean_text(text: Any, facts: ReportFacts | None = None, removed: list | None = None, where: str = "") -> str:
    if not isinstance(text, str) or not text:
        return text if isinstance(text, str) else ""
    facts = facts or ReportFacts()
    paragraphs = []
    for para in text.split("\n\n"):
        kept = []
        for sentence in _SENTENCE.split(para.strip()):
            if not sentence:
                continue
            rule = _check(sentence, facts)
            if rule:
                if removed is not None:
                    removed.append({"rule": rule, "where": where, "text": sentence[:300]})
                continue
            kept.append(sentence)
        if kept:
            paragraphs.append(" ".join(kept))
    return "\n\n".join(paragraphs)


def is_media_finding(item: dict[str, Any]) -> bool:
    """A key finding about the current photos, floor plan or tour."""
    return item.get("icon") == "photos" or bool(_MEDIA_TOPIC.search(str(item.get("title") or "")))


def _clean_items(
    items: Any, fields: tuple[str, ...], facts: ReportFacts, must_keep: str, *, findings: bool = False,
    removed: list | None = None, where: str = "",
) -> list:
    out = []
    for i, item in enumerate(items or []):
        if not isinstance(item, dict):
            continue
        place = f"{where}[{i}]"
        # Without the counts the model could only guess about the media, so
        # the whole finding goes, title included ("Sparse visual storytelling").
        if findings and is_media_finding(item) and not facts.media_given:
            if removed is not None:
                removed.append({"rule": "unseen_photos", "where": place, "text": str(item.get("title") or "")[:300]})
            continue
        title_rule = _check(str(item.get("title") or ""), facts) if findings else None
        if title_rule:
            if removed is not None:
                removed.append({"rule": title_rule, "where": place, "text": str(item.get("title") or "")[:300]})
            continue
        item = dict(item)
        for f in fields:
            if f in item:
                item[f] = clean_text(item[f], facts, removed, f"{place}.{f}")
        if "bullets" in item and isinstance(item["bullets"], list):
            item["bullets"] = [b for b in (clean_text(x, facts, removed, f"{place}.bullets") for x in item["bullets"]) if b]
        if item.get(must_keep):
            out.append(item)
        elif removed is not None:
            removed.append({"rule": "emptied", "where": place, "text": str(item.get("title") or "")[:300]})
    return out


def clean_findings(findings: Any, facts: ReportFacts | None = None, removed: list | None = None) -> list:
    """Key findings (or a preview's key_issues) with every claim checked."""
    return _clean_items(
        findings, ("description", "evidence", "impact", "recommend"), facts or ReportFacts(), "description",
        findings=True, removed=removed, where="key_findings",
    )


def clean_report(
    report: dict[str, Any], facts: ReportFacts | None = None, *, ai_written: bool = True, removed: list | None = None,
) -> dict[str, Any]:
    """A copy of the report with every claim checked. A report edited by a
    person (an analyst who looked at the listing) keeps its wording; only the
    invented competing listings go."""
    if not isinstance(report, dict):
        return report
    out = dict(report)
    out["active_competition"] = []
    if not ai_written:
        return out
    facts = facts or ReportFacts()
    out["key_findings"] = clean_findings(report.get("key_findings"), facts, removed)
    out["action_plan"] = _clean_items(
        report.get("action_plan"), ("description", "why_it_matters"), facts, "title", removed=removed, where="action_plan")
    for key in ("executive_summary", "pricing_recommendation_detail"):
        if key in report:
            out[key] = clean_text(report.get(key), facts, removed, key)
    return out
