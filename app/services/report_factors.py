"""The 20 report factors and the facts code works out for them.

The report overhaul (Nov 2026) replaces the old free-form findings with a
fixed set of 20 factors. Every factor gets one verdict — a problem, working
well, or check with your agent (when we don't hold the data). The AI writes
each factor's prose from the facts here and nothing else; anything it can't
be given becomes "check with your agent", so there are always 20.

This module is the deterministic part: the factor list, the day sentence,
the Rightmove search-step visibility maths, stamp duty and affordability,
and the effect of a price change on what the seller walks away with. No AI,
no network — pure functions, so they're easy to test and never wrong.
"""
from __future__ import annotations

import math
from typing import Any, Literal

Verdict = Literal["problem", "working_well", "check_with_agent"]

PROBLEM: Verdict = "problem"
WORKING_WELL: Verdict = "working_well"
CHECK_WITH_AGENT: Verdict = "check_with_agent"

# The 20 factors, in order. `locked_subtext` is the one line shown under a
# locked factor on the free preview. `always_check` factors have no public
# data (Rightmove keeps it private), so they're always "check with your agent".
FACTORS: tuple[dict[str, Any], ...] = (
    {"num": 1, "key": "visibility", "name": "Property Visibility Analysis",
     "locked_subtext": "Whether your price keeps you out of buyers' searches."},
    {"num": 2, "key": "engagement", "name": "Listing Engagement and Performance", "always_check": True,
     "locked_subtext": "The views and enquiries only your agent can see."},
    {"num": 3, "key": "asking_price", "name": "Asking Price Competitiveness",
     "locked_subtext": "Your price against what's actually sold nearby."},
    {"num": 4, "key": "pricing_range", "name": "Recommended Pricing Range and Scenarios",
     "locked_subtext": "A sensible price range and what each choice does."},
    {"num": 5, "key": "comparable_sold", "name": "Comparable Sold Property Analysis",
     "locked_subtext": "Recent sold prices for homes like yours."},
    {"num": 6, "key": "active_competition", "name": "Active Competitor Analysis",
     "locked_subtext": "The homes you're competing with right now."},
    {"num": 7, "key": "buyer_demand", "name": "Local Buyer Demand Analysis",
     "locked_subtext": "How fast homes like yours are being bought."},
    {"num": 8, "key": "time_on_market", "name": "Time on Market Analysis",
     "locked_subtext": "How long you've been listed, and what's normal."},
    {"num": 9, "key": "reduction_history", "name": "Price Reduction History Analysis",
     "locked_subtext": "What your price changes signal to buyers."},
    {"num": 10, "key": "photography", "name": "Photography Assessment",
     "locked_subtext": "What your photos tell a buyer at first glance."},
    {"num": 11, "key": "description", "name": "Listing Description Assessment",
     "locked_subtext": "Whether your wording sells the home or buries it."},
    {"num": 12, "key": "floor_plan", "name": "Floor Plan and Layout Presentation",
     "locked_subtext": "Floor plan and room sizes buyers look for."},
    {"num": 13, "key": "positioning", "name": "Property Positioning and USPs",
     "locked_subtext": "Whether your best features are front and centre."},
    {"num": 14, "key": "target_buyer", "name": "Target Buyer Audience",
     "locked_subtext": "Who your home is really for."},
    {"num": 15, "key": "buyer_objections", "name": "Buyer Perception and Objections",
     "locked_subtext": "The doubts a buyer may have before viewing."},
    {"num": 16, "key": "viewing_conversion", "name": "Viewing-to-Offer Conversion", "always_check": True,
     "locked_subtext": "Why viewings may not be turning into offers."},
    {"num": 17, "key": "agent_marketing", "name": "Estate Agent Marketing Effectiveness",
     "locked_subtext": "How hard your listing is being marketed."},
    {"num": 18, "key": "condition_readiness", "name": "Property Condition and Sale Readiness",
     "locked_subtext": "Whether you're ready for a quick sale."},
    {"num": 19, "key": "affordability", "name": "Buyer Affordability and Purchase Costs",
     "locked_subtext": "The real cost for your likely buyer."},
    {"num": 20, "key": "net_proceeds", "name": "Seller Net Proceeds",
     "locked_subtext": "What a price change means for your pocket."},
)

FACTOR_BY_KEY = {f["key"]: f for f in FACTORS}
FACTOR_KEYS = tuple(f["key"] for f in FACTORS)
ALWAYS_CHECK_KEYS = tuple(f["key"] for f in FACTORS if f.get("always_check"))
assert len(FACTORS) == 20


# ── Days on market, worked out in code (never by the AI) ──────────────────
def day_sentence(reduced_days: int | None, advertised_days: int | None, *, agent: bool = False) -> str | None:
    """The one day line the report may use, or None when no date is known.
    Reduced wins over advertised. The AI is told never to state any other
    day count."""
    whose = "This property" if agent else "Your property"
    price_whose = "This property's" if agent else "Your"
    if reduced_days is not None and reduced_days >= 0:
        return f"{price_whose} price was last reduced {_days(reduced_days)} ago, and it's still on the market."
    if advertised_days is not None and advertised_days >= 0:
        return f"{whose} has been advertised for {_days(advertised_days)}."
    return None


def _days(n: int) -> str:
    return "1 day" if n == 1 else f"{n} days"


# ── Factor 1: Rightmove search-step visibility ────────────────────────────
# The round prices buyers set as the ceiling of a Rightmove search. A home
# priced just above one of these never shows for the buyers who stopped there.
def _price_steps() -> list[int]:
    steps = list(range(50_000, 500_001, 25_000))
    steps += list(range(550_000, 1_000_001, 50_000))
    steps += list(range(1_100_000, 2_000_001, 100_000))
    steps += list(range(2_250_000, 5_000_001, 250_000))
    return steps


PRICE_STEPS = _price_steps()
# How close above a step still counts as "just above it" (a cheap win).
VISIBILITY_GAP_FRACTION = 0.045


def visibility(price: float | None) -> dict[str, Any]:
    """Where the asking price sits against Rightmove's search steps. When the
    price is just above a step, dropping to it opens a whole search bracket."""
    if not price or price <= 0:
        return {"known": False}
    price = int(round(price))
    below = [s for s in PRICE_STEPS if s < price]
    at_or_above = [s for s in PRICE_STEPS if s >= price]
    floor_step = below[-1] if below else None
    ceil_step = at_or_above[0] if at_or_above else None
    on_step = price in PRICE_STEPS
    gap = price - floor_step if floor_step is not None else None
    just_above = bool(gap is not None and 0 < gap <= price * VISIBILITY_GAP_FRACTION and not on_step)
    return {
        "known": True, "price": price, "on_step": on_step,
        "floor_step": floor_step, "ceil_step": ceil_step, "gap_to_floor": gap,
        "just_above_step": just_above,
        # The verdict code picks; the AI writes the prose from these.
        "verdict": PROBLEM if just_above else WORKING_WELL,
    }


# ── Factor 19: stamp duty (England) and affordability ─────────────────────
# England & Northern Ireland residential SDLT, standard home-mover rates in
# force from 1 April 2025. CONFIRM these are still current before relying on
# them (shown to the owner for sign-off). Wales (LTT) and Scotland (LBTT)
# differ, so those get "ask your conveyancer".
SDLT_BANDS_ENGLAND = (
    (125_000, 0.00),
    (250_000, 0.02),
    (925_000, 0.05),
    (1_500_000, 0.10),
    (math.inf, 0.12),
)
SDLT_RATES_AS_OF = "1 April 2025 (England & NI, standard rates)"
DEPOSIT_FRACTION = 0.10
INCOME_MULTIPLE = 4.5


def sdlt_england(price: float | None) -> int | None:
    """Stamp duty a typical (non-first-time, single-home) buyer pays at this
    asking price, to the nearest pound. None when the price is unknown."""
    if not price or price <= 0:
        return None
    price = float(price)
    tax = 0.0
    lower = 0.0
    for upper, rate in SDLT_BANDS_ENGLAND:
        if price <= lower:
            break
        taxable = min(price, upper) - lower
        if taxable > 0:
            tax += taxable * rate
        lower = upper
    return int(round(tax))


def affordability(price: float | None, country: str = "England") -> dict[str, Any]:
    """What it costs a likely buyer: stamp duty, a 10% deposit, and the rough
    income a lender wants for the rest. England only computes the tax; Wales
    and Scotland are flagged to ask a conveyancer."""
    if not price or price <= 0:
        return {"known": False}
    price = int(round(price))
    deposit = int(round(price * DEPOSIT_FRACTION))
    loan = price - deposit
    required_income = int(round(loan / INCOME_MULTIPLE / 1000.0)) * 1000  # to the nearest £1,000
    england = str(country or "England").strip().lower() in ("", "england", "uk", "northern ireland", "ni")
    return {
        "known": True, "price": price, "deposit": deposit, "loan": loan,
        "required_income": required_income, "income_multiple": INCOME_MULTIPLE, "deposit_fraction": DEPOSIT_FRACTION,
        "stamp_duty": sdlt_england(price) if england else None,
        "stamp_duty_known": england, "stamp_duty_as_of": SDLT_RATES_AS_OF,
    }


# ── Factor 20: seller net proceeds (never assumes their mortgage) ─────────
def net_proceeds_effect(price: float | None, new_price: float | None) -> dict[str, Any]:
    """What a move to new_price changes at the top line, before their own
    costs. We never assume their mortgage or fees — the AI lists what to ask."""
    if not price or price <= 0 or not new_price or new_price <= 0:
        return {"known": False}
    price, new_price = int(round(price)), int(round(new_price))
    difference = new_price - price
    return {
        "known": True, "price": price, "new_price": new_price,
        "difference": difference, "lower": difference < 0,
        "pct": round(abs(difference) / price * 100, 1),
    }
