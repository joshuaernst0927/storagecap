"""
StorageCap scoring model — 175-point system.

Categories:
  Motivation signals       0–70
  Owner profile            0–25
  Deal quality             0–15
  Value-add                0–20
  Offer & deal structure   0–20
  Business plan upside     0–25
  Negatives                deductions
  Override                 +5 if cap rate > 7.5% on stabilized asset

Tier thresholds:
  110+ = HOT
  70-109 = WARM
  <70   = COLD
"""

from __future__ import annotations
import math
from datetime import date
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from models import Deal


def _ucc_months_remaining(deal: "Deal") -> Optional[int]:
    if not deal.ucc_lien_maturity_date:
        return None
    try:
        md = date.fromisoformat(deal.ucc_lien_maturity_date[:10])
        td = (md - date.today()).days
        return max(0, math.ceil(td / 30.44))
    except (ValueError, TypeError):
        return None


def score_full(deal: "Deal") -> dict:
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
        motivation += 10

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
        value_add += 5

    if occ < 80 and rents_below >= 5:
        value_add += 5

    if getattr(deal, "self_managed", False):
        value_add += 4

    if deal.deferred_maintenance:
        value_add += 3

    if getattr(deal, "no_web_presence", False):
        value_add += 2

    value_add = min(20, value_add)

    # ── OFFER & DEAL STRUCTURE (0–20) ─────────────────────────────────────
    offer_deal = 0

    offer_price = getattr(deal, "offer_price", None)
    asking_price = deal.asking_price

    if offer_price and asking_price and asking_price > 0:
        discount_pct = ((asking_price - offer_price) / asking_price) * 100
        if discount_pct >= 15:
            offer_deal += 10
        elif discount_pct >= 10:
            offer_deal += 7
        elif discount_pct >= 5:
            offer_deal += 4

    offer_status = getattr(deal, "offer_status", None)
    if offer_status in ("accepted", "countered"):
        offer_deal += 8

    deal_structure = getattr(deal, "deal_structure", None)
    if deal_structure in ("seller-carry", "leaseback", "installment"):
        offer_deal += 5
    elif deal_structure == "all-cash":
        offer_deal += 3

    days_on_market = getattr(deal, "days_on_market", None) or 0
    if days_on_market >= 90:
        offer_deal += 6

    estimated_value = deal.estimated_value or 0
    if offer_price and estimated_value > 0:
        ppu_discount = ((estimated_value - offer_price) / estimated_value) * 100
        if ppu_discount >= 20:
            offer_deal += 8
        elif ppu_discount >= 10:
            offer_deal += 5

    offer_deal = min(20, offer_deal)

    # ── BUSINESS PLAN UPSIDE (0–25) ───────────────────────────────────────
    business_plan = 0

    noi_upside_pct = getattr(deal, "noi_upside_pct", None) or 0
    if noi_upside_pct >= 50:
        business_plan += 12
    elif noi_upside_pct >= 25:
        business_plan += 8
    elif noi_upside_pct >= 10:
        business_plan += 5

    if excess_land is True:
        business_plan += 8

    rent_increase_pct = getattr(deal, "rent_increase_potential_pct", None) or 0
    if rent_increase_pct >= 20:
        business_plan += 7
    elif rent_increase_pct >= 10:
        business_plan += 4

    occ_upside_pct = getattr(deal, "occupancy_upside_pct", None) or 0
    if occ_upside_pct >= 20:
        business_plan += 7
    elif occ_upside_pct >= 10:
        business_plan += 4

    if getattr(deal, "climate_conversion_possible", False):
        business_plan += 5

    if getattr(deal, "self_managed", False):
        business_plan += 4

    if getattr(deal, "no_web_presence", False):
        business_plan += 3  # technology / online leasing upside

    if excess_land is True or getattr(deal, "value_add_potential", False):
        business_plan += 3  # ancillary income upside

    exit_strategy = getattr(deal, "exit_strategy", None)
    if excess_land is True and exit_strategy == "sell":
        business_plan += 6  # land repositioning / rezoning

    projected_exit_cap = getattr(deal, "projected_exit_cap_rate", None)
    if projected_exit_cap is not None and cap_rate is not None and projected_exit_cap < cap_rate - 0.005:
        business_plan += 4  # exit cap rate compression

    business_plan = min(25, business_plan)

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
        negatives -= 6

    year_built = deal.year_built or 0
    if year_built >= 2020:
        negatives -= 5

    if getattr(deal, "institutional_owner", False):
        negatives -= 10

    if getattr(deal, "broker_listed", False):
        negatives -= 5

    if excess_land is False:
        negatives -= 3

    if deal.climate_percent == 100:
        negatives -= 2

    # ── POSITIVE OVERRIDE ─────────────────────────────────────────────────
    override = 0
    if cap_rate is not None and cap_rate > 0.075 and occ >= 85:
        override += 5

    total = max(0, min(175, motivation + owner_profile + deal_quality + value_add + offer_deal + business_plan + negatives + override))

    breakdown = {
        "motivation": motivation,
        "ownerProfile": owner_profile,
        "dealQuality": deal_quality,
        "valueAdd": value_add,
        "offerDeal": offer_deal,
        "businessPlan": business_plan,
        "negatives": negatives,
        "override": override,
    }

    explanation = _build_explanation(deal, breakdown, total, occ, cap_rate)

    return {"total": total, "breakdown": breakdown, "explanation": explanation}


def score(deal: "Deal") -> int:
    return score_full(deal)["total"]


def needs_letter(deal: "Deal") -> bool:
    return deal.source_type in ("distressed", "off_market") and deal.motivation_score >= 70


def _build_explanation(deal: "Deal", b: dict, total: int, occ: float, cap_rate) -> str:
    rents_below = getattr(deal, "rents_below_market_pct", None) or 0
    rents_above = getattr(deal, "rents_above_market_pct", None) or 0
    excess_land = getattr(deal, "excess_land", None)
    offer_price = getattr(deal, "offer_price", None)
    asking_price = deal.asking_price

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
    elif b["offerDeal"] >= 12:
        if offer_price and asking_price and asking_price > 0:
            pct = round(((asking_price - offer_price) / asking_price) * 100)
            s1 = f"Strong deal structure with offer {pct}% below ask."
        else:
            s1 = "Favorable deal structure with meaningful discount to ask."
    elif b["businessPlan"] >= 15:
        s1 = "High-upside business plan with multiple value creation levers."
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
    elif total >= 70:
        s1 = "Moderate opportunity with financial upside and a manageable entry point."
    else:
        s1 = "Limited distress and value-add signals — primarily a financial-quality play."

    if getattr(deal, "institutional_owner", False):
        s2 = "Institutional or REIT ownership limits off-market negotiation potential."
    elif occ >= 95 and rents_above >= 0 and rents_below == 0:
        s2 = "Fully stabilized at above-market rents — limited upside, better suited for a core buyer."
    elif (deal.year_built or 0) >= 2020:
        s2 = "Recently built facility — limited value-add runway, pricing should reflect stabilized yield."
    elif b["businessPlan"] >= 15:
        upsides = []
        noi_upside = getattr(deal, "noi_upside_pct", None) or 0
        if noi_upside >= 25:
            upsides.append(f"{noi_upside:.0f}% NOI upside")
        rent_inc = getattr(deal, "rent_increase_potential_pct", None) or 0
        if rent_inc >= 10:
            upsides.append(f"{rent_inc:.0f}% rent increase potential")
        occ_up = getattr(deal, "occupancy_upside_pct", None) or 0
        if occ_up >= 10:
            upsides.append(f"{occ_up:.0f}% occupancy upside")
        if excess_land is True:
            upsides.append("expansion land")
        s2 = f"Business plan upside through {', '.join(upsides)}." if upsides else "Strong business plan with multiple upside drivers."
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
    elif total < 40:
        s2 = "Monitor for further distress development before committing outreach resources."
    else:
        s2 = "Outreach warranted to explore seller motivation and pricing flexibility."

    return f"{s1} {s2}"
