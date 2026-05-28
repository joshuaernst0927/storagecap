"""CoStar self-storage listings via the CoStar API (requires paid subscription)."""

from __future__ import annotations
import logging
from typing import Optional

from models import Deal
from scrapers.base import BaseScraper

log = logging.getLogger(__name__)

COSTAR_API = "https://api.costar.com/v2"


class CoStarScraper(BaseScraper):
    name = "costar"
    source_type = "marketed"
    channel = "CoStar"

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key
        self.api_secret = api_secret

    def scrape(self, states: Optional[list[str]] = None) -> list[Deal]:
        if self.dry_run:
            log.info("[DRY RUN] CoStar: would query API for self-storage listings")
            return self._dry_run_samples()

        if not self.api_key:
            log.info("CoStar: no API key — skipping. Set COSTAR_API_KEY in .env.")
            return []

        return self._api_scrape(states)

    def _api_scrape(self, states: Optional[list[str]]) -> list[Deal]:
        import base64
        creds = base64.b64encode(f"{self.api_key}:{self.api_secret or ''}".encode()).decode()
        headers = {
            "Authorization": f"Basic {creds}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        body = {
            "propertyType": ["SelfStorage"],
            "saleStatusType": ["ForSale"],
            "stateCode": states or ["FL", "TX", "NC", "GA", "TN"],
            "pageSize": 100,
        }

        deals = []
        try:
            resp = self.post(f"{COSTAR_API}/properties/search", json=body, headers=headers)
            for prop in resp.json().get("properties", []):
                deal = self._prop_to_deal(prop)
                if deal:
                    deals.append(self._tag(deal))
        except Exception as exc:
            log.warning("CoStar API: %s", exc)

        log.info("CoStar: %d listings", len(deals))
        return deals

    def _prop_to_deal(self, prop: dict) -> Optional[Deal]:
        addr = prop.get("address", {})
        sale = prop.get("saleInformation", {})
        return Deal(
            facility_name=prop.get("buildingName", prop.get("name", "")),
            address=addr.get("streetAddress", ""),
            city=addr.get("city", ""),
            state=addr.get("stateCode", ""),
            zip_code=addr.get("postalCode", ""),
            asking_price=sale.get("askingPrice"),
            noi=sale.get("noi"),
            cap_rate=sale.get("capRate", 0) / 100 if sale.get("capRate") else None,
            unit_count=prop.get("numberOfUnits"),
            year_built=prop.get("yearBuilt"),
            sqft=prop.get("rentableArea"),
            url=f"https://www.costar.com/property/{prop.get('coStarBuildingId', '')}",
            owner_name=prop.get("ownerName", "CoStar Listing"),
            owner_entity=prop.get("ownerCompanyName", ""),
            raw_data=prop,
        )

    def _dry_run_samples(self) -> list[Deal]:
        return [self._tag(Deal(
            facility_name="Metro Storage — Houston TX",
            city="Houston", state="TX",
            asking_price=8_500_000, noi=552_000, cap_rate=0.065,
            unit_count=680, year_built=2006,
            url="https://www.costar.com/property/example",
            owner_name="CoStar Listing",
        ))]
