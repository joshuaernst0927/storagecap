"""
Motivation scoring model (0–100).

Distressed: signals of financial or operational duress → highest scores.
Off-market: owner lifecycle signals → moderate boost.
FSBO: no-broker-fee savings → small boost on top of base.
Marketed: scored primarily on financial quality vs. market.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Deal

# Sun Belt self-storage market cap rate benchmark (Q1 2025)
MARKET_CAP_RATE = 0.065


def score(deal: "Deal") -> int:
    pts = 0

    # ── Distress signals ──────────────────────────────────────────────────
    if deal.tax_delinquency:
        pts += 25
        if (deal.tax_delinquency_years or 0) >= 3:
            pts += 10     # Tax deed action imminent

    if deal.fire_code_violations:
        pts += 15

    if deal.lis_pendens:
        pts += 20
        if (deal.lis_pendens_amount or 0) > 100_000:
            pts += 5

    if deal.ucc_lien:
        pts += 15

    if deal.court_judgment:
        pts += 15

    # Code violations: 5 pts each, cap at 15
    pts += min(len(deal.code_violations) * 5, 15)

    # ── Off-market / owner lifecycle ─────────────────────────────────────
    if deal.out_of_state_owner:
        pts += 5

    age = deal.owner_age_estimate or 0
    if age >= 75:
        pts += 15
    elif age >= 65:
        pts += 10

    yrs = deal.years_owned or 0
    if yrs >= 20:
        pts += 10
    elif yrs >= 15:
        pts += 5

    if deal.declining_occupancy:
        pts += 10

    if deal.deferred_maintenance:
        pts += 5

    if deal.single_asset_owner:
        pts += 5

    if deal.below_market_rents:
        pts += 5

    # ── FSBO bonus (no broker fee = better basis) ─────────────────────────
    if deal.source_type == "fsbo":
        pts += 10

    # ── Financial quality (primarily for marketed + FSBO) ─────────────────
    if deal.cap_rate is not None:
        gap = deal.cap_rate - MARKET_CAP_RATE
        if gap >= 0.015:
            pts += 15
        elif gap >= 0.005:
            pts += 10
        elif gap >= 0:
            pts += 5
        elif gap < -0.01:
            pts -= 10
    elif deal.asking_price and deal.noi:
        implied = deal.noi / deal.asking_price
        gap = implied - MARKET_CAP_RATE
        if gap >= 0.015:
            pts += 15
        elif gap >= 0.005:
            pts += 10
        elif gap >= 0:
            pts += 5
        elif gap < -0.01:
            pts -= 10

    return max(0, min(100, pts))


def needs_letter(deal: "Deal") -> bool:
    return deal.source_type in ("distressed", "off_market") and deal.motivation_score >= 40
