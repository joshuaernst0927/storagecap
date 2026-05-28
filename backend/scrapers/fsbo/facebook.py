"""
Facebook Marketplace scraper — self-storage for sale.

Facebook Marketplace requires authentication and heavily uses JavaScript,
making traditional scraping unreliable.

Options:
  A) Playwright + saved session cookies (most reliable)
     1. Log in manually once, save session to fb_cookies.json
     2. Load cookies into Playwright context on each run

  B) Facebook Graph API (requires Business account + approval)
     — not practical for real estate listings

  C) Manual export: Periodically save searches and feed into deals.json directly

This module implements Option A (Playwright with saved cookies).
If no cookies are saved or login fails, it logs instructions and returns empty.

Setup:
  1. pip install playwright && playwright install chromium
  2. python -c "from scrapers.fsbo.facebook import save_session; save_session()"
     Follow the prompts to log in and save cookies.
"""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

COOKIES_PATH = Path("fb_cookies.json")
SEARCH_URL = (
    "https://www.facebook.com/marketplace/search?"
    "query=self+storage+for+sale&category_id=267&availability=item_available"
)


class FacebookMarketplaceScraper(BaseScraper):
    name = "facebook_marketplace"
    source_type = "fsbo"
    channel = "Facebook Marketplace FSBO"

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] Facebook Marketplace: would scrape with Playwright")
            return self._dry_run_samples()

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            log.warning("Playwright not installed. Run: pip install playwright && playwright install chromium")
            return []

        if not COOKIES_PATH.exists():
            log.warning(
                "Facebook Marketplace: no session cookies found at %s.\n"
                "  To enable: python -c \"from scrapers.fsbo.facebook import save_session; save_session()\"",
                COOKIES_PATH,
            )
            return []

        deals: list[Deal] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context()
            ctx.add_cookies(json.loads(COOKIES_PATH.read_text()))
            page = ctx.new_page()

            try:
                page.goto(SEARCH_URL, timeout=30_000)
                page.wait_for_selector("[data-testid='marketplace-item']", timeout=15_000)

                items = page.query_selector_all("[data-testid='marketplace-item']")
                for item in items:
                    deal = self._parse_item(item, page)
                    if deal:
                        deals.append(self._tag(deal))
            except Exception as exc:
                log.warning("Facebook Marketplace scrape failed: %s", exc)
            finally:
                browser.close()

        log.info("Facebook Marketplace: %d listings found", len(deals))
        return deals

    def _parse_item(self, item, page) -> Optional[Deal]:
        try:
            title_el = item.query_selector("span[dir='auto']")
            title = title_el.inner_text().strip() if title_el else ""
            if not any(k in title.lower() for k in ["storage", "warehouse"]):
                return None

            price_el = item.query_selector("span.x193iq5w")
            price_text = price_el.inner_text().strip() if price_el else ""
            price = _parse_price(price_text)

            link_el = item.query_selector("a")
            href = link_el.get_attribute("href") if link_el else ""
            url = f"https://www.facebook.com{href}" if href and href.startswith("/") else href

            return Deal(
                facility_name=title,
                asking_price=price,
                url=url or "",
                owner_name="Facebook Marketplace Seller",
            )
        except Exception:
            return None

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="Self Storage Business For Sale — Charlotte NC",
            city="Charlotte",
            state="NC",
            asking_price=1_800_000,
            unit_count=210,
            owner_name="Facebook Marketplace Seller",
            url="https://www.facebook.com/marketplace/item/example",
        )
        return [self._tag(deal)]


def save_session() -> None:
    """Interactive helper: log in to Facebook and save session cookies."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Install playwright first: pip install playwright && playwright install chromium")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto("https://www.facebook.com/login")
        print("Log in to Facebook in the browser window, then press Enter here...")
        input()
        cookies = ctx.cookies()
        COOKIES_PATH.write_text(json.dumps(cookies))
        print(f"Session saved to {COOKIES_PATH}")
        browser.close()


import re

def _parse_price(text: str) -> Optional[float]:
    clean = re.sub(r"[^\d]", "", text)
    return float(clean) if clean else None
