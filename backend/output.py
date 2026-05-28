"""Persists deals to deals.json and pushes hot deals to the Next.js pipeline API."""

from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Optional

import requests

from config import Config
from models import Deal

log = logging.getLogger(__name__)


# ── deals.json ────────────────────────────────────────────────────────────────

def load_existing(path: str) -> dict[str, dict]:
    """Returns existing deals keyed by dedup_key."""
    p = Path(path)
    if not p.exists():
        return {}
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return {d.get("dedup_key", d["id"]): d for d in raw if isinstance(d, dict)}
    except Exception as exc:
        log.warning("Could not load %s: %s", path, exc)
        return {}


def save_deals(deals: list[Deal], path: str, dry_run: bool = False) -> None:
    records = [d.to_dict() | {"dedup_key": d.dedup_key} for d in deals]
    if dry_run:
        log.info("[DRY RUN] Would write %d deals to %s", len(records), path)
        return
    Path(path).write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")
    log.info("Saved %d deals → %s", len(records), path)


def deduplicate(new: list[Deal], existing: dict[str, dict]) -> list[Deal]:
    """Return only deals whose dedup_key is not already in existing."""
    fresh = []
    for d in new:
        if d.dedup_key not in existing:
            fresh.append(d)
        else:
            log.debug("Dedup skip: %s", d.dedup_key)
    log.info("%d new / %d duplicate deals", len(fresh), len(new) - len(fresh))
    return fresh


# ── Next.js pipeline push ─────────────────────────────────────────────────────

def push_to_pipeline(
    deals: list[Deal],
    cfg: Config,
    dry_run: bool = False,
    threshold: Optional[int] = None,
) -> int:
    """POST hot deals to /api/pipeline-ingest.  Returns count pushed."""
    cutoff = threshold if threshold is not None else cfg.hot_deal_threshold
    hot = [d for d in deals if d.motivation_score >= cutoff]
    if not hot:
        log.info("No deals above threshold %d to push.", cutoff)
        return 0

    url = f"{cfg.nextjs_base_url.rstrip('/')}/api/pipeline-ingest"
    headers = {"Content-Type": "application/json"}
    if cfg.nextjs_api_secret:
        headers["x-api-secret"] = cfg.nextjs_api_secret

    payload = [d.to_pipeline_property() for d in hot]

    if dry_run:
        log.info("[DRY RUN] Would push %d deals to %s", len(payload), url)
        for p in payload[:3]:
            log.info("  → %s (%s) score=%d", p["facilityName"], p["city"], p["motivationScore"])
        return len(payload)

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        log.info("Pushed %d hot deals to pipeline (%s)", len(payload), resp.status_code)
        return len(payload)
    except requests.RequestException as exc:
        log.error("Pipeline push failed: %s", exc)
        return 0
