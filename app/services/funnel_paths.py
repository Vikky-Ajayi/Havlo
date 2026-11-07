"""Where Stale Listings links send a prospect after the landing page.

Two campaign funnels keep their whole journey under their own directory:
Rightmove's pages (/rm/seller, /rm/agent; leads tagged rm_...) and the Meta2
offer page (/offer/seller; leads tagged meta2_...). For each, the return from
payment (/<dir>/complete), the full report (/<dir>/report), the optional next
steps (/<dir>/next-steps) and the 30-day dashboard (/<dir>/dashboard/<token>)
stay under it. Those pages load the campaign's own Tag Manager container and
no Meta Pixel (havlo_frontend/index.html, src/lib/gtm.ts), so it can track the
journey end to end. Every other lead keeps the default addresses.

Kept free of app imports so the link builders (listing_monitor,
analyst_review, the post-purchase drip, the stale-listings router) can all
use it without import cycles.
"""
from __future__ import annotations

# lead_source prefix -> the journey's directory.
JOURNEYS = {"rm_": "/rm", "meta2_": "/offer"}


def journey_dir(lead_source: str | None) -> str | None:
    """"/rm" or "/offer" for a campaign lead with its own directory, else None."""
    source = lead_source or ""
    return next((d for prefix, d in JOURNEYS.items() if source.startswith(prefix)), None)


def is_rm_lead(lead_source: str | None) -> bool:
    """A lead from the /rm/ pages: rm_seller, rm_agent or rm_agent_listing
    (ads_funnel.channel_of(...) == "rm")."""
    return (lead_source or "").startswith("rm_")


def landing_path(lead_source: str | None, audience: str | None) -> str | None:
    """The campaign landing page for a lead with its own directory, None for anyone
    else. The offer page has no agent version."""
    base = journey_dir(lead_source)
    if base is None:
        return None
    return f"{base}/agent" if audience == "agent" and base == "/rm" else f"{base}/seller"


def complete_path(lead_source: str | None) -> str:
    base = journey_dir(lead_source)
    return f"{base}/complete" if base else "/stale-listings/prospect/complete"


def report_path(lead_source: str | None) -> str:
    base = journey_dir(lead_source)
    return f"{base}/report" if base else "/stale-listings/prospect/report"


def next_steps_path(lead_source: str | None) -> str:
    base = journey_dir(lead_source)
    return f"{base}/next-steps" if base else "/stale-listings/prospect/next-steps"


def dashboard_path(lead_source: str | None, token: str) -> str:
    base = journey_dir(lead_source)
    return f"{base + '/dashboard' if base else '/m'}/{token}"
