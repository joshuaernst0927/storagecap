#!/usr/bin/env python3
"""
Populate acquisition_model.xlsx with extracted deal inputs.

Usage:
  python underwrite.py --inputs-file inputs.json --output /tmp/deal_uw.xlsx
"""
from __future__ import annotations
import argparse
import json
import re
import shutil
from pathlib import Path
import openpyxl

TEMPLATE = Path(__file__).parent / "models" / "acquisition_model.xlsx"

# Inputs sheet: JSON field → cell address
INPUTS_MAP: dict[str, str] = {
    "purchasePrice":        "B4",
    "closingCostsPct":      "B5",
    "initialRepairs":       "B6",
    "acquisitionFeePct":    "B7",
    "assetMgmtFeePct":      "B8",
    "dispositionFeePct":    "B9",
    "startOccupancy":       "B13",
    "stabilizedOccupancy":  "B14",
    "monthsToStabilization":"B15",
    "annualRentGrowth":     "B18",
    "opexGrowth":           "B22",
    "initialLTV":           "B26",
    "initialRate":          "B27",
    "initialAmortYears":    "B28",
    "ioPeriodMonths":       "B29",
    "minDSCR":              "B30",
    "refiMonth":            "B31",
    "refiLTV":              "B32",
    "refiRate":             "B33",
    "refiAmortYears":       "B34",
    "exitCapRate":          "B35",
    "exitMonth":            "B36",
    "sellingCostsPct":      "B37",
    "lpReturnOfCapital":    "B41",
    "lpCatchUp":            "B42",
    "gpCatchUp":            "B43",
    "preferredReturn":      "B44",
    "lpResidual":           "B45",
    "gpResidual":           "B46",
}

# Unit Mix sheet: normalized type string → row
UNIT_ROWS: dict[str, int] = {
    "5x5": 5, "5x10": 6, "10x10": 7, "10x15": 8, "10x20": 9,
}
OTHER_ROW = 10  # Parking / Outdoor / Other


def _match_unit_row(type_str: str) -> int:
    t = type_str.lower().replace(" ", "")
    for key, row in UNIT_ROWS.items():
        if t == key:
            return row
    for key, row in UNIT_ROWS.items():
        if key in t or t in key:
            return row
    return OTHER_ROW


def populate(inputs: dict, output_path: Path) -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE}")
    shutil.copy2(TEMPLATE, output_path)

    wb = openpyxl.load_workbook(str(output_path))

    # ── Inputs sheet ─────────────────────────────────────────────────────────
    ws_in = wb["Inputs"]
    for field, cell in INPUTS_MAP.items():
        v = inputs.get(field)
        if v is not None:
            ws_in[cell] = v

    # ── Unit Mix & Market Comps sheet ─────────────────────────────────────────
    ws_um = wb["Unit Mix & Market Comps"]
    for item in inputs.get("unitMix", []):
        row = _match_unit_row(str(item.get("type", "")))
        for col, field in [("B", "units"), ("C", "sqft"), ("D", "currentRent"), ("E", "marketRent")]:
            v = item.get(field)
            if v is not None:
                ws_um[f"{col}{row}"] = v

    wb.save(str(output_path))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs-file", required=True, help="Path to JSON file with model inputs")
    parser.add_argument("--output", required=True, help="Destination .xlsx path")
    args = parser.parse_args()

    with open(args.inputs_file, encoding="utf-8") as f:
        inputs = json.load(f)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    populate(inputs, out)
    print(str(out))


if __name__ == "__main__":
    main()
