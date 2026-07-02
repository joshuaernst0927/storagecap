// lib/extraction/deterministicExtractor.ts
import type { IngestedSheet, IngestedCell } from './workbookIngest';
import { classifySheet, SheetCategory, SheetClassification } from './sheetClassifier';

export interface ExtractionSourceRef {
  file: string;
  sheet: string;
  row: number;
  cell: string;
  label: string;
  rawText: string;
}

export interface ExtractedFieldCandidate {
  field: string;
  value: number;
  source: ExtractionSourceRef;
  confidence: number;
  needsReview: boolean;
  // Generic classification of how this value was derived. Only set for
  // fields with a defined resolver (currently historicalCapexTotal via
  // capexResolver.ts). Not deal-specific.
  candidateType?: 'documented' | 'calculated' | 'blended';
}

interface ConceptPattern {
  pattern: RegExp;
  baseConfidence: number;
  baseNeedsReview: boolean;
}

// Each field is defined as a CONCEPT, not a flat list of exact phrases.
// Patterns are organized by specificity tier (highest first): explicit
// period-qualified labels are most trustworthy, broad/ambiguous synonyms
// are least trustworthy. New broker label variants should be added as
// a new pattern within the matching concept/tier, not as a one-off
// field. Nothing here is deal-specific -- no sheet names, rows, cells,
// or property names are referenced.
const CONCEPT_PATTERNS: Record<string, ConceptPattern[]> = {
  t12Revenue: [
    { pattern: /^t-?12\s*(gross)?\s*revenue$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^total\s*(gross\s*)?revenue\s*\(?t-?12\)?$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^trailing\s*12.*revenue$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^revenue\s*-\s*property$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^total\s*revenue$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^total\s*income$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^rental\s*income$/i, baseConfidence: 0.7, baseNeedsReview: false },
    { pattern: /^effective\s*gross\s*income$/i, baseConfidence: 0.7, baseNeedsReview: true },
    { pattern: /^egi$/i, baseConfidence: 0.6, baseNeedsReview: true },
    { pattern: /^gross\s*income$/i, baseConfidence: 0.6, baseNeedsReview: true },
    { pattern: /^revenue$/i, baseConfidence: 0.55, baseNeedsReview: true },
  ],
  t12TotalExpenses: [
    { pattern: /^t-?12\s*total\s*expenses?$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^total\s*operating\s*expenses\s*\(?t-?12\)?$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^trailing\s*12.*expenses?$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^expense\s*-\s*property$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^total\s*operating\s*expenses$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^total\s*expenses?$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^operating\s*expenses$/i, baseConfidence: 0.65, baseNeedsReview: true },
    { pattern: /^total\s*opex$/i, baseConfidence: 0.65, baseNeedsReview: true },
    { pattern: /^expenses?$/i, baseConfidence: 0.55, baseNeedsReview: true },
  ],
  t12NOI: [
    { pattern: /^t-?12\s*noi$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^net\s*operating\s*income\s*\(?t-?12\)?$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^trailing\s*12.*noi$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^net\s*operating\s*income$/i, baseConfidence: 0.8, baseNeedsReview: false },
    { pattern: /^(storage|property|net)\s*noi$/i, baseConfidence: 0.75, baseNeedsReview: false },
    { pattern: /^net\s*income\s*from\s*operations$/i, baseConfidence: 0.75, baseNeedsReview: false },
    { pattern: /^noi$/i, baseConfidence: 0.65, baseNeedsReview: true },
  ],
  historicalCapexTotal: [
    { pattern: /^total\s*capex$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^capex\s*total$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^total\s*capital\s*expenditures?$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^capital\s*expenditures?\b/i, baseConfidence: 0.75, baseNeedsReview: false },
    { pattern: /^subtotal$/i, baseConfidence: 0.5, baseNeedsReview: true },
    { pattern: /^total$/i, baseConfidence: 0.45, baseNeedsReview: true },
  ],
  capexYear: [
    { pattern: /^capex\s*year$/i, baseConfidence: 0.85, baseNeedsReview: false },
    { pattern: /^year$/i, baseConfidence: 0.5, baseNeedsReview: true },
  ],
};

// Which sheet categories are considered an AUTHORITATIVE source for each
// field. A match found on an authoritative sheet keeps its base
// confidence. A match found because the sheet fell into the broad
// "unknown" fallback list (low classification confidence) is damped and
// forced to needsReview -- this is what separates a true T-12 sheet's
// NOI line from a same-looking line on an unrelated/low-confidence sheet
// like a rolling income statement, without doing final selection here.
const AUTHORITATIVE_CATEGORIES: Record<string, SheetCategory[]> = {
  t12Revenue: ['t12', 'operatingStatement'],
  t12TotalExpenses: ['t12', 'operatingStatement'],
  t12NOI: ['t12', 'operatingStatement', 'summary'],
  historicalCapexTotal: ['t12', 'operatingStatement', 'capex'],
  capexYear: ['capex'],
};

const FALLBACK_DAMPING_FACTOR = 0.6;

const FIELDS_BY_CATEGORY: Record<SheetCategory, string[]> = {
  t12: ['t12Revenue', 't12TotalExpenses', 't12NOI', 'historicalCapexTotal'],
  operatingStatement: ['t12Revenue', 't12TotalExpenses', 't12NOI', 'historicalCapexTotal'],
  rentRoll: [],
  unitMix: [],
  capex: ['historicalCapexTotal', 'capexYear'],
  proforma: [],
  summary: ['t12NOI'],
  assumptions: [],
  unknown: ['t12Revenue', 't12TotalExpenses', 't12NOI', 'historicalCapexTotal', 'capexYear'],
};

function cap(text: string, n = 200): string {
  return text.length > n ? text.slice(0, n) + '...' : text;
}

function rowRawText(cells: IngestedCell[]): string {
  return cap(
    cells
      .map((c) => (c.value === null ? '' : String(c.value)))
      .filter(Boolean)
      .join(' | ')
  );
}

// Scans the sheet for a header cell that names a "total" column
// (e.g. "T-12 Total", "Trailing 12 Total", "TOTAL", or a generic
// "Total" header). When found, value extraction prefers this column
// over the first numeric cell to the right of the label -- this is
// what lets the extractor pick the actual total instead of a monthly
// column when labels and totals are not in adjacent columns.
function findPreferredTotalColumn(sheet: IngestedSheet): number | null {
  const namedTotalPatterns = [/^t-?12\s*total$/i, /^trailing\s*12\s*total$/i];
  let genericMatch: number | null = null;
  for (const row of sheet.rows) {
    for (const cell of row.cells) {
      if (typeof cell.value !== 'string') continue;
      const v = cell.value.trim();
      if (v === '') continue;
      for (const p of namedTotalPatterns) {
        if (p.test(v)) return cell.col;
      }
      if (genericMatch === null && /^total$/i.test(v)) {
        genericMatch = cell.col;
      }
    }
  }
  return genericMatch;
}

function findNumericValueInRow(
  cells: IngestedCell[],
  labelColIndex: number,
  preferredCol: number | null
): number | null {
  if (preferredCol !== null && preferredCol > labelColIndex) {
    for (const c of cells) {
      if (c.col !== preferredCol) continue;
      if (typeof c.value === 'number') return c.value;
      if (typeof c.value === 'string') {
        const cleaned = c.value.replace(/[$,()% ]/g, '');
        const num = Number(cleaned);
        if (!Number.isNaN(num) && c.value.trim() !== '') return num;
      }
    }
  }
  for (const c of cells) {
    if (c.col <= labelColIndex) continue;
    if (typeof c.value === 'number') return c.value;
    if (typeof c.value === 'string') {
      const cleaned = c.value.replace(/[$,()% ]/g, '');
      const num = Number(cleaned);
      if (!Number.isNaN(num) && c.value.trim() !== '') return num;
    }
  }
  return null;
}

function extractFieldFromSheet(
  sheet: IngestedSheet,
  field: string,
  fileName: string,
  preferredCol: number | null,
  sheetCategory: SheetCategory
): ExtractedFieldCandidate[] {
  const patterns = CONCEPT_PATTERNS[field];
  if (!patterns) return [];

  const isAuthoritative = (AUTHORITATIVE_CATEGORIES[field] || []).includes(sheetCategory);

  const candidates: ExtractedFieldCandidate[] = [];

  for (const row of sheet.rows) {
    for (const cell of row.cells) {
      if (typeof cell.value !== 'string') continue;
      const label = cell.value.trim();
      if (label === '') continue;

      let matched: ConceptPattern | null = null;
      for (const def of patterns) {
        if (def.pattern.test(label)) {
          matched = def;
          break;
        }
      }
      if (!matched) continue;

      const value = findNumericValueInRow(row.cells, cell.col, preferredCol);
      if (value === null) continue;

      const confidence = isAuthoritative
        ? matched.baseConfidence
        : Math.round(matched.baseConfidence * FALLBACK_DAMPING_FACTOR * 100) / 100;
      const needsReview = matched.baseNeedsReview || !isAuthoritative;

      candidates.push({
        field,
        value,
        source: {
          file: fileName,
          sheet: sheet.sheetName,
          row: row.rowIndex,
          cell: cell.address,
          label,
          rawText: rowRawText(row.cells),
        },
        confidence,
        needsReview,
        // Any value matched from a labeled row is documented evidence, not an
        // estimate. Generic across all fields -- not tied to historicalCapexTotal
        // specifically or to any deal.
        candidateType: 'documented',
      });
    }
  }

  return candidates;
}

export interface DeterministicExtractionResult {
  candidates: ExtractedFieldCandidate[];
  warnings: string[];
}

export function extractAll(
  sheets: IngestedSheet[],
  classifications: SheetClassification[],
  fileName: string = 'unknown.xlsx'
): ExtractedFieldCandidate[] {
  const candidates: ExtractedFieldCandidate[] = [];
  const classByName = new Map(classifications.map((c) => [c.sheetName, c]));

  for (const sheet of sheets) {
    const classification = classByName.get(sheet.sheetName) ?? classifySheet(sheet);
    const fieldsToTry =
      classification.confidence >= 0.4
        ? FIELDS_BY_CATEGORY[classification.category]
        : FIELDS_BY_CATEGORY.unknown;
    const effectiveCategory: SheetCategory =
      classification.confidence >= 0.4 ? classification.category : 'unknown';

    const preferredCol = findPreferredTotalColumn(sheet);

    for (const field of fieldsToTry) {
      candidates.push(...extractFieldFromSheet(sheet, field, fileName, preferredCol, effectiveCategory));
    }
  }

  return candidates;
}

export function runDeterministicExtraction(
  sheets: IngestedSheet[],
  fileName: string
): DeterministicExtractionResult {
  const classifications = sheets.map((s) => classifySheet(s));
  const candidates = extractAll(sheets, classifications, fileName);

  const fieldsFound = new Set(candidates.map((c) => c.field));
  const allFields = Object.keys(CONCEPT_PATTERNS);
  const warnings: string[] = [];
  for (const field of allFields) {
    if (!fieldsFound.has(field)) {
      warnings.push('No candidate found for field "' + field + '" in any sheet of ' + fileName);
    }
  }

  return { candidates, warnings };
}
