"""
UCC lien search — finds storage facility owners with UCC-1 filings
approaching the 5-year expiration (i.e., lender hasn't continued = debt pressure).

State SOS UCC portals:
  FL  https://efts.sunbiz.org/FTSearch.aspx   (search by debtor name)
  TX  https://www.sos.state.tx.us/ucc/          (search by debtor)
  NC  https://www.sosnc.gov/online_services/search/by_title/_ucc_filings
  GA  https://ecorp.sos.ga.gov/                 (UCC filings search)
  TN  https://tnbear.tn.gov/UCC/                (UCC search)

Practical approach:
  Without a SOS API, scraping UCC portals is feasible but requires navigating
  form-based search pages.  The cleanest path is to search for known storage
  operator names (from ATTOM or prior scrapes) and check for active UCC filings
  with origination dates 4-5 years ago (approaching lapse).

  A commercial alternative: RELA IQ or CT Lien Solutions provide UCC data feeds.

This scraper implements the FL SunBiz search as a working example.
TX / NC / GA / TN are scaffolded — activate with additional portal knowledge.
"""

from __future__ import annotations
import logging
import re
from datetime import date, timedelta
from typing import Optional

from bs4 import BeautifulSoup

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

# UCC statements filed 42-60 months ago are "approaching maturity"
MATURITY_WINDOW_DAYS_MIN = 42 * 30
MATURITY_WINDOW_DAYS_MAX = 60 * 30


class UCCLienScraper(BaseScraper):
    name = "ucc_liens"
    source_type = "distressed"
    channel = "UCC Liens Approaching Maturity"

    def __init__(self, known_owners: Optional[list[str]] = None, **kwargs):
        super().__init__(**kwargs)
        # Feed in owner names found by other scrapers for targeted UCC lookup
        self.known_owners = known_owners or []

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] UCCLiens: would search SOS portals for %d known owners", len(self.known_owners))
            return self._dry_run_samples()

        deals: list[Deal] = []
        target = states or ["FL", "TX", "NC", "GA", "TN"]

        for state in target:
            if state == "FL":
                deals.extend(self._search_fl_sunbiz())

        return deals

    # ── Florida SunBiz ──────────────────────────────────────────────────────

    def _search_fl_sunbiz(self) -> list[Deal]:
        """
        Florida SunBiz UCC search.
        POST to https://efts.sunbiz.org/FTSearch.aspx with debtor name.
        Returns HTML table of UCC-1 filings.
        """
        base_url = "https://efts.sunbiz.org/FTSearch.aspx"
        keywords = self.known_owners or ["storage", "mini storage", "self storage"]
        deals = []

        for keyword in keywords[:10]:  # Rate-limit: cap at 10 queries
            try:
                resp = self.post(
                    base_url,
                    data={
                        "__EVENTTARGET": "",
                        "__EVENTARGUMENT": "",
                        "txtSearchNameDebtor": keyword,
                        "rdoSrchType": "N",
                        "btnSearch": "Search",
                    },
                )
                found = self._parse_sunbiz_results(resp.text, keyword)
                deals.extend(found)
            except Exception as exc:
                log.warning("SunBiz search for '%s' failed: %s", keyword, exc)

        return deals

    def _parse_sunbiz_results(self, html: str, keyword: str) -> list[Deal]:
        soup = BeautifulSoup(html, "lxml")
        table = soup.find("table", id="searchResultsTable") or soup.find("table", class_="results")
        if not table:
            return []

        deals = []
        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            debtor_name = cells[0].get_text(strip=True)
            filing_date_text = cells[2].get_text(strip=True)
            lapse_date_text = cells[3].get_text(strip=True)

            filing_date = _parse_date(filing_date_text)
            lapse_date = _parse_date(lapse_date_text)
            if not lapse_date:
                continue

            today = date.today()
            days_to_lapse = (lapse_date - today).days

            # Only include if approaching maturity window (4.5–5 years from filing)
            if not (0 < days_to_lapse < 180):
                continue

            text = debtor_name.lower()
            if not any(k in text for k in ["storage", "warehouse"]):
                continue

            deal = Deal(
                owner_name=debtor_name,
                state="FL",
                ucc_lien=True,
                ucc_lien_maturity_date=lapse_date.isoformat(),
                raw_data={"keyword": keyword, "filing_date": filing_date_text, "lapse_date": lapse_date_text},
            )
            deals.append(self._tag(deal))

        return deals

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="Storage Partners of Florida LLC",
            address="2200 N Dale Mabry Hwy",
            city="Tampa",
            state="FL",
            ucc_lien=True,
            ucc_lien_amount=850_000,
            ucc_lien_maturity_date=(date.today() + timedelta(days=90)).isoformat(),
        )
        return [self._tag(deal)]


def _parse_date(text: str) -> Optional[date]:
    text = text.strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None
