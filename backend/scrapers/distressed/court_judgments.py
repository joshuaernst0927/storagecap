"""
Court judgment scraper — finds judgments filed against storage facility owners.

Sources:
  1. PACER (federal) — bankruptcy filings (Chapter 7/11 against storage operators)
  2. State court systems — each state has its own portal
     FL: https://www.myflcourtaccess.com/  (requires account but free)
     TX: https://www.txcourts.gov/         (varies by county)
     NC: https://www.nccourts.gov/
     GA: https://efiling.gsccca.org/        (GA Superior Court)
     TN: https://www.tncourts.gov/
  3. ATTOM foreclosure data (most practical with API key)

This module implements:
  - ATTOM foreclosure endpoint (best coverage)
  - FL myflcourtaccess.com search for known storage entities
"""

from __future__ import annotations
import logging
from typing import Optional

from bs4 import BeautifulSoup

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0"


class CourtJudgmentScraper(BaseScraper):
    name = "court_judgments"
    source_type = "distressed"
    channel = "Court Judgments"

    def __init__(self, attom_api_key: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.attom_key = attom_api_key

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] CourtJudgments: would scan foreclosure + judgment records")
            return self._dry_run_samples()

        target = states or ["FL", "TX", "NC", "GA", "TN"]
        if self.attom_key:
            return self._attom_foreclosure_scan(target)
        return self._state_court_scan(target)

    # ── ATTOM foreclosure ─────────────────────────────────────────────────────

    def _attom_foreclosure_scan(self, states: list[str]) -> list[Deal]:
        deals: list[Deal] = []
        headers = {"apikey": self.attom_key, "accept": "application/json"}
        for state in states:
            try:
                resp = self.get(
                    f"{ATTOM_BASE}/preforeclosure/detail",
                    headers=headers,
                    params={"state": state, "statustype": "JUDGMENT", "pagesize": 100},
                )
                for prop in resp.json().get("property", []):
                    addr = prop.get("address", {})
                    text = addr.get("line1", "").lower()
                    if not any(k in text for k in ["storage", "warehouse"]):
                        continue
                    owner = prop.get("owner", {})
                    pf = prop.get("preforeclosure", {})
                    deal = Deal(
                        address=addr.get("line1", ""),
                        city=addr.get("locality", ""),
                        state=state,
                        zip_code=addr.get("postal1", ""),
                        owner_name=owner.get("owner1", {}).get("fullname", "Unknown"),
                        court_judgment=True,
                        court_judgment_amount=float(pf.get("openingBid", 0) or 0) or None,
                        raw_data=prop,
                    )
                    deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("ATTOM judgment %s: %s", state, exc)
        return deals

    # ── State court direct ────────────────────────────────────────────────────

    def _state_court_scan(self, states: list[str]) -> list[Deal]:
        deals: list[Deal] = []
        if "FL" in states:
            deals.extend(self._fl_myflcourt_scan())
        return deals

    def _fl_myflcourt_scan(self) -> list[Deal]:
        """
        Florida myflcourtaccess.com — public access (no login needed for basic search).
        https://www.myflcourtaccess.com/
        Search for civil judgments against storage entities.
        """
        url = "https://www.myflcourtaccess.com/home/publicaccess"
        try:
            resp = self.get(url, params={"partyName": "storage", "caseType": "civil", "filing": "judgment"})
        except Exception as exc:
            log.warning("myflcourtaccess scan failed: %s", exc)
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        deals = []
        for row in soup.select("table#caseResults tr")[1:]:
            cells = row.find_all("td")
            if len(cells) < 4:
                continue
            party = cells[0].get_text(strip=True)
            case_type = cells[1].get_text(strip=True)
            county = cells[2].get_text(strip=True)
            if "storage" not in party.lower():
                continue
            deal = Deal(
                owner_name=party,
                state="FL",
                city=county,
                court_judgment=True,
                raw_data={"case_type": case_type, "county": county},
            )
            deals.append(self._tag(deal))
        return deals

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="Sunshine Storage Holdings",
            address="1400 Business Park Dr",
            city="Fort Lauderdale",
            state="FL",
            owner_name="Sunshine Storage Holdings LLC",
            court_judgment=True,
            court_judgment_amount=180_000,
            unit_count=340,
        )
        return [self._tag(deal)]
