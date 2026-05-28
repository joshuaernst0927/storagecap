"""
CBRE self-storage listings.

CBRE's property search: https://www.cbre.com/properties/properties-for-sale
Filter: Property Type → Industrial → Self-Storage

CBRE's site is React-rendered.  Playwright required.
CBRE also has a commercial data API (CBRE Capital Markets API) — contact your
CBRE relationship manager for access credentials.
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

CBRE_BASE = "https://www.cbre.com"
SEARCH_URL = (
    "https://www.cbre.com/properties/properties-for-sale"
    "?propertyType=Industrial&subtype=Self-Storage"
)


class CBREScraper(BaseScraper):
    name = "cbre"
    source_type = "marketed"
    channel = "CBRE"

    def __init__(self, use_playwright: bool = True, **kwargs):
        super().__init__(**kwargs)
        self.use_playwright = use_playwright

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] CBRE: would scrape self-storage listings")
            return self._dry_run_samples()

        if not self.use_playwright:
            return []

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning("Playwright not installed — skipping CBRE scraper.")
            return []

        deals = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            try:
                page.goto(SEARCH_URL, wait_until="networkidle", timeout=45_000)
                page.wait_for_selector("[class*='PropertyCard'], [class*='listing-card'], .property-card", timeout=25_000)

                cards = page.query_selector_all("[class*='PropertyCard'], [class*='listing-card'], .property-card")
                log.info("CBRE: found %d cards", len(cards))

                for card in cards:
                    deal = self._parse_card(card)
                    if deal:
                        if states and deal.state not in states:
                            continue
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("CBRE Playwright scrape failed: %s", exc)
            finally:
                browser.close()

        log.info("CBRE: %d listings", len(deals))
        return deals

    def _parse_card(self, card) -> Optional[Deal]:
        try:
            name_el = card.query_selector("h2, h3, [class*='title'], [class*='name']")
            name = name_el.inner_text().strip() if name_el else ""

            addr_el = card.query_selector("[class*='address'], [class*='location']")
            addr = addr_el.inner_text().strip() if addr_el else ""

            price_el = card.query_selector("[class*='price'], [class*='Price']")
            price_text = price_el.inner_text().strip() if price_el else ""
            price_clean = re.sub(r"[^\d]", "", price_text)
            price = float(price_clean) if price_clean else None

            link = card.query_selector("a")
            href = link.get_attribute("href") if link else ""
            url = f"{CBRE_BASE}{href}" if href and href.startswith("/") else href or ""

            city, state = _parse_city_state(addr or name)

            size_el = card.query_selector("[class*='size'], [class*='sqft']")
            size_text = size_el.inner_text().strip() if size_el else ""
            size_match = re.search(r"([\d,]+)\s*(?:sf|sq\.?\s*ft)", size_text, re.IGNORECASE)
            sqft = int(size_match.group(1).replace(",", "")) if size_match else None

            return Deal(
                facility_name=name or addr,
                address=addr,
                city=city,
                state=state,
                asking_price=price,
                sqft=sqft,
                url=url,
                owner_name="CBRE Listing",
            )
        except Exception:
            return None

    def _dry_run_samples(self) -> list[Deal]:
        return [self._tag(Deal(
            facility_name="Class-A Storage Campus — Alpharetta GA",
            city="Alpharetta", state="GA",
            asking_price=14_000_000, noi=910_000, cap_rate=0.065,
            unit_count=820, sqft=95_000,
            url=f"{CBRE_BASE}/properties/example",
            owner_name="CBRE Listing",
        ))]


def _parse_city_state(text: str) -> tuple[str, str]:
    m = re.search(r"([A-Za-z\s]+),\s+([A-Z]{2})", text)
    if m:
        return m.group(1).strip(), m.group(2)
    return "", ""
