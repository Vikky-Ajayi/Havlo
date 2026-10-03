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


def unique_listings(prospects: list[Any], prefer: set | None = None) -> list[Any]:
    """One prospect per Rightmove listing. A sheet upload could add a listing
    discovery already had under a differently written link, and counting
    both overstated agencies' stale listings (and listed the property twice
    on their letter). Keeps the copy in `prefer` (ids), else the one whose
    code was used, else the oldest."""
    prefer = prefer or set()
    best: dict[str, Any] = {}
    for p in prospects:
        key = sps.rightmove_listing_id(p.rightmove_url) or str(p.id)
        rank = (p.id not in prefer, p.code_looked_up_at is None, p.created_at or datetime.max.replace(tzinfo=timezone.utc))
        if key not in best or rank < best[key][0]:
            best[key] = (rank, p)
    kept = {id(p) for _, p in best.values()}
    return [p for p in prospects if id(p) in kept]


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
    groups = {key: unique_listings(items) for key, items in groups.items()}
    existing = {a.company_key: a for a in (await db.execute(select(StaleAgentAccount))).scalars()}
    created = updated = 0
    # Accounts never go (their code may be in the post), but one that no
    # longer has MIN_LISTINGS shows its real count, which keeps it out of
    # the agency list and letters.
    for key, account in existing.items():
        if len(groups.get(key, [])) < MIN_LISTINGS:
            account.listing_count = len(groups.get(key, []))
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
    opened = set((await db.execute(
        select(StaleListingProspect.parent_prospect_id).where(StaleListingProspect.agent_account_id == account.id)
    )).scalars().all())
    return sorted(unique_listings([p for p in prospects if qualifies(p)], prefer=opened), key=_stale_order)


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
    # Details are collected once per agency: pre-fill them, and the funnel
    # goes straight to the assessment (it skips the form when a prospect
    # already has contact details).
    if account.contact_email and not copy.contact_email:
        copy.contact_name = account.contact_name
        copy.contact_email = account.contact_email
        copy.contact_phone = account.contact_phone
        copy.contact_details_submitted_at = now
        copy.property_confirmed_at = copy.property_confirmed_at or now
    await db.commit()
    return copy, token


async def remember_agency_contact(db: AsyncSession, copy: StaleListingProspect) -> None:
    """After the details form is submitted on an agency's copy: keep them on
    the agency (the first time), for every later property and the follow-ups.
    The caller commits."""
    if copy.audience != "agent" or not copy.agent_account_id:
        return
    if copy.lead_source == "meta_agent":
        # Came in through an ads landing page: the ads emails cover them, so
        # the agency doesn't also start the letter campaign's follow-ups.
        return
    account = await db.get(StaleAgentAccount, copy.agent_account_id)
    if account is None or account.contact_email:
        return
    account.contact_name = copy.contact_name
    account.contact_email = copy.contact_email
    account.contact_phone = copy.contact_phone
    account.contact_details_submitted_at = datetime.now(timezone.utc)


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


def _letter_wording(prospects: list[StaleListingProspect]) -> tuple[str, str]:
    """(headline, "how stale" phrase) that's true for this mix of listings:
    known days on market and/or price reductions (see STALE_MIN_DAYS)."""
    count = len(prospects)
    known = [days_on_market(p) for p in prospects if reduced_date(p) is None]
    if len(known) == count and known:
        return (f"{count} of your listings have been on the market for more than {max(min(known) // 30, 1)} months.",
                f"have now been listed for {min(known)} days or more")
    if not known:
        return (f"{count} of your listings have stalled on the market.",
                "have been reduced in price without finding a buyer")
    return (f"{count} of your listings have stalled on the market.",
            "have been listed for six months or more, or reduced in price without finding a buyer")


def _agent_letter_header(page, width: float, height: float) -> None:
    from reportlab.lib import colors

    margin = sps._LETTER_MARGIN
    top = height - 46
    if sps._LETTER_LOGO_PATH.is_file():
        page.drawImage(str(sps._LETTER_LOGO_PATH), margin, top - 22, width=100, height=23.3, mask="auto", preserveAspectRatio=True)
    else:
        page.setFillColor(sps._LETTER_INK)
        page.setFont("Helvetica-Bold", 24)
        page.drawString(margin, top - 18, "HAVLO")
    page.setFillColor(colors.HexColor("#3A3A3C"))
    page.setFont("Helvetica", 9.5)
    page.drawString(margin + 1, top - 34, "StaleListings for Agents")
    page.setFillColor(sps._LETTER_ACCENT)
    page.setFont("Helvetica-Bold", 17)
    page.drawRightString(width - margin, top, "Your stale listings, seen")
    page.drawRightString(width - margin, top - 20, "through the market's eyes")
    sps._letter_draw_corner_flag(page, width, height)


def _agent_access_box(page, x: float, y: float, w: float, h: float, qr_reader, agent_code: str, count: int,
                      cta: tuple[str, str] | None = None) -> None:
    """QR straight to the portfolio, the address to type, and the agency code."""
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.utils import ImageReader

    page.setFillColor(sps._LETTER_CARD_BG)
    page.setStrokeColor(sps._LETTER_CARD_BORDER)
    page.setLineWidth(1)
    page.roundRect(x, y, w, h, 14, stroke=1, fill=1)
    code_w = 150
    code_x = x + w - code_w
    page.setFillColor(sps._LETTER_ACCENT)
    page.roundRect(code_x, y, code_w, h, 14, stroke=0, fill=1)
    page.rect(code_x, y, 14, h, stroke=0, fill=1)
    page.setFillColor(colors.white)
    page.setFont("Helvetica-Bold", 8)
    page.drawCentredString(code_x + code_w / 2, y + h - 22, "YOUR AGENCY CODE")
    page.setFont("Helvetica-Bold", 28)
    page.drawCentredString(code_x + code_w / 2, y + h / 2 - 10, agent_code)
    qr_size = h - 20
    page.drawImage(ImageReader(qr_reader), code_x - qr_size - 14, y + 10, qr_size, qr_size)
    label = ParagraphStyle("AgentScan", fontName=sps._LETTER_FONT_BOLD, fontSize=12.5, leading=15.5, textColor=sps._LETTER_INK)
    text_w = code_x - qr_size - 28 - (x + 18)
    if cta:
        # A test version's call to action: its line, how to get in, the address.
        small = ParagraphStyle("AgentScanSub", fontName=sps._LETTER_FONT_REGULAR, fontSize=9.2, leading=12, textColor=sps._LETTER_MUTED)
        url = ParagraphStyle("AgentScanUrl", fontName=sps._LETTER_FONT_BOLD, fontSize=9.6, leading=12, textColor=sps._LETTER_ACCENT)
        ty = sps._letter_para(page, cta[0], x + 18, y + h - 16, text_w, label) - 3
        ty = sps._letter_para(page, cta[1], x + 18, ty, text_w, small) - 2
        sps._letter_para(page, "heyhavlo.com/check/agent", x + 18, ty, text_w, url)
        return
    sps._letter_para(
        page, f"Scan to see all {count} listings and their assessments, or visit "
        "<font color='#A409D2'>heyhavlo.com/check/agent</font> and enter your agency code.",
        x + 18, y + h - 18, text_w, label,
    )


# ── Letter test versions ─────────────────────────────────────────────────────
# Direct-mail A/B test (Oct 2026), as for the owner letter: version 1 is the
# letter above (the control, unchanged); versions 2-5 rewrite page 1's copy
# and the call to action only. The QR code is the same for all.
AGENT_LETTER_VERSIONS = (1, 2, 3, 4, 5)


def _agent_version_copy(version: int, count: int, brand: str) -> dict[str, Any]:
    brand = sps._letter_esc(brand)
    copies: dict[int, dict[str, Any]] = {
        2: {
            "headline": f"We reviewed {count} of your long-running listings. A few patterns stood out.",
            "body": [
                f"We identified <b>{count} properties</b> currently marketed by {brand} that have been listed for <b>six months or more</b>, or have had a price reduction without yet finding a buyer.",
                "We then reviewed the publicly available market information for each property. Across the listings, we found <b>several areas worth a second look</b> &mdash; including how some homes are <b>positioned against nearby competition</b> and how the listings may appear to buyers comparing alternatives.",
                "We have summarised those observations in a separate Property Performance Assessment for each listing. The assessments are intended to give your team <b>another perspective</b>, <b>not to replace your existing expertise or vendor relationship</b>.",
            ],
            "section": "WHAT WE REVIEWED",
            "items": ["Price vs Recent Sold Prices", "Competing Listings Nearby", "Listing Presentation", "Buyer Appeal", "Potential Friction Points", "Practical Next Steps"],
            "closing": f"The {count} properties and their initial findings are ready to view.",
            "cta": (f"See what stood out across your {count} listings.", "Scan the QR code and enter your agency code."),
        },
        3: {
            "headline": f"{count} vendors may soon be asking: \u201cWhat do we do next?\u201d",
            "body": [
                f"We identified <b>{count} properties</b> currently marketed by {brand} that have remained on the market for <b>six months or more</b>, or have been reduced without yet finding a buyer.",
                "Long-running instructions can lead to <b>difficult conversations</b> about price, presentation, marketing and what should happen next. Havlo has independently reviewed the publicly available information for each of these properties to help give your team <b>additional evidence</b> for those conversations.",
                "Each Property Performance Assessment is designed to <b>sit alongside your own expertise</b>. It can help structure a vendor review, highlight areas worth discussing and provide a <b>practical starting point</b> for the next phase of the instruction.",
            ],
            "section": "USE THE ASSESSMENT TO REVIEW",
            "items": ["Current Price Position", "Nearby Competition", "Listing Presentation", "Buyer Appeal", "Possible Stalling Factors", "Next-Step Actions"],
            "closing": f"We have already identified the {count} listings and prepared their assessment summaries.",
            "cta": ("Prepare for your next vendor review.", f"Scan to see the {count} properties and their assessments."),
        },
        4: {
            "headline": f"You already won the instruction. Can these {count} listings be moved forward?",
            "body": [
                f"{brand} currently has <b>{count} properties</b> we identified as having been marketed for <b>six months or more</b>, or reduced in price without yet finding a buyer.",
                "These are instructions your team has <b>already worked to win</b>. When a listing stalls, generating <b>fresh attention</b> may require more than simply waiting for the next enquiry.",
                f"Havlo has prepared an independent <b>Property Performance Assessment</b> for each of the {count} properties, looking at the listing in the context of <b>current competition</b>, pricing signals, presentation and buyer appeal.",
                "The aim is simple: give your team another set of observations that may help you decide what to test, change or discuss with the vendor &mdash; <b>while you retain the instruction and the client relationship</b>.",
            ],
            "section": "EACH ASSESSMENT LOOKS AT",
            "items": ["Price Position", "Nearby Competition", "Listing Presentation", "Buyer Appeal", "Why Interest May Be Limited", "Practical Action Plan"],
            "closing": f"Your {count} listings are grouped together for your team to review.",
            "cta": (f"See the {count} listings we reviewed.", "Scan to open your agency summary and assessment previews."),
        },
        5: {
            "headline": "Sometimes a long-running listing just needs a fresh pair of eyes.",
            "body": [
                f"We identified <b>{count} properties</b> currently marketed by {brand} that have been on the market for <b>six months or more</b>, or have been reduced without yet finding a buyer.",
                "Your team knows the vendors, the local market and the work already carried out. Havlo adds something different: an <b>independent review</b> of how each property currently appears when viewed against the <b>wider market</b>.",
                "For each property, we prepared a <b>Property Performance Assessment</b> covering pricing context, nearby competition, listing presentation, buyer appeal and <b>practical areas</b> your team may wish to revisit.",
                "This is <b>not a replacement for your agency</b> or your advice. Think of it as <b>a second set of eyes</b> that can help surface observations that are easy to miss after a listing has been live for several months.",
            ],
            "section": "A SECOND LOOK AT",
            "items": ["Pricing Context", "Nearby Competition", "Listing Presentation", "Buyer Appeal", "Potential Stalling Factors", "Practical Next Steps"],
            "closing": f"We have summarised all {count} properties for your agency.",
            "cta": (f"Take a fresh look at your {count} listings.", "Scan the QR code and enter your agency code."),
        },
    }
    if version not in copies:
        raise ValueError(f"Unknown agent letter version: {version}")
    return copies[version]


def _agent_page1_body(page, width: float, height: float, account: StaleAgentAccount,
                      prospects: list[StaleListingProspect], gap_scale: float = 1.0, version: int = 1) -> float:
    """Page 1's flowing content, address block to "summarised on the next
    page"; returns the final y. Same measure-then-draw approach as the owner
    letter (see stale_prospect_service._letter_draw_page1_body): `gap_scale`
    compresses the whitespace so a long address never runs into the QR box."""
    from reportlab.lib.styles import ParagraphStyle

    def g(n: float) -> float:
        return n * gap_scale

    margin = sps._LETTER_MARGIN
    body = sps._LETTER_BODY_STYLE
    headline, how_stale = _letter_wording(prospects)
    count = len(prospects)

    # Address block where the owner letter's is: the mail house overlays its
    # code above it and a barcode below it, hence the wide gap after.
    y = height - 150
    page.setFillColor(sps._LETTER_INK)
    page.setFont("Helvetica", 10.5)
    address_x = margin + 7 * page.stringWidth(" ", "Helvetica", 10.5)
    page.drawRightString(width - margin, y, datetime.now(timezone.utc).strftime("%d/%m/%Y"))
    lines = ["Regarding your property listings", display_company_name(account.company_name)]
    address = _address_lines(account.letter_address)
    lines += address if len(address) <= 5 else [*address[:4], address[-1]]
    for line in lines:
        page.drawString(address_x, y, line)
        y -= 14.5
    y -= g(90)

    headline_style = ParagraphStyle("AgentHeadline", fontName="Helvetica-Bold", fontSize=22.5, leading=26, textColor=sps._LETTER_ACCENT)
    if version != 1:
        copy = _agent_version_copy(version, count, account.brand or display_company_name(account.company_name))
        w = width - 2 * margin
        y = sps._letter_para(page, copy["headline"], margin, y, w, headline_style) - g(16)
        for i, text in enumerate(copy["body"]):
            y = sps._letter_para(page, text, margin, y - (g(8) if i else 0), w, body)
        y -= g(22)
        sps._letter_draw_tracked_text(
            page, copy["section"], margin, y,
            font=sps._LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=sps._LETTER_INK,
        )
        y -= g(10) + 14
        y = sps._letter_draw_checklist_grid(page, margin, y, w, copy["items"], 2, row_h=24) - g(6)
        return sps._letter_para(page, copy["closing"], margin, y, w, body)
    y = sps._letter_para(page, headline, margin, y, width - 2 * margin, headline_style) - g(16)
    y = sps._letter_para(
        page, f"We track how long homes stay on the market across the UK. <b>{count} properties</b> your agency "
        f"is marketing on Rightmove {how_stale} &ndash; the point where buyer attention usually fades and vendors "
        "start asking what could be done differently.",
        margin, y, width - 2 * margin, body,
    ) - g(8)
    y = sps._letter_para(
        page, "Havlo specialises in analysing properties that have remained unsold for an extended period. For each "
        "of these listings we have prepared an independent <b>Property Performance Assessment</b>, designed to support "
        "your work with your vendor &ndash; not replace you.",
        margin, y, width - 2 * margin, body,
    ) - g(22)

    sps._letter_draw_tracked_text(
        page, "WHAT EACH ASSESSMENT COVERS", margin, y,
        font=sps._LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=sps._LETTER_INK,
    )
    y -= g(10) + 14
    y = sps._letter_draw_checklist_grid(
        page, margin, y, width - 2 * margin,
        ["Price vs Recent Sold Prices", "Competing Listings Nearby", "Listing Presentation",
         "Buyer Appeal", "Why It May Have Stalled", "A Practical Action Plan"],
        2, row_h=24,
    ) - g(6)
    return sps._letter_para(
        page, f"Your {count} listings are summarised on the following page.", margin, y, width - 2 * margin, body,
    )


def generate_agent_letter_pdf(
    account: StaleAgentAccount, prospects: list[StaleListingProspect], token: str, public_base_url: str,
    letter_version: int | None = None,
) -> str:
    """Two-page A4 letter to the agency. Page 1: the pitch, what each
    assessment covers, and the QR/agency code. Page 2: its stale listings
    (as many as fit, longest first) and how it works. Returns the path."""
    if sps._PDF_LIBS_IMPORT_ERROR:
        raise RuntimeError("Install reportlab and qrcode to generate letters.") from sps._PDF_LIBS_IMPORT_ERROR
    from io import BytesIO

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfgen import canvas as rl_canvas

    output_dir = Path("generated") / "agent-letters"
    output_dir.mkdir(parents=True, exist_ok=True)
    version = letter_version or getattr(account, "letter_version", None) or 1
    pdf_path = output_dir / f"agent-letter-{account.agent_code}{f'-v{version}' if version != 1 else ''}.pdf"
    width, height = A4
    margin = sps._LETTER_MARGIN
    ink, muted, accent = sps._LETTER_INK, sps._LETTER_MUTED, sps._LETTER_ACCENT
    count = len(prospects)
    brand = account.brand or display_company_name(account.company_name)
    qr_reader = sps._letter_make_qr(f"{public_base_url.rstrip('/')}/check/agent?token={token}")

    page = rl_canvas.Canvas(str(pdf_path), pagesize=A4)
    page.setTitle(f"Havlo StaleListings - {brand}")

    # ── Page 1 ──
    _agent_letter_header(page, width, height)
    footer_note = (
        "If any of these properties are no longer on your books, please disregard them. We identify properties "
        "currently listed for sale using publicly available listing information, and occasional errors may occur. "
        "This is a property marketing and saleability analysis, not a formal valuation, survey or structural assessment."
    )
    qr_h = 91
    qr_bottom = sps._letter_footer_height(width, footer_note) + 18
    measure = rl_canvas.Canvas(BytesIO(), pagesize=A4)
    y_full = _agent_page1_body(measure, width, height, account, prospects, gap_scale=1.0, version=version)
    y_none = _agent_page1_body(measure, width, height, account, prospects, gap_scale=0.0, version=version)
    overflow = (qr_bottom + qr_h + 16) - y_full
    gap_scale = max(0.55, 1.0 - overflow / (y_none - y_full)) if overflow > 0 and y_none > y_full else 1.0
    _agent_page1_body(page, width, height, account, prospects, gap_scale=gap_scale, version=version)
    cta = _agent_version_copy(version, count, brand)["cta"] if version != 1 else None
    _agent_access_box(page, margin, qr_bottom, width - 2 * margin, qr_h, qr_reader, account.agent_code, count, cta=cta)
    sps._letter_draw_footer(page, width, footer_note)
    page.showPage()

    # ── Page 2 ──
    _agent_letter_header(page, width, height)
    y = height - 140
    sps._letter_draw_tracked_text(
        page, "YOUR STALE LISTINGS", margin, y,
        font=sps._LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=ink,
    )
    y -= 10
    y = sps._letter_para(
        page, f"The {count} listings we assessed for {sps._letter_esc(brand)}, those longest on the market first.",
        margin, y, width - 2 * margin, sps._LETTER_BODY_STYLE,
    ) - 12

    # Everything below the table, bottom up: legal line, sign-off, how it works.
    legal_style = ParagraphStyle("AgentLegal", fontName=sps._LETTER_FONT_REGULAR, fontSize=7.4, leading=10, textColor=muted, alignment=1)
    steps_h, signoff_h, legal_top = 118, 44, 62
    table_bottom_limit = legal_top + signoff_h + steps_h + 20
    row_h, head_h = 19.5, 26
    more_h = 18
    fit = int((y - table_bottom_limit - head_h - more_h) // row_h)
    rows = prospects[:max(1, min(count, fit))]
    col_price, col_market = width - margin - 170, width - margin - 12
    table_h = head_h + row_h * len(rows) + (more_h if count > len(rows) else 6)
    page.setFillColor(sps._LETTER_CARD_BG)
    page.roundRect(margin, y - table_h, width - 2 * margin, table_h, 10, stroke=0, fill=1)
    y -= 17
    page.setFillColor(muted)
    page.setFont(sps._LETTER_FONT_BOLD, 8)
    page.drawString(margin + 12, y, "PROPERTY")
    page.drawRightString(col_price, y, "ASKING PRICE")
    page.drawRightString(col_market, y, "ON THE MARKET")
    max_w = col_price - margin - 100
    for prospect in rows:
        y -= row_h
        address = (prospect.property_address or "").strip()
        if prospect.postcode and prospect.postcode not in address:
            address = f"{address}, {prospect.postcode}"
        if page.stringWidth(address, sps._LETTER_FONT_REGULAR, 9.2) > max_w:
            while address and page.stringWidth(address + "…", sps._LETTER_FONT_REGULAR, 9.2) > max_w:
                address = address[:-1]
            address = address.rstrip(", ") + "…"
        page.setFillColor(ink)
        page.setFont(sps._LETTER_FONT_REGULAR, 9.2)
        page.drawString(margin + 12, y, address)
        page.drawRightString(col_price, y, f"£{int(prospect.asking_price or 0):,}")
        page.setFillColor(sps._LETTER_ORANGE)
        page.setFont(sps._LETTER_FONT_BOLD, 9.2)
        page.drawRightString(col_market, y, market_label(prospect))
    if count > len(rows):
        y -= more_h
        page.setFillColor(muted)
        page.setFont(sps._LETTER_FONT_REGULAR, 8.6)
        page.drawString(margin + 12, y, f"+ {count - len(rows)} more, all listed at heyhavlo.com/check/agent")

    # How it works: three numbered steps across the page.
    steps_top = legal_top + signoff_h + steps_h
    sps._letter_draw_tracked_text(
        page, "HOW IT WORKS", margin, steps_top,
        font=sps._LETTER_FONT_BOLD, size=10, char_space=10 * -0.03, color=ink,
    )
    steps = [
        "Scan the QR code on the first page, or visit <b>heyhavlo.com/check/agent</b>.",
        f"Enter your agency code <b>{account.agent_code}</b> and choose a listing.",
        "See its assessment, unlock the full report and share it with your vendor.",
    ]
    step_style = ParagraphStyle("AgentStep", fontName=sps._LETTER_FONT_REGULAR, fontSize=9.6, leading=13.2, textColor=ink)
    col_w = (width - 2 * margin) / 3
    for i, text in enumerate(steps):
        cx = margin + col_w * i
        cy = steps_top - 34
        page.setFillColor(accent)
        page.circle(cx + 13, cy, 13, stroke=0, fill=1)
        page.setFillColorRGB(1, 1, 1)
        page.setFont("Helvetica-Bold", 12)
        page.drawCentredString(cx + 13, cy - 4.2, str(i + 1))
        sps._letter_para(page, text, cx, cy - 22, col_w - 18, step_style)

    sps._letter_para(page, "Kind regards,<br/><b>The Havlo StaleListings team</b>", margin,
                     legal_top + signoff_h - 6, width - 2 * margin, sps._LETTER_BODY_STYLE)
    sps._letter_para(page, sps._LETTER_LEGAL_TEXT, margin, legal_top - 20, width - 2 * margin, legal_style)
    page.showPage()
    page.save()
    return str(pdf_path)


async def refresh_agent_accounts_job() -> dict[str, int]:
    """refresh_agent_accounts with its own session, for the background loop."""
    from app.db.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        return await refresh_agent_accounts(db)
