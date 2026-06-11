#!/usr/bin/env python3
"""
Populate acquisition_model.xlsx with extracted deal inputs,
recalculate via LibreOffice, and read back all output cells.

Expense mapping handles any self-storage OM line item and maps
it intelligently to the model's 8 hardcoded expense rows.
"""
from __future__ import annotations
import argparse
import json
import shutil
import subprocess
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

# ── Operating Expenses sheet cells ───────────────────────────────────────────
# B5  = Property Taxes
# B6  = Insurance
# B7  = Utilities
# B8  = Repairs & Maintenance
# B9  = Payroll / On-Site Staff
# B10 = Management Fee (auto-calculated from EGI - do not overwrite)
# B11 = Marketing / Admin
# B12 = Software / Call Center
# B13 = Bad Debt / Concessions (auto-calculated - do not overwrite)
# B14 = Replacement Reserves

OPEX_DIRECT: dict[str, str] = {
    "t12Tax":                "B5",
    "t12Insurance":          "B6",
    "t12Utilities":          "B7",
    "t12RepairsMaintenance": "B8",
    "t12Payroll":            "B9",
    "t12OfficeEmployee":     "B9",   # additive with payroll
    "t12Marketing":          "B11",
    "t12Administrative":     "B11",  # additive with marketing
}

# Keyword map: any expense label from the OM → model cell
OPEX_KEYWORD_MAP: list[tuple[list[str], str]] = [
    (["tax", "prop tax", "property tax", "real estate tax", "re tax", "assessment"], "B5"),
    (["insurance", "insur", "liability", "casualty"], "B6"),
    (["utilit", "electric", "gas", "water", "sewer", "trash", "waste", "alarm", "security system"], "B7"),
    (["repair", "maintenance", "maint", "contract service", "janitorial", "landscap",
      "groundskeep", "pest", "exterminator", "snow", "cleaning", "security patrol",
      "guard", "lock", "gate"], "B8"),
    (["payroll", "personnel", "staff", "labor", "wage", "salary", "employee",
      "on-site", "manager", "resident", "hr", "benefit", "compensation"], "B9"),
    (["software", "technology", "tech", "call center", "sitelink", "stortrack",
      "storedge", "yardi", "optech", "cloud", "subscription", "it "], "B12"),
    (["reserve", "replacement reserve", "capital reserve", "capex reserve"], "B14"),
    (["market", "advertis", "admin", "administrative", "office supply", "telephone",
      "phone", "postage", "printing", "bank fee", "professional fee", "legal",
      "accounting", "audit", "regulatory", "compliance", "license", "permit",
      "miscellaneous", "other", "general"], "B11"),
]

SKIP_CELLS = {"B10", "B13"}  # auto-calculated from EGI


def map_expense_keyword(label: str) -> str:
    normalized = label.lower().strip()
    for keywords, cell in OPEX_KEYWORD_MAP:
        for kw in keywords:
            if kw in normalized:
                return cell
    return "B11"  # catch-all


def populate(inputs: dict, output_path: Path) -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE}")
    shutil.copy2(TEMPLATE, output_path)
    wb = openpyxl.load_workbook(str(output_path))

    # Inputs sheet
    ws_in = wb["Inputs"]
    for field, cell in INPUTS_MAP.items():
        v = inputs.get(field)
        if v is not None:
            ws_in[cell] = v

    # Operating Expenses sheet
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
                cell = map_expense_keyword(label)
                opex_totals[cell] = opex_totals.get(cell, 0) + float(amount)
            except (TypeError, ValueError):
                pass

    for cell, total in opex_totals.items():
        if cell not in SKIP_CELLS and total > 0:
            ws_opex[cell] = round(total)

    # Unit Mix & Market Comps sheet
    ws_um = wb["Unit Mix & Market Comps"]
    unit_rows = {"5x5": 5, "5x10": 6, "10x10": 7, "10x15": 8, "10x20": 9}

    for item in inputs.get("unitMix", []):
        t = str(item.get("type", "")).lower().replace(" ", "")
        row = 10
        for key, r in unit_rows.items():
            if t == key or key in t or t in key:
                row = r
                break
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
