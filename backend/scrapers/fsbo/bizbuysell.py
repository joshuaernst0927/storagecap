"""
BizBuySell scraper — self-storage businesses for sale.
URL: https://www.bizbuysell.com/self-storage-businesses-for-sale/

BizBuySell uses static HTML with consistent pagination (no JS required).
Listings include asking price, revenue, cash flow, location, and seller contact.
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

BASE_URL = "https://www.bizbuysell.com"
SEARCH_URL = f"{BASE_URL}/self-storage-businesses-for-sale/"

STATE_ABBREV = {
    "Florida": "FL", "Texas": "TX", "North Carolina": "NC",
    "Georgia": "GA", "Tennessee": "TN",
    "Alabama": "AL", "South Carolina": "SC", "Virginia": "VA",
}


class BizBuySellScraper(BaseScraper):
    name = "bizbuysell"
    source_type = "fsbo"
    channel = "BizBuySell FSBO"

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] BizBuySell: would scrape self-storage listings")
            return self._dry_run_samples()

        target_states = set(states or list(STATE_ABBREV.values()))
        deals: list[Deal] = []
        page = 1

        while True:
            url = SEARCH_URL if page == 1 else f"{SEARCH_URL}?page={page}"
            try:
                resp = self.get(url)
            except Exception as exc:
                log.warning("BizBuySell page %d failed: %s", page, exc)
                break

            soup = BeautifulSoup(resp.text, "lxml")
            listings = soup.select("div.listing, div[data-id], article.result")

            if not listings:
                break

            found_on_page = 0
            for listing in listings:
                deal = self._parse_listing(listing, target_states)
                if deal:
                    deals.append(self._tag(deal))
                    found_on_page += 1

            log.info("BizBuySell page %d: %d matching listings", page, found_on_page)

            # Pagination
            next_btn = soup.select_one("a[rel='next'], a.next-page, li.next a")
            if not next_btn:
                break
            page += 1
            if page > 20:  # Safety cap
                break

        log.info("BizBuySell total: %d listings", len(deals))
        return deals

    def _parse_listing(self, el, target_states: set) -> Optional[Deal]:
        # Title
        title_el = el.select_one("h3 a, h2 a, a.title, a.listing-title")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        href = title_el.get("href", "")
        url = href if href.startswith("http") else f"{BASE_URL}{href}"

        if not any(k in title.lower() for k in ["storage", "self storage", "self-storage", "mini storage"]):
            return None

        # Location
        loc_el = el.select_one("span.location, p.location, div.city")
        location_text = loc_el.get_text(strip=True) if loc_el else ""
        city, state = _parse_location(location_text)
        if state and state not in target_states:
            return None

        # Price
        price_el = el.select_one("span.price, div.asking-price, strong.price")
        price_text = price_el.get_text(strip=True) if price_el else ""
        asking_price = _parse_dollar(price_text)

        # Revenue / cash flow
        rev_el = el.select_one("span.revenue, span[data-type='revenue']")
        cf_el = el.select_one("span.cash-flow, span[data-type='cashflow']")
        gross_revenue = _parse_dollar(rev_el.get_text(strip=True)) if rev_el else None
        noi = _parse_dollar(cf_el.get_text(strip=True)) if cf_el else None

        # Cap rate (if price + noi known)
        cap_rate = None
        if asking_price and noi and asking_price > 0:
            cap_rate = noi / asking_price

        return Deal(
            facility_name=title,
            city=city,
            state=state or "",
            asking_price=asking_price,
            gross_revenue=gross_revenue,
            noi=noi,
            cap_rate=cap_rate,
            url=url,
            owner_name="BizBuySell Seller",
        )

    def _dry_run_samples(self) -> list[Deal]:
        samples = [
            Deal(
                facility_name="Self Storage Facility For Sale — Tampa Bay Area",
                city="Tampa",
                state="FL",
                asking_price=3_200_000,
                gross_revenue=420_000,
                noi=265_000,
                cap_rate=0.083,
                unit_count=380,
                url="https://www.bizbuysell.com/business/example-1",
                owner_name="BizBuySell Seller",
            ),
            Deal(
                facility_name="Climate Controlled Mini Storage — Charlotte NC",
                city="Charlotte",
                state="NC",
                asking_price=1_950_000,
                gross_revenue=260_000,
                noi=160_000,
                cap_rate=0.082,
                unit_count=240,
                url="https://www.bizbuysell.com/business/example-2",
                owner_name="BizBuySell Seller",
            ),
        ]
        return [self._tag(d) for d in samples]


def _parse_location(text: str) -> tuple[str, str]:
    text = text.strip()
    for full_name, abbrev in STATE_ABBREV.items():
        if full_name in text or abbrev in text:
            city = text.replace(full_name, "").replace(abbrev, "").replace(",", "").strip()
            return city, abbrev
    # Try "City, ST" pattern
    m = re.match(r"^(.+),\s+([A-Z]{2})$", text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return text, ""


def _parse_dollar(text: str) -> Optional[float]:
    clean = re.sub(r"[^\d]", "", text)
    return float(clean) if clean else None
