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

// Generic candidate-type priority. Applies to every field that sets
// candidateType, not just historicalCapexTotal. Documented evidence always
// outranks an estimate; a blended (partial-documented + calculated-fill)
// value outranks a fully calculated estimate. Not tied to any sheet name,
// label, or deal.
const CANDIDATE_TYPE_PRIORITY: Record<string, number> = {
  documented: 0,
  blended: 1,
  calculated: 2,
};

function candidateTypePriorityIndex(candidateType: string | undefined): number {
  if (!candidateType) return Number.POSITIVE_INFINITY;
  return CANDIDATE_TYPE_PRIORITY[candidateType] ?? Number.POSITIVE_INFINITY;
}

// Generic evidence-strength ordering per field, keyed by structural sheet
// category (from sheetClassifier.ts) -- never a sheet name or deal. A
// category earlier in the list is more dedicated evidence for that field.
// Categories not listed (including 'unknown') rank lowest.
const EVIDENCE_STRENGTH_PRIORITY: Record<string, string[]> = {
  historicalCapexTotal: ['capex', 't12', 'operatingStatement'],
};

function evidenceStrengthIndex(field: string, sheetCategory: string | undefined): number {
  const list = EVIDENCE_STRENGTH_PRIORITY[field];
  if (!list || !sheetCategory) return Number.POSITIVE_INFINITY;
  const idx = list.indexOf(sheetCategory);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
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

  // Generic candidate-type priority (documented > blended > calculated).
  const typePrioA = candidateTypePriorityIndex((a as any).candidateType);
  const typePrioB = candidateTypePriorityIndex((b as any).candidateType);
  if (typePrioA !== typePrioB) {
    return typePrioA - typePrioB;
  }

  // Generic evidence-strength priority (dedicated structural category beats
  // incidental/unknown context), only applied among candidates that tied on
  // candidateType above.
  const evidencePrioA = evidenceStrengthIndex(field, (a.source as any).sheetCategory);
  const evidencePrioB = evidenceStrengthIndex(field, (b.source as any).sheetCategory);
  if (evidencePrioA !== evidencePrioB) {
    return evidencePrioA - evidencePrioB;
  }

  const confA = a.confidence ?? -Infinity;
  const confB = b.confidence ?? -Infinity;
  if (confA !== confB) {
    return confB - confA;
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
