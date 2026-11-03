"""The 20-factor report as a properly laid-out A4 PDF (ReportLab), instead of
the browser printing the web page.

Same content and order as the report page (StaleProspectWizard.tsx's v2
FullReportStep): the property and score, the executive summary, the score
bars, the three most important actions, the price comparison, the 30-day
plan, all 20 factors in order, then the optional services, sharing with the
agent, and how the assessment is made. Built from the stored report on
request, never cached, so it always matches the page.

`factor_cards` is shared with the agent report PDF (agent_report_pdf.py).
"""
from __future__ import annotations

import logging
import os
import statistics
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from app.services import land_registry
from app.services import stale_prospect_service as sps

logger = logging.getLogger(__name__)

# Score bars from the verdicts (the page's scoresFromFactors in reportParts.tsx).
SCORE_LABELS = {
    "pricing": "Pricing", "listing_presentation": "Listing presentation", "market_positioning": "Market positioning",
    "competition": "Competition", "buyer_appeal": "Buyer appeal",
}
AREA_FACTORS = {
    "pricing": ("visibility", "asking_price", "pricing_range", "comparable_sold", "reduction_history", "affordability"),
    "listing_presentation": ("photography", "description", "floor_plan", "agent_marketing"),
    "market_positioning": ("positioning", "time_on_market", "buyer_objections"),
    "competition": ("active_competition", "buyer_demand"),
    "buyer_appeal": ("target_buyer", "condition_readiness", "positioning", "buyer_objections"),
}
PROBLEM_POINTS = {5: 20, 4: 35, 3: 50, 2: 62, 1: 72}
# The 30-day plan's task for each problem (the page's PLAN_TASK).
PLAN_TASK = {
    "visibility": "Move to the next search price step", "asking_price": "Get evidence for your asking price",
    "pricing_range": "Agree your price plan and its trigger", "comparable_sold": "Get sales of homes like yours",
    "active_competition": "Check your price against what's for sale",
    "buyer_demand": "Review buyer demand with your agent", "time_on_market": "Reset the listing",
    "reduction_history": "Decide your next price move", "photography": "Fix the photos, starting with the lead image",
    "description": "Fill the gaps in your description", "floor_plan": "Add or improve the floor plan",
    "positioning": "Lead with your best features", "target_buyer": "Aim the marketing at the right buyers",
    "buyer_objections": "Answer buyers' doubts before they view", "agent_marketing": "Upgrade the marketing",
    "condition_readiness": "Gather your sale paperwork now",
    "affordability": "Make the price work for buyers' budgets", "net_proceeds": "Work out what you'll walk away with",
}
VERDICT_ORDER = ("problem", "check_with_agent", "working_well")
FIGURE_KEYS = ("engagement", "viewing_conversion")
SHARE_CLAUSE = (
    "You're welcome to share this report with your estate agent, in full or in part, so they can put its "
    "recommendations into practice. Forward this PDF or send them the link to your online report, and go through "
    "the actions together at your next review."
)
AGENT_SHARE_CLAUSE = (
    "You're welcome to share this report with your vendor, in full or in part, to agree the next steps together. "
    "Every figure in it comes from the listing, HM Land Registry or the homes for sale around it."
)

if not sps._PDF_LIBS_IMPORT_ERROR:
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        CondPageBreak, Image as RLImage, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    W = sps._REPORT_CONTENT_W
    INK, MUTED, ACCENT, ACCENT_PALE = sps._LETTER_INK, sps._LETTER_MUTED, sps._LETTER_ACCENT, sps._LETTER_ACCENT_PALE
    BORDER = sps._LETTER_CARD_BORDER
    TRAY = colors.HexColor("#F5F6F8")
    VERDICTS = {
        "problem": ("Problem", sps._LETTER_RED, sps._REPORT_RED_BG),
        "working_well": ("Working well", sps._LETTER_GREEN, sps._REPORT_GREEN_BG),
        "check_with_agent": ("Check with your agent", ACCENT, ACCENT_PALE),
    }


def scores_from_factors(factors: list[dict[str, Any]]) -> dict[str, int]:
    by_key = {f.get("key"): f for f in factors}
    out: dict[str, int] = {}
    for area, keys in AREA_FACTORS.items():
        points = []
        for k in keys:
            f = by_key.get(k)
            if not f:
                continue
            v = f.get("verdict")
            points.append(85 if v == "working_well" else PROBLEM_POINTS.get(f.get("severity") or 3, 50)
                          if v == "problem" else 60)
        if points:
            out[area] = round(sum(points) / len(points))
    return out


def plan_boxes(factors: list[dict[str, Any]], top_actions: list[dict[str, Any]]) -> list[tuple[str, str, list[str]]]:
    """The three 30-day plan boxes, as the page builds them."""
    order = {v: i for i, v in enumerate(VERDICT_ORDER)}
    ranked = sorted(factors, key=lambda f: (order.get(f.get("verdict") or "working_well", 2),
                                            -(f.get("severity") or 0), f.get("num") or 0))
    problems = [f for f in ranked if f.get("verdict") == "problem"]
    box1 = [t["title"] for t in top_actions if t.get("title")] or [
        PLAN_TASK.get(f.get("key") or "", f.get("name") or "") for f in problems[:3]]
    have_figures = {f.get("key") for f in factors if f.get("owner_figures")}
    box2: list[str] = []
    standing = [] if "engagement" in have_figures else ["Get your listing figures from your agent"]
    for t in standing + ["Get written feedback after every viewing"] + [
            PLAN_TASK.get(f.get("key") or "", f.get("name") or "") for f in problems[3:]]:
        if t and t not in box2 and t not in box1:
            box2.append(t)
    return [
        ("Days 1–10", "Fix the fundamentals", box1),
        ("Days 11–20", "Build momentum", box2[:5]),
        ("Days 21–30", "Decide the next move", [
            "Compare viewings and feedback with before your changes",
            "Hold, change the price or relaunch, using the pricing scenarios in this report",
        ]),
    ]


def _esc(text: Any) -> str:
    return sps._letter_esc("" if text is None else str(text))


def _money(n: Any) -> str:
    try:
        return f"£{round(float(n)):,}" if n else "—"
    except (TypeError, ValueError):
        return "—"


def _month(iso: Any) -> str:
    try:
        d = date.fromisoformat(str(iso or "")[:10])
    except ValueError:
        return ""
    return f"{d:%b %Y}"


def _day(iso: Any) -> str:
    try:
        d = date.fromisoformat(str(iso or "")[:10])
    except ValueError:
        return ""
    return f"{d.day} {d:%b %Y}"


def _styles() -> dict[str, "ParagraphStyle"]:
    s = sps._report_styles()
    B, BOLD, XBOLD = sps._LETTER_FONT_REGULAR, sps._LETTER_FONT_BOLD, sps._LETTER_FONT_EXTRABOLD
    s.update({
        "eyebrow": ParagraphStyle("eyebrow", fontName=BOLD, fontSize=7.6, leading=10, textColor=ACCENT, spaceAfter=3),
        "title": ParagraphStyle("title", fontName=XBOLD, fontSize=19, leading=23, textColor=INK, spaceAfter=3),
        "section": ParagraphStyle("section", fontName=XBOLD, fontSize=14, leading=18, textColor=INK, spaceAfter=7),
        "kpi_label": ParagraphStyle("kpi_label", fontName=BOLD, fontSize=7.2, leading=9.5, textColor=MUTED),
        "kpi_value": ParagraphStyle("kpi_value", fontName=XBOLD, fontSize=14.5, leading=18, textColor=INK),
        "kpi_sub": ParagraphStyle("kpi_sub", fontName=B, fontSize=7.4, leading=9.6, textColor=MUTED),
        "label": ParagraphStyle("label", fontName=BOLD, fontSize=7, leading=9, textColor=MUTED, spaceAfter=2),
        "factor_title": ParagraphStyle("factor_title", fontName=BOLD, fontSize=11, leading=14, textColor=INK),
        "factor_num": ParagraphStyle("factor_num", fontName=BOLD, fontSize=9, leading=11, textColor=INK, alignment=1),
        "text": ParagraphStyle("text", fontName=B, fontSize=9, leading=13.4, textColor=INK),
        "cell": ParagraphStyle("cell", fontName=B, fontSize=8.2, leading=10.8, textColor=INK),
        "cell_bold": ParagraphStyle("cell_bold", fontName=BOLD, fontSize=8.2, leading=10.8, textColor=INK),
        "cell_muted": ParagraphStyle("cell_muted", fontName=B, fontSize=7.2, leading=9.3, textColor=MUTED),
        "head_cell": ParagraphStyle("head_cell", fontName=BOLD, fontSize=7.2, leading=9, textColor=MUTED),
        "note": ParagraphStyle("note", fontName=B, fontSize=7.5, leading=10.5, textColor=MUTED),
        "action_num": ParagraphStyle("action_num", fontName=XBOLD, fontSize=12, leading=14, textColor=colors.white,
                                     alignment=1),
        "plan_days": ParagraphStyle("plan_days", fontName=BOLD, fontSize=7.4, leading=9.5, textColor=ACCENT),
        "plan_title": ParagraphStyle("plan_title", fontName=BOLD, fontSize=10, leading=13, textColor=INK, spaceAfter=4),
        "plan_item": ParagraphStyle("plan_item", fontName=B, fontSize=8.2, leading=11.4, textColor=INK, leftIndent=8,
                                    firstLineIndent=-8, spaceAfter=3),
        "share_title": ParagraphStyle("share_title", fontName=BOLD, fontSize=10.5, leading=14, textColor=INK, spaceAfter=3),
    })
    return s


def _section(story: list, st: dict, title: str, kicker: str = "", space: float = 130) -> None:
    story.append(CondPageBreak(space))
    story.append(Spacer(1, 12))
    if kicker:
        story.append(Paragraph(_esc(kicker.upper()), st["eyebrow"]))
    story.append(Paragraph(_esc(title), st["section"]))


def _paras(text: Any, style) -> list:
    return sps._report_multi_para(str(text or ""), style, space_between=5)


def _kpi(st: dict, label: str, value: str, sub: str = "") -> list:
    out = [Paragraph(_esc(label), st["kpi_label"]), Spacer(1, 3), Paragraph(value, st["kpi_value"])]
    if sub:
        out += [Spacer(1, 2), Paragraph(_esc(sub), st["kpi_sub"])]
    return out


def _photo(snapshot: dict[str, Any]) -> Any:
    url = snapshot.get("image") or next(iter(snapshot.get("images") or []), None)
    data = sps._fetch_report_photo_bytesio(url) if url and not str(url).startswith("/") else None
    if data is None:
        return None
    try:
        img = RLImage(data, width=58 * mm, height=42 * mm)
        img.hAlign = "LEFT"
        return img
    except Exception:  # noqa: BLE001 -- a photo that won't decode just isn't shown
        logger.warning("Report PDF: could not decode the listing photo", exc_info=True)
        return None


def factor_cards(story: list, st: dict, factors: list[dict[str, Any]], *, agent: bool = False) -> None:
    """Every factor, 1 to 20: number, name and verdict, then what we found,
    why it matters and what to do. Each card is a table of rows, so a long one
    can carry on over a page break instead of failing to fit."""
    inner = W - 2 * 10
    for f in sorted(factors, key=lambda x: x.get("num") or 0):
        label, color, bg = VERDICTS.get(f.get("verdict") or "", VERDICTS["check_with_agent"])
        if agent and f.get("verdict") == "check_with_agent":
            label = "Check the figures"
        title = Paragraph(f'<font color="{_hex(color)}">{_esc(f.get("num"))}.</font>&nbsp;&nbsp;{_esc(f.get("name"))}',
                          st["factor_title"])
        rows: list[list] = [[sps._report_header_row(title, sps._ReportPill(label, color, bg), inner)]]
        for heading, key in (("WHAT WE FOUND", "found"), ("WHY IT MATTERS", "why")):
            if f.get(key):
                rows.append([[Paragraph(heading, st["label"])] + _paras(f[key], st["text"])])
        if f.get("action"):
            action = Table([[[Paragraph("WHAT TO DO", st["label"])] + _paras(f["action"], st["text"])]],
                           colWidths=[inner])
            action.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), TRAY), ("ROUNDEDCORNERS", [5, 5, 5, 5]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]))
            rows.append([action])
        note = ""
        if f.get("owner_figures"):
            when = _day((f.get("owner_figures") or {}).get("updated_at"))
            note = f"Updated from {'the' if agent else 'your agent’s'} figures{f' on {when}' if when else ''}."
        elif f.get("key") in FIGURE_KEYS and f.get("verdict") == "check_with_agent":
            note = ("Add these figures to this section in the online report and it will be rewritten from them."
                    if agent else
                    "Got these figures from your agent? Add them to this section in your online report and we’ll "
                    "rewrite it from them.")
        if note:
            rows.append([Paragraph(_esc(note), st["note"])])
        card = Table(rows, colWidths=[W])
        card.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.7, BORDER), ("LINEBEFORE", (0, 0), (0, -1), 3, color),
            ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, 0), 9), ("BOTTOMPADDING", (0, -1), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(CondPageBreak(110))
        story.append(card)
        story.append(Spacer(1, 7))


def _box(flowables: list, width: float, height: float, pad: float = 9):
    """A card of a set height, so cards side by side line up."""
    t = Table([[flowables]], colWidths=[width], rowHeights=[height])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), pad), ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), pad), ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
        ("BACKGROUND", (0, 0), (-1, -1), sps._LETTER_CARD_BG), ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
        ("ROUNDEDCORNERS", [7, 7, 7, 7]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _hex(color) -> str:
    return color.hexval().replace("0x", "#")


def _table(st: dict, header: list[str], rows: list[list], widths: list[float], shaded: set[int] = frozenset()):
    t = Table([[Paragraph(_esc(h), st["head_cell"]) for h in header]] + rows, colWidths=[W * w for w in widths],
              repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), TRAY), ("LINEBELOW", (0, 0), (-1, 0), 0.75, BORDER),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, colors.HexColor("#EEEEF1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    for i in shaded:
        style.append(("BACKGROUND", (0, i + 1), (-1, i + 1), ACCENT_PALE))
    t.setStyle(TableStyle(style))
    return t


def _price_comparison(story: list, st: dict, asking: float | None, sales: list[dict[str, Any]],
                      competition: dict[str, Any] | None) -> None:
    def gap(price: float) -> str:
        if not asking or not price:
            return ""
        d = asking - price
        if d == 0:
            return "Same as yours"
        return f"Yours is {_money(abs(d))} ({abs(round(d / price * 100, 1))}%) {'higher' if d > 0 else 'lower'}"

    story.append(Paragraph("Sold nearby", st["h3"]))
    story.append(Paragraph("HM Land Registry recorded sales", st["note"]))
    story.append(Spacer(1, 4))
    if sales:
        rows = [[Paragraph("Your asking price", st["cell_bold"]), Paragraph("", st["cell"]),
                 Paragraph(_money(asking), st["cell_bold"]), Paragraph("", st["cell"])]] if asking else []
        for s in sales:
            rows.append([
                [Paragraph(_esc(s.get("address")), st["cell_bold"])]
                + ([Paragraph(_esc(s["property_type"]), st["cell_muted"])] if s.get("property_type") else []),
                Paragraph(_esc(_month(s.get("sold_date")) or "—"), st["cell"]),
                Paragraph(_money(s.get("sold_price")), st["cell"]),
                Paragraph(_esc(gap(s.get("sold_price") or 0)), st["cell_muted"]),
            ])
        prices = [s["sold_price"] for s in sales if s.get("sold_price")]
        if len(prices) > 1:
            median = statistics.median(prices)
            rows.append([Paragraph("Median of these sales", st["cell_bold"]), Paragraph("", st["cell"]),
                         Paragraph(_money(median), st["cell_bold"]), Paragraph(_esc(gap(median)), st["cell_muted"])])
        story.append(_table(st, ["Home", "Sold", "Price", "Against your price"], rows, [0.42, 0.13, 0.15, 0.30],
                            shaded={0} if asking else set()))
        story.append(Spacer(1, 3))
        story.append(Paragraph(_esc(land_registry.attribution()), st["note"]))
    else:
        story.append(Paragraph("No recorded sales of similar homes nearby yet.", st["muted"]))

    story.append(CondPageBreak(90))
    story.append(Spacer(1, 10))
    story.append(Paragraph("For sale now", st["h3"]))
    basis = ""
    if competition and competition.get("compared_with"):
        basis = f"{competition['compared_with']}{' ' + competition['area'] if competition.get('area') else ''}"
    story.append(Paragraph(_esc(basis or "Homes buyers are comparing with yours"), st["note"]))
    story.append(Spacer(1, 4))
    listings = (competition or {}).get("listings") or []
    if not competition:
        story.append(Paragraph("We couldn't check the homes for sale around you this time.", st["muted"]))
    elif not listings:
        n = competition.get("for_sale_now")
        lead = (f"{n} similar {'home is' if n == 1 else 'homes are'} for sale nearby, but none within 15% of your price."
                if n else "No similar homes are for sale nearby right now.")
        story.append(Paragraph(_esc(lead + " Buyers at your level have little to compare you with, so if they aren't "
                                    "buying, it's the price or the home itself rather than the competition."), st["muted"]))
    else:
        rows = []
        for c in listings:
            meta = " · ".join(x for x in (
                f"{c['bedrooms']} bed" if c.get("bedrooms") else "", c.get("type") or "",
                f"{float(c['distance']):.1f} mi" if isinstance(c.get("distance"), (int, float)) else "",
                str(c.get("status") or "").replace("_", " ") if c.get("status") not in (None, "", "for_sale", "on_market") else "",
            ) if x)
            rows.append([
                [Paragraph(_esc(c.get("address") or "Nearby listing"), st["cell_bold"])]
                + ([Paragraph(_esc(meta), st["cell_muted"])] if meta else []),
                Paragraph(_esc(_month(c.get("first_listed")) or "—"), st["cell"]),
                Paragraph(_money(c.get("price")), st["cell"]),
                Paragraph(_esc(gap(c.get("price") or 0)), st["cell_muted"]),
            ])
        story.append(_table(st, ["Home", "Listed", "Price", "Against your price"], rows, [0.42, 0.13, 0.15, 0.30]))


def generate_v2_report_pdf(prospect: Any) -> str:
    """The prospect's 20-factor report as a PDF file; returns its path."""
    if sps._PDF_LIBS_IMPORT_ERROR:
        raise RuntimeError("Install reportlab to generate the report PDF.") from sps._PDF_LIBS_IMPORT_ERROR
    report = sps._safe_json(sps.current_report_json(prospect))
    snapshot = sps._safe_json(prospect.listing_snapshot_json)
    agent = getattr(prospect, "audience", None) == "agent"
    whose = "this property" if agent else "your property"
    address = sps.address_with_full_postcode(prospect.property_address, prospect.postcode)
    factors = [f for f in report.get("factors") or [] if isinstance(f, dict) and f.get("name")]
    st = _styles()

    output_dir = Path("generated") / "stale-reports-v2"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"report-{prospect.property_code}.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=sps.A4, leftMargin=sps._REPORT_MARGIN, rightMargin=sps._REPORT_MARGIN,
        topMargin=24 * mm, bottomMargin=19 * mm, title=f"Havlo Full Property Assessment — {address}", author="Havlo",
    )
    story: list = []

    # ── The property ─────────────────────────────────────────────────────
    story.append(Paragraph("FULL PROPERTY ASSESSMENT", st["eyebrow"]))
    story.append(Paragraph(_esc(address), st["title"]))
    today = datetime.now(timezone.utc)
    story.append(Paragraph(_esc(f"Prepared {today.day} {today:%B %Y} · Property code {prospect.property_code}"),
                           st["muted"]))
    story.append(Spacer(1, 9))
    counts = {v: sum(1 for f in factors if f.get("verdict") == v) for v in VERDICT_ORDER}
    reduced = sps.reduced_date_info(prospect, snapshot)
    timing = (_kpi(st, "Date reduced", _esc(_day(reduced) or "Recently"))
              if reduced else _kpi(st, "Days on the market", _esc(f"{prospect.listing_duration_days} days")
                                   if prospect.listing_duration_days is not None else "—"))
    verdicts = " · ".join(x for x in (
        f"{counts['check_with_agent']} to check" if counts["check_with_agent"] else "",
        f"{counts['working_well']} working well" if counts["working_well"] else "") if x)
    photo = _photo(snapshot)
    facts_w = (W - 20) - (62 * mm if photo is not None else 0)
    facts = Table([
        [_kpi(st, "Asking price", _money(prospect.asking_price),
              " · ".join(x for x in (prospect.property_type or "", f"{prospect.bedrooms} bed" if prospect.bedrooms else "") if x)),
         timing],
        [_kpi(st, "Saleability score", f"{_esc(report.get('overall_score', '—'))}/100", "Havlo's assessment"),
         _kpi(st, "Across the 20 factors", _esc(str(counts["problem"])) + (" problem" if counts["problem"] == 1 else " problems"),
              verdicts)],
    ], colWidths=[facts_w / 2, facts_w / 2])
    facts.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    header = Table([[photo, facts]] if photo is not None else [[facts]],
                   colWidths=[62 * mm, facts_w] if photo is not None else [facts_w])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(sps._report_card([header], pad=10, bg=TRAY, border=TRAY))

    if report.get("executive_summary"):
        _section(story, st, "Executive summary", space=90)
        story += _paras(report["executive_summary"], st["body"])

    # ── Score ────────────────────────────────────────────────────────────
    _section(story, st, "Saleability score", "How buyers are likely to see it", space=190)
    scores = scores_from_factors(factors)
    bars_w = W - 24 - 42 * mm - 8
    bars: list = []
    for key, label in SCORE_LABELS.items():
        if key in scores:
            bars += [sps._ReportScoreBar(label, scores[key], w=bars_w), Spacer(1, 6)]
    score = report.get("overall_score")
    gauge = [sps._ReportScoreGauge(score if isinstance(score, (int, float)) else 50, w=118, radius=44), Spacer(1, 3),
             Paragraph(f'<b>{_esc(score if score is not None else "—")}</b><font size="12">/100</font>', st["score_num"]),
             Paragraph("SALEABILITY SCORE", st["score_lbl"])]
    row = Table([[gauge, bars or [Paragraph("", st["muted"])]]], colWidths=[42 * mm, W - 24 - 42 * mm])
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                             ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    block = [row]
    if report.get("pricing_line"):
        block += [Spacer(1, 8), Paragraph(_esc(report["pricing_line"]), st["muted"])]
    story.append(KeepTogether(sps._report_card(block, pad=12)))

    # ── Top actions ──────────────────────────────────────────────────────
    top = [t for t in report.get("top_actions") or [] if isinstance(t, dict) and t.get("title")]
    if top:
        _section(story, st, "Your three most important actions", "Start here", space=150)
        for i, t in enumerate(top, start=1):
            badge = Table([[Paragraph(str(i), st["action_num"])]], colWidths=[9 * mm], rowHeights=[9 * mm])
            badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), INK), ("ROUNDEDCORNERS", [13, 13, 13, 13]),
                                       ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                       ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                                       ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
            body = [Paragraph(_esc(t.get("title")), st["h3"])] + _paras(t.get("detail"), st["text"])
            line = Table([[badge, body]], colWidths=[13 * mm, W - 24 - 13 * mm])
            line.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                      ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
            story.append(KeepTogether(sps._report_card([line], pad=12)))
            story.append(Spacer(1, 6))

    # ── Price comparison ─────────────────────────────────────────────────
    _section(story, st, "How your price compares" if not agent else "How the price compares", "The evidence", space=170)
    sales = [r for r in sps.report_comparable_rows(prospect) if not r.get("is_subject")]
    _price_comparison(story, st, prospect.asking_price, sales, report.get("competition"))

    # ── 30-day plan ──────────────────────────────────────────────────────
    boxes = plan_boxes(factors, top)
    col_w = (W - 2 * 7) / 3
    cells = []
    for days, title, items in boxes:
        flow = [Paragraph(_esc(days.upper()), st["plan_days"]), Spacer(1, 2), Paragraph(_esc(title), st["plan_title"])]
        flow += [Paragraph(f"•&nbsp;{_esc(item)}", st["plan_item"]) for item in items]
        cells.append(flow)
    inner = col_w - 2 * 9
    height = max(sum(f.wrap(inner, 10000)[1] + f.getSpaceBefore() + f.getSpaceAfter() for f in c)
                 for c in cells) + 2 * 9 + 6
    grid = Table([[_box(c, col_w, height) for c in cells]], colWidths=[col_w + 7, col_w + 7, col_w])
    grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    # The heading never sits on a page without its boxes.
    _section(story, st, "Your 30-day plan" if not agent else "The 30-day plan", "What to do, and when",
             space=height + 60)
    story.append(grid)
    story.append(Spacer(1, 5))
    if not agent:
        story.append(Paragraph(_esc(
            "Your online dashboard turns this plan into a checklist. We check the listing every day and the homes "
            "around it every week, and tick things off when we see a change has been made."), st["note"]))

    # ── The 20 factors ───────────────────────────────────────────────────
    _section(story, st, f"All {len(factors)} factors", f"What's helping and what's holding {whose} back", space=170)
    factor_cards(story, st, factors, agent=agent)

    # ── Services, sharing, method: kept together as the closing page ─────
    story.append(CondPageBreak(400))
    if not agent:  # the optional services are for homeowners
        _section(story, st, "Havlo optional property improvement services", "If you'd like us to act on this report",
                 space=10)
        from app.services import stale_prospect_addons as addons

        services = [(f"{a['name']} — £{a['price']:,.0f}", f"{a['blurb']} Delivered by email in 3–7 working days.")
                    for a in addons.ADDONS.values()]
        services.append((f"{addons.INCLUDED['name']} — Included", addons.INCLUDED["blurb"]))
        for name, blurb in services:
            story.append(KeepTogether([Paragraph(_esc(name), st["h3"]), Paragraph(_esc(blurb), st["text"]),
                                       Spacer(1, 7)]))
        story.append(Paragraph(_esc("Open your report online and choose Explore Next Steps to order."), st["muted"]))
    story.append(Spacer(1, 10))
    story.append(KeepTogether(sps._report_card([
        Paragraph("Sharing this report with your vendor" if agent else "Sharing this report with your agent",
                  st["share_title"]),
        Paragraph(_esc(AGENT_SHARE_CLAUSE if agent else SHARE_CLAUSE), st["text"]),
    ], pad=12, bg=ACCENT_PALE, border=ACCENT_PALE)))

    story.append(sps._report_hr(14, 8))
    story.append(Paragraph("How this assessment is made", st["h3"]))
    story.append(Paragraph(_esc(
        "From the listing itself (its price, photos, description, floor plan and history), recorded sales from HM "
        "Land Registry, the homes for sale around it on Rightmove, and Havlo's assessment of each of the 20 factors "
        "that decide whether a home sells. Stamp duty and mortgage figures use the current standard rates. Views, "
        "enquiries and viewings are only included where they've been added from the agent's figures."), st["note"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_esc(
        "This report is strategic guidance based on the information available to Havlo when it was prepared. It is "
        "not a valuation, a survey or financial advice."), st["note"]))

    doc.build(story, onFirstPage=lambda c, d: sps._report_page_chrome(c, d, address),
              onLaterPages=lambda c, d: sps._report_page_chrome(c, d, address))
    return os.path.abspath(pdf_path)
