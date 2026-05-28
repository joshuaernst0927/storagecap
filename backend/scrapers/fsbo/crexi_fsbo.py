"""
Crexi FSBO self-storage listings.

Crexi has a public web app (https://www.crexi.com/properties) and a private API.
If CREXI_API_KEY is set, use the API.  Otherwise attempt web scraping with Playwright.

API docs: https://app.crexi.com/api-docs (requires account)
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

CREXI_API_BASE = "https://api.crexi.com/v1"
CREXI_SEARCH_URL = "https://www.crexi.com/properties?types=self-storage&listingType=fsbo&transactionType=for-sale"


class CrexiFSBOScraper(BaseScraper):
    name = "crexi_fsbo"
    source_type = "fsbo"
    channel = "Crexi FSBO"

    def __init__(self, crexi_api_key: Optional[str] = None, use_playwright: bool = True, **kwargs):
        super().__init__(**kwargs)
        self.api_key = crexi_api_key
        self.use_playwright = use_playwright

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] Crexi FSBO: would scrape listings")
            return self._dry_run_samples()

        if self.api_key:
            return self._api_scrape(states)
        if self.use_playwright:
            return self._playwright_scrape(states)
        log.warning("Crexi FSBO: no API key and Playwright disabled — skipping.")
        return []

    # ── Crexi API ─────────────────────────────────────────────────────────────

    def _api_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        params = {
            "propertyType": "self_storage",
            "listingType": "for_sale",
            "listingSubType": "fsbo",
            "pageSize": 50,
            "page": 1,
        }
        if states:
            params["states"] = ",".join(states)

        deals: list[Deal] = []
        while True:
            try:
                resp = self.get(f"{CREXI_API_BASE}/properties/search", headers=headers, params=params)
                data = resp.json()
            except Exception as exc:
                log.warning("Crexi API page %d failed: %s", params["page"], exc)
                break

            listings = data.get("listings", data.get("results", []))
            if not listings:
                break

            for listing in listings:
                deal = self._api_listing_to_deal(listing)
                if deal:
                    deals.append(self._tag(deal))

            if len(listings) < params["pageSize"]:
                break
            params["page"] += 1

        log.info("Crexi FSBO API: %d listings", len(deals))
        return deals

    def _api_listing_to_deal(self, listing: dict) -> Optional[Deal]:
        price = listing.get("askingPrice") or listing.get("price")
        noi = listing.get("noi") or listing.get("netOperatingIncome")
        cap = listing.get("capRate")
        prop = listing.get("property", listing)

        addr = prop.get("address", {})
        return Deal(
            facility_name=listing.get("name", "") or prop.get("name", ""),
            address=addr.get("street", ""),
            city=addr.get("city", ""),
            state=addr.get("state", ""),
            zip_code=addr.get("zip", ""),
            asking_price=float(price) if price else None,
            noi=float(noi) if noi else None,
            cap_rate=float(cap) / 100 if cap else None,
            unit_count=prop.get("unitCount") or prop.get("units"),
            url=listing.get("url", ""),
            owner_name="Crexi FSBO Seller",
            raw_data=listing,
        )

    # ── Playwright fallback ────────────────────────────────────────────────────

    def _playwright_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning("Playwright not installed.")
            return []

        deals: list[Deal] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                page.goto(CREXI_SEARCH_URL, wait_until="networkidle", timeout=40_000)
                page.wait_for_selector("[data-testid='listing-card'], .listing-tile", timeout=20_000)
                for card in page.query_selector_all("[data-testid='listing-card'], .listing-tile"):
                    deal = self._parse_card(card)
                    if deal:
                        if states and deal.state not in states:
                            continue
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("Crexi FSBO Playwright failed: %s", exc)
            finally:
                browser.close()

        log.info("Crexi FSBO Playwright: %d listings", len(deals))
        return deals

    def _parse_card(self, card) -> Optional[Deal]:
        try:
            name_el = card.query_selector("h2, h3, [data-testid='property-name']")
            name = name_el.inner_text().strip() if name_el else ""
            addr_el = card.query_selector("[data-testid='property-address'], .address")
            addr = addr_el.inner_text().strip() if addr_el else ""
            price_el = card.query_selector("[data-testid='price'], .asking-price")
            price_text = price_el.inner_text().strip() if price_el else ""
            price = float(re.sub(r"[^\d]", "", price_text)) if price_text else None
            link_el = card.query_selector("a")
            href = link_el.get_attribute("href") if link_el else ""
            url = f"https://www.crexi.com{href}" if href and href.startswith("/") else href or ""
            city, state = _parse_city_state(addr)
            return Deal(
                facility_name=name or addr,
                address=addr,
                city=city,
                state=state,
                asking_price=price,
                url=url,
                owner_name="Crexi FSBO Seller",
            )
        except Exception:
            return None

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="FSBO Storage Center — Raleigh NC",
            city="Raleigh",
            state="NC",
            asking_price=2_700_000,
            unit_count=295,
            noi=185_000,
            cap_rate=0.069,
            url="https://www.crexi.com/properties/example",
            owner_name="Crexi FSBO Seller",
        )
        return [self._tag(deal)]


def _parse_city_state(text: str) -> tuple[str, str]:
    m = re.search(r"([A-Za-z\s]+),\s+([A-Z]{2})", text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return "", ""
