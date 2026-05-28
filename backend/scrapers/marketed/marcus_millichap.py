"""
Marcus & Millichap self-storage listings.
URL: https://www.marcusmillichap.com/properties?propertyType=SelfStorage

M&M's site uses React with client-side rendering.  Playwright required.
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

BASE_URL = "https://www.marcusmillichap.com"
SEARCH_URL = f"{BASE_URL}/properties?propertyType=SelfStorage&listingStatus=Active"


class MarcusMillichapScraper(BaseScraper):
    name = "marcus_millichap"
    source_type = "marketed"
    channel = "Marcus & Millichap"

    def __init__(self, use_playwright: bool = True, **kwargs):
        super().__init__(**kwargs)
        self.use_playwright = use_playwright

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] Marcus & Millichap: would scrape listings")
            return self._dry_run_samples()

        if not self.use_playwright:
            return []

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning("Playwright not installed — skipping M&M scraper.")
            return []

        deals = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1280, "height": 900})
            page = ctx.new_page()
            try:
                page.goto(SEARCH_URL, wait_until="networkidle", timeout=45_000)
                # M&M uses a grid of property cards
                page.wait_for_selector(".property-card, [data-testid='property-card'], .listing-card", timeout=25_000)

                cards = page.query_selector_all(".property-card, [data-testid='property-card'], .listing-card")
                log.info("M&M: found %d cards", len(cards))

                for card in cards:
                    deal = self._parse_card(card, page)
                    if deal:
                        if states and deal.state not in states:
                            continue
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("M&M Playwright scrape failed: %s", exc)
            finally:
                browser.close()

        log.info("Marcus & Millichap: %d listings", len(deals))
        return deals

    def _parse_card(self, card, page) -> Optional[Deal]:
        try:
            # Property name / address
            name_el = card.query_selector("h2, h3, .property-name, .card-title")
            name = name_el.inner_text().strip() if name_el else ""

            addr_el = card.query_selector(".property-address, .address, .location")
            addr = addr_el.inner_text().strip() if addr_el else ""

            # Price
            price_el = card.query_selector(".price, .asking-price, [class*='price']")
            price_text = price_el.inner_text().strip() if price_el else ""
            price_clean = re.sub(r"[^\d]", "", price_text)
            price = float(price_clean) if price_clean else None

            # NOI / cap rate
            noi_el = card.query_selector("[class*='noi'], [data-label='NOI']")
            noi_text = noi_el.inner_text().strip() if noi_el else ""
            noi_clean = re.sub(r"[^\d]", "", noi_text)
            noi = float(noi_clean) if noi_clean else None

            cap_el = card.query_selector("[class*='cap'], [data-label='Cap Rate']")
            cap_text = cap_el.inner_text().strip() if cap_el else ""
            cap_match = re.search(r"([\d.]+)", cap_text)
            cap = float(cap_match.group(1)) / 100 if cap_match else None

            # Link
            link = card.query_selector("a")
            href = link.get_attribute("href") if link else ""
            url = f"{BASE_URL}{href}" if href and href.startswith("/") else href or ""

            # Location parsing
            city, state = _parse_city_state(addr or name)

            # Units
            units_el = card.query_selector("[class*='unit'], [data-label='Units']")
            units_text = units_el.inner_text().strip() if units_el else ""
            units_match = re.search(r"(\d+)", units_text)
            unit_count = int(units_match.group(1)) if units_match else None

            return Deal(
                facility_name=name or addr,
                address=addr,
                city=city,
                state=state,
                asking_price=price,
                noi=noi,
                cap_rate=cap,
                unit_count=unit_count,
                url=url,
                owner_name="Marcus & Millichap Listing",
            )
        except Exception:
            return None

    def _dry_run_samples(self) -> list[Deal]:
        return [self._tag(Deal(
            facility_name="Southeast Storage Portfolio — Multi-Asset",
            city="Nashville", state="TN",
            asking_price=12_500_000, noi=812_000, cap_rate=0.065,
            unit_count=940, url=f"{BASE_URL}/properties/example",
            owner_name="Marcus & Millichap Listing",
        ))]


def _parse_city_state(text: str) -> tuple[str, str]:
    m = re.search(r"([A-Za-z\s]+),\s+([A-Z]{2})", text)
    if m:
        return m.group(1).strip(), m.group(2)
    return "", ""
