from __future__ import annotations
import uuid
from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class Deal:
    # ── Identifiers ─────────────────────────────────────────────────────────
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    source_name: str = ""           # e.g. "craigslist", "bizbuysell", "attom_distressed"
    source_type: str = ""           # distressed | off_market | fsbo | marketed
    channel: str = ""               # human-readable channel label

    # ── Property ────────────────────────────────────────────────────────────
    facility_name: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    unit_count: Optional[int] = None
    unit_mix: str = ""
    year_built: Optional[int] = None
    sqft: Optional[int] = None
    land_acres: Optional[float] = None
    climate_percent: int = 0

    # ── Financials ──────────────────────────────────────────────────────────
    asking_price: Optional[float] = None
    estimated_value: Optional[float] = None
    noi: Optional[float] = None
    gross_revenue: Optional[float] = None
    occupancy: Optional[float] = None
    cap_rate: Optional[float] = None

    # ── Owner ────────────────────────────────────────────────────────────────
    owner_name: str = "Unknown"
    owner_entity: str = ""
    owner_entity_state: str = ""
    owner_entity_formed: str = ""
    registered_agent: str = ""
    owner_mailing_address: str = ""
    owner_phone: str = ""
    owner_email: str = ""
    owner_age_estimate: Optional[int] = None
    out_of_state_owner: bool = False
    years_owned: Optional[int] = None
    single_asset_owner: bool = False
    below_market_rents: bool = False
    no_web_presence: bool = False
    # Value-add / deal quality
    street_rates_below_market_pct: Optional[float] = None  # % below market street rate
    value_add_potential: bool = False
    rents_below_market_pct: Optional[float] = None         # % rents below market
    rents_above_market_pct: Optional[float] = None         # % rents above market
    excess_land: Optional[bool] = None                     # True = has expansion land, False = confirmed none
    self_managed: bool = False
    institutional_owner: bool = False
    broker_listed: bool = False
    mechanics_lien: bool = False
    expired_permit: bool = False
    # Offer & deal structure
    offer_price: Optional[float] = None
    days_on_market: Optional[int] = None
    offer_status: Optional[str] = None          # pending | countered | accepted | rejected
    deal_structure: Optional[str] = None        # standard | seller-carry | leaseback | installment | all-cash
    # Business plan upside
    projected_year1_noi: Optional[float] = None
    projected_stabilized_noi: Optional[float] = None
    noi_upside_pct: Optional[float] = None
    rent_increase_potential_pct: Optional[float] = None
    occupancy_upside_pct: Optional[float] = None
    climate_conversion_possible: bool = False
    exit_strategy: Optional[str] = None        # sell | refi | hold
    projected_exit_cap_rate: Optional[float] = None

    # ── Distress signals ────────────────────────────────────────────────────
    tax_delinquency: bool = False
    tax_delinquency_amount: Optional[float] = None
    tax_delinquency_years: Optional[int] = None
    fire_code_violations: bool = False
    fire_code_count: int = 0
    fire_code_details: list = field(default_factory=list)
    code_violations: list = field(default_factory=list)
    lis_pendens: bool = False
    lis_pendens_amount: Optional[float] = None
    ucc_lien: bool = False
    ucc_lien_amount: Optional[float] = None
    ucc_lien_maturity_date: str = ""
    court_judgment: bool = False
    court_judgment_amount: Optional[float] = None
    declining_occupancy: bool = False
    occupancy_trend: Optional[float] = None
    deferred_maintenance: bool = False
    maintenance_issues: list = field(default_factory=list)

    # ── Scoring + output ────────────────────────────────────────────────────
    motivation_score: int = 0
    score_breakdown: dict = field(default_factory=dict)
    score_explanation: str = ""
    needs_outreach_letter: bool = False
    letter_draft: str = ""
    url: str = ""
    discovered_at: str = field(default_factory=lambda: date.today().isoformat())
    raw_data: dict = field(default_factory=dict)

    # ── Dedup key ────────────────────────────────────────────────────────────
    @property
    def dedup_key(self) -> str:
        addr = self.address.lower().strip()
        city = self.city.lower().strip()
        state = self.state.upper().strip()
        return f"{addr}|{city}|{state}"

    def to_pipeline_property(self) -> dict:
        """Convert to the PipelineProperty shape consumed by Next.js."""
        source_map = {
            "distressed": "county-records",
            "off_market": "data-scrape",
            "fsbo": "inbound",
            "marketed": "broker",
        }
        priority_map = {
            range(110, 176): "high",
            range(70, 110): "medium",
            range(0, 70): "low",
        }
        priority = "medium"
        for r, p in priority_map.items():
            if self.motivation_score in r:
                priority = p
                break

        return {
            "id": f"py-{self.id}",
            "facilityName": self.facility_name or f"Storage — {self.city}, {self.state}",
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "zipCode": self.zip_code,
            "unitCount": self.unit_count or 0,
            "unitMix": self.unit_mix,
            "yearBuilt": self.year_built or 2000,
            "landAcres": self.land_acres or 0,
            "climatePercent": self.climate_percent,
            "estimatedValue": int(self.estimated_value or self.asking_price or 0),
            "askingPrice": int(self.asking_price) if self.asking_price else None,
            "noi": int(self.noi) if self.noi else None,
            "grossRevenue": int(self.gross_revenue) if self.gross_revenue else None,
            "occupancy": int(self.occupancy or 0),
            "ownerName": self.owner_name,
            "ownerEntity": self.owner_entity or self.owner_name,
            "ownerEntityState": self.owner_entity_state or self.state,
            "ownerEntityFormed": self.owner_entity_formed or None,
            "registeredAgent": self.registered_agent or None,
            "ownerMailingAddress": self.owner_mailing_address or f"{self.city}, {self.state}",
            "ownerPhone": self.owner_phone or None,
            "ownerEmail": self.owner_email or None,
            "distressSignals": {
                "taxDelinquency": self.tax_delinquency,
                "taxDelinquencyAmount": self.tax_delinquency_amount,
                "taxDelinquencyYears": self.tax_delinquency_years,
                "fireCodeViolations": self.fire_code_violations,
                "fireCodeCount": self.fire_code_count,
                "fireCodeDetails": self.fire_code_details,
                "codeViolations": self.code_violations,
                "lisPendens": self.lis_pendens,
                "lisPendensAmount": self.lis_pendens_amount,
                "mechanicsLien": self.mechanics_lien,
                "expiredPermit": self.expired_permit,
                "uccLien": self.ucc_lien,
                "civilJudgment": self.court_judgment,
                "civilJudgmentAmount": self.court_judgment_amount,
                "decliningOccupancy": self.declining_occupancy,
                "occupancyTrend": self.occupancy_trend,
                "deferredMaintenance": self.deferred_maintenance,
                "maintenanceIssues": self.maintenance_issues,
                "outOfStateOwner": self.out_of_state_owner,
                "ownerAge": self.owner_age_estimate,
                "yearsOwned": self.years_owned,
                "singleAssetOwner": self.single_asset_owner,
            },
            "noWebPresence": self.no_web_presence,
            "streetRatesBelowMarketPct": self.street_rates_below_market_pct,
            "valueAddPotential": self.value_add_potential,
            "rentsBelowMarketPct": self.rents_below_market_pct,
            "rentsAboveMarketPct": self.rents_above_market_pct,
            "excessLand": self.excess_land,
            "selfManaged": self.self_managed,
            "institutionalOwner": self.institutional_owner,
            "brokerListed": self.broker_listed,
            "offerPrice": int(self.offer_price) if self.offer_price else None,
            "daysOnMarket": self.days_on_market,
            "offerStatus": self.offer_status,
            "dealStructure": self.deal_structure,
            "projectedYear1NOI": int(self.projected_year1_noi) if self.projected_year1_noi else None,
            "projectedStabilizedNOI": int(self.projected_stabilized_noi) if self.projected_stabilized_noi else None,
            "noiUpsidePct": self.noi_upside_pct,
            "rentIncreasePotentialPct": self.rent_increase_potential_pct,
            "occupancyUpsidePct": self.occupancy_upside_pct,
            "climateConversionPossible": self.climate_conversion_possible or None,
            "exitStrategy": self.exit_strategy,
            "projectedExitCapRate": self.projected_exit_cap_rate,
            "motivationScore": self.motivation_score,
            "scoreBreakdown": self.score_breakdown or None,
            "scoreExplanation": self.score_explanation or None,
            "stage": "identified",
            "currentStatus": "outreach-sent",
            "priority": priority,
            "source": source_map.get(self.source_type, "data-scrape"),
            "addedDate": self.discovered_at,
            "notes": f"Auto-sourced via {self.channel}. URL: {self.url}" if self.url else f"Auto-sourced via {self.channel}.",
            "outreachLetter": self.letter_draft or None,
        }

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source_name": self.source_name,
            "source_type": self.source_type,
            "channel": self.channel,
            "facility_name": self.facility_name,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "zip_code": self.zip_code,
            "unit_count": self.unit_count,
            "year_built": self.year_built,
            "sqft": self.sqft,
            "land_acres": self.land_acres,
            "climate_percent": self.climate_percent,
            "asking_price": self.asking_price,
            "estimated_value": self.estimated_value,
            "noi": self.noi,
            "gross_revenue": self.gross_revenue,
            "occupancy": self.occupancy,
            "cap_rate": self.cap_rate,
            "owner_name": self.owner_name,
            "owner_entity": self.owner_entity,
            "owner_entity_state": self.owner_entity_state,
            "owner_mailing_address": self.owner_mailing_address,
            "owner_phone": self.owner_phone,
            "owner_email": self.owner_email,
            "owner_age_estimate": self.owner_age_estimate,
            "out_of_state_owner": self.out_of_state_owner,
            "years_owned": self.years_owned,
            "single_asset_owner": self.single_asset_owner,
            "below_market_rents": self.below_market_rents,
            "tax_delinquency": self.tax_delinquency,
            "tax_delinquency_amount": self.tax_delinquency_amount,
            "tax_delinquency_years": self.tax_delinquency_years,
            "fire_code_violations": self.fire_code_violations,
            "fire_code_count": self.fire_code_count,
            "fire_code_details": self.fire_code_details,
            "code_violations": self.code_violations,
            "lis_pendens": self.lis_pendens,
            "lis_pendens_amount": self.lis_pendens_amount,
            "ucc_lien": self.ucc_lien,
            "ucc_lien_amount": self.ucc_lien_amount,
            "ucc_lien_maturity_date": self.ucc_lien_maturity_date,
            "court_judgment": self.court_judgment,
            "court_judgment_amount": self.court_judgment_amount,
            "declining_occupancy": self.declining_occupancy,
            "occupancy_trend": self.occupancy_trend,
            "deferred_maintenance": self.deferred_maintenance,
            "maintenance_issues": self.maintenance_issues,
            "motivation_score": self.motivation_score,
            "needs_outreach_letter": self.needs_outreach_letter,
            "letter_draft": self.letter_draft,
            "url": self.url,
            "discovered_at": self.discovered_at,
        }
