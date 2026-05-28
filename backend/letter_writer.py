"""Drafts personalised outreach letters using Claude."""

from __future__ import annotations
import logging
from typing import Optional

from models import Deal

log = logging.getLogger(__name__)

BUYER_NAME = "Marcus Webb"
BUYER_COMPANY = "YEM Acquisitions"
BUYER_PHONE = "(904) 555-0101"
BUYER_EMAIL = "joshuaernst@gmail.com"


def _build_prompt(deal: Deal) -> str:
    signals = []
    if deal.tax_delinquency:
        signals.append(f"tax delinquency of ${deal.tax_delinquency_amount:,.0f} ({deal.tax_delinquency_years} year(s))")
    if deal.fire_code_violations:
        signals.append(f"{deal.fire_code_count} fire code violation(s)")
    if deal.lis_pendens:
        signals.append(f"lis pendens (${deal.lis_pendens_amount:,.0f})" if deal.lis_pendens_amount else "lis pendens filing")
    if deal.ucc_lien:
        signals.append("UCC lien approaching maturity")
    if deal.court_judgment:
        signals.append(f"court judgment (${deal.court_judgment_amount:,.0f})" if deal.court_judgment_amount else "court judgment")
    if deal.code_violations:
        signals.append(f"{len(deal.code_violations)} open code violation(s)")
    if deal.declining_occupancy:
        signals.append(f"declining occupancy ({deal.occupancy_trend:+.0f}% YoY)" if deal.occupancy_trend else "declining occupancy")
    if deal.deferred_maintenance:
        signals.append("deferred maintenance observed")
    if deal.out_of_state_owner:
        signals.append("out-of-state ownership")
    if (deal.owner_age_estimate or 0) >= 65:
        signals.append(f"owner estimated age {deal.owner_age_estimate}")
    if (deal.years_owned or 0) >= 15:
        signals.append(f"long-term ownership ({deal.years_owned} years)")

    signal_block = "\n".join(f"- {s}" for s in signals) if signals else "- No major distress signals; owner profile suggests retirement motivation"

    financials = []
    if deal.asking_price:
        financials.append(f"Asking price: ${deal.asking_price:,.0f}")
    if deal.noi:
        financials.append(f"NOI: ${deal.noi:,.0f}")
    if deal.occupancy:
        financials.append(f"Occupancy: {deal.occupancy:.0f}%")
    if deal.unit_count:
        financials.append(f"Units: {deal.unit_count}")

    fin_block = "\n".join(financials) if financials else "Financial details not yet confirmed"

    return f"""You are drafting a cold outreach letter on behalf of a private self-storage buyer.

BUYER:
Name: {BUYER_NAME}
Company: {BUYER_COMPANY}
Phone: {BUYER_PHONE}
Email: {BUYER_EMAIL}

TARGET PROPERTY:
Name: {deal.facility_name or 'Self-storage facility'}
Address: {deal.address}, {deal.city}, {deal.state} {deal.zip_code}
Owner: {deal.owner_name}
Source: {deal.channel}

DISTRESS / MOTIVATION SIGNALS IDENTIFIED:
{signal_block}

KNOWN FINANCIALS:
{fin_block}

LETTER REQUIREMENTS:
- 3-4 paragraphs, professional but warm
- Open by introducing {BUYER_NAME} and {BUYER_COMPANY}
- Reference specific signals without being harsh or accusatory — frame as awareness, not judgment
- Explain the value proposition: direct buyer, no broker, 30-45 day close, confidential, fair price
- Close with a clear, low-pressure call to action (phone or reply)
- Sign off from {BUYER_NAME}, {BUYER_COMPANY} | {BUYER_PHONE} | {BUYER_EMAIL}
- Do NOT use any placeholder text like [brackets]
- Keep it under 300 words
- Tone: confident, respectful, direct — not salesy"""


def draft_letter(deal: Deal, api_key: str, dry_run: bool = False) -> str:
    if dry_run:
        return (
            f"[DRY RUN LETTER]\n\n"
            f"Dear {deal.owner_name},\n\n"
            f"This is a placeholder letter for {deal.facility_name or deal.city + ', ' + deal.state}. "
            f"Motivation score: {deal.motivation_score}.\n\n"
            f"Respectfully,\n{BUYER_NAME}\n{BUYER_COMPANY}"
        )

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": _build_prompt(deal)}],
        )
        return msg.content[0].text.strip()
    except Exception as exc:
        log.error("Letter generation failed for %s: %s", deal.facility_name, exc)
        return ""


def draft_letters_for_batch(
    deals: list[Deal],
    api_key: Optional[str],
    dry_run: bool = False,
) -> None:
    """Mutates each qualifying deal in-place, adding letter_draft."""
    if not api_key and not dry_run:
        log.warning("No ANTHROPIC_API_KEY — skipping letter generation.")
        return

    eligible = [d for d in deals if d.needs_outreach_letter]
    log.info("Drafting letters for %d deals...", len(eligible))

    for deal in eligible:
        text = draft_letter(deal, api_key or "", dry_run=dry_run)
        if text:
            deal.letter_draft = text
            log.debug("Letter drafted for %s", deal.facility_name or deal.city)
