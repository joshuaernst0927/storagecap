"""
Lis pendens and pre-foreclosure scraper.

Sources:
  1. ATTOM pre-foreclosure API (best — use if ATTOM_API_KEY set)
  2. County Clerk of Court records (public, per-county)
  3. PACER (federal court) for bankruptcy filings

County Clerk portals (FL):
  Hillsborough: https://www.hillsclerk.com/    (case search)
  Duval:        https://www.duvalclerk.com/    (official records)
  Miami-Dade:   https://www2.miami-dadeclerk.com/

Note: Many FL county clerks use Odyssey (Tyler Technologies) which has a
searchable case portal.  The pattern is consistent enough to scrape.
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0"

# Florida Odyssey portals by county
FL_ODYSSEY_PORTALS = {
    "Hillsborough": "https://publicrecords.hillsboroughcounty.org/",
    "Duval": "https://www.duvalclerk.com/Official-Records/Search",
    "Pinellas": "https://www.pinellasclerk.org/",
    "Pasco": "https://apps.pascoclerk.com/",
    "Polk": "https://www.polkclerk.com/",
}


class LisPendensScraper(BaseScraper):
    name = "lis_pendens"
    source_type = "distressed"
    channel = "Lis Pendens / Pre-Foreclosure"

    def __init__(self, attom_api_key: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.attom_key = attom_api_key

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] LisPendens: would scan %s", states)
            return self._dry_run_samples(states or ["FL", "TX"])

        target = states or ["FL", "TX", "NC", "GA", "TN"]
        if self.attom_key:
            return self._attom_scan(target)
        return self._county_scan(target)

    # ── ATTOM ────────────────────────────────────────────────────────────────

    def _attom_scan(self, states: list[str]) -> list[Deal]:
        deals: list[Deal] = []
        headers = {"apikey": self.attom_key, "accept": "application/json"}

        for state in states:
            try:
                resp = self.get(
                    f"{ATTOM_BASE}/preforeclosure/detail",
                    headers=headers,
                    params={"state": state, "statustype": "LIS PENDENS", "pagesize": 100},
                )
                for prop in resp.json().get("property", []):
                    deal = self._attom_prop_to_deal(prop, state)
                    if deal:
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("ATTOM lis pendens %s: %s", state, exc)

        return deals

    def _attom_prop_to_deal(self, prop: dict, state: str) -> Optional[Deal]:
        addr = prop.get("address", {})
        text = str(addr.get("line1", "")).lower()
        if not any(k in text for k in ["storage", "warehouse"]):
            return None

        lp = prop.get("preforeclosure", {})
        amount = lp.get("openingBid") or lp.get("estimatedValue")

        owner = prop.get("owner", {})
        owner_name = owner.get("owner1", {}).get("fullname", "Unknown")

        return Deal(
            address=addr.get("line1", ""),
            city=addr.get("locality", ""),
            state=state,
            zip_code=addr.get("postal1", ""),
            owner_name=owner_name,
            lis_pendens=True,
            lis_pendens_amount=float(amount) if amount else None,
            raw_data=prop,
        )

    # ── County-direct ─────────────────────────────────────────────────────────

    def _county_scan(self, states: list[str]) -> list[Deal]:
        deals: list[Deal] = []
        if "FL" in states:
            for county, url in FL_ODYSSEY_PORTALS.items():
                try:
                    found = self._fetch_fl_county(county, url)
                    deals.extend(found)
                except Exception as exc:
                    log.warning("Lis pendens %s county failed: %s", county, exc)
        return deals

    def _fetch_fl_county(self, county: str, base_url: str) -> list[Deal]:
        """
        Searches FL county official records for lis pendens documents
        mentioning storage properties.
        Each county has slightly different Odyssey URL paths.
        """
        search_url = base_url.rstrip("/") + "/official-records/search"
        try:
            resp = self.get(
                search_url,
                params={"documentType": "LIS PENDENS", "keywords": "storage"},
            )
        except Exception:
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        deals = []
        for row in soup.select("tr.result-row, tr.data-row"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            grantor = cells[0].get_text(strip=True)
            address = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            amount_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
            amount = _parse_dollar(amount_text)

            if not any(k in (grantor + address).lower() for k in ["storage", "warehouse"]):
                continue

            deal = Deal(
                address=address,
                city=_county_seat(county),
                state="FL",
                owner_name=grantor,
                lis_pendens=True,
                lis_pendens_amount=amount,
            )
            deals.append(self._tag(deal))
        return deals

    def _dry_run_samples(self, states: list[str]) -> list[Deal]:
        samples = []
        for state in states[:2]:
            deal = Deal(
                facility_name=f"Storage Ventures — {state}",
                address="3300 Commerce Way",
                city={"FL": "Orlando", "TX": "Dallas"}.get(state, "City"),
                state=state,
                owner_name="Commerce Storage LLC",
                lis_pendens=True,
                lis_pendens_amount=215_000,
                unit_count=310,
            )
            samples.append(self._tag(deal))
        return samples


def _parse_dollar(text: str) -> Optional[float]:
    clean = re.sub(r"[^\d.]", "", text)
    try:
        return float(clean)
    except ValueError:
        return None


def _county_seat(county: str) -> str:
    seats = {
        "Hillsborough": "Tampa", "Duval": "Jacksonville", "Pinellas": "St. Petersburg",
        "Pasco": "New Port Richey", "Polk": "Bartow",
    }
    return seats.get(county, county)
