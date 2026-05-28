"""
Tax delinquency scraper for FL, TX, NC, GA, TN.

Strategy (in priority order):
  1. ATTOM Data API  — if ATTOM_API_KEY is set, query pre-foreclosure + tax delinquency
     endpoints filtered to self-storage NAICS 531130 / SIC 6500.
  2. County-direct   — scrape published delinquent tax sale lists for the largest counties.
     Each county sub-class implements _fetch_county() → list[Deal].

County portal notes (update URLs if portals change):
  FL  – Most counties publish an Excel delinquency list before May tax cert sale.
        Hillsborough: https://hctax.net/Property/TaxCert
        Miami-Dade:   https://www.miamidade.gov/taxcollector/
        Duval:        https://taxcollector.coj.net/
  TX  – Harris County: https://hctax.net/  (same vendor as Hillsborough for TaxSys)
        Dallas CAD:    https://www.dallascad.org/
  NC  – Wake County:   https://www.wakegov.com/departments-government/tax-administration
        Mecklenburg:   https://www.mecknc.gov/TaxCollections/
  GA  – Fulton County: https://www.fultoncountyga.gov/government/departments/taxes
  TN  – Davidson:      https://www.nashville.gov/departments/finance/trustee
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0"

# Storage SIC codes used in ATTOM queries
STORAGE_SIC = ["6512", "6552", "7941"]

# Counties to scrape when no ATTOM key (state → list of county names)
TARGET_COUNTIES = {
    "FL": ["Hillsborough", "Miami-Dade", "Duval", "Palm Beach", "Orange", "Pinellas", "Broward"],
    "TX": ["Harris", "Dallas", "Tarrant", "Travis", "Bexar"],
    "NC": ["Mecklenburg", "Wake", "Guilford"],
    "GA": ["Fulton", "DeKalb", "Cobb", "Gwinnett"],
    "TN": ["Davidson", "Shelby", "Knox"],
}


class TaxDelinquencyScraper(BaseScraper):
    name = "tax_delinquency"
    source_type = "distressed"
    channel = "County Tax Delinquency"

    def __init__(self, attom_api_key: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.attom_key = attom_api_key

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        target = states or list(TARGET_COUNTIES.keys())
        if self.dry_run:
            log.info("[DRY RUN] TaxDelinquency: would scan %s", target)
            return self._dry_run_samples(target)

        if self.attom_key:
            return self._attom_scan(target)
        return self._county_scan(target)

    # ── ATTOM path ─────────────────────────────────────────────────────────

    def _attom_scan(self, states: list[str]) -> list[Deal]:
        deals: list[Deal] = []
        for state in states:
            try:
                deals.extend(self._attom_state(state))
            except Exception as exc:
                log.warning("ATTOM scan failed for %s: %s", state, exc)
        return deals

    def _attom_state(self, state: str) -> list[Deal]:
        """
        Query ATTOM pre-foreclosure endpoint filtered by state.
        Docs: https://api.developer.attomdata.com/docs#!/Pre-Foreclosure/
        """
        headers = {
            "apikey": self.attom_key,
            "accept": "application/json",
        }
        params = {
            "state": state,
            "statustype": "PRE-FORECLOSURE",
            "pagesize": 100,
            "page": 1,
        }
        deals: list[Deal] = []
        while True:
            try:
                resp = self.get(
                    f"{ATTOM_BASE}/preforeclosure/detail",
                    headers=headers,
                    params=params,
                )
                data = resp.json()
            except Exception as exc:
                log.warning("ATTOM pre-foreclosure page %d failed: %s", params["page"], exc)
                break

            properties = data.get("property", [])
            if not properties:
                break

            for prop in properties:
                deal = self._attom_to_deal(prop, state)
                if deal:
                    deals.append(self._tag(deal))

            if len(properties) < params["pagesize"]:
                break
            params["page"] += 1

        log.info("ATTOM: %d pre-foreclosure properties in %s", len(deals), state)
        return deals

    def _attom_to_deal(self, prop: dict, state: str) -> Optional[Deal]:
        addr = prop.get("address", {})
        assessment = prop.get("assessment", {})
        preforeclosure = prop.get("preforeclosure", {})

        city = addr.get("locality", "")
        street = addr.get("line1", "")
        zip_code = addr.get("postal1", "")

        # Filter: only process if address / description mentions storage
        combined = f"{street} {city}".lower()
        if not _looks_like_storage(combined, prop):
            return None

        tax_amount = assessment.get("taxBilled")
        tax_delinquent = bool(preforeclosure.get("recordingDate"))

        deal = Deal(
            address=street,
            city=city,
            state=state,
            zip_code=zip_code,
            owner_name=_owner_name(prop),
            tax_delinquency=tax_delinquent,
            tax_delinquency_amount=float(tax_amount) if tax_amount else None,
        )
        return deal

    # ── County-direct path ──────────────────────────────────────────────────

    def _county_scan(self, states: list[str]) -> list[Deal]:
        deals: list[Deal] = []
        for state in states:
            counties = TARGET_COUNTIES.get(state, [])
            for county in counties:
                try:
                    found = self._fetch_county(state, county)
                    log.info("County %s, %s: %d storage properties with tax issues", county, state, len(found))
                    deals.extend(found)
                except Exception as exc:
                    log.warning("County scrape failed %s %s: %s", county, state, exc)
        return deals

    def _fetch_county(self, state: str, county: str) -> list[Deal]:
        """
        Override per-county.  Default implementation uses the Florida TaxSys
        platform (Tyler Technologies) which serves many FL and TX counties.
        """
        if state == "FL":
            return self._fetch_taxsys_fl(county)
        if state == "TX":
            return self._fetch_texas_cad(county)
        # NC / GA / TN — public records portals vary widely; log a TODO
        log.debug("No direct scraper for %s, %s — add ATTOM key for coverage.", county, state)
        return []

    def _fetch_taxsys_fl(self, county: str) -> list[Deal]:
        """
        Florida TaxSys (county-taxes.com) — search delinquent accounts.
        Many FL counties use this platform.
        URL pattern: https://{slug}.county-taxes.com/public/search/property_tax
        """
        slug_map = {
            "Hillsborough": "hillsborough-fl",
            "Pinellas": "pinellas-fl",
            "Pasco": "pasco-fl",
            "Polk": "polk-fl",
        }
        slug = slug_map.get(county)
        if not slug:
            return []

        url = f"https://{slug}.county-taxes.com/public/search/property_tax"
        try:
            resp = self.get(url, params={"search_type": "delinquent", "usage": "storage"})
        except Exception as exc:
            log.warning("TaxSys %s failed: %s", county, exc)
            return []

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "lxml")
        results = []
        for row in soup.select("table.search-results tr[data-parcel]"):
            cells = row.find_all("td")
            if len(cells) < 4:
                continue
            addr_text = cells[1].get_text(strip=True)
            owner_text = cells[2].get_text(strip=True)
            amount_text = cells[3].get_text(strip=True)
            amount = _parse_dollar(amount_text)
            deal = Deal(
                address=addr_text,
                city=_infer_city(addr_text, county),
                state="FL",
                owner_name=owner_text,
                tax_delinquency=True,
                tax_delinquency_amount=amount,
            )
            results.append(self._tag(deal))
        return results

    def _fetch_texas_cad(self, county: str) -> list[Deal]:
        """
        Texas Central Appraisal Districts — delinquent search.
        Harris County Tax Office: https://hctax.net/
        """
        if county != "Harris":
            return []
        url = "https://hctax.net/Property/AccountDetail"
        # Harris County requires POST with account details — a real scraper
        # would iterate through known storage parcel IDs from the CAD roll.
        # Placeholder: returns empty until parcel list is seeded.
        log.debug("Harris County TX: scraper stub — seed parcel list to activate.")
        return []

    # ── Dry run ─────────────────────────────────────────────────────────────

    def _dry_run_samples(self, states: list[str]) -> list[Deal]:
        samples = []
        for state in states[:2]:
            deal = Deal(
                facility_name=f"Sample Storage — {state}",
                address="100 Industrial Blvd",
                city={"FL": "Tampa", "TX": "Houston", "NC": "Charlotte", "GA": "Atlanta", "TN": "Nashville"}.get(state, "City"),
                state=state,
                zip_code="00000",
                owner_name="Sample Owner LLC",
                tax_delinquency=True,
                tax_delinquency_amount=35_000,
                tax_delinquency_years=2,
                unit_count=280,
            )
            samples.append(self._tag(deal))
        return samples


# ── Helpers ────────────────────────────────────────────────────────────────────

def _looks_like_storage(text: str, prop: dict) -> bool:
    keywords = ["storage", "mini storage", "self storage", "self-storage", "warehouse"]
    if any(k in text for k in keywords):
        return True
    sic = str(prop.get("lot", {}).get("siteInfluence", ""))
    return "7941" in sic or "6512" in sic


def _owner_name(prop: dict) -> str:
    owner = prop.get("owner", {})
    parts = [owner.get("owner1", {}).get("fullname", ""), owner.get("owner2", {}).get("fullname", "")]
    return " & ".join(p for p in parts if p) or "Unknown"


def _parse_dollar(text: str) -> Optional[float]:
    clean = re.sub(r"[^\d.]", "", text)
    try:
        return float(clean)
    except ValueError:
        return None


def _infer_city(address: str, county: str) -> str:
    # Very rough: return county seat as fallback
    seats = {
        "Hillsborough": "Tampa", "Miami-Dade": "Miami", "Duval": "Jacksonville",
        "Orange": "Orlando", "Pinellas": "St. Petersburg", "Broward": "Fort Lauderdale",
        "Palm Beach": "West Palm Beach",
    }
    return seats.get(county, county)
