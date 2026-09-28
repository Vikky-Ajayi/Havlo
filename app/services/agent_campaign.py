"""Agent campaign: letters to estate agency companies about their stale listings.

Every owner prospect records the agency marketing it (agent_company_name
etc., from the Rightmove listing page). Companies with at least
MIN_LISTINGS of our stale prospects get a StaleAgentAccount: one letter per
company, posted to the branch holding most of those listings (Rightmove
only gives branch addresses), with a 5-digit agency code.

At /check/agent the agency enters that code (or scans the letter's QR) and
sees those properties. Opening one creates the agency's own copy of the
prospect (audience = "agent") -- same listing, report and comparables, but
its own details, checkout and unlock -- and hands its token to the normal
/check funnel. Owner and agent purchases stay separate.
"""
from __future__ import annotations

import json
import random
import re
import string
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import StaleAgentAccount, StaleListingProspect
from app.services import stale_prospect_service as sps

MIN_LISTINGS = 2
# Discovery's criteria: on the market STALE_MIN_DAYS or more, or -- when
# Rightmove only shows "Reduced on <date>" -- reduced in price. For those
# the day count runs from the reduction, so they're shown as "Reduced
# <date>", never as days on market (same as the assessment page).
STALE_MIN_DAYS = 180
LETTER_TABLE_ROWS = 8
# Copied onto an agent's copy of an owner prospect: the listing, report and
# comparables. Deliberately not the funnel/payment/contact/letter fields.
_COPIED_FIELDS = (
    "country", "property_address", "postcode", "city", "rightmove_url", "rightmove_id", "asking_price",
    "listing_duration_days", "listed_date", "property_type", "bedrooms", "bathrooms",
    "listing_snapshot_json", "report_json", "preview_json", "agent_edited_report_json",
    "sold_comparables_json", "sold_comparables_at", "is_manual",
    "agent_branch_id", "agent_company_name", "agent_brand", "agent_branch_name", "agent_address",
    "agent_phone", "agent_logo_url", "agent_profile_url",
)


def company_key(name: str | None) -> str:
    """"Grant J. Bates Property Limited" and "GRANT J BATES PROPERTY LTD" -> one key."""
    key = re.sub(r"[^A-Z0-9& ]+", " ", (name or "").upper())
    key = re.sub(r"\bLIMITED\b", "LTD", key)
    return " ".join(key.split())


def display_company_name(name: str) -> str:
    """Rightmove's legal names are upper case; letters read better in title case."""
    words = []
    for word in (name or "").split():
        upper = word.upper()
        if words and upper in {"AND", "OF", "THE", "FOR"}:
            words.append(word.lower())
        elif upper in {"LTD", "LLP", "PLC", "UK", "&"}:
            words.append({"LTD": "Ltd", "LLP": "LLP", "PLC": "plc", "UK": "UK", "&": "&"}[upper])
        elif len(word) <= 2 and word.isalpha() and word.isupper():
            words.append(word)  # initials: "J", "JB"
        else:
            words.append(word[:1].upper() + word[1:].lower())
    return " ".join(words)


def _days(listed_date: Any, duration: Any, today: date | None = None) -> int:
    today = today or datetime.now(timezone.utc).date()
    if listed_date:
        listed = listed_date.date() if isinstance(listed_date, datetime) else listed_date
        return max((today - listed).days, int(duration or 0))
    return int(duration or 0)


def days_on_market(prospect: StaleListingProspect, today: date | None = None) -> int:
    return _days(prospect.listed_date, prospect.listing_duration_days, today)


def reduced_date(prospect: StaleListingProspect) -> str | None:
    """YYYY-MM-DD (or "" if unreadable) when the listing only qualified
    through a price reduction; None when days on market are known."""
    try:
        snapshot = json.loads(prospect.listing_snapshot_json or "{}")
    except ValueError:
        snapshot = {}
    return sps.reduced_date_info(prospect, snapshot if isinstance(snapshot, dict) else {})


def qualifies(prospect: StaleListingProspect) -> bool:
    return reduced_date(prospect) is not None or days_on_market(prospect) >= STALE_MIN_DAYS


def _stale_order(prospect: StaleListingProspect) -> tuple:
    """Known days on market first (longest first), then reductions (oldest first)."""
    reduced = reduced_date(prospect)
    if reduced is None:
        return (0, -days_on_market(prospect))
    return (1, reduced or "9999")


def market_label(prospect: StaleListingProspect) -> str:
    """"412 days" or "Reduced Jul 2026" for the letter table."""
    reduced = reduced_date(prospect)
    if reduced is None:
        return f"{days_on_market(prospect)} days"
    if not reduced:
        return "Price reduced"
    return "Reduced " + datetime.strptime(reduced, "%Y-%m-%d").strftime("%b %Y")


def _owner_filter():
    return (
        StaleListingProspect.country == "UK",
        StaleListingProspect.audience == "owner",
        or_(StaleListingProspect.source_status.is_(None), StaleListingProspect.source_status != "archived"),
    )


async def make_agent_code(db: AsyncSession) -> str:
    for _ in range(60):
        code = f"{random.randint(10000, 99999)}"
        if (await db.execute(select(StaleAgentAccount.id).where(StaleAgentAccount.agent_code == code))).first() is None:
            return code
    raise RuntimeError("Could not allocate a unique agency code.")


async def make_agent_copy_code(db: AsyncSession) -> str:
    """"A" + 3 characters: fits property_code's 4 characters, never matches
    the 4-digit owner code lookup (which keeps digits only), and doesn't use
    up the owner codes."""
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(60):
        code = "A" + "".join(random.choices(alphabet, k=3))
        if (await db.execute(select(StaleListingProspect.id).where(StaleListingProspect.property_code == code))).first() is None:
            return code
    raise RuntimeError("Could not allocate a unique agent copy code.")


async def refresh_agent_accounts(db: AsyncSession) -> dict[str, int]:
    """Create or update an account for every agency company with at least
    MIN_LISTINGS owner prospects. Existing accounts keep their code; their
    letter branch, brand and count follow the current prospects."""
    P = StaleListingProspect
    rows = (await db.execute(
        select(P).where(*_owner_filter(), P.agent_company_name.is_not(None))
    )).scalars().all()
    groups: dict[str, list[Any]] = defaultdict(list)
    for row in rows:
        if not qualifies(row):
            continue
        key = company_key(row.agent_company_name)
        if key:
            groups[key].append(row)
    existing = {a.company_key: a for a in (await db.execute(select(StaleAgentAccount))).scalars()}
    created = updated = 0
    for key, items in groups.items():
        if len(items) < MIN_LISTINGS:
            continue
        by_branch = Counter(i.agent_branch_id or i.agent_branch_name or "" for i in items)
        busiest_key = by_branch.most_common(1)[0][0]
        busiest = next(i for i in items if (i.agent_branch_id or i.agent_branch_name or "") == busiest_key)
        brands = Counter(i.agent_brand for i in items if i.agent_brand)
        names = Counter(i.agent_company_name for i in items)
        account = existing.get(key)
        if account is None:
            account = StaleAgentAccount(company_key=key, agent_code=await make_agent_code(db), qr_token_hashes=[])
            db.add(account)
            created += 1
        else:
            updated += 1
        account.company_name = names.most_common(1)[0][0]
        account.company_names_json = json.dumps(sorted(names))
        # A group trading under several brands (e.g. Leaders and Romans Group:
        # Langford Russell, Gibbs Gillespie, Acorn...) is greeted by the group's
        # name, not whichever brand happens to have the most listings.
        account.brand = next(iter(brands)) if len(brands) == 1 else display_company_name(account.company_name)
        account.letter_branch_id = busiest.agent_branch_id
        account.letter_branch_name = busiest.agent_branch_name
        account.letter_address = busiest.agent_address
        account.letter_phone = busiest.agent_phone
        account.logo_url = busiest.agent_logo_url
        account.listing_count = len(items)
    await db.commit()
    return {"companies_with_stale_listings": sum(1 for v in groups.values() if len(v) >= MIN_LISTINGS),
            "created": created, "updated": updated}


async def portfolio(db: AsyncSession, account: StaleAgentAccount) -> list[StaleListingProspect]:
    """The owner prospects this agency is marketing that meet discovery's
    criteria (see STALE_MIN_DAYS): known days on market first, longest first,
    then price reductions."""
    names = json.loads(account.company_names_json or "[]") or [account.company_name]
    prospects = (await db.execute(
        select(StaleListingProspect).where(*_owner_filter(), StaleListingProspect.agent_company_name.in_(names))
    )).scalars().all()
    return sorted((p for p in prospects if qualifies(p)), key=_stale_order)


async def agent_copies(db: AsyncSession, account: StaleAgentAccount) -> dict[uuid.UUID, StaleListingProspect]:
    """This agency's copies, by the owner prospect they were made from."""
    copies = (await db.execute(
        select(StaleListingProspect).where(StaleListingProspect.agent_account_id == account.id)
    )).scalars().all()
    return {c.parent_prospect_id: c for c in copies if c.parent_prospect_id}


async def find_account(db: AsyncSession, *, token: str | None = None, code: str | None = None) -> StaleAgentAccount | None:
    if token and token.strip():
        return (await db.execute(
            select(StaleAgentAccount).where(StaleAgentAccount.qr_token_hashes.contains([sps.hash_access_token(token.strip())]))
        )).scalar_one_or_none()
    digits = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(digits) == 5:
        return (await db.execute(select(StaleAgentAccount).where(StaleAgentAccount.agent_code == digits))).scalar_one_or_none()
    return None


def issue_account_token(account: StaleAgentAccount) -> str:
    """A new link token for the account (earlier ones keep working)."""
    token = sps.create_access_token()
    account.qr_token_hashes = [*(account.qr_token_hashes or []), sps.hash_access_token(token)]
    return token


async def open_agent_copy(
    db: AsyncSession, account: StaleAgentAccount, owner: StaleListingProspect
) -> tuple[StaleListingProspect, str]:
    """The agency's own copy of `owner` (made on first open) and a fresh
    access token for it. Commits."""
    now = datetime.now(timezone.utc)
    token = sps.create_access_token()
    copy = (await db.execute(
        select(StaleListingProspect).where(
            StaleListingProspect.agent_account_id == account.id,
            StaleListingProspect.parent_prospect_id == owner.id,
        )
    )).scalar_one_or_none()
    if copy is None:
        copy = StaleListingProspect(
            **{field: getattr(owner, field) for field in _COPIED_FIELDS},
            property_code=await make_agent_copy_code(db),
            qr_token_hash=sps.hash_access_token(token),
            qr_token_hashes=[sps.hash_access_token(token)],
            audience="agent",
            agent_account_id=account.id,
            parent_prospect_id=owner.id,
            source_status="active",
            # Not the owner's: letter-stage statuses would make the letter
            # email retry loop pick the copy up.
            processing_status="report_ready",
            discovered_at=now,
            processed_at=now,
            payment_status="pending",
            agent_checked_at=now,
        )
        db.add(copy)
    else:
        sps.record_qr_token(copy, token)
    await db.commit()
    return copy, token


def property_status(copy: StaleListingProspect | None) -> str:
    """Where the agency is with one property, for the portfolio list."""
    if copy is None:
        return "new"
    if copy.unlocked_at:
        return "unlocked"
    if copy.contact_details_submitted_at:
        return "in_progress"
    return "opened"


# ── Letter ──────────────────────────────────────────────────────────────────

def _address_lines(address: str | None) -> list[str]:
    return [part.strip() for part in (address or "").split(",") if part.strip()]


def generate_agent_letter_pdf(
    account: StaleAgentAccount, prospects: list[StaleListingProspect], token: str, public_base_url: str
) -> str:
    """One-page A4 letter to the agency: its stale listings (the longest
    few in a table), and the code/QR for /check/agent. Returns the path."""
    if sps._PDF_LIBS_IMPORT_ERROR:
        raise RuntimeError("Install reportlab and qrcode to generate letters.") from sps._PDF_LIBS_IMPORT_ERROR
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas as rl_canvas

    output_dir = Path("generated") / "agent-letters"
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / f"agent-letter-{account.agent_code}.pdf"
    width, height = A4
    margin = sps._LETTER_MARGIN
    ink, muted, accent = sps._LETTER_INK, sps._LETTER_MUTED, sps._LETTER_ACCENT
    body = ParagraphStyle("AgentBody", fontName=sps._LETTER_FONT_REGULAR, fontSize=10, leading=14.2, textColor=ink)
    small = ParagraphStyle("AgentSmall", fontName=sps._LETTER_FONT_REGULAR, fontSize=8.6, leading=11.5, textColor=muted)
    title = ParagraphStyle("AgentTitle", fontName=sps._LETTER_FONT_EXTRABOLD, fontSize=19, leading=23, textColor=ink)
    esc = sps._letter_esc
    count = len(prospects)
    known = [days_on_market(p) for p in prospects if reduced_date(p) is None]
    n_reduced = count - len(known)
    brand = account.brand or display_company_name(account.company_name)
    if not n_reduced:
        headline = f"{count} of your listings have been on the market for {max(min(known) // 30, 1)}+ months"
        how_stale = f"have now been listed for {min(known)} days or more"
    elif not known:
        headline = f"{count} of your listings have stalled on the market"
        how_stale = "have been reduced in price without finding a buyer"
    else:
        headline = f"{count} of your listings have stalled on the market"
        how_stale = "have been listed for six months or more, or reduced in price without finding a buyer"

    page = rl_canvas.Canvas(str(pdf_path), pagesize=A4)
    page.setTitle(f"Havlo StaleListings - {brand}")

    # Header: logo, tagline, the purple corner flag.
    top = height - 46
    if sps._LETTER_LOGO_PATH.is_file():
        page.drawImage(str(sps._LETTER_LOGO_PATH), margin, top - 22, width=100, height=23.3, mask="auto", preserveAspectRatio=True)
    else:
        page.setFillColor(ink)
        page.setFont("Helvetica-Bold", 24)
        page.drawString(margin, top - 18, "HAVLO")
    page.setFillColor(colors.HexColor("#3A3A3C"))
    page.setFont("Helvetica", 9.5)
    page.drawString(margin + 1, top - 34, "StaleListings for Agents")
    page.setFillColor(accent)
    page.setFont("Helvetica-Bold", 16)
    page.drawRightString(width - margin, top, "Your stale listings, seen")
    page.drawRightString(width - margin, top - 19, "through the market's eyes")
    sps._letter_draw_corner_flag(page, width, height)

    # Date and recipient.
    y = height - 128
    page.setFillColor(muted)
    page.setFont(sps._LETTER_FONT_REGULAR, 9.5)
    page.drawString(margin, y, datetime.now(timezone.utc).strftime("%-d %B %Y"))
    y -= 22
    page.setFillColor(ink)
    lines = ["For the attention of the Directors", display_company_name(account.company_name)]
    lines += _address_lines(account.letter_address)
    for i, line in enumerate(lines):
        page.setFont(sps._LETTER_FONT_BOLD if i == 1 else sps._LETTER_FONT_REGULAR, 10)
        page.drawString(margin, y, line)
        y -= 13.5
    y -= 14

    y = sps._letter_para(page, headline, margin, y, width - 2 * margin, title) - 12
    paragraphs = [
        f"Dear {esc(brand)} team,",
        f"We track how long homes stay on the market across the UK. <b>{count} properties</b> your agency is "
        f"marketing on Rightmove {how_stale} &ndash; the point where buyer "
        "attention usually fades and vendors start asking what could be done differently.",
        "For each one we have prepared an independent <b>Property Performance Assessment</b>: how its price sits "
        "against recent recorded sales nearby, what may be holding back buyer interest, the competition around it, "
        "and a practical plan to get it moving. It is designed to support your work with your vendor, not replace you.",
    ]
    for text in paragraphs:
        y = sps._letter_para(page, text, margin, y, width - 2 * margin, body) - 8

    # The longest-listed properties: as many rows as fit above the access
    # box, sign-off and footer (a long branch address leaves less room).
    reserved = 104 + 24 + 24 + 34 + 72  # access box, gaps, sign-off, footer
    fit = int((y - 6 - 16 - 16 - reserved) // 19)
    rows = prospects[:max(3, min(LETTER_TABLE_ROWS, fit))]
    col_price, col_days = width - margin - 150, width - margin
    y -= 6
    page.setFillColor(sps._LETTER_CARD_BG)
    table_h = 24 + 19 * len(rows) + (16 if count > len(rows) else 0)
    page.roundRect(margin, y - table_h, width - 2 * margin, table_h, 10, stroke=0, fill=1)
    y -= 16
    page.setFillColor(muted)
    page.setFont(sps._LETTER_FONT_BOLD, 8)
    page.drawString(margin + 12, y, "PROPERTY")
    page.drawRightString(col_price, y, "ASKING PRICE")
    page.drawRightString(col_days - 12, y, "ON THE MARKET")
    for prospect in rows:
        y -= 19
        address = (prospect.property_address or "").strip()
        if prospect.postcode and prospect.postcode not in address:
            address = f"{address}, {prospect.postcode}"
        page.setFillColor(ink)
        page.setFont(sps._LETTER_FONT_REGULAR, 9.2)
        max_w = col_price - margin - 90
        if page.stringWidth(address, sps._LETTER_FONT_REGULAR, 9.2) > max_w:
            while address and page.stringWidth(address + "…", sps._LETTER_FONT_REGULAR, 9.2) > max_w:
                address = address[:-1]
            address = address.rstrip(", ") + "…"
        page.drawString(margin + 12, y, address)
        page.drawRightString(col_price, y, f"£{int(prospect.asking_price or 0):,}")
        page.setFillColor(sps._LETTER_ORANGE)
        page.setFont(sps._LETTER_FONT_BOLD, 9.2)
        page.drawRightString(col_days - 12, y, market_label(prospect))
    if count > len(rows):
        y -= 16
        page.setFillColor(muted)
        page.setFont(sps._LETTER_FONT_REGULAR, 8.6)
        page.drawString(margin + 12, y, f"+ {count - len(rows)} more in your portfolio")
    y -= 24

    # Access box: QR straight to the portfolio, and the agency code.
    box_h = 104
    box_y = y - box_h
    page.setFillColor(sps._LETTER_CARD_BG)
    page.setStrokeColor(sps._LETTER_CARD_BORDER)
    page.roundRect(margin, box_y, width - 2 * margin, box_h, 14, stroke=1, fill=1)
    code_w = 150
    code_x = width - margin - code_w
    page.setFillColor(accent)
    page.roundRect(code_x, box_y, code_w, box_h, 14, stroke=0, fill=1)
    page.rect(code_x, box_y, 14, box_h, stroke=0, fill=1)
    page.setFillColor(colors.white)
    page.setFont("Helvetica-Bold", 8)
    page.drawCentredString(code_x + code_w / 2, box_y + box_h - 24, "YOUR AGENCY CODE")
    page.setFont("Helvetica-Bold", 28)
    page.drawCentredString(code_x + code_w / 2, box_y + box_h / 2 - 8, account.agent_code)
    qr_size = box_h - 22
    url = f"{public_base_url.rstrip('/')}/check/agent?token={token}"
    page.drawImage(ImageReader(sps._letter_make_qr(url)), code_x - qr_size - 14, box_y + 11, qr_size, qr_size)
    label = ParagraphStyle("AgentScan", fontName=sps._LETTER_FONT_BOLD, fontSize=12.5, leading=15.5, textColor=ink)
    text_w = code_x - qr_size - 28 - (margin + 18)
    sps._letter_para(
        page, f"Scan to see all {count} listings and their assessments, or visit "
        f"<font color='#A409D2'>heyhavlo.com/check/agent</font> and enter your agency code.",
        margin + 18, box_y + box_h - 20, text_w, label,
    )
    y = box_y - 24

    y = sps._letter_para(page, "Kind regards,<br/><b>The Havlo StaleListings team</b>", margin, y, width - 2 * margin, body)
    sps._letter_para(page, sps._LETTER_LEGAL_TEXT, margin, 56, width - 2 * margin, small)
    page.showPage()
    page.save()
    return str(pdf_path)


async def refresh_agent_accounts_job() -> dict[str, int]:
    """refresh_agent_accounts with its own session, for the background loop."""
    from app.db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        return await refresh_agent_accounts(db)
