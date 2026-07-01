// lib/extraction/candidateSelector.ts
//
// Phase 2 precedence engine. Takes canonical candidates (already converted
// by toCanonicalCandidates.ts) and selects one CanonicalExtractedField per
// field. Does not touch deterministicExtractor.ts, validate_extraction.ts,
// or upload-deal.ts.

import type {
  ExtractedFieldCandidate as CanonicalCandidate,
  CanonicalExtractedField,
} from '../pipelineData';

const LABEL_PRIORITY: Record<string, string[]> = {
  t12NOI: ['net noi', 'net operating income', 'noi', 'storage noi'],
};

// Source-sheet priority for fields where a dedicated sheet beats a T-12 line item.
// Lower index = higher priority. Matched against candidate.source.sheetName (case-insensitive).
const SOURCE_SHEET_PRIORITY: Record<string, string[]> = {
  historicalCapexTotal: ['capex', 'capital expenditure', 'cap ex', 'capex summary'],
};

function sourceSheetPriorityIndex(field: string, sheetName: string | undefined): number {
  const list = SOURCE_SHEET_PRIORITY[field];
  if (!list || !sheetName) return Number.POSITIVE_INFINITY;
  const normalized = sheetName.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    if (normalized.includes(list[i])) return i;
  }
  return Number.POSITIVE_INFINITY;
}

function labelPriorityIndex(field: string, label: string | undefined): number {
  const list = LABEL_PRIORITY[field];
  if (!list || !label) return Number.POSITIVE_INFINITY;
  const normalized = label.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    if (normalized.includes(list[i])) return i;
  }
  return Number.POSITIVE_INFINITY;
}

function compareCandidates(
  field: string,
  a: CanonicalCandidate,
  b: CanonicalCandidate
): number {
  if (a.needsReview !== b.needsReview) {
    return a.needsReview ? 1 : -1;
  }

  const confA = a.confidence ?? -Infinity;
  const confB = b.confidence ?? -Infinity;
  if (confA !== confB) {
    return confB - confA;
  }

  // Source-sheet priority (e.g. CapEx Summary beats T-12 line for historicalCapexTotal)
  const sheetPrioA = sourceSheetPriorityIndex(field, a.source.sheetName);
  const sheetPrioB = sourceSheetPriorityIndex(field, b.source.sheetName);
  if (sheetPrioA !== sheetPrioB) {
    return sheetPrioA - sheetPrioB;
  }

  const prioA = labelPriorityIndex(field, a.source.label);
  const prioB = labelPriorityIndex(field, b.source.label);
  if (prioA !== prioB) {
    return prioA - prioB;
  }

  const rowA = a.source.rowNumber ?? -1;
  const rowB = b.source.rowNumber ?? -1;
  if (rowA !== rowB) {
    return rowB - rowA;
  }

  const cellA = a.source.cellAddress ?? '';
  const cellB = b.source.cellAddress ?? '';
  return cellA.localeCompare(cellB);
}

export function selectCandidate(
  field: string,
  candidates: CanonicalCandidate[]
): CanonicalExtractedField {
  if (candidates.length === 0) {
    return {
      selectedValue: null,
      source: null,
      confidence: null,
      needsReview: true,
      conflicts: [],
    };
  }

  const sorted = [...candidates].sort((a, b) => compareCandidates(field, a, b));
  const winner = sorted[0];
  const losers = sorted.slice(1);

  const tiedAtLastResort =
    losers.length > 0 &&
    winner.needsReview === losers[0].needsReview &&
    (winner.confidence ?? -Infinity) === (losers[0].confidence ?? -Infinity) &&
    labelPriorityIndex(field, winner.source.label) ===
      labelPriorityIndex(field, losers[0].source.label) &&
    (winner.source.rowNumber ?? -1) === (losers[0].source.rowNumber ?? -1);

  return {
    selectedValue: winner.value,
    selectedCandidateIndex: candidates.indexOf(winner),
    source: winner.source,
    confidence: winner.confidence,
    needsReview: tiedAtLastResort ? true : winner.needsReview,
    conflicts: losers,
  };
}

export function selectAll(
  candidatesByField: Record<string, CanonicalCandidate[]>
): Record<string, CanonicalExtractedField> {
  const result: Record<string, CanonicalExtractedField> = {};
  for (const [field, candidates] of Object.entries(candidatesByField)) {
    result[field] = selectCandidate(field, candidates);
  }
  return result;
}
