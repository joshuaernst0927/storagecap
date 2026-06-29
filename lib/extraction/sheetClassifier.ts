// lib/extraction/sheetClassifier.ts
import type { IngestedSheet } from './workbookIngest';

export type SheetCategory =
  | 't12'
  | 'operatingStatement'
  | 'rentRoll'
  | 'unitMix'
  | 'capex'
  | 'proforma'
  | 'summary'
  | 'assumptions'
  | 'unknown';

export interface SheetClassification {
  sheetName: string;
  category: SheetCategory;
  confidence: number;
  reasons: string[];
}

interface CategoryRule {
  category: SheetCategory;
  nameRegex: RegExp;
  keywords: string[];
}

const RULES: CategoryRule[] = [
  {
    category: 'capex',
    nameRegex: /cap\s*ex/i,
    keywords: ['capex', 'capital expenditure', 'capital improvements'],
  },
  {
    category: 't12',
    nameRegex: /t-?12|trailing\s*12/i,
    keywords: ['t-12', 't12', 'trailing 12', 'noi', 'net operating income'],
  },
  {
    category: 'operatingStatement',
    nameRegex: /operating\s*statement|p&l|income\s*statement/i,
    keywords: ['gross revenue', 'total expenses', 'operating expenses', 'noi'],
  },
  {
    category: 'rentRoll',
    nameRegex: /rent\s*roll/i,
    keywords: ['unit number', 'tenant', 'lease start', 'monthly rent'],
  },
  {
    category: 'unitMix',
    nameRegex: /unit\s*mix|market\s*comps/i,
    keywords: ['unit type', 'square footage', 'in-place rent', 'street rate'],
  },
  {
    category: 'proforma',
    nameRegex: /pro\s*forma|underwrit/i,
    keywords: ['stabilized noi', 'cap rate', 'irr', 'moic'],
  },
  {
    category: 'summary',
    nameRegex: /summary|overview/i,
    keywords: ['purchase price', 'deal summary', 'executive summary'],
  },
  {
    category: 'assumptions',
    nameRegex: /assumptions|inputs/i,
    keywords: ['growth rate', 'exit cap', 'hold period', 'ltv'],
  },
];

function sheetText(sheet: IngestedSheet): string {
  const parts: string[] = [];
  for (const row of sheet.rows.slice(0, 40)) {
    for (const cell of row.cells) {
      if (typeof cell.value === 'string') parts.push(cell.value);
    }
  }
  return parts.join(' | ').toLowerCase();
}

export function classifySheet(sheet: IngestedSheet): SheetClassification {
  const text = sheetText(sheet);
  let best: SheetClassification = {
    sheetName: sheet.sheetName,
    category: 'unknown',
    confidence: 0,
    reasons: [],
  };

  for (const rule of RULES) {
    const reasons: string[] = [];
    let score = 0;

    if (rule.nameRegex.test(sheet.sheetName)) {
      score += 0.6;
      reasons.push('sheet name matches ' + rule.nameRegex.source);
    }

    const matchedKeywords = rule.keywords.filter((kw) => text.includes(kw));
    if (matchedKeywords.length > 0) {
      score += Math.min(0.5, matchedKeywords.length * 0.15);
      reasons.push('keyword match: ' + matchedKeywords.join(', '));
    }

    if (score > best.confidence) {
      best = {
        sheetName: sheet.sheetName,
        category: rule.category,
        confidence: Math.min(1, score),
        reasons,
      };
    }
  }

  return best;
}

export function classifyWorkbook(sheets: IngestedSheet[]): SheetClassification[] {
  return sheets.map(classifySheet);
}
