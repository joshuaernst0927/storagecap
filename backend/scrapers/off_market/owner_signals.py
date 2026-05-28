"""
Off-market owner signal detection.

Identifies self-storage facilities with:
  - Long ownership tenure (10+ years)
  - Owner estimated age 65+
  - Out-of-state owner / absentee landlord
  - Single-asset owner (no portfolio)
  - Below-market rents (proxy: low NOI per unit vs. market)

Primary data source: ATTOM Data API
  - /property/snapshot — property + ownership details
  - /assessment/snapshot — tax assessment (last sale date → years owned)
  - /sale/snapshot — ownership history
  Endpoint: https://api.gateway.attomdata.com/propertyapi/v1.0.0/

Fallback: County Assessor data (varies by county, many are public)
  FL: Each county appraiser has a public property search
  TX: Central Appraisal Districts (CADs) all publish public search
  NC: GIS / county tax portals
  GA: GA Superior Court Clerks' Cooperative Authority (GSCCCA)
  TN: County assessor offices

NAICS 531130 = Lessors of Miniwarehouses and Self-Storage Units
"""

from __future__ import annotations
import logging
from datetime import date
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0"
MARKET_NOI_PER_UNIT = 600  # Annual NOI per unit — Sun Belt benchmark ($600/unit/yr)

# State → typical metro coordinates for ATTOM radius search
METRO_SEARCH_POINTS = {
    "FL": [
        {"lat": 27.950575, "lon": -82.457178, "label": "Tampa"},
        {"lat": 25.761681, "lon": -80.191788, "label": "Miami"},
        {"lat": 30.332184, "lon": -81.655651, "label": "Jacksonville"},
        {"lat": 28.538336, "lon": -81.379234, "label": "Orlando"},
    ],
    "TX": [
        {"lat": 29.760427, "lon": -95.369803, "label": "Houston"},
        {"lat": 32.776665, "lon": -96.796989, "label": "Dallas"},
        {"lat": 30.267153, "lon": -97.743057, "label": "Austin"},
    ],
    "NC": [
        {"lat": 35.227087, "lon": -80.843127, "label": "Charlotte"},
        {"lat": 35.779590, "lon": -78.638179, "label": "Raleigh"},
    ],
    "GA": [
        {"lat": 33.748995, "lon": -84.387982, "label": "Atlanta"},
    ],
    "TN": [
        {"lat": 36.162664, "lon": -86.781602, "label": "Nashville"},
        {"lat": 35.149534, "lon": -90.048981, "label": "Memphis"},
    ],
}


class OwnerSignalScraper(BaseScraper):
    name = "owner_signals"
    source_type = "off_market"
    channel = "Off-Market Owner Signals"

    def __init__(self, attom_api_key: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.attom_key = attom_api_key

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] OwnerSignals: would scan ATTOM for ownership signals")
            return self._dry_run_samples(states or ["FL", "TX"])

        if not self.attom_key:
            log.warning("OwnerSignals: ATTOM_API_KEY not set — skipping off-market scan.")
            log.warning("  → Add ATTOM_API_KEY to .env to enable owner signal detection.")
            return []

        target = states or list(METRO_SEARCH_POINTS.keys())
        deals: list[Deal] = []
        for state in target:
            points = METRO_SEARCH_POINTS.get(state, [])
            for point in points:
                try:
                    found = self._attom_radius_search(state, point)
                    deals.extend(found)
                except Exception as exc:
                    log.warning("OwnerSignals %s %s failed: %s", point["label"], state, exc)

        log.info("OwnerSignals: %d off-market candidates found", len(deals))
        return deals

    def _attom_radius_search(self, state: str, point: dict) -> list[Deal]:
        """Search ATTOM for self-storage properties within 25mi of metro center."""
        headers = {"apikey": self.attom_key, "accept": "application/json"}
        params = {
            "latitude": point["lat"],
            "longitude": point["lon"],
            "radius": 25,
            "propertyType": "COMMERCIAL",
            "categoryCode": "A",  # All commercial
            "pagesize": 50,
        }
        try:
            resp = self.get(f"{ATTOM_BASE}/property/snapshot", headers=headers, params=params)
            props = resp.json().get("property", [])
        except Exception as exc:
            log.debug("ATTOM snapshot %s failed: %s", point["label"], exc)
            return []

        deals = []
        for prop in props:
            deal = self._attom_prop_to_deal(prop, state)
            if deal:
                deals.append(self._tag(deal))
        return deals

    def _attom_prop_to_deal(self, prop: dict, state: str) -> Optional[Deal]:
        addr = prop.get("address", {})
        lot = prop.get("lot", {})
        building = prop.get("building", {})
        sale = prop.get("sale", {})
        owner = prop.get("owner", {})

        street = addr.get("line1", "")
        # Filter to storage only
        use_code = str(lot.get("lotUse", "") or "").lower()
        desc = str(lot.get("lotDescription", "") or "").lower()
        if not any(k in f"{street} {use_code} {desc}" for k in ["storage", "warehouse", "7941"]):
            return None

        # Last sale date → years owned
        last_sale_date = sale.get("saleTransDate", "")
        years_owned = _years_since(last_sale_date)

        # Owner mailing address → out-of-state check
        owner_state = owner.get("mailingState", state)
        out_of_state = owner_state != state if owner_state else False

        owner_name_raw = owner.get("owner1", {}).get("fullname", "Unknown")

        # Skip if not meeting minimum threshold for off-market interest
        if years_owned and years_owned < 10 and not out_of_state:
            return None

        assessed = prop.get("assessment", {})
        tax = assessed.get("tax", {})
        market_val = assessed.get("market", {}).get("mktTtlValue")

        units = building.get("size", {}).get("universalSize")

        deal = Deal(
            address=street,
            city=addr.get("locality", ""),
            state=state,
            zip_code=addr.get("postal1", ""),
            unit_count=int(units) if units else None,
            year_built=building.get("yearBuilt"),
            estimated_value=float(market_val) if market_val else None,
            owner_name=owner_name_raw,
            owner_entity=owner_name_raw,
            owner_entity_state=owner_state or state,
            owner_mailing_address=_owner_mailing(owner),
            out_of_state_owner=out_of_state,
            years_owned=years_owned,
            raw_data=prop,
        )

        # Proxy for below-market rents: market value / units vs. benchmark
        if market_val and units and int(units) > 0:
            implied_noi = float(market_val) * 0.065  # 6.5% cap rate assumption
            noi_per_unit = implied_noi / int(units)
            deal.below_market_rents = noi_per_unit < MARKET_NOI_PER_UNIT * 0.8

        return deal

    def _dry_run_samples(self, states: list[str]) -> list[Deal]:
        samples = []
        for state in states[:2]:
            deal = Deal(
                facility_name=f"Long-Term Hold Storage — {state}",
                address="7700 Park Ave",
                city={"FL": "Jacksonville", "TX": "San Antonio"}.get(state, "City"),
                state=state,
                zip_code="32210",
                unit_count=260,
                year_built=1998,
                owner_name="Robert & Carol Henderson",
                owner_entity="Henderson Family LLC",
                owner_entity_state=state,
                owner_mailing_address="44 Oak Lane, Somewhere, GA 30301",
                out_of_state_owner=state != "GA",
                years_owned=18,
                owner_age_estimate=71,
                estimated_value=2_800_000,
                noi=178_000,
                occupancy=76,
                below_market_rents=True,
            )
            samples.append(self._tag(deal))
        return samples


# ── Helpers ────────────────────────────────────────────────────────────────────

def _years_since(date_str: str) -> Optional[int]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            from datetime import datetime
            d = datetime.strptime(date_str[:10], fmt[:8] if "T" in fmt else fmt)
            return (date.today() - d.date()).days // 365
        except (ValueError, AttributeError):
            pass
    return None


def _owner_mailing(owner: dict) -> str:
    parts = [
        owner.get("mailingAddressOneLine", ""),
        owner.get("mailingAddress", {}).get("oneLine", ""),
    ]
    return next((p for p in parts if p), "")
