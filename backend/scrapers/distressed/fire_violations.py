"""
Fire marshal violations and Notices of Violation (NOVs) scraper.

Data sources:
  - City/county open data portals (where available)
  - State fire marshal public records portals
  - ATTOM property condition data (if key present)

Open data portals with code/fire violations:
  Nashville  → https://data.nashville.gov/ (code enforcement)
  Charlotte  → https://data.charlottenc.gov/
  Atlanta    → https://gis.atlantaga.gov/ (open data)
  Jacksonville → https://data.coj.net/
  Houston    → https://cohgis-mycity.opendata.arcgis.com/
  Tampa      → https://publicrecords.hillsboroughcounty.org/
"""

from __future__ import annotations
import logging
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

# City open-data endpoints for code/fire violations (Socrata API or direct CSV)
OPEN_DATA_ENDPOINTS = {
    "Nashville": {
        "url": "https://data.nashville.gov/resource/q6gt-xkvv.json",
        "state": "TN",
        "params": {"$where": "violation_type like '%FIRE%' OR violation_type like '%STORAGE%'", "$limit": 500},
    },
    "Charlotte": {
        "url": "https://data.charlottenc.gov/resource/pf8n-ygj8.json",
        "state": "NC",
        "params": {"$where": "description like '%storage%'", "$limit": 500},
    },
    "Houston": {
        "url": "https://cohgis-mycity.opendata.arcgis.com/datasets/coh-code-violations.geojson",
        "state": "TX",
        "params": {"$limit": 500},
    },
}


class FireViolationsScraper(BaseScraper):
    name = "fire_violations"
    source_type = "distressed"
    channel = "Fire Marshal / Code Violations"

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] FireViolations: would query open-data portals")
            return self._dry_run_samples()

        deals: list[Deal] = []
        for city, cfg in OPEN_DATA_ENDPOINTS.items():
            if states and cfg["state"] not in states:
                continue
            try:
                found = self._fetch_open_data(city, cfg)
                deals.extend(found)
            except Exception as exc:
                log.warning("FireViolations %s failed: %s", city, exc)

        return deals

    def _fetch_open_data(self, city: str, cfg: dict) -> list[Deal]:
        resp = self.get(cfg["url"], params=cfg.get("params", {}))

        # Socrata returns JSON array
        try:
            rows = resp.json()
            if not isinstance(rows, list):
                rows = rows.get("features", [])
        except Exception:
            return []

        deals = []
        for row in rows:
            # GeoJSON features have properties sub-dict
            props = row.get("properties", row)
            address = (
                props.get("address", "")
                or props.get("incident_address", "")
                or props.get("violation_address", "")
            )
            if not address:
                continue

            text = " ".join(str(v) for v in props.values()).lower()
            if not any(k in text for k in ["storage", "warehouse", "mini storage"]):
                continue

            details = [
                props.get("violation_description", "")
                or props.get("description", "")
                or "Fire/code violation on record"
            ]

            deal = Deal(
                address=address,
                city=city,
                state=cfg["state"],
                fire_code_violations=True,
                fire_code_count=1,
                fire_code_details=[d for d in details if d],
                raw_data=props,
            )
            deals.append(self._tag(deal))

        log.info("FireViolations %s: %d storage properties with violations", city, len(deals))
        return deals

    def _dry_run_samples(self) -> list[Deal]:
        deal = Deal(
            facility_name="Sample Storage — Nashville",
            address="500 Murfreesboro Pike",
            city="Nashville",
            state="TN",
            unit_count=220,
            fire_code_violations=True,
            fire_code_count=2,
            fire_code_details=["Suppression system inspection overdue", "Exit signage non-compliant"],
        )
        return [self._tag(deal)]
