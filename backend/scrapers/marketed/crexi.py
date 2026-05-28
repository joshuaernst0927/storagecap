"""Crexi marketed self-storage listings (broker-listed)."""

from __future__ import annotations
import logging
import re
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

CREXI_API_BASE = "https://api.crexi.com/v1"
CREXI_SEARCH_URL = "https://www.crexi.com/properties?types=self-storage&transactionType=for-sale"


class CrexiScraper(BaseScraper):
    name = "crexi"
    source_type = "marketed"
    channel = "Crexi"

    def __init__(self, crexi_api_key: Optional[str] = None, use_playwright: bool = True, **kwargs):
        super().__init__(**kwargs)
        self.api_key = crexi_api_key
        self.use_playwright = use_playwright

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] Crexi: would scrape marketed listings")
            return self._dry_run_samples()

        if self.api_key:
            return self._api_scrape(states)
        if self.use_playwright:
            return self._playwright_scrape(states)
        return []

    def _api_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        params = {"propertyType": "self_storage", "listingType": "for_sale", "pageSize": 50, "page": 1}
        if states:
            params["states"] = ",".join(states)

        deals = []
        while True:
            try:
                resp = self.get(f"{CREXI_API_BASE}/properties/search", headers=headers, params=params)
                data = resp.json()
                listings = data.get("listings", data.get("results", []))
                if not listings:
                    break
                for listing in listings:
                    deal = self._api_to_deal(listing)
                    if deal:
                        deals.append(self._tag(deal))
                if len(listings) < params["pageSize"]:
                    break
                params["page"] += 1
            except Exception as exc:
                log.warning("Crexi API page %d: %s", params["page"], exc)
                break

        log.info("Crexi: %d listings via API", len(deals))
        return deals

    def _api_to_deal(self, listing: dict) -> Optional[Deal]:
        addr = listing.get("property", {}).get("address", {})
        price = listing.get("askingPrice")
        noi = listing.get("noi")
        cap = listing.get("capRate")
        return Deal(
            facility_name=listing.get("name", ""),
            address=addr.get("street", ""),
            city=addr.get("city", ""),
            state=addr.get("state", ""),
            zip_code=addr.get("zip", ""),
            asking_price=float(price) if price else None,
            noi=float(noi) if noi else None,
            cap_rate=float(cap) / 100 if cap else None,
            url=listing.get("url", ""),
            owner_name="Crexi Listing",
            raw_data=listing,
        )

    def _playwright_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return []

        deals = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            try:
                page.goto(CREXI_SEARCH_URL, wait_until="networkidle", timeout=40_000)
                page.wait_for_selector("[data-testid='listing-card'], .listing-tile", timeout=20_000)
                for card in page.query_selector_all("[data-testid='listing-card'], .listing-tile"):
                    deal = _parse_card(card)
                    if deal:
                        if states and deal.state not in states:
                            continue
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("Crexi Playwright: %s", exc)
            finally:
                browser.close()

        log.info("Crexi: %d listings via Playwright", len(deals))
        return deals

    def _dry_run_samples(self) -> list[Deal]:
        return [self._tag(Deal(
            facility_name="Peach State Storage Center — Atlanta GA",
            city="Atlanta", state="GA",
            asking_price=6_800_000, noi=428_000, cap_rate=0.063,
            unit_count=520, url="https://www.crexi.com/properties/example",
            owner_name="Crexi Listing",
        ))]


def _parse_card(card) -> Optional[Deal]:
    try:
        name_el = card.query_selector("h2, h3, [data-testid='property-name']")
        name = name_el.inner_text().strip() if name_el else ""
        addr_el = card.query_selector("[data-testid='property-address'], .address")
        addr = addr_el.inner_text().strip() if addr_el else ""
        price_el = card.query_selector("[data-testid='price'], .asking-price")
        price_text = price_el.inner_text().strip() if price_el else ""
        price_str = re.sub(r"[^\d]", "", price_text)
        price = float(price_str) if price_str else None
        link_el = card.query_selector("a")
        href = link_el.get_attribute("href") if link_el else ""
        url = f"https://www.crexi.com{href}" if href and href.startswith("/") else href or ""
        m = re.search(r"([A-Za-z\s]+),\s+([A-Z]{2})", addr)
        city, state = (m.group(1).strip(), m.group(2)) if m else ("", "")
        return Deal(
            facility_name=name or addr, address=addr, city=city, state=state,
            asking_price=price, url=url, owner_name="Crexi Listing",
        )
    except Exception:
        return None
