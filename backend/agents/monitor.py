"""
CourtListener bankruptcy monitor agent.

Scans PACER/CourtListener for Chapter 7 and Chapter 11 bankruptcy filings
involving self-storage operators in target markets (FL, TX, NC, GA, TN, OH, SC).

Uses the CourtListener REST API v3:
  https://www.courtlistener.com/api/rest/v3/dockets/
  Auth: Authorization: Token <COURTLISTENER_TOKEN>

Run directly:
  python -m backend.agents.monitor
  python -m backend.agents.monitor --states FL TX --days 30 --output leads.json

Environment:
  COURTLISTENER_TOKEN  required
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from typing import Optional
from urllib.parse import urlencode

import requests

log = logging.getLogger(__name__)

# ─── Target courts ─────────────────────────────────────────────────────────────
# CourtListener court IDs for bankruptcy courts in target states.
# Full list: https://www.courtlistener.com/api/rest/v3/courts/?jurisdiction=FB
TARGET_COURTS: dict[str, list[str]] = {
    "FL": ["flsb", "flmb", "flnb"],
    "TX": ["txsb", "txeb", "txnb", "txwb"],
    "NC": ["nceb", "ncmb", "ncwb"],
    "GA": ["ganb", "gamb", "gasb"],
    "TN": ["tneb", "tnmb", "tnwb"],
    "OH": ["ohnb", "ohsb"],
    "SC": ["scb"],
}

COURT_CITY_LABELS: dict[str, str] = {
    "flsb": "Miami",       "flmb": "Orlando",      "flnb": "Tallahassee",
    "txsb": "Houston",     "txeb": "Tyler",         "txnb": "Dallas",        "txwb": "San Antonio",
    "nceb": "Raleigh",     "ncmb": "Greensboro",   "ncwb": "Charlotte",
    "ganb": "Atlanta",     "gamb": "Macon",         "gasb": "Savannah",
    "tneb": "Knoxville",   "tnmb": "Nashville",    "tnwb": "Memphis",
    "ohnb": "Cleveland",   "ohsb": "Columbus",
    "scb":  "Columbia",
}

COURT_STATE: dict[str, str] = {
    court_id: state
    for state, courts in TARGET_COURTS.items()
    for court_id in courts
}

ALL_TARGET_COURT_IDS: set[str] = {c for courts in TARGET_COURTS.values() for c in courts}

BASE_URL = "https://www.courtlistener.com/api/rest/v3/dockets/"
SEARCH_QUERIES = [
    '"self storage"',
    '"self storage" "chapter 11"',
    '"self storage" "chapter 7"',
    '"self-storage"',
    '"storage facility" bankruptcy',
]


# ─── Lead model ────────────────────────────────────────────────────────────────

@dataclass
class BankruptcyLead:
    id: str = field(default_factory=lambda: f"cl_{uuid.uuid4().hex[:10]}")
    case_name: str = ""
    docket_number: str = ""
    court_id: str = ""
    state: str = ""
    city: str = ""
    chapter: str = ""
    date_filed: str = ""
    cause: str = ""
    nature_of_suit: str = ""
    debtor_name: str = ""
    source_url: str = ""
    score: int = 18   # base bankruptcy score boost
    raw: dict = field(default_factory=dict)

    def to_lead_json(self) -> dict:
        """Convert to the Lead shape used by the Next.js /leads page."""
        return {
            "id": self.id,
            "facilityName": self.case_name[:80],
            "address": f"Case No. {self.docket_number}" if self.docket_number else "See court record",
            "city": self.city,
            "state": self.state,
            "ownerName": self.debtor_name or "Unknown",
            "source": "courtlistener",
            "sourceUrl": self.source_url,
            "distressSignals": {
                "bankruptcy": True,
                "bankruptcyChapter": self.chapter,
                "bankruptcyDate": self.date_filed,
                "bankruptcyDocket": self.docket_number,
            },
            "score": self.score,
            "status": "new",
            "foundAt": date.today().isoformat(),
            "lastUpdated": date.today().isoformat(),
            "notes": " · ".join(filter(None, [
                f"{self.chapter} filing",
                f"Filed: {self.date_filed}" if self.date_filed else "",
                f"Cause: {self.cause}" if self.cause else "",
                f"Court: {self.court_id.upper()}",
            ])),
        }


# ─── CourtListener client ──────────────────────────────────────────────────────

class CourtListenerMonitor:
    def __init__(self, token: str, delay: float = 1.0):
        self.token = token
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Token {token}",
            "User-Agent": "YEMAcquisitions/1.0 (joshuaernst@gmail.com)",
            "Accept": "application/json",
        })

    def _get(self, url: str, params: dict) -> dict:
        time.sleep(self.delay)
        resp = self.session.get(url, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json()

    def _extract_court_id(self, docket: dict) -> str:
        """Court may be a URL like '.../courts/flsb/' or a plain slug."""
        court_id = docket.get("court_id", "")
        if court_id:
            return court_id.lower()
        court = docket.get("court", "")
        if isinstance(court, str) and "/courts/" in court:
            return court.rstrip("/").split("/")[-1].lower()
        return ""

    def _chapter_from_cause(self, cause: str) -> str:
        import re
        m = re.search(r"chapter\s+(\d+)", cause or "", re.IGNORECASE)
        return f"Chapter {m.group(1)}" if m else "Bankruptcy"

    def _debtor_from_case_name(self, case_name: str) -> str:
        import re
        # "In re: ABC Storage LLC" → "ABC Storage LLC"
        m = re.match(r"in\s+re:?\s+(.+)", case_name or "", re.IGNORECASE)
        if m:
            return m.group(1).strip()
        # "Plaintiff v. ABC Storage" → "Plaintiff"
        parts = re.split(r"\s+v\.?\s+", case_name or "", flags=re.IGNORECASE)
        return parts[0].strip()

    def fetch_query(self, query: str, filed_after: str, page_size: int = 50) -> list[dict]:
        params = {
            "q": query,
            "order_by": "date_filed",
            "date_filed__gte": filed_after,
            "page_size": page_size,
            "format": "json",
        }
        log.debug("CourtListener query: %s", query)
        try:
            data = self._get(BASE_URL, params)
            results = data.get("results", [])
            log.info("Query '%s' → %d results", query, len(results))
            return results
        except Exception as exc:
            log.warning("CourtListener query '%s' failed: %s", query, exc)
            return []

    def scan(
        self,
        states: Optional[list[str]] = None,
        days: int = 180,
    ) -> list[BankruptcyLead]:
        target_states = set(states or list(TARGET_COURTS.keys()))
        filed_after = (date.today() - timedelta(days=days)).isoformat()

        raw: list[dict] = []
        seen_ids: set[int] = set()

        for query in SEARCH_QUERIES:
            results = self.fetch_query(query, filed_after)
            for r in results:
                if r["id"] not in seen_ids:
                    seen_ids.add(r["id"])
                    raw.append(r)

        log.info("Total unique dockets fetched: %d", len(raw))

        leads: list[BankruptcyLead] = []
        for docket in raw:
            court_id = self._extract_court_id(docket)
            if court_id not in ALL_TARGET_COURT_IDS:
                continue
            state = COURT_STATE.get(court_id, "")
            if state not in target_states:
                continue

            case_name = docket.get("case_name") or docket.get("case_name_short") or ""
            chapter = self._chapter_from_cause(docket.get("cause", ""))
            debtor = self._debtor_from_case_name(case_name)
            city = COURT_CITY_LABELS.get(court_id, court_id.upper())
            docket_id = docket.get("id", "")
            abs_url = docket.get("absolute_url", f"/docket/{docket_id}/")

            lead = BankruptcyLead(
                case_name=case_name[:80],
                docket_number=docket.get("docket_number", ""),
                court_id=court_id,
                state=state,
                city=city,
                chapter=chapter,
                date_filed=docket.get("date_filed", ""),
                cause=docket.get("cause", ""),
                nature_of_suit=docket.get("nature_of_suit", ""),
                debtor_name=debtor[:80],
                source_url=f"https://www.courtlistener.com{abs_url}",
                score=18,
                raw=docket,
            )
            leads.append(lead)

        log.info("Leads matching target states: %d", len(leads))
        return leads


# ─── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="CourtListener bankruptcy monitor")
    parser.add_argument("--states", nargs="+", default=list(TARGET_COURTS.keys()),
                        help="State abbreviations to scan (default: all target states)")
    parser.add_argument("--days", type=int, default=180,
                        help="How far back to look (default: 180 days)")
    parser.add_argument("--output", default=None,
                        help="Write leads JSON to this file path")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )

    token = os.environ.get("COURTLISTENER_TOKEN")
    if not token:
        print("ERROR: COURTLISTENER_TOKEN environment variable not set.", file=sys.stderr)
        sys.exit(1)

    monitor = CourtListenerMonitor(token=token)
    leads = monitor.scan(states=args.states, days=args.days)

    output = [l.to_lead_json() for l in leads]

    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"Wrote {len(output)} leads to {args.output}")
    else:
        print(json.dumps(output, indent=2))

    print(f"\n{len(leads)} bankruptcy leads found across {args.states}", file=sys.stderr)


if __name__ == "__main__":
    main()
