"""
LoopNet self-storage listings (fully marketed deals).
Uses Playwright for JS rendering.  Falls back to CoStar API if key present.

Search URL:
  https://www.loopnet.com/search/self-storage-facilities/usa/for-sale/
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

SEARCH_URL = "https://www.loopnet.com/search/self-storage-facilities/usa/for-sale/?pricemax=30000000"
COSTAR_API = "https://api.costar.com/v2/properties/search"


class LoopNetScraper(BaseScraper):
    name = "loopnet"
    source_type = "marketed"
    channel = "LoopNet"

    def __init__(self, costar_api_key: Optional[str] = None, costar_secret: Optional[str] = None,
                 use_playwright: bool = True, **kwargs):
        super().__init__(**kwargs)
        self.costar_key = costar_api_key
        self.costar_secret = costar_secret
        self.use_playwright = use_playwright

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] LoopNet: would scrape self-storage listings")
            return self._dry_run_samples()

        if self.costar_key:
            return self._costar_api_scrape(states)
        if self.use_playwright:
            return self._playwright_scrape(states)
        return []

    def _costar_api_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        """CoStar API — requires sales contract with CoStar Group."""
        import base64
        creds = base64.b64encode(f"{self.costar_key}:{self.costar_secret}".encode()).decode()
        headers = {"Authorization": f"Basic {creds}", "Accept": "application/json"}
        params = {
            "propertyType": "SelfStorage",
            "saleListingType": "ForSale",
            "pageSize": 100,
        }
        if states:
            params["stateCode"] = ",".join(states)

        deals = []
        try:
            resp = self.get(COSTAR_API, headers=headers, params=params)
            for prop in resp.json().get("properties", []):
                deal = self._costar_to_deal(prop)
                if deal:
                    deals.append(self._tag(deal))
        except Exception as exc:
            log.warning("CoStar API failed: %s", exc)
        return deals

    def _costar_to_deal(self, prop: dict) -> Optional[Deal]:
        addr = prop.get("address", {})
        return Deal(
            facility_name=prop.get("buildingName", ""),
            address=addr.get("deliveryLine", ""),
            city=addr.get("city", ""),
            state=addr.get("stateCode", ""),
            zip_code=addr.get("postalCode", ""),
            asking_price=prop.get("askingPrice"),
            noi=prop.get("noi"),
            cap_rate=prop.get("capRate", 0) / 100 if prop.get("capRate") else None,
            unit_count=prop.get("numberOfUnits"),
            year_built=prop.get("yearBuilt"),
            url=f"https://www.loopnet.com/property/{prop.get('propertyId', '')}",
            owner_name="LoopNet Listing",
            raw_data=prop,
        )

    def _playwright_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning("Playwright not installed.")
            return []

        deals = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            try:
                page.goto(SEARCH_URL, wait_until="networkidle", timeout=45_000)
                page.wait_for_selector(".placard, [data-testid='property-card']", timeout=25_000)
                for card in page.query_selector_all(".placard, [data-testid='property-card']"):
                    deal = self._parse_card(card)
                    if deal:
                        if states and deal.state not in states:
                            continue
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("LoopNet Playwright failed: %s", exc)
            finally:
                browser.close()

        log.info("LoopNet: %d listings", len(deals))
        return deals

    def _parse_card(self, card) -> Optional[Deal]:
        try:
            name_el = card.query_selector(".placard-title, h2, h3")
            name = name_el.inner_text().strip() if name_el else ""
            addr_el = card.query_selector(".placard-subtitle, .address")
            addr = addr_el.inner_text().strip() if addr_el else ""
            price_el = card.query_selector(".price, .placard-price")
            price_text = price_el.inner_text().strip() if price_el else ""
            price = float(re.sub(r"[^\d]", "", price_text)) if re.sub(r"[^\d]", "", price_text) else None
            link_el = card.query_selector("a")
            href = link_el.get_attribute("href") if link_el else ""
            url = f"https://www.loopnet.com{href}" if href and href.startswith("/") else href or ""
            city, state = _parse_city_state(addr)
            return Deal(
                facility_name=name or addr,
                address=addr,
                city=city,
                state=state,
                asking_price=price,
                url=url,
                owner_name="LoopNet Listing",
            )
        except Exception:
            return None

    def _dry_run_samples(self) -> list[Deal]:
        return [self._tag(Deal(
            facility_name="Sun Coast Self Storage — Clearwater FL",
            city="Clearwater", state="FL",
            asking_price=5_200_000, noi=340_000, cap_rate=0.065,
            unit_count=450, url="https://www.loopnet.com/listing/example",
            owner_name="LoopNet Listing",
        ))]


def _parse_city_state(text: str) -> tuple[str, str]:
    m = re.search(r"([A-Za-z\s]+),\s+([A-Z]{2})", text)
    if m:
        return m.group(1).strip(), m.group(2)
    return "", ""
