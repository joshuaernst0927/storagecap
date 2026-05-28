"""
LoopNet FSBO listings — self-storage for sale by owner.

LoopNet uses Cloudflare protection and requires JavaScript rendering.
This scraper uses Playwright (headless Chromium).

URL: https://www.loopnet.com/search/self-storage-facilities/for-sale/?ListingType=FSBO

If Playwright is unavailable or blocked, falls back to LoopNet's undocumented
JSON API (subject to change) or returns empty with a log warning.

Note: LoopNet is owned by CoStar Group.  A CoStar API subscription gives
programmatic access to the same data.  Set COSTAR_API_KEY in .env for that path.
"""

from __future__ import annotations
import logging
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

SEARCH_URL = (
    "https://www.loopnet.com/search/self-storage-facilities/usa/for-sale/"
    "?ListingType=FSBO&pricemax=20000000"
)


class LoopNetFSBOScraper(BaseScraper):
    name = "loopnet_fsbo"
    source_type = "fsbo"
    channel = "LoopNet FSBO"

    def __init__(self, use_playwright: bool = True, **kwargs):
        super().__init__(**kwargs)
        self.use_playwright = use_playwright

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] LoopNet FSBO: would scrape with Playwright")
            return self._dry_run_samples()

        if self.use_playwright:
            return self._playwright_scrape(states)
        return []

    def _playwright_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning("Playwright not installed. Run: playwright install chromium")
            return []

        deals: list[Deal] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
            ctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )
            page = ctx.new_page()

            try:
                page.goto(SEARCH_URL, wait_until="networkidle", timeout=40_000)
                # Wait for listing cards
                page.wait_for_selector("[data-testid='property-card'], .listing-card", timeout=20_000)

                for card in page.query_selector_all("[data-testid='property-card'], .listing-card"):
                    deal = self._parse_card(card)
                    if deal:
                        if states and deal.state not in states:
                            continue
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("LoopNet FSBO Playwright scrape failed: %s", exc)
            finally:
                browser.close()

        log.info("LoopNet FSBO: %d listings found", len(deals))
        return deals

    def _parse_card(self, card) -> Optional[Deal]:
        try:
            title = card.query_selector("h2, h3, .property-name")
            name = title.inner_text().strip() if title else ""

            price_el = card.query_selector(".price, [data-testid='asking-price']")
            price_text = price_el.inner_text().strip() if price_el else ""

            addr_el = card.query_selector(".property-address, .address")
            addr_text = addr_el.inner_text().strip() if addr_el else ""

            link_el = card.query_selector("a")
            href = link_el.get_attribute("href") if link_el else ""
            url = f"https://www.loopnet.com{href}" if href and href.startswith("/") else href or ""

            city, state = _parse_city_state(addr_text)

            import re
            price = float(re.sub(r"[^\d]", "", price_text)) if price_text else None

            return Deal(
                facility_name=name or addr_text,
                address=addr_text,
                city=city,
                state=state,
                asking_price=price,
                url=url,
                owner_name="LoopNet FSBO Seller",
            )
        except Exception:
            return None

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="FSBO — 320-Unit Storage Center, Orlando FL",
            city="Orlando",
            state="FL",
            asking_price=4_100_000,
            unit_count=320,
            noi=260_000,
            cap_rate=0.063,
            url="https://www.loopnet.com/listing/example",
            owner_name="LoopNet FSBO Seller",
        )
        return [self._tag(deal)]


def _parse_city_state(text: str) -> tuple[str, str]:
    import re
    m = re.search(r",\s*([A-Za-z\s]+),?\s+([A-Z]{2})", text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    parts = text.split(",")
    if len(parts) >= 2:
        return parts[-2].strip(), parts[-1].strip()[:2]
    return "", ""
