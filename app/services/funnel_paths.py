"""Where Stale Listings links send a prospect after the landing page.

Rightmove's campaign pages (/rm/seller, /rm/agent) keep the whole journey
under /rm/: the return from payment (/rm/complete), the full report
(/rm/report), the optional next steps (/rm/next-steps) and the 30-day
dashboard (/rm/dashboard/<token>). Those pages load Rightmove's own Tag
Manager containers and no Meta Pixel (havlo_frontend/index.html,
src/lib/gtm.ts), so Rightmove can track the journey end to end. Every other
lead keeps the default addresses.

Kept free of app imports so the link builders (listing_monitor,
analyst_review, the post-purchase drip, the stale-listings router) can all
use it without import cycles.
"""
from __future__ import annotations


def is_rm_lead(lead_source: str | None) -> bool:
    """A lead from the /rm/ pages: rm_seller, rm_agent or rm_agent_listing
    (ads_funnel.channel_of(...) == "rm")."""
    return (lead_source or "").startswith("rm_")


def landing_path(lead_source: str | None, audience: str | None) -> str | None:
    """The /rm/ landing page for a Rightmove lead, None for anyone else."""
    if not is_rm_lead(lead_source):
        return None
    return "/rm/agent" if audience == "agent" else "/rm/seller"


def complete_path(lead_source: str | None) -> str:
    return "/rm/complete" if is_rm_lead(lead_source) else "/stale-listings/prospect/complete"


def report_path(lead_source: str | None) -> str:
    return "/rm/report" if is_rm_lead(lead_source) else "/stale-listings/prospect/report"


def next_steps_path(lead_source: str | None) -> str:
    return "/rm/next-steps" if is_rm_lead(lead_source) else "/stale-listings/prospect/next-steps"


def dashboard_path(lead_source: str | None, token: str) -> str:
    return f"{'/rm/dashboard' if is_rm_lead(lead_source) else '/m'}/{token}"
