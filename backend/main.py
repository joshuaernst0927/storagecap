#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StorageCap Pipeline — finds self-storage facilities for sale across all channels.

Usage:
  python main.py                        # Full live run
  python main.py --dry-run              # Safe test run (no writes, no API calls)
  python main.py --sources distressed fsbo   # Run only specific source types
  python main.py --states FL TX         # Target specific states
  python main.py --dry-run --sources bizbuysell craigslist

Source type flags:
  distressed  — tax delinquency, fire violations, UCC liens, lis pendens, judgments
  off_market  — owner signals (long tenure, OOS, age 65+)
  fsbo        — Craigslist, Facebook, LoopNet FSBO, Crexi FSBO, BizBuySell
  marketed    — LoopNet, Crexi, CoStar, Marcus & Millichap, CBRE

Individual scraper flags (use instead of source type):
  tax_delinquency | fire_violations | ucc_liens | lis_pendens | court_judgments
  owner_signals
  craigslist | facebook | loopnet_fsbo | crexi_fsbo | bizbuysell
  loopnet | crexi | costar | marcus_millichap | cbre
"""

from __future__ import annotations
import argparse
import io
import logging
import sys
from datetime import date
from typing import Optional

# Force UTF-8 output on Windows so Unicode log characters don't crash
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from config import Config
from models import Deal
from scorer import score as compute_score, needs_letter
from output import load_existing, save_deals, deduplicate, push_to_pipeline
from letter_writer import draft_letters_for_batch
from emailer import send_summary

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("pipeline")

ALL_SOURCE_TYPES = ["distressed", "off_market", "fsbo", "marketed"]

SOURCE_TYPE_MAP = {
    "distressed": ["tax_delinquency", "fire_violations", "ucc_liens", "lis_pendens", "court_judgments"],
    "off_market": ["owner_signals"],
    "fsbo": ["craigslist", "facebook", "loopnet_fsbo", "crexi_fsbo", "bizbuysell"],
    "marketed": ["loopnet", "crexi", "costar", "marcus_millichap", "cbre"],
}


def build_scrapers(cfg: Config, sources: list[str], dry_run: bool) -> list:
    """Instantiate requested scrapers."""
    from scrapers.distressed.tax_delinquency import TaxDelinquencyScraper
    from scrapers.distressed.fire_violations import FireViolationsScraper
    from scrapers.distressed.ucc_liens import UCCLienScraper
    from scrapers.distressed.lis_pendens import LisPendensScraper
    from scrapers.distressed.court_judgments import CourtJudgmentScraper
    from scrapers.off_market.owner_signals import OwnerSignalScraper
    from scrapers.fsbo.craigslist import CraigslistScraper
    from scrapers.fsbo.facebook import FacebookMarketplaceScraper
    from scrapers.fsbo.loopnet_fsbo import LoopNetFSBOScraper
    from scrapers.fsbo.crexi_fsbo import CrexiFSBOScraper
    from scrapers.fsbo.bizbuysell import BizBuySellScraper
    from scrapers.marketed.loopnet import LoopNetScraper
    from scrapers.marketed.crexi import CrexiScraper
    from scrapers.marketed.costar import CoStarScraper
    from scrapers.marketed.marcus_millichap import MarcusMillichapScraper
    from scrapers.marketed.cbre import CBREScraper

    kwargs = dict(dry_run=dry_run, delay=cfg.request_delay)

    registry = {
        "tax_delinquency": lambda: TaxDelinquencyScraper(attom_api_key=cfg.attom_api_key, **kwargs),
        "fire_violations": lambda: FireViolationsScraper(**kwargs),
        "ucc_liens": lambda: UCCLienScraper(**kwargs),
        "lis_pendens": lambda: LisPendensScraper(attom_api_key=cfg.attom_api_key, **kwargs),
        "court_judgments": lambda: CourtJudgmentScraper(attom_api_key=cfg.attom_api_key, **kwargs),
        "owner_signals": lambda: OwnerSignalScraper(attom_api_key=cfg.attom_api_key, **kwargs),
        "craigslist": lambda: CraigslistScraper(**kwargs),
        "facebook": lambda: FacebookMarketplaceScraper(**kwargs),
        "loopnet_fsbo": lambda: LoopNetFSBOScraper(use_playwright=cfg.use_playwright, **kwargs),
        "crexi_fsbo": lambda: CrexiFSBOScraper(
            crexi_api_key=cfg.crexi_api_key, use_playwright=cfg.use_playwright, **kwargs
        ),
        "bizbuysell": lambda: BizBuySellScraper(**kwargs),
        "loopnet": lambda: LoopNetScraper(
            costar_api_key=cfg.costar_api_key, costar_secret=cfg.costar_api_secret,
            use_playwright=cfg.use_playwright, **kwargs
        ),
        "crexi": lambda: CrexiScraper(
            crexi_api_key=cfg.crexi_api_key, use_playwright=cfg.use_playwright, **kwargs
        ),
        "costar": lambda: CoStarScraper(
            api_key=cfg.costar_api_key, api_secret=cfg.costar_api_secret, **kwargs
        ),
        "marcus_millichap": lambda: MarcusMillichapScraper(use_playwright=cfg.use_playwright, **kwargs),
        "cbre": lambda: CBREScraper(use_playwright=cfg.use_playwright, **kwargs),
    }

    # Expand source-type aliases
    expanded: list[str] = []
    for s in sources:
        if s in SOURCE_TYPE_MAP:
            expanded.extend(SOURCE_TYPE_MAP[s])
        else:
            expanded.append(s)

    scrapers = []
    for name in expanded:
        if name in registry:
            scrapers.append(registry[name]())
        else:
            log.warning("Unknown scraper: %s", name)

    return scrapers


def run(
    cfg: Config,
    sources: list[str],
    states: Optional[list[str]],
    dry_run: bool,
    no_email: bool = False,
    no_push: bool = False,
) -> None:
    target_states = states or cfg.target_states
    log.info("=" * 60)
    log.info("StorageCap Pipeline — %s", date.today())
    log.info("Sources: %s", ", ".join(sources))
    log.info("States:  %s", ", ".join(target_states))
    log.info("Mode:    %s", "DRY RUN" if dry_run else "LIVE")
    log.info("=" * 60)

    # ── Load existing deals for dedup ────────────────────────────────────────
    existing = load_existing(cfg.deals_json_path)
    log.info("Loaded %d existing deals from %s", len(existing), cfg.deals_json_path)

    # ── Run scrapers ──────────────────────────────────────────────────────────
    scrapers = build_scrapers(cfg, sources, dry_run)
    all_raw: list[Deal] = []
    for scraper in scrapers:
        log.info("Running: %s", scraper.name)
        try:
            found = scraper.scrape(states=target_states)
            log.info("  -> %d deals", len(found))
            all_raw.extend(found)
        except Exception as exc:
            log.error("Scraper %s crashed: %s", scraper.name, exc)

    log.info("Total raw: %d deals", len(all_raw))

    # ── Score ─────────────────────────────────────────────────────────────────
    for deal in all_raw:
        deal.motivation_score = compute_score(deal)
        deal.needs_outreach_letter = needs_letter(deal)

    # ── Deduplicate ───────────────────────────────────────────────────────────
    new_deals = deduplicate(all_raw, existing)

    # ── Letter drafting ───────────────────────────────────────────────────────
    draft_letters_for_batch(new_deals, cfg.anthropic_api_key, dry_run=dry_run)
    letters_drafted = sum(1 for d in new_deals if d.letter_draft)

    # ── Save to deals.json ────────────────────────────────────────────────────
    all_deals = list(existing.values()) + [d.to_dict() for d in new_deals]
    save_deals(new_deals, cfg.deals_json_path, dry_run=dry_run)

    # ── Push hot deals to Next.js pipeline ───────────────────────────────────
    hot_deals = [d for d in new_deals if d.motivation_score >= cfg.hot_deal_threshold]
    pushed = 0
    if not no_push:
        pushed = push_to_pipeline(new_deals, cfg, dry_run=dry_run)

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info("=" * 60)
    log.info("SUMMARY")
    log.info("  New deals found:    %d", len(new_deals))
    log.info("  Hot (>=%d score):   %d", cfg.hot_deal_threshold, len(hot_deals))
    log.info("  Letters drafted:    %d", letters_drafted)
    log.info("  Pushed to pipeline: %d", pushed)

    breakdown: dict[str, int] = {}
    for d in new_deals:
        breakdown[d.source_type] = breakdown.get(d.source_type, 0) + 1
    for stype, count in sorted(breakdown.items()):
        log.info("  %-16s %d", stype + ":", count)
    log.info("=" * 60)

    # ── Daily email ───────────────────────────────────────────────────────────
    if not no_email:
        # Build a mock list from dicts for existing deals count
        all_deal_objs = new_deals  # new only for email table; totals use len
        send_summary(
            all_deals=[],  # just pass empty for total count ref
            new_deals=new_deals,
            hot_deals=hot_deals,
            letters_drafted=letters_drafted,
            pushed=pushed,
            cfg=cfg,
            dry_run=dry_run,
        )


def main() -> None:
    all_scrapers = []
    for names in SOURCE_TYPE_MAP.values():
        all_scrapers.extend(names)

    parser = argparse.ArgumentParser(
        description="StorageCap self-storage acquisition pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Run without making writes, API calls, or sending email",
    )
    parser.add_argument(
        "--sources", nargs="+",
        default=ALL_SOURCE_TYPES,
        choices=ALL_SOURCE_TYPES + all_scrapers,
        metavar="SOURCE",
        help="Source types or individual scrapers to run (default: all)",
    )
    parser.add_argument(
        "--states", nargs="+",
        help="Target states, e.g. --states FL TX (default: FL TX NC GA TN)",
    )
    parser.add_argument(
        "--no-email", action="store_true",
        help="Skip daily email summary",
    )
    parser.add_argument(
        "--no-push", action="store_true",
        help="Skip pushing deals to Next.js pipeline",
    )
    parser.add_argument(
        "--threshold", type=int, default=None,
        help="Override hot deal score threshold (default from .env or 65)",
    )

    args = parser.parse_args()
    cfg = Config.from_env()
    if args.threshold is not None:
        cfg.hot_deal_threshold = args.threshold

    run(
        cfg=cfg,
        sources=args.sources,
        states=args.states,
        dry_run=args.dry_run,
        no_email=args.no_email,
        no_push=args.no_push,
    )


if __name__ == "__main__":
    main()
