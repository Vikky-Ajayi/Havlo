"""The optional services offered after a 20-factor report (the overhaul's
"Explore Next Steps"): a basket paid in ONE SumUp checkout, with the team
emailed per paid order. 30-Day Monitoring is included free with every report,
so it's shown but never charged. See StaleProspectAddonOrder."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import StaleListingProspect, StaleProspectAddonOrder
from app.services import email_service, sumup_service

logger = logging.getLogger(__name__)

# Paid add-ons; one SumUp payment covers whatever's in the basket.
ADDONS: dict[str, dict[str, Any]] = {
    "listing_rewrite": {
        "key": "listing_rewrite", "name": "Listing Rewrite", "price": 199.0,
        "blurb": "We refresh your listing with a stronger headline, a clearer, more compelling description and a "
                 "recommended photo order based on your report findings.",
        "deliverable": "You'll receive a ready-to-use, improved listing.",
    },
    "relaunch_strategy": {
        "key": "relaunch_strategy", "name": "Relaunch Strategy", "price": 299.0,
        "blurb": "A complete plan to give your property renewed momentum, including pricing guidance, timing, "
                 "where to advertise and a week-by-week action plan.",
        "deliverable": "You'll receive a clear, step-by-step relaunch plan.",
    },
}
# Shown in the basket as already yours: the dashboard that comes with the
# report. It watches the listing and the homes around it; it can't see the
# views and enquiries, which only the agent has.
INCLUDED: dict[str, Any] = {
    "key": "monitoring_30", "name": "30-Day Monitoring", "price": 0.0,
    "blurb": "Your dashboard tracks your listing, the changes you make and the homes around you for 30 days, "
             "free with every report.",
}
CURRENCY = "GBP"


def _loads(text: str | None, default: Any) -> Any:
    try:
        return json.loads(text) if text else default
    except (ValueError, TypeError):
        return default


async def completed_orders(db: AsyncSession, prospect: StaleListingProspect) -> list[StaleProspectAddonOrder]:
    rows = (await db.execute(
        select(StaleProspectAddonOrder)
        .where(StaleProspectAddonOrder.prospect_id == prospect.id,
               StaleProspectAddonOrder.status == "completed")
        .order_by(StaleProspectAddonOrder.created_at)
    )).scalars().all()
    return list(rows)


def _ordered_keys(orders: list[StaleProspectAddonOrder]) -> set[str]:
    keys: set[str] = set()
    for o in orders:
        for item in _loads(o.items_json, []):
            if isinstance(item, dict) and item.get("key"):
                keys.add(str(item["key"]))
    return keys


def catalog(orders: list[StaleProspectAddonOrder]) -> list[dict[str, Any]]:
    """The three services with a status: a paid add-on is "ordered" once it's in
    a completed order, otherwise "available"; monitoring is always "included"."""
    ordered = _ordered_keys(orders)
    out = []
    for spec in ADDONS.values():
        out.append({**spec, "status": "ordered" if spec["key"] in ordered else "available"})
    out.append({**INCLUDED, "status": "included"})
    return out


def serialize_order(order: StaleProspectAddonOrder) -> dict[str, Any]:
    return {
        "order_id": str(order.id),
        "items": _loads(order.items_json, []),
        "amount": order.amount,
        "currency": order.currency,
        "status": order.status,
        "reference": order.reference,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "paid_at": order.paid_at.isoformat() if order.paid_at else None,
    }


class AddonError(Exception):
    """A basket we can't take (unknown item, empty, already owned)."""


async def create_order(
    db: AsyncSession, prospect: StaleListingProspect, item_keys: list[str], *, redirect_url: str,
) -> dict[str, Any]:
    """Create a pending order for the selected add-ons and a single SumUp
    checkout for their total. The caller commits. Items already bought (in a
    completed order) are dropped; monitoring can't be bought here."""
    already = _ordered_keys(await completed_orders(db, prospect))
    seen: set[str] = set()
    items: list[dict[str, Any]] = []
    for key in item_keys:
        key = str(key)
        if key not in ADDONS:
            raise AddonError(f"Unknown service: {key}.")
        if key in already or key in seen:
            continue
        seen.add(key)
        spec = ADDONS[key]
        items.append({"key": spec["key"], "name": spec["name"], "price": spec["price"]})
    if not items:
        raise AddonError("Choose at least one service to continue.")

    amount = round(sum(float(i["price"]) for i in items), 2)
    reference = f"SLA-{prospect.property_code}-{uuid.uuid4().hex[:8].upper()}"
    order = StaleProspectAddonOrder(
        prospect_id=prospect.id, items_json=json.dumps(items), amount=amount,
        currency=CURRENCY, status="pending", payment_method="card", reference=reference)
    db.add(order)
    await db.flush()

    names = ", ".join(i["name"] for i in items)
    checkout = await sumup_service.create_checkout(
        amount=amount, currency=CURRENCY,
        description=f"Havlo next steps ({prospect.property_code}): {names}"[:255],
        reference=reference, redirect_url=redirect_url)
    checkout_url = checkout.get("checkout_url") or checkout.get("hosted_checkout_url") or ""
    checkout_id = checkout.get("id") or ""
    if not checkout_url or not checkout_id:
        raise sumup_service.SumUpError("Payment provider did not return a checkout link.")
    order.sumup_checkout_id = checkout_id
    order.sumup_checkout_url = checkout_url
    return {"order_id": str(order.id), "checkout_url": checkout_url, "amount": amount,
            "currency": CURRENCY, "items": items}


async def confirm_order(db: AsyncSession, order: StaleProspectAddonOrder) -> StaleProspectAddonOrder:
    """Poll SumUp for a pending order; on PAID, mark it completed and email the
    team. The caller commits. A missing/other status leaves it as it was so the
    customer can retry."""
    if order.status == "completed" or not order.sumup_checkout_id:
        return order
    try:
        data = await sumup_service.get_checkout_status(order.sumup_checkout_id)
    except sumup_service.SumUpError as exc:
        logger.error("SumUp verification failed for add-on order %s: %s", order.id, exc)
        return order
    status = (data.get("status") or "").upper()
    if status == "PAID":
        order.status = "completed"
        order.paid_at = datetime.now(timezone.utc)
    elif status in {"FAILED", "EXPIRED"}:
        logger.info("Add-on order %s %s at SumUp.", order.id, status)
    return order


async def email_team(order: StaleProspectAddonOrder, prospect: StaleListingProspect) -> bool:
    """Tell the team a paid add-on order came in (same inbox as report
    notifications, ADMIN_NOTIFY_EMAIL). Marks team_emailed_at so it's sent once."""
    if order.team_emailed_at is not None:
        return False
    items = _loads(order.items_json, [])
    fields = {
        "Property code": prospect.property_code or "—",
        "Property": prospect.property_address or "—",
        "Services": ", ".join(f'{i.get("name")} (£{i.get("price")})' for i in items) or "—",
        "Total": f"£{order.amount:.2f}",
        "Contact": prospect.contact_name or "—",
        "Email": getattr(prospect, "contact_email", None) or "—",
        "Reference": order.reference or "—",
    }
    sent = await email_service.send_admin_notification(
        "Add-on orders",
        f"New paid add-on order for {prospect.property_code}: {fields['Services']}.",
        fields, source_label="StaleListings next steps",
        property_url=prospect.rightmove_url or "")
    if sent:  # a failed send is retried by reconcile_orders
        order.team_emailed_at = datetime.now(timezone.utc)
    return sent


# A paid order is otherwise only confirmed when the customer's own tab comes
# back from SumUp to the Next Steps page (it remembers the order in that tab):
# close the tab after paying, or come back in another, and it stayed pending,
# never showed as paid in the console and the team was never told.
RECONCILE_WINDOW = timedelta(days=7)  # how far back pending checkouts are checked
RECONCILE_BATCH = 50


async def reconcile_orders() -> dict[str, int]:
    """Background (every few minutes): ask SumUp about recent pending orders
    and mark the paid ones completed, then email the team about any paid
    order it hasn't been told about yet."""
    from app.db.database import AsyncSessionLocal

    stats = {"checked": 0, "confirmed": 0, "team_emailed": 0}
    cutoff = datetime.now(timezone.utc) - RECONCILE_WINDOW
    async with AsyncSessionLocal() as db:
        pending = (await db.execute(
            select(StaleProspectAddonOrder)
            .where(StaleProspectAddonOrder.status == "pending",
                   StaleProspectAddonOrder.sumup_checkout_id.is_not(None),
                   StaleProspectAddonOrder.created_at >= cutoff)
            .order_by(StaleProspectAddonOrder.created_at.desc())
            .limit(RECONCILE_BATCH)
        )).scalars().all()
        for order in pending:
            stats["checked"] += 1
            await confirm_order(db, order)
            if order.status == "completed":
                stats["confirmed"] += 1
        await db.commit()

        unemailed = (await db.execute(
            select(StaleProspectAddonOrder)
            .where(StaleProspectAddonOrder.status == "completed", StaleProspectAddonOrder.team_emailed_at.is_(None))
            .limit(RECONCILE_BATCH)
        )).scalars().all()
        for order in unemailed:
            prospect = await db.get(StaleListingProspect, order.prospect_id)
            if prospect is not None and await email_team(order, prospect):
                stats["team_emailed"] += 1
            await db.commit()
    return stats
