"""The agent report as a downloadable PDF: the same figures and sections as
the agent report page (app/services/agent_report.py's intel plus Havlo's
assessment of the listing), laid out for A4 with ReportLab.

Built from the stored report data on request (never cached on disk), with
the agent's own fee for the commission figures. Headings use Plus Jakarta
Sans, body text Inter: the type of the Stale Listings pages.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from app.services import land_registry
from app.services import stale_prospect_service as sps

logger = logging.getLogger(__name__)

DEFAULT_FEE = 1.2
VAT = 0.2
STATUS_LABELS = {"on_market": "For sale", "under_offer": "Under offer", "sold_stc": "Sold STC", "removed": "Removed"}
TONES = {
    "Low": "good", "Limited": "neutral", "Routine": "good",
    "Moderate": "warn", "Elevated": "warn", "Soon": "warn", "Medium": "warn",
    "High": "bad", "Priority": "bad", "Strong": "good",
    "Critical": "bad", "Immediate": "bad", "Immediate review": "bad",
}

if not sps._PDF_LIBS_IMPORT_ERROR:
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        CondPageBreak, Image as RLImage, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    HEADING_FONT = sps._LETTER_FONT_EXTRABOLD
    HEADING_FONT_BOLD = sps._LETTER_FONT_BOLD
    _fonts = Path(__file__).resolve().parent.parent / "assets" / "fonts"
    for _name, _file, _attr in (
        ("PlusJakartaSans-ExtraBold", "PlusJakartaSans-ExtraBold.ttf", "HEADING_FONT"),
        ("PlusJakartaSans-Bold", "PlusJakartaSans-Bold.ttf", "HEADING_FONT_BOLD"),
    ):
        try:
            pdfmetrics.registerFont(TTFont(_name, str(_fonts / _file)))
            globals()[_attr] = _name
        except Exception:  # noqa: BLE001 -- Inter's heavier weights stand in
            logger.warning("%s not registrable; agent report headings use %s", _file, globals()[_attr], exc_info=True)

    INK = sps._LETTER_INK
    MUTED = sps._LETTER_MUTED
    ACCENT = sps._LETTER_ACCENT
    ACCENT_PALE = sps._LETTER_ACCENT_PALE
    CARD_BG = colors.HexColor("#FFFFFF")
    TRAY_BG = colors.HexColor("#F5F6F8")
    BORDER = sps._LETTER_CARD_BORDER
    TONE_COLORS = {"good": sps._LETTER_GREEN, "warn": sps._LETTER_ORANGE, "bad": colors.HexColor("#B42318"),
                   "neutral": colors.HexColor("#344054")}
    W = sps._REPORT_CONTENT_W


def _esc(text: Any) -> str:
    return sps._letter_esc("" if text is None else text)


def _money(n: Any) -> str:
    try:
        return f"£{round(float(n)):,}" if n else "—"
    except (TypeError, ValueError):
        return "—"


def _date(iso: str | None) -> str:
    try:
        d = date.fromisoformat((iso or "")[:10])
    except ValueError:
        return ""
    return f"{d.day} {d:%b %Y}"


def _commission(price: Any, fee: float) -> float | None:
    try:
        return float(price) * (fee / 100) * (1 + VAT) if price else None
    except (TypeError, ValueError):
        return None


def _styles() -> dict[str, "ParagraphStyle"]:
    s = sps._report_styles()
    B, BOLD = sps._LETTER_FONT_REGULAR, sps._LETTER_FONT_BOLD
    s.update({
        "eyebrow": ParagraphStyle("eyebrow", fontName=BOLD, fontSize=7.4, leading=10, textColor=ACCENT, spaceAfter=3),
        # Inter, not Plus Jakarta Sans: ReportLab doesn't kern, and Jakarta's
        # commas then sit visibly apart from the word before them.
        "title": ParagraphStyle("title", fontName=sps._LETTER_FONT_EXTRABOLD, fontSize=20, leading=24, textColor=INK, spaceAfter=4),
        "section": ParagraphStyle("section", fontName=HEADING_FONT, fontSize=14.5, leading=18, textColor=INK, spaceBefore=2, spaceAfter=7),
        "sub": ParagraphStyle("sub", fontName=HEADING_FONT_BOLD, fontSize=10.5, leading=14, textColor=INK, spaceBefore=6, spaceAfter=5),
        "kpi_label": ParagraphStyle("kpi_label", fontName=BOLD, fontSize=7.2, leading=9.5, textColor=MUTED),
        "kpi_value": ParagraphStyle("kpi_value", fontName=HEADING_FONT, fontSize=15, leading=18, textColor=INK),
        "kpi_sub": ParagraphStyle("kpi_sub", fontName=B, fontSize=7, leading=9.4, textColor=MUTED),
        "cell": ParagraphStyle("cell", fontName=B, fontSize=8.1, leading=10.6, textColor=INK),
        "cell_bold": ParagraphStyle("cell_bold", fontName=BOLD, fontSize=8.1, leading=10.6, textColor=INK),
        "cell_muted": ParagraphStyle("cell_muted", fontName=B, fontSize=7.1, leading=9.2, textColor=MUTED),
        "head_cell": ParagraphStyle("head_cell", fontName=BOLD, fontSize=7.1, leading=9, textColor=MUTED),
        "view_value": ParagraphStyle("view_value", fontName=HEADING_FONT, fontSize=11.5, leading=14, textColor=ACCENT),
        "insight": ParagraphStyle("insight", fontName=B, fontSize=8.6, leading=12.6, textColor=colors.HexColor("#3A2B44")),
        "note": ParagraphStyle("note", fontName=B, fontSize=7.4, leading=10.4, textColor=MUTED),
        "num": ParagraphStyle("num", fontName=BOLD, fontSize=8.5, leading=10, textColor=colors.white, alignment=1),
    })
    return s


def _measure(flowables: list, width: float) -> float:
    return sum(f.wrap(width, 100000)[1] for f in flowables)


def _card(flowables: list, width: float, height: float | None = None, pad: float = 9, bg=None, border=None):
    t = Table([[flowables]], colWidths=[width], rowHeights=[height] if height else None)
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), pad), ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), pad), ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
        ("BACKGROUND", (0, 0), (-1, -1), CARD_BG if bg is None else bg),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER if border is None else border),
        ("ROUNDEDCORNERS", [7, 7, 7, 7]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _grid(cells: list[list], cols: int, gap: float = 7, pad: float = 9) -> "Table":
    """Cards in rows of `cols`, every card in a row the same height."""
    card_w = (W - gap * (cols - 1)) / cols
    inner = card_w - 2 * pad
    rows = []
    for i in range(0, len(cells), cols):
        chunk = cells[i:i + cols]
        height = max(_measure(c, inner) for c in chunk) + 2 * pad
        rows.append([_card(c, card_w, height, pad) for c in chunk] + [""] * (cols - len(chunk)))
    t = Table(rows, colWidths=[card_w + gap] * (cols - 1) + [card_w])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-2, -1), gap), ("RIGHTPADDING", (-1, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), gap), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _kpi(st: dict, label: str, value: str, sub: str = "", tone: str | None = None) -> list:
    color = TONE_COLORS.get(tone or "") if tone else None
    value_html = f'<font color="{color.hexval().replace("0x", "#")}">{value}</font>' if color is not None else value
    out = [Paragraph(_esc(label), st["kpi_label"]), Spacer(1, 4), Paragraph(value_html, st["kpi_value"])]
    if sub:
        out += [Spacer(1, 3), Paragraph(sub, st["kpi_sub"])]
    return out


def _table(st: dict, header: list[str], rows: list[list], widths: list[float], highlight: set[int] | None = None):
    data = [[Paragraph(_esc(h), st["head_cell"]) for h in header]] + rows
    t = Table(data, colWidths=[W * w for w in widths], repeatRows=1)
    style = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, BORDER), ("LINEBELOW", (0, 1), (-1, -2), 0.4, colors.HexColor("#EEEEF1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (-1, 0), TRAY_BG),
    ]
    for i in highlight or ():
        style.append(("BACKGROUND", (0, i + 1), (-1, i + 1), ACCENT_PALE))
    t.setStyle(TableStyle(style))
    return t


def _home_rows(st: dict, homes: list[dict]) -> list[list]:
    rows = []
    for h in homes:
        meta = " · ".join(x for x in (f"{h['bedrooms']} bed" if h.get("bedrooms") else "", h.get("type") or "",
                                       f"{h['distance']} mi" if h.get("distance") is not None else "") if x)
        rows.append([
            [Paragraph(_esc(h.get("address") or ""), st["cell_bold"])] + ([Paragraph(_esc(meta), st["cell_muted"])] if meta else []),
            Paragraph(_money(h.get("price")), st["cell"]),
            Paragraph(_esc(STATUS_LABELS.get(h.get("status") or "", h.get("status") or "")), st["cell"]),
            Paragraph(_esc(_date(h.get("first_listed")) or "—"), st["cell"]),
            Paragraph(_esc(h.get("agent") or "—"), st["cell"]),
        ])
    return rows


def _sale_rows(st: dict, sales: list[dict]) -> list[list]:
    return [[
        Paragraph(_esc(s.get("address") or ""), st["cell_bold"]),
        Paragraph(_esc(s.get("property_type") or s.get("type") or ""), st["cell"]),
        Paragraph(_money(s.get("price")), st["cell"]),
        Paragraph(_esc(_date(s.get("date"))), st["cell"]),
    ] for s in sales]


def _bullets(st: dict, items: list[str], quote: bool = False) -> list:
    out = []
    for item in items:
        text = f"\u201c{_esc(item)}\u201d" if quote else _esc(item)
        out.append(Paragraph(f"•\u00a0\u00a0{text}", st["bullet"]))
        out.append(Spacer(1, 3))
    return out


def _section(story: list, st: dict, title: str, kicker: str = "", space: float = 120) -> None:
    story.append(CondPageBreak(space))
    story.append(Spacer(1, 10))
    if kicker:
        story.append(Paragraph(_esc(kicker.upper()), st["eyebrow"]))
    story.append(Paragraph(_esc(title), st["section"]))


def _photo(snapshot: dict) -> Any:
    url = snapshot.get("image") or next(iter(snapshot.get("images") or []), None)
    data: BytesIO | None = None
    if url and str(url).startswith("/"):
        local = Path("havlo_frontend/public") / str(url).lstrip("/")
        if local.is_file():
            data = BytesIO(local.read_bytes())
    elif url:
        data = sps._fetch_report_photo_bytesio(url)
    if data is None:
        return None
    try:
        img = RLImage(data, width=56 * mm, height=40 * mm)
        img.hAlign = "LEFT"
        return img
    except Exception:  # noqa: BLE001
        logger.warning("Agent report PDF: could not decode the listing photo", exc_info=True)
        return None


def _chrome(c, doc, address: str) -> None:
    c.saveState()
    page_w, page_h, margin = sps._REPORT_PAGE_W, sps._REPORT_PAGE_H, sps._REPORT_MARGIN
    if sps._LETTER_LOGO_PATH.is_file():
        c.drawImage(str(sps._LETTER_LOGO_PATH), margin, page_h - 15 * mm, width=26 * mm, height=8 * mm,
                    preserveAspectRatio=True, mask="auto")
    c.setFont(sps._LETTER_FONT_BOLD, 7.5)
    c.setFillColor(MUTED)
    c.drawString(margin + 30 * mm, page_h - 12.2 * mm, "STALE LISTINGS · AGENT REPORT")
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.75)
    c.line(margin, page_h - 17 * mm, page_w - margin, page_h - 17 * mm)
    c.line(margin, 14 * mm, page_w - margin, 14 * mm)
    c.setFont(sps._LETTER_FONT_REGULAR, 7)
    c.drawString(margin, 10 * mm, address[:70])
    c.drawCentredString(page_w / 2, 10 * mm, "Prepared by Havlo — heyhavlo.com")
    c.drawRightString(page_w - margin, 10 * mm, f"Page {doc.page}")
    c.restoreState()


def generate_agent_report_pdf(prospect: Any, intel: dict[str, Any] | None = None, fee: float | None = None) -> str:
    """The agent report for an agency's copy of a listing, as a PDF file;
    returns its absolute path. `intel` defaults to the stored report data."""
    if sps._PDF_LIBS_IMPORT_ERROR:
        raise RuntimeError("Install reportlab to generate the agent report PDF.") from sps._PDF_LIBS_IMPORT_ERROR
    intel = intel or json.loads(prospect.agent_intel_json or "{}")
    fee = fee if fee and 0 < fee < 10 else DEFAULT_FEE
    report = sps._safe_json(sps.current_report_json(prospect))
    snapshot = sps._safe_json(prospect.listing_snapshot_json)
    address = sps.address_with_full_postcode(prospect.property_address, prospect.postcode)
    st = _styles()
    h = intel.get("headline") or {}
    subject = intel.get("subject") or {}
    agency = prospect.agent_brand or prospect.agent_company_name or subject.get("agent") or ""

    output_dir = Path("generated") / "stale-agent-reports"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"agent-report-{prospect.property_code}.pdf"
    doc = SimpleDocTemplate(
        str(pdf_path), pagesize=sps.A4, leftMargin=sps._REPORT_MARGIN, rightMargin=sps._REPORT_MARGIN,
        topMargin=24 * mm, bottomMargin=19 * mm, title=f"Havlo Agent Report — {address}", author="Havlo",
    )
    story: list = []

    # ── Cover ────────────────────────────────────────────────────────────
    story.append(Paragraph("AGENT REPORT · INSTRUCTION INTELLIGENCE", st["eyebrow"]))
    story.append(Paragraph(_esc(address), st["title"]))
    today = datetime.now(timezone.utc)
    prepared = f"Prepared {today.day} {today:%B %Y}" + (f" for {agency}" if agency else "")
    story.append(Paragraph(_esc(prepared), st["muted"]))
    story.append(Spacer(1, 10))

    price = h.get("price") or prospect.asking_price
    if subject.get("reduced_date") is not None or h.get("reduced_date"):
        reduced = subject.get("reduced_date") or h.get("reduced_date")
        timing_label = "Date reduced"
        timing_value = _date(reduced) or "Recently"
        timing_sub = f"{h['days_since_reduction']} days ago" if h.get("days_since_reduction") is not None else "price reduced"
        if h.get("dom"):
            timing_sub += f" · {h['dom']} days on the market"
    else:
        timing_label, timing_value = "Days on the market", f"{h.get('dom') or prospect.listing_duration_days or '—'} days"
        timing_sub = f"vs {h['dom_benchmark']}-day local benchmark" if h.get("dom_benchmark") else (f"since {_date(subject.get('listed_date'))}" if subject.get("listed_date") else "")
    photo = _photo(snapshot)
    facts_w = (W - 20) - (60 * mm if photo is not None else 0)
    facts = Table([[
        _kpi(st, "Asking price", _money(price), " · ".join(x for x in (prospect.property_type or "", f"{prospect.bedrooms} bed" if prospect.bedrooms else "") if x)),
        _kpi(st, timing_label, _esc(timing_value), _esc(timing_sub)),
    ], [
        _kpi(st, "Marketed by", _esc(agency or "—")),
        _kpi(st, "Saleability score", f"{_esc(report.get('overall_score', '—'))}/100", "Havlo's assessment of the listing"),
    ]], colWidths=[facts_w / 2, facts_w / 2])
    facts.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    if photo is not None:
        header = Table([[photo, facts]], colWidths=[60 * mm, facts_w])
    else:
        header = Table([[facts]], colWidths=[facts_w])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story.append(_card([header], W, pad=10, bg=TRAY_BG, border=TRAY_BG))
    story.append(Spacer(1, 8))
    if intel.get("summary"):
        story.append(Paragraph(_esc(intel["summary"]), st["muted"]))

    # ── Headline figures ─────────────────────────────────────────────────
    _section(story, st, "How exposed is this instruction?", "Instruction intelligence", space=200)
    health = h.get("health")
    health_tone = None if health is None else "bad" if health < 45 else "warn" if health < 65 else "good"
    gap_bits = []
    if h.get("success_gap_rightmove"):
        gap_bits.append(f"{h['success_gap_rightmove']} agreed on Rightmove")
    if h.get("success_gap_sales"):
        gap_bits.append(f"{h['success_gap_sales']} sold (Land Registry)")
    reasons = h.get("vendor_pressure_reasons") or []
    commission = _commission(price, fee)
    cells = [
        _kpi(st, "Instruction health", f"{health if health is not None else '—'}/100", "time, price, presentation, competition and homes selling", health_tone),
        _kpi(st, "Instruction risk", _esc(h.get("risk") or "—"), _esc(h.get("risk_reason") or ""), TONES.get(h.get("risk") or "")),
        _kpi(st, "Vendor pressure", _esc(h.get("vendor_pressure") or h.get("vendor_frustration") or "High"), _esc(reasons[0] if reasons else ""), "bad"),
        _kpi(st, timing_label, _esc(timing_value), _esc(timing_sub)),
        _kpi(st, "Competitor pressure", _esc(h.get("competitor_pressure") or "—"), _esc(h.get("competitor_reason") or ""), TONES.get(h.get("competitor_pressure") or "")),
        _kpi(st, "Comparable success gap", str(h.get("success_gap", 0)),
             _esc("similar homes sold or agreed since it was listed" + (": " + " · ".join(gap_bits) if gap_bits else ""))),
        _kpi(st, "Relaunch opportunity", _esc(h.get("relaunch") or "—"), _esc(h.get("relaunch_reason") or ""), TONES.get(h.get("relaunch") or "")),
        _kpi(st, "Commission on this instruction", _money(commission), _esc(f"at a {fee:g}% fee + VAT")),
    ]
    story.append(_grid(cells, 4))

    # ── What the vendor can see ──────────────────────────────────────────
    view = intel.get("vendor_view") or {}
    items = view.get("items") or []
    if items:
        _section(story, st, "What your vendor can see", "The market is moving around this listing")
        rows = [[Paragraph(_esc(i.get("value")), st["view_value"]), Paragraph(_esc(i.get("text") or ""), st["body_left"])] for i in items]
        t = Table(rows, colWidths=[30 * mm, W - 30 * mm])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#EEEEF1")),
                               ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (0, 0), (-1, -1), 2)]))
        story.append(t)
        story.append(Spacer(1, 7))
        story.append(_card([Paragraph("<b>Havlo insight:</b> your vendor has access to much of the same market information. "
                                      "A proactive review backed by current evidence shows the instruction is being actively managed.",
                                      st["insight"])], W, pad=10, bg=ACCENT_PALE, border=ACCENT_PALE))

    # ── Actions ──────────────────────────────────────────────────────────
    actions = intel.get("actions") or []
    if actions:
        _section(story, st, "What Havlo recommends you do now", "Prioritised")
        for i, a in enumerate(actions, start=1):
            title = Paragraph(f"{i}.\u00a0\u00a0{_esc(a.get('title'))}", st["h3"])
            pill = sps._ReportPill(a.get("priority") or "", TONE_COLORS.get(TONES.get(a.get("priority") or "", "neutral")),
                                   {"bad": sps._REPORT_RED_BG, "warn": sps._REPORT_ORANGE_BG, "good": sps._REPORT_GREEN_BG}.get(TONES.get(a.get("priority") or "", ""), TRAY_BG))
            story.append(KeepTogether(_card([sps._report_header_row(title, pill, W - 20), Spacer(1, 3),
                                             Paragraph(_esc(a.get("why") or ""), st["muted"])], W, pad=10)))
            story.append(Spacer(1, 6))

    # ── Vendor call ──────────────────────────────────────────────────────
    vendor = intel.get("vendor") or {}
    if vendor.get("questions") or vendor.get("talking_points"):
        _section(story, st, "Be ready for the next vendor call", f"Vendor conversation priority: {vendor.get('priority', '')}")
        if vendor.get("questions"):
            story.append(Paragraph("Questions your vendor is likely to ask", st["sub"]))
            story += _bullets(st, vendor["questions"], quote=True)
        if vendor.get("talking_points"):
            story.append(Paragraph("Evidence-backed talking points", st["sub"]))
            story += _bullets(st, vendor["talking_points"])

    # ── Competition ──────────────────────────────────────────────────────
    market = intel.get("market") or {}
    if market.get("cards"):
        _section(story, st, "The competition around this listing", "Local market movement", space=180)
        story.append(_grid([_kpi(st, c.get("label") or "", _esc(c.get("value")), _esc(c.get("sub") or "")) for c in market["cards"]], 4))
        widths = [0.38, 0.13, 0.13, 0.14, 0.22]
        for key, label in (("sold_since", "Listed after this one, already under offer or sold STC"),
                           ("competing", "Similar homes for sale, closest in price"),
                           ("new_30", "New competition in the last 30 days")):
            homes = market.get(key) or []
            if homes:
                story.append(CondPageBreak(90))
                story.append(Paragraph(_esc(label), st["sub"]))
                story.append(_table(st, ["Home", "Price", "Status", "Listed", "Agent"], _home_rows(st, homes), widths))
                story.append(Spacer(1, 6))

    comp = intel.get("competitors") or {}
    agencies = comp.get("agencies") or []
    if agencies:
        _section(story, st, "Competing agencies nearby", f"Competitor threat: {comp.get('threat', '')} · Exposure: {comp.get('exposure', '')}")
        story.append(Paragraph(_esc(
            f"{comp.get('in_segment', 0)} other agencies are marketing similar homes {intel.get('area_label') or 'nearby'}; "
            f"{comp.get('agreed_in_segment', 0)} have one under offer or sold STC. These are the agents your vendor is likely to come across."
        ), st["muted"]))
        story.append(Spacer(1, 5))
        rows, mine = [], set()
        for i, a in enumerate(agencies):
            if a.get("you"):
                mine.add(i)
            rows.append([
                [Paragraph(_esc(a.get("agent") or ""), st["cell_bold"])] + ([Paragraph("Your agency", st["cell_muted"])] if a.get("you") else []),
                Paragraph(str(a.get("listings", 0)), st["cell"]), Paragraph(str(a.get("agreed", 0)), st["cell"]),
                Paragraph(str(a.get("new_30", 0)), st["cell"]), Paragraph(f"{a.get('share', 0)}%", st["cell"]),
            ])
        story.append(_table(st, ["Agency", "Homes listed nearby", "Under offer / sold STC", "New in 30 days", "Share"], rows,
                            [0.4, 0.16, 0.18, 0.14, 0.12], highlight=mine))
        if comp.get("momentum"):
            story.append(Spacer(1, 5))
            story.append(Paragraph("<b>Momentum:</b> " + _esc(", ".join(f"{a['agent']} ({a['new_30']} new)" for a in comp["momentum"]))
                                   + " took on new listings nearby in the last 30 days.", st["muted"]))

    # ── Price ────────────────────────────────────────────────────────────
    pricing = intel.get("pricing") or {}
    sold = intel.get("sold") or {}
    if pricing:
        _section(story, st, "Price position", f"Price reduction pressure: {pricing.get('reduction_pressure', '')}", space=180)
        prem = pricing.get("premium_pct")
        sprem = pricing.get("sold_premium_pct")
        cells = [
            _kpi(st, "Asking price", _money(price), _esc(f"{_money(pricing['price_per_bedroom'])} a bedroom") if pricing.get("price_per_bedroom") else ""),
            _kpi(st, "Middle of similar homes for sale", _money(pricing.get("median_for_sale")),
                 _esc("yours is in line" if prem == 0 else f"yours is {abs(prem)}% {'above' if prem > 0 else 'below'}"))
            if pricing.get("median_for_sale") else
            _kpi(st, "Recorded sale range (12 months)", _esc(f"{_money(sold.get('low_12m'))}–{_money(sold.get('high_12m'))}"),
                 _esc(f"{sold.get('homes_label', 'homes')} {sold.get('area_label', 'nearby')}"))
            if sold.get("low_12m") else
            _kpi(st, "Price per bedroom", _money(pricing.get("price_per_bedroom")), "the asking price over the bedrooms"),
            _kpi(st, "Middle recorded sale (12 months)", _money(pricing.get("sold_median")),
                 _esc(f"{pricing.get('sold_count', 0)} sales of {sold.get('homes_label', 'homes')} {sold.get('area_label', 'nearby')}"
                      + (f"; yours is {abs(sprem)}% {'above' if sprem > 0 else 'below'}" if sprem not in (None, 0) else ""))
                 if pricing.get("sold_median") else _esc("no recorded sales nearby")),
            _kpi(st, "Price score", f"{pricing.get('score') if pricing.get('score') is not None else '—'}/100", _esc("against the local evidence")),
        ]
        story.append(_grid(cells, 4))
        line = []
        if pricing.get("cheaper_share") is not None:
            line.append(f"{pricing['cheaper_share']}% of similar homes for sale nearby are cheaper.")
        if pricing.get("reduced_date"):
            line.append(f"Last reduced {pricing.get('days_since_reduction')} days ago ({_date(pricing['reduced_date'])}).")
        else:
            line.append("No price reduction on record.")
        story.append(Paragraph(_esc(" ".join(line)), st["muted"]))
        comparables = pricing.get("comparables") or []
        if comparables:
            story.append(CondPageBreak(90))
            story.append(Paragraph("Comparable sold prices", st["sub"]))
            story.append(_table(st, ["Address", "Type", "Sold for", "Date"], _sale_rows(st, comparables), [0.5, 0.16, 0.16, 0.18]))
        def key(s: dict) -> str:
            return "".join(ch for ch in (s.get("address") or "").lower() if ch.isalnum()) + f"|{s.get('price')}"

        shown = {key(c) for c in comparables}
        since = [s for s in sold.get("since_listed") or [] if key(s) not in shown]
        if since:
            story.append(CondPageBreak(90))
            story.append(Paragraph(_esc(f"{'Also sold' if comparables else 'Similar homes that sold'} {sold.get('area_label', 'nearby')} since this one was listed"), st["sub"]))
            story.append(_table(st, ["Address", "Type", "Sold for", "Date"], _sale_rows(st, since), [0.5, 0.16, 0.16, 0.18]))
        if comparables or since:
            story.append(Spacer(1, 4))
            story.append(Paragraph(_esc(land_registry.attribution()), st["note"]))

    # ── Presentation ─────────────────────────────────────────────────────
    pres = intel.get("presentation") or {}
    if pres:
        fresh = intel.get("freshness") or {}
        _section(story, st, "Presentation and buyer appeal", f"Relaunch opportunity: {fresh.get('relaunch', '')} · Listing fatigue: {fresh.get('fatigue', '')}", space=170)
        fp = pres.get("floorplans")
        cells = [
            _kpi(st, "Portal presentation", f"{pres.get('score', '—')}/100", "the listing against similar ones, with Havlo's assessment"),
            _kpi(st, "Photos", _esc(pres.get("photos") if pres.get("photos") is not None else "—"),
                 _esc(f"similar listings: {pres['comparable_photos']}") if pres.get("comparable_photos") else ""),
            _kpi(st, "Floorplan", "Yes" if fp else "No" if fp == 0 else "—",
                 _esc(f"{pres['comparable_floorplan_share']}% of similar listings have one") if pres.get("comparable_floorplan_share") is not None else ""),
            _kpi(st, "Buyer appeal", f"{round(pres['buyer_appeal'])}/100" if pres.get("buyer_appeal") is not None else "—", "Havlo's assessment"),
        ]
        story.append(_grid(cells, 4))
        if pres.get("gaps"):
            story.append(Paragraph("What to fix", st["sub"]))
            story += _bullets(st, [g[:1].upper() + g[1:] for g in pres["gaps"]])
        for f in pres.get("findings") or []:
            story.append(Paragraph(f"<b>{_esc(f.get('title'))}.</b> {_esc(f.get('detail'))}", st["body_left"]))
            story.append(Spacer(1, 4))

    # ── Havlo's assessment ───────────────────────────────────────────────
    if report.get("executive_summary") or report.get("scores"):
        _section(story, st, "Havlo's assessment of the listing", "Saleability", space=200)
        if report.get("executive_summary"):
            story += sps._report_multi_para(report["executive_summary"], st["body"])
            story.append(Spacer(1, 8))
        scores = report.get("scores") or {}
        labels = {"pricing": "Pricing", "listing_presentation": "Listing presentation", "market_positioning": "Market positioning",
                  "competition": "Competition", "buyer_appeal": "Buyer appeal"}
        bars = []
        has_gauge = isinstance(report.get("overall_score"), (int, float))
        bars_w = W - 24 - 40 * mm - 8 if has_gauge else W - 24
        for key, label in labels.items():
            if isinstance(scores.get(key), (int, float)):
                bars += [sps._ReportScoreBar(label, round(scores[key]), w=bars_w), Spacer(1, 6)]
        if bars and has_gauge:
            gauge = [sps._ReportScoreGauge(report["overall_score"], w=110, radius=42), Spacer(1, 4),
                     Paragraph(f'<font size="17"><b>{_esc(report.get("overall_score", "—"))}</b></font>/100', st["score_num"]),
                     Paragraph("SALEABILITY SCORE", st["score_lbl"])]
            row = Table([[gauge, bars]], colWidths=[40 * mm, W - 24 - 40 * mm])
            row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
            story.append(KeepTogether(_card([row], W, pad=12)))
        elif bars:
            story.append(KeepTogether(_card(bars, W, pad=12)))
        findings = [f for f in report.get("key_findings") or [] if isinstance(f, dict)]
        issues = [f for f in findings if f.get("type") == "issue"][:2] or findings[:2]
        if issues:
            story.append(Paragraph("Why it may not be selling", st["sub"]))
            for f in issues:
                flow = [Paragraph(_esc(f.get("title") or ""), st["h3"])]
                for label, key, hexcolor in (("EVIDENCE", "evidence", "#B14F0A"), ("IMPACT", "impact", "#B42318"), ("RECOMMEND", "recommend", "#0E7D4C")):
                    if f.get(key):
                        flow += [Spacer(1, 3), Paragraph(f'<font color="{hexcolor}"><b>{label}</b></font>\u00a0\u00a0{_esc(f[key])}', st["body_left"])]
                if len(flow) == 1 and f.get("description"):
                    flow.append(Paragraph(_esc(f["description"]), st["body_left"]))
                story.append(KeepTogether(_card(flow, W, pad=10)))
                story.append(Spacer(1, 6))

    # ── Branch ───────────────────────────────────────────────────────────
    branch = intel.get("branch") or {}
    if branch:
        _section(story, st, "What's at stake for the branch", "Commercial")
        story.append(_grid([
            _kpi(st, "Commission on this instruction", _money(commission), _esc(f"at a {fee:g}% fee + VAT")),
            _kpi(st, "Your stale listings", str(branch.get("stale_listings", 0)), _esc(f"worth {_money(branch.get('stale_value'))} in asking prices")),
            _kpi(st, "Commission tied up in them", _money(_commission(branch.get("stale_value"), fee)), "at your fee"),
            _kpi(st, "This listing", f"#{branch['rank_by_time']}" if branch.get("rank_by_time") else "—",
                 _esc(f"longest-running of your {branch.get('stale_listings', 0)}")),
        ], 4))

    # ── Plan, health ─────────────────────────────────────────────────────
    plan = intel.get("plan") or report.get("thirty_day_plan") or []
    if plan:
        _section(story, st, "The next four weeks", "30-day action plan")
        story.append(_grid([[Paragraph(f"WEEK {_esc(w.get('week'))}", st["week_num"]), Spacer(1, 3),
                             Paragraph(_esc(w.get("title") or ""), st["week_title"])] for w in plan[:4]], 4))
    components = intel.get("health_components") or {}
    if components:
        _section(story, st, "Instruction health breakdown", "How the health score is made")
        bars = []
        for label, value in components.items():
            if isinstance(value, (int, float)):
                bars += [sps._ReportScoreBar(label, round(value), w=W - 24), Spacer(1, 6)]
        story.append(KeepTogether(_card(bars, W, pad=12)))

    # ── Full recommendations ─────────────────────────────────────────────
    action_plan = [a for a in report.get("action_plan") or [] if isinstance(a, dict)]
    if action_plan:
        _section(story, st, "Havlo stale listing recommendation", "In full", space=160)
        for i, action in enumerate(action_plan, start=1):
            title = Paragraph(f"{i}. {_esc(action.get('title') or '')}", st["h3"])
            flow = [sps._report_header_row(title, sps._report_priority_pill(action["priority"]), W - 24)] if action.get("priority") else [title]
            flow += [Spacer(1, 4)] + sps._report_multi_para(action.get("description") or "", st["body"])
            if action.get("why_it_matters"):
                flow += [Spacer(1, 4), Paragraph(f"<i>Why it matters: {_esc(action['why_it_matters'])}</i>", st["muted"])]
            bullets = sps._report_dedupe_bullets(action.get("bullets"))
            if bullets:
                flow.append(Spacer(1, 5))
                flow += [Paragraph(f"•\u00a0\u00a0{_esc(b)}", st["bullet"]) for b in bullets]
            story.append(KeepTogether(_card(flow, W, pad=12)))
            story.append(Spacer(1, 7))

    # ── Sources ──────────────────────────────────────────────────────────
    story.append(CondPageBreak(110))
    story.append(Spacer(1, 10))
    story.append(sps._report_hr())
    story.append(Paragraph("How this is worked out", st["sub"]))
    story.append(Paragraph(_esc(
        "Homes for sale around the listing on Rightmove (price, status, when listed, agency); recorded sales from HM Land Registry; "
        "the listing's own Rightmove page; and Havlo's assessment of it. The local benchmark is the typical time similar homes still for "
        "sale nearby have been listed, not how long sold homes took. The comparable success gap counts similar homes listed after this one "
        "that are now under offer or sold STC, plus similar homes nearby that completed a sale after it was listed. Commission is an "
        f"estimate at a {fee:g}% fee plus VAT."
    ), st["note"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_esc(land_registry.attribution()), st["note"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_esc(
        "This report is strategic guidance based on the information available to Havlo when it was prepared. It is not a valuation."
    ), st["note"]))

    doc.build(story, onFirstPage=lambda c, d: _chrome(c, d, address), onLaterPages=lambda c, d: _chrome(c, d, address))
    return os.path.abspath(pdf_path)
