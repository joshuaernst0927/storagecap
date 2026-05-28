"""Sends a daily HTML summary email of the pipeline run results."""

from __future__ import annotations
import logging
import smtplib
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Config
from models import Deal

log = logging.getLogger(__name__)


def _html_table_rows(deals: list[Deal]) -> str:
    rows = []
    for d in sorted(deals, key=lambda x: -x.motivation_score):
        name = d.facility_name or f"{d.city}, {d.state}"
        signals = []
        if d.tax_delinquency:
            signals.append("Tax Delinq")
        if d.fire_code_violations:
            signals.append("Fire Code")
        if d.lis_pendens:
            signals.append("Lis Pendens")
        if d.ucc_lien:
            signals.append("UCC Lien")
        if d.court_judgment:
            signals.append("Judgment")
        if d.out_of_state_owner:
            signals.append("OOS Owner")
        score_color = "#c0392b" if d.motivation_score >= 75 else "#e67e22" if d.motivation_score >= 50 else "#7f8c8d"
        rows.append(f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">{name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">{d.city}, {d.state}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-transform:capitalize">{d.source_type}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;color:{score_color}">{d.motivation_score}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px">{', '.join(signals) or '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">
            {'<a href="' + d.url + '">View</a>' if d.url else '—'}
          </td>
        </tr>""")
    return "\n".join(rows)


def _build_html(
    all_deals: list[Deal],
    new_deals: list[Deal],
    hot_deals: list[Deal],
    letters_drafted: int,
    pushed: int,
    dry_run: bool,
) -> str:
    by_type: dict[str, int] = {}
    for d in new_deals:
        by_type[d.source_type] = by_type.get(d.source_type, 0) + 1

    breakdown = " · ".join(f"{v} {k}" for k, v in sorted(by_type.items())) or "none"
    run_label = "DRY RUN" if dry_run else "LIVE RUN"

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222">
  <h1 style="font-size:28px;font-weight:normal;border-bottom:2px solid #c9a84c;padding-bottom:12px">
    StorageCap Pipeline — Daily Report <span style="font-size:16px;color:#999">{date.today()} · {run_label}</span>
  </h1>

  <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
    <tr>
      <td style="padding:12px 16px;background:#f9f7f2;border:1px solid #eee">
        <div style="font-size:32px;font-weight:bold;color:#c9a84c">{len(new_deals)}</div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px">New Deals Found</div>
        <div style="font-size:11px;color:#999;margin-top:4px">{breakdown}</div>
      </td>
      <td style="padding:12px 16px;background:#f9f7f2;border:1px solid #eee">
        <div style="font-size:32px;font-weight:bold;color:#c0392b">{len(hot_deals)}</div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Hot Deals (≥65)</div>
      </td>
      <td style="padding:12px 16px;background:#f9f7f2;border:1px solid #eee">
        <div style="font-size:32px;font-weight:bold;color:#2c3e50">{letters_drafted}</div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Letters Drafted</div>
      </td>
      <td style="padding:12px 16px;background:#f9f7f2;border:1px solid #eee">
        <div style="font-size:32px;font-weight:bold;color:#27ae60">{pushed}</div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Pushed to Pipeline</div>
      </td>
    </tr>
  </table>

  {"<p style='color:#e67e22;font-weight:bold'>⚠ DRY RUN — no data was written or pushed.</p>" if dry_run else ""}

  <h2 style="font-size:18px;font-weight:normal;margin-top:32px">New Deals This Run</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#2c3e50;color:white">
        <th style="padding:8px 12px;text-align:left">Property</th>
        <th style="padding:8px 12px;text-align:left">Location</th>
        <th style="padding:8px 12px;text-align:left">Source</th>
        <th style="padding:8px 12px;text-align:left">Score</th>
        <th style="padding:8px 12px;text-align:left">Signals</th>
        <th style="padding:8px 12px;text-align:left">Link</th>
      </tr>
    </thead>
    <tbody>
      {_html_table_rows(new_deals) if new_deals else '<tr><td colspan="6" style="padding:16px;text-align:center;color:#999">No new deals this run.</td></tr>'}
    </tbody>
  </table>

  <p style="font-size:12px;color:#aaa;margin-top:40px;border-top:1px solid #eee;padding-top:16px">
    StorageCap Pipeline · Total tracked: {len(all_deals)} ·
    <a href="http://localhost:3000/pipeline" style="color:#c9a84c">Open Pipeline →</a>
  </p>
</body>
</html>"""


def send_summary(
    all_deals: list[Deal],
    new_deals: list[Deal],
    hot_deals: list[Deal],
    letters_drafted: int,
    pushed: int,
    cfg: Config,
    dry_run: bool = False,
) -> None:
    html = _build_html(all_deals, new_deals, hot_deals, letters_drafted, pushed, dry_run)

    if dry_run:
        log.info("[DRY RUN] Would send email to %s", cfg.email_to)
        return

    if not cfg.email_username or not cfg.email_password:
        log.warning("No email credentials configured — skipping summary email.")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"StorageCap Pipeline — {len(new_deals)} new deals {date.today()}"
    msg["From"] = cfg.email_username
    msg["To"] = cfg.email_to
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(cfg.email_smtp_host, cfg.email_smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(cfg.email_username, cfg.email_password)
            server.sendmail(cfg.email_username, cfg.email_to, msg.as_string())
        log.info("Email summary sent to %s", cfg.email_to)
    except Exception as exc:
        log.error("Email send failed: %s", exc)
