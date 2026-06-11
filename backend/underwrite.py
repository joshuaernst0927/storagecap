#!/usr/bin/env python3
"""
YEM Acquisitions — Excel-backed underwrite engine.
Populates acquisition_model.xlsx, recalculates via LibreOffice,
reads back all output cells. Also provides legacy compatibility
functions (run_model, find_max_offer, find_max_offer_by_type)
that loi_api.py depends on.
"""
from __future__ import annotations
import argparse
import json
import math
import shutil
import subprocess
import tempfile
import os
from pathlib import Path
import openpyxl

TEMPLATE = Path("/root/acquisition_model.xlsx")

# ── Inputs sheet: JSON field → cell ──────────────────────────────────────────
INPUTS_MAP: dict[str, str] = {
    "purchasePrice":         "B4",
    "closingCostsPct":       "B5",
    "initialRepairs":        "B6",
    "acquisitionFeePct":     "B7",
    "assetMgmtFeePct":       "B8",
    "dispositionFeePct":     "B9",
    "sponsorCoInvestPct":    "B10",
    "startOccupancy":        "B13",
    "stabilizedOccupancy":   "B14",
    "monthsToStabilization": "B15",
    "annualRentGrowth":      "B18",
    "opexGrowth":            "B22",
    "initialLTV":            "B26",
    "initialRate":           "B27",
    "initialAmortYears":     "B28",
    "ioPeriodMonths":        "B29",
    "minDSCR":               "B30",
    "refiMonth":             "B31",
    "refiLTV":               "B32",
    "refiRate":              "B33",
    "refiAmortYears":        "B34",
    "exitCapRate":           "B35",
    "exitMonth":             "B36",
    "sellingCostsPct":       "B37",
    "lpReturnOfCapital":     "B41",
    "lpCatchUp":             "B42",
    "gpCatchUp":             "B43",
    "preferredReturn":       "B44",
    "lpResidual":            "B45",
    "gpResidual":            "B46",
    "unlevered":             "B49",
}

# Operating Expenses direct field mappings
OPEX_DIRECT: dict[str, str] = {
    "t12Tax":                "B5",
    "t12Insurance":          "B6",
    "t12Utilities":          "B7",
    "t12RepairsMaintenance": "B8",
    "t12Payroll":            "B9",
    "t12OfficeEmployee":     "B9",
    "t12Marketing":          "B11",
    "t12Administrative":     "B11",
}

SKIP_CELLS = {"B10", "B13"}

OPEX_KEYWORD_MAP: list[tuple[list[str], str]] = [
    (["tax", "prop tax", "property tax", "real estate tax", "re tax", "assessment"], "B5"),
    (["insurance", "insur", "liability", "casualty"], "B6"),
    (["utilit", "electric", "gas", "water", "sewer", "trash", "waste", "alarm", "security system"], "B7"),
    (["repair", "maintenance", "maint", "contract service", "janitorial", "landscap",
      "groundskeep", "pest", "exterminator", "snow", "cleaning", "security patrol"], "B8"),
    (["payroll", "personnel", "staff", "labor", "wage", "salary", "employee",
      "on-site", "manager", "resident", "hr", "benefit", "compensation"], "B9"),
    (["software", "technology", "tech", "call center", "sitelink", "stortrack",
      "storedge", "yardi", "cloud", "subscription"], "B12"),
    (["reserve", "replacement reserve", "capital reserve", "capex reserve"], "B14"),
    (["market", "advertis", "admin", "administrative", "office", "telephone",
      "phone", "postage", "printing", "bank fee", "professional fee", "legal",
      "accounting", "audit", "regulatory", "compliance", "license", "permit",
      "miscellaneous", "other", "general"], "B11"),
]

UNIT_ROWS: dict[str, int] = {"5x5": 5, "5x10": 6, "10x10": 7, "10x15": 8, "10x20": 9}


def _map_expense_keyword(label: str) -> str:
    normalized = label.lower().strip()
    for keywords, cell in OPEX_KEYWORD_MAP:
        for kw in keywords:
            if kw in normalized:
                return cell
    return "B11"


def _match_unit_row(type_str: str) -> int:
    t = type_str.lower().replace(" ", "")
    for key, row in UNIT_ROWS.items():
        if t == key or key in t or t in key:
            return row
    return 10


def populate(inputs: dict, output_path: Path) -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE}")
    shutil.copy2(TEMPLATE, output_path)
    wb = openpyxl.load_workbook(str(output_path))

    ws_in = wb["Inputs"]
    for field, cell in INPUTS_MAP.items():
        v = inputs.get(field)
        if v is not None:
            ws_in[cell] = v

    ws_opex = wb["Operating Expenses"]
    opex_totals: dict[str, float] = {}
    for field, cell in OPEX_DIRECT.items():
        v = inputs.get(field)
        if v is not None:
            try:
                opex_totals[cell] = opex_totals.get(cell, 0) + float(v)
            except (TypeError, ValueError):
                pass
    for item in inputs.get("expenseLineItems", []):
        label = str(item.get("label", ""))
        amount = item.get("amount")
        if label and amount is not None:
            try:
                cell = _map_expense_keyword(label)
                opex_totals[cell] = opex_totals.get(cell, 0) + float(amount)
            except (TypeError, ValueError):
                pass
    for cell, total in opex_totals.items():
        if cell not in SKIP_CELLS and total > 0:
            ws_opex[cell] = round(total)

    ws_um = wb["Unit Mix & Market Comps"]
    for item in inputs.get("unitMix", []):
        row = _match_unit_row(str(item.get("type", "")))
        for col, field in [("B", "units"), ("C", "sqft"), ("D", "currentRent"), ("E", "marketRent")]:
            v = item.get(field)
            if v is not None:
                try:
                    ws_um[f"{col}{row}"] = float(v)
                except (TypeError, ValueError):
                    pass

    wb.save(str(output_path))


def recalculate(xlsx_path: Path) -> Path:
    try:
        subprocess.run([
            "libreoffice", "--headless",
            "--convert-to", "xlsx",
            "--outdir", str(xlsx_path.parent),
            str(xlsx_path),
        ], timeout=60, capture_output=True, check=True)
    except Exception:
        pass
    return xlsx_path


def read_outputs(xlsx_path: Path) -> dict:
    wb = openpyxl.load_workbook(str(xlsx_path), data_only=True)

    def safe(sheet: str, cell: str):
        try:
            v = wb[sheet][cell].value
            if v is None or v == "N/A":
                return None
            return float(v)
        except Exception:
            return None

    noi_years = [safe("Operating Expenses", f"{col}17") or 0 for col in ["B", "C", "D", "E", "F"]]
    cash_flows = [safe("Returns Summary", f"I{row}") or 0 for row in range(6, 11)]

    return {
        "totalEquity":          safe("Returns Summary", "B14"),
        "exitValue":            safe("Returns Summary", "B15"),
        "leveredIRR":           safe("Returns Summary", "B16"),
        "equityMultiple":       safe("Returns Summary", "B17"),
        "avgCashOnCash":        safe("Returns Summary", "B18"),
        "dscrY1":               safe("Returns Summary", "B19"),
        "debtYieldY1":          safe("Returns Summary", "B20"),
        "unleveredIRR":         safe("Returns Summary", "B23"),
        "unleveredMultiple":    safe("Returns Summary", "B24"),
        "lpTotalDistributions": safe("GP-LP Waterfall", "B18"),
        "gpTotalDistributions": safe("GP-LP Waterfall", "B19"),
        "lpMOIC":               safe("GP-LP Waterfall", "B20"),
        "gpMOIC":               safe("GP-LP Waterfall", "B21"),
        "lpIRR":                safe("GP-LP Waterfall", "B22"),
        "gpIRR":                safe("GP-LP Waterfall", "B23"),
        "totalMOIC":            safe("GP-LP Waterfall", "B24"),
        "noiYears":             noi_years,
        "cashFlows":            cash_flows,
    }


def run_model(inputs: dict) -> dict:
    """Legacy function — populates Excel and reads back outputs."""
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
        out = Path(f.name)
    try:
        populate(inputs, out)
        calc = recalculate(out)
        result = read_outputs(calc)
        # Map to legacy keys expected by loi_api.py
        return {
            "purchase_price":     inputs.get("purchasePrice", 0),
            "levered_irr":        result.get("leveredIRR") or 0,
            "unlevered_irr":      result.get("unleveredIRR") or 0,
            "equity_multiple":    result.get("equityMultiple") or 0,
            "going_in_cap":       result.get("dscrY1") or 0,
            "stabilized_cap":     0,
            "year1_noi":          result.get("noiYears", [0])[0],
            "year5_noi":          result.get("noiYears", [0, 0, 0, 0, 0])[4] if len(result.get("noiYears", [])) > 4 else 0,
            **result,
        }
    finally:
        try:
            os.unlink(out)
        except Exception:
            pass


def find_max_offer(inputs: dict, target_irr: float) -> float:
    """Legacy binary search for max offer price at target IRR."""
    lo, hi = 100000, 50000000
    mid = lo
    for _ in range(50):
        mid = (lo + hi) / 2
        test_inputs = {**inputs, "purchasePrice": mid}
        try:
            result = run_model(test_inputs)
            irr = result.get("levered_irr") or result.get("leveredIRR") or 0
            if irr >= target_irr:
                lo = mid
            else:
                hi = mid
        except Exception:
            hi = mid
    return round(mid)


def find_max_offer_by_type(inputs: dict, target_irr: float, deal_type: str) -> dict:
    """Deal-type-aware max offer calculation."""
    deal_type = (deal_type or "value-add").lower().strip()

    def g(k, d):
        return inputs[k] if inputs.get(k) is not None else d

    in_place_noi = g("in_place_noi", g("year1_noi", 200000))
    stabilized_noi = g("stabilized_noi", in_place_noi * 1.3)
    exit_cap = g("exit_cap_rate", 0.0725)
    hold_years = int(g("exit_month", 60)) // 12
    selling_costs = g("selling_costs_pct", 0.02)
    closing_costs = g("closing_costs_pct", 0.03)
    acq_fee = g("acquisition_fee_pct", 0.02)
    initial_repairs = g("initial_repairs", 0)
    rent_growth = g("rent_growth", 0.05)
    opex_growth = g("opex_growth", 0.025)

    noi_growth = rent_growth - opex_growth
    if deal_type == "stabilized":
        noi_years = [in_place_noi * (1 + noi_growth) ** yr for yr in range(hold_years)]
        method = "Stabilized: T12 NOI grown at net rent growth rate"
    elif deal_type == "distressed":
        noi_years = []
        for yr in range(1, hold_years + 1):
            if yr <= 2:
                noi = in_place_noi * (1 + rent_growth) ** (yr - 1)
            else:
                ramp = min((yr - 2) / 3, 1.0)
                noi = (in_place_noi + ramp * (stabilized_noi - in_place_noi)) * (1 + rent_growth) ** (yr - 1)
            noi_years.append(noi)
        method = "Distressed: depressed NOI Y1-Y2, ramp to stabilized Y3-Y5"
    else:
        months_to_stab = int(g("months_to_stabilization", 18))
        stab_year = max(1, math.ceil(months_to_stab / 12))
        noi_years = []
        for yr in range(1, hold_years + 1):
            if yr <= stab_year:
                ramp = yr / stab_year
                noi = in_place_noi + ramp * (stabilized_noi - in_place_noi)
            else:
                noi = stabilized_noi * (1 + noi_growth) ** (yr - stab_year)
            noi_years.append(noi)
        method = f"Value-Add: ramp from in-place to stabilized over {stab_year} year(s)"

    def calc_irr_at_price(price):
        total_cost = price * (1 + closing_costs + acq_fee) + initial_repairs
        exit_value = noi_years[-1] / exit_cap
        net_sale = exit_value * (1 - selling_costs)
        cash_flows = [-total_cost] + noi_years[:-1] + [noi_years[-1] + net_sale]

        def npv(r, cfs):
            return sum(cf / (1 + r) ** i for i, cf in enumerate(cfs))

        lo, hi = -0.5, 10.0
        for _ in range(200):
            mid = (lo + hi) / 2
            if npv(mid, cash_flows) > 0:
                lo = mid
            else:
                hi = mid
        return mid

    lo, hi = 100000, 50000000
    for _ in range(60):
        mid = (lo + hi) / 2
        try:
            irr = calc_irr_at_price(mid)
            if irr >= target_irr:
                lo = mid
            else:
                hi = mid
        except Exception:
            hi = mid

    max_offer = round(mid / 1000) * 1000
    irr_at_max = round(calc_irr_at_price(max_offer), 4)

    return {
        "max_offer":       max_offer,
        "deal_type":       deal_type,
        "method":          method,
        "in_place_noi":    round(in_place_noi),
        "stabilized_noi":  round(stabilized_noi),
        "going_in_cap":    round(in_place_noi / max_offer, 4) if max_offer > 0 else 0,
        "stabilized_cap":  round(stabilized_noi / max_offer, 4) if max_offer > 0 else 0,
        "irr_at_max":      irr_at_max,
        "target_irr":      target_irr,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs-file", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--read-outputs", action="store_true")
    args = parser.parse_args()

    with open(args.inputs_file, encoding="utf-8") as f:
        inputs = json.load(f)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    populate(inputs, out)

    if args.read_outputs:
        calc = recalculate(out)
        outputs = read_outputs(calc)
        print(json.dumps(outputs))
    else:
        print(str(out))


if __name__ == "__main__":
    main()
