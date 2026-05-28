"""
StorageCap scoring model — 130-point system.

Categories:
  Motivation signals  0–70
  Owner profile       0–25
  Deal quality        0–15
  Value-add           0–20
  Negatives           deductions
  Override            +5 if cap rate > 7.5% on stabilized asset

Tier thresholds:
  85+  = HOT
  55-84 = WARM
  <55  = COLD
"""

from __future__ import annotations
import math
from datetime import date
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from models import Deal


def _ucc_months_remaining(deal: "Deal") -> Optional[int]:
    """Return months until UCC lien maturity, or None if unknown."""
    if not deal.ucc_lien_maturity_date:
        return None
    try:
        md = date.fromisoformat(deal.ucc_lien_maturity_date[:10])
        td = (md - date.today()).days
        return max(0, math.ceil(td / 30.44))
    except (ValueError, TypeError):
        return None


def score_full(deal: "Deal") -> dict:
    """
    Return scoring result with breakdown dict and plain-English explanation.

    Shape:
        {
            "total": int,
            "breakdown": {
                "motivation": int,
                "ownerProfile": int,
                "dealQuality": int,
                "valueAdd": int,
                "negatives": int,
                "override": int,
            },
            "explanation": str,
        }
    """
    # Normalize occupancy (some sources provide 0-1, others 0-100)
    occ_raw = deal.occupancy or 0
    occ = occ_raw if occ_raw > 1 else occ_raw * 100

    # ── MOTIVATION SIGNALS (0–70) ─────────────────────────────────────────
    motivation = 0
    active_count = 0

    tax_years = deal.tax_delinquency_years or 0
    if deal.tax_delinquency:
        motivation += 20 if tax_years >= 2 else 12
        active_count += 1

    if deal.fire_code_violations:
        motivation += 18
        active_count += 1

    if deal.lis_pendens:
        motivation += 18
        active_count += 1

    if getattr(deal, "mechanics_lien", False):
        motivation += 10
        active_count += 1

    if getattr(deal, "expired_permit", False):
        motivation += 8
        active_count += 1

    ucc_months = _ucc_months_remaining(deal)
    if deal.ucc_lien and (ucc_months is not None and ucc_months <= 12):
        motivation += 8
        active_count += 1

    if deal.court_judgment:
        motivation += 6
        active_count += 1

    if active_count >= 2:
        motivation += 10  # multi-signal bonus

    motivation = min(70, motivation)

    # ── OWNER PROFILE (0–25) ──────────────────────────────────────────────
    owner_profile = 0
    age = deal.owner_age_estimate or 0

    if age >= 65:
        owner_profile += 12
    elif age >= 55:
        owner_profile += 7

    if (deal.years_owned or 0) >= 15:
        owner_profile += 8

    if deal.out_of_state_owner:
        owner_profile += 5

    if deal.single_asset_owner:
        owner_profile += 5

    if getattr(deal, "no_web_presence", False):
        owner_profile += 3

    owner_profile = min(25, owner_profile)

    # ── DEAL QUALITY (0–15) ───────────────────────────────────────────────
    deal_quality = 0

    cap_rate = deal.cap_rate
    if cap_rate is None and deal.noi:
        ref_price = deal.asking_price or deal.estimated_value
        if ref_price:
            cap_rate = deal.noi / ref_price

    unit_count = deal.unit_count or 0
    if 150 <= unit_count <= 600:
        deal_quality += 8

    if cap_rate is not None and cap_rate > 0.065:
        deal_quality += 5

    street_below = getattr(deal, "street_rates_below_market_pct", None) or 0
    if street_below >= 10:
        deal_quality += 5

    if getattr(deal, "value_add_potential", False):
        deal_quality += 4

    if deal.climate_percent == 0 and unit_count > 0:
        deal_quality += 3

    deal_quality = min(15, deal_quality)

    # ── VALUE-ADD (0–20) ──────────────────────────────────────────────────
    value_add = 0

    if occ < 70:
        value_add += 8
    elif occ < 80:
        value_add += 5

    rents_below = getattr(deal, "rents_below_market_pct", None) or 0
    if rents_below >= 15:
        value_add += 8
    elif rents_below >= 5:
        value_add += 4

    excess_land = getattr(deal, "excess_land", None)
    if excess_land is True:
        value_add += 7

    if deal.climate_percent == 0 and unit_count > 0:
        value_add += 5  # conversion opportunity

    if occ < 80 and rents_below >= 5:
        value_add += 5  # both low occupancy AND below-market rents

    if getattr(deal, "self_managed", False):
        value_add += 4

    if deal.deferred_maintenance:
        value_add += 3

    if getattr(deal, "no_web_presence", False):
        value_add += 2  # old technology / no online leasing proxy

    value_add = min(20, value_add)

    # ── NEGATIVES ─────────────────────────────────────────────────────────
    negatives = 0

    if occ >= 95:
        negatives -= 8
    elif occ >= 90:
        negatives -= 4

    rents_above = getattr(deal, "rents_above_market_pct", None) or 0
    if rents_above >= 10:
        negatives -= 8
    if rents_above == 0 and occ >= 95:
        negatives -= 6  # at-market rents with full occupancy

    year_built = deal.year_built or 0
    if year_built >= 2020:
        negatives -= 5

    if getattr(deal, "institutional_owner", False):
        negatives -= 10

    if getattr(deal, "broker_listed", False):
        negatives -= 5

    if excess_land is False:
        negatives -= 3  # confirmed no expansion land

    if deal.climate_percent == 100:
        negatives -= 2

    # ── POSITIVE OVERRIDE ─────────────────────────────────────────────────
    override = 0
    if cap_rate is not None and cap_rate > 0.075 and occ >= 85:
        override += 5

    total = max(0, min(130, motivation + owner_profile + deal_quality + value_add + negatives + override))

    breakdown = {
        "motivation": motivation,
        "ownerProfile": owner_profile,
        "dealQuality": deal_quality,
        "valueAdd": value_add,
        "negatives": negatives,
        "override": override,
    }

    explanation = _build_explanation(deal, breakdown, total, occ, cap_rate)

    return {"total": total, "breakdown": breakdown, "explanation": explanation}


def score(deal: "Deal") -> int:
    """Return the total motivation score (0–130)."""
    return score_full(deal)["total"]


def needs_letter(deal: "Deal") -> bool:
    return deal.source_type in ("distressed", "off_market") and deal.motivation_score >= 55


# ── Explanation ───────────────────────────────────────────────────────────────

def _build_explanation(deal: "Deal", b: dict, total: int, occ: float, cap_rate) -> str:
    # Sentence 1: lead with strongest positive driver
    if b["motivation"] >= 30:
        signals = []
        if deal.tax_delinquency:
            yr = deal.tax_delinquency_years or 1
            signals.append(f"{yr}-year tax delinquency")
        if deal.fire_code_violations:
            signals.append("active fire code violations")
        if deal.lis_pendens:
            signals.append("lis pendens filing")
        if getattr(deal, "mechanics_lien", False):
            signals.append("mechanics lien")
        if deal.court_judgment:
            signals.append("civil judgment")
        if deal.ucc_lien:
            signals.append("maturing UCC lien")
        s1 = f"High motivation seller with {' and '.join(signals)}."
    elif b["motivation"] >= 12:
        signals = []
        if deal.tax_delinquency:
            signals.append("tax delinquency")
        if deal.ucc_lien:
            signals.append("maturing UCC lien")
        if getattr(deal, "expired_permit", False):
            signals.append("expired permit")
        if deal.court_judgment:
            signals.append("civil judgment")
        s1 = f"Early distress indicators — {', '.join(signals)}."
    elif b["ownerProfile"] >= 15:
        details = []
        age = deal.owner_age_estimate or 0
        if age >= 55:
            details.append(f"age-{age} owner")
        if (deal.years_owned or 0) >= 15:
            details.append(f"{deal.years_owned} years of ownership")
        s1 = f"Favorable owner profile — {' and '.join(details)} suggest succession or liquidity motivation."
    elif b["valueAdd"] >= 15:
        s1 = "Strong value-add profile with multiple improvement levers."
    elif cap_rate is not None and cap_rate > 0.075:
        s1 = f"Above-market {cap_rate * 100:.1f}% cap rate on a stabilized asset."
    elif total >= 55:
        s1 = "Moderate opportunity with financial upside and a manageable entry point."
    else:
        s1 = "Limited distress and value-add signals — primarily a financial-quality play."

    # Sentence 2: key opportunity or concern
    rents_above = getattr(deal, "rents_above_market_pct", None) or 0
    rents_below = getattr(deal, "rents_below_market_pct", None) or 0
    excess_land = getattr(deal, "excess_land", None)

    if getattr(deal, "institutional_owner", False):
        s2 = "Institutional or REIT ownership limits off-market negotiation potential."
    elif occ >= 95 and rents_above >= 0 and rents_below == 0:
        s2 = "Fully stabilized at above-market rents — limited upside, better suited for a core buyer."
    elif (deal.year_built or 0) >= 2020:
        s2 = "Recently built facility — limited value-add runway, pricing should reflect stabilized yield."
    elif b["valueAdd"] >= 15:
        upsides = []
        if occ < 80:
            upsides.append(f"occupancy at {occ:.0f}% has room to grow")
        if rents_below >= 10:
            upsides.append(f"rents {rents_below:.0f}% below market")
        if excess_land is True:
            upsides.append("expansion land available")
        if getattr(deal, "self_managed", False):
            upsides.append("professional management upside")
        s2 = f"Strong value-add path through {', '.join(upsides)}."
    elif b["motivation"] >= 18 and b["valueAdd"] >= 5:
        s2 = "Motivated seller combined with operational upside makes this a priority outreach target."
    elif occ < 75:
        s2 = "Below-average occupancy and deferred maintenance create a clear basis-play opportunity."
    elif total < 35:
        s2 = "Monitor for further distress development before committing outreach resources."
    else:
        s2 = "Outreach warranted to explore seller motivation and pricing flexibility."

    return f"{s1} {s2}"
