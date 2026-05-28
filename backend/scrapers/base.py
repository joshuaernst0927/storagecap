"""Base scraper class with shared session, retry logic, and dry-run support."""

from __future__ import annotations
import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from models import Deal

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class BaseScraper(ABC):
    name: str = "base"
    source_type: str = "marketed"
    channel: str = ""

    def __init__(self, dry_run: bool = False, delay: float = 2.0):
        self.dry_run = dry_run
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    @abstractmethod
    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        ...

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(requests.RequestException),
        reraise=True,
    )
    def get(self, url: str, **kwargs) -> requests.Response:
        time.sleep(self.delay)
        resp = self.session.get(url, timeout=20, **kwargs)
        resp.raise_for_status()
        return resp

    def post(self, url: str, **kwargs) -> requests.Response:
        time.sleep(self.delay)
        resp = self.session.post(url, timeout=20, **kwargs)
        resp.raise_for_status()
        return resp

    def _tag(self, deal: Deal) -> Deal:
        deal.source_name = self.name
        deal.source_type = self.source_type
        deal.channel = self.channel or self.name
        return deal
