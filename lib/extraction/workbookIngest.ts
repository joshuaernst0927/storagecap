// lib/extraction/workbookIngest.ts
import * as XLSX from 'xlsx';

export interface IngestedCell {
  row: number;
  col: number;
  address: string;
  value: string | number | boolean | null;
  formula?: string;
}

export interface IngestedRow {
  rowIndex: number;
  cells: IngestedCell[];
}

export interface IngestedSheet {
  sheetName: string;
  rows: IngestedRow[];
}

export interface IngestedWorkbook {
  sheets: IngestedSheet[];
}

export function ingestWorkbook(buffer: Buffer): IngestedWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellText: false });

  const sheets: IngestedSheet[] = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const ref = ws['!ref'];
    if (!ref) {
      return { sheetName, rows: [] };
    }

    const range = XLSX.utils.decode_range(ref);
    const rows: IngestedRow[] = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells: IngestedCell[] = [];
      let hasValue = false;

      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        const cell = ws[address];
        if (!cell) continue;

        const value =
          cell.v === undefined || cell.v === null
            ? null
            : (cell.v as string | number | boolean);

        if (value !== null && value !== '') hasValue = true;

        cells.push({
          row: r,
          col: c,
          address,
          value,
          formula: cell.f ? String(cell.f) : undefined,
        });
      }

      if (hasValue) {
        rows.push({ rowIndex: r, cells });
      }
    }

    return { sheetName, rows };
  });

  return { sheets };
}
