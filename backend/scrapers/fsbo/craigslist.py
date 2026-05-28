"""
Craigslist scraper — commercial real estate > self-storage (FSBO).

Searches the "cre" (commercial real estate) category across all major metros
in the target states.  Craigslist HTML is consistent and doesn't require JS.

URL pattern:
  https://{metro}.craigslist.org/search/cre?query=self+storage&sort=date
"""

from __future__ import annotations
import logging
import re
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

# metro slug → (state, city display name)
METROS = {
    # FL
    "miami": ("FL", "Miami"), "tampa": ("FL", "Tampa"), "orlando": ("FL", "Orlando"),
    "jacksonville": ("FL", "Jacksonville"), "sarasota": ("FL", "Sarasota"),
    "space-coast": ("FL", "Melbourne"), "treasure-coast": ("FL", "Port St. Lucie"),
    # TX
    "houston": ("TX", "Houston"), "dallas": ("TX", "Dallas"), "austin": ("TX", "Austin"),
    "sanantonio": ("TX", "San Antonio"), "waco": ("TX", "Waco"),
    # NC
    "charlotte": ("NC", "Charlotte"), "raleigh": ("NC", "Raleigh"),
    "greensboro": ("NC", "Greensboro"), "wilmington": ("NC", "Wilmington"),
    # GA
    "atlanta": ("GA", "Atlanta"), "savannah": ("GA", "Savannah"),
    "columbusga": ("GA", "Columbus"),
    # TN
    "nashville": ("TN", "Nashville"), "memphis": ("TN", "Memphis"),
    "knoxville": ("TN", "Knoxville"), "chattanooga": ("TN", "Chattanooga"),
}

STORAGE_KEYWORDS = [
    "self storage", "self-storage", "mini storage", "storage facility",
    "storage units", "storage center", "storage park", "boat storage",
]


class CraigslistScraper(BaseScraper):
    name = "craigslist"
    source_type = "fsbo"
    channel = "Craigslist FSBO"

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] Craigslist: would scrape %d metros", len(METROS))
            return self._dry_run_samples()

        target_states = set(states or list({v[0] for v in METROS.values()}))
        deals: list[Deal] = []

        for metro, (state, city) in METROS.items():
            if state not in target_states:
                continue
            try:
                found = self._scrape_metro(metro, state, city)
                deals.extend(found)
            except Exception as exc:
                log.warning("Craigslist %s failed: %s", metro, exc)

        log.info("Craigslist: %d listings found", len(deals))
        return deals

    def _scrape_metro(self, metro: str, state: str, city: str) -> list[Deal]:
        base = f"https://{metro}.craigslist.org"
        url = f"{base}/search/cre"
        resp = self.get(url, params={"query": "self storage", "sort": "date"})
        soup = BeautifulSoup(resp.text, "lxml")

        deals = []
        # Craigslist result items
        for item in soup.select("li.cl-search-result, li.result-row"):
            title_el = item.select_one("a.cl-app-anchor, a.result-title")
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not any(k in title.lower() for k in STORAGE_KEYWORDS):
                continue

            href = title_el.get("href", "")
            if href and not href.startswith("http"):
                href = urljoin(base, href)

            price_el = item.select_one("span.priceinfo, span.result-price")
            price_text = price_el.get_text(strip=True) if price_el else ""
            price = _parse_price(price_text)

            location_el = item.select_one("span.cl-location, span.result-hood")
            location = location_el.get_text(strip=True).strip("() ") if location_el else city

            deal = Deal(
                facility_name=title,
                city=location or city,
                state=state,
                asking_price=price,
                url=href,
                owner_name="FSBO Owner",
            )
            deals.append(self._tag(deal))

            # Optionally fetch listing detail for more data
            if href and len(deals) <= 5:
                self._enrich_from_detail(deal, href)

        return deals

    def _enrich_from_detail(self, deal: Deal, url: str) -> None:
        """Fetch individual listing page to extract phone, address, unit count."""
        try:
            resp = self.get(url)
            soup = BeautifulSoup(resp.text, "lxml")

            body = soup.select_one("section#postingbody")
            if not body:
                return

            text = body.get_text(" ", strip=True)

            # Phone
            phone_match = re.search(r"\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}", text)
            if phone_match:
                deal.owner_phone = phone_match.group()

            # Unit count
            unit_match = re.search(r"(\d+)\s*(?:unit|storage unit|space)", text, re.IGNORECASE)
            if unit_match:
                deal.unit_count = int(unit_match.group(1))

            # Address from map block
            map_addr = soup.select_one("div.mapaddress")
            if map_addr:
                deal.address = map_addr.get_text(strip=True)

            # NOI / cap rate clues
            noi_match = re.search(r"NOI[:\s]+\$?([\d,]+)", text, re.IGNORECASE)
            if noi_match:
                deal.noi = float(noi_match.group(1).replace(",", ""))

            cap_match = re.search(r"cap\s*rate[:\s]+([\d.]+)%?", text, re.IGNORECASE)
            if cap_match:
                deal.cap_rate = float(cap_match.group(1)) / 100
        except Exception:
            pass

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="Owner Selling: 280-Unit Self Storage — Tampa FL",
            city="Tampa",
            state="FL",
            asking_price=2_400_000,
            unit_count=280,
            owner_name="FSBO Owner",
            url="https://tampa.craigslist.org/example",
            owner_phone="(813) 555-0100",
        )
        return [self._tag(deal)]


def _parse_price(text: str) -> Optional[float]:
    clean = re.sub(r"[^\d]", "", text)
    return float(clean) if clean else None
