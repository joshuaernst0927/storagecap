// lib/extraction/toCanonicalCandidates.ts
//
// Adapter layer: converts deterministicExtractor.ts's local candidate shape
// into the canonical provenance shape defined in lib/pipelineData.ts.
// Does NOT modify deterministicExtractor.ts or validate_extraction.ts.

import type {
  ExtractedFieldCandidate as LocalCandidate,
} from './deterministicExtractor';

import type {
  ExtractedFieldCandidate as CanonicalCandidate,
  ExtractionSourceRef as CanonicalSourceRef,
  ExtractionSourceType,
} from '../pipelineData';

export function toCanonicalCandidate(
  local: LocalCandidate,
  sourceType: ExtractionSourceType = 'Excel'
): CanonicalCandidate {
  const canonicalSource: CanonicalSourceRef = {
    fileName: local.source.file,
    sourceType,
    sheetName: local.source.sheet,
    rowNumber: local.source.row,
    cellAddress: local.source.cell,
    label: local.source.label,
    rawText: local.source.rawText,
  };

  return {
    value: local.value,
    source: canonicalSource,
    confidence: local.confidence,
    needsReview: local.needsReview,
  };
}

export function toCanonicalCandidateMap(
  localCandidates: LocalCandidate[],
  sourceType: ExtractionSourceType = 'Excel'
): Record<string, CanonicalCandidate[]> {
  const result: Record<string, CanonicalCandidate[]> = {};

  for (const local of localCandidates) {
    const canonical = toCanonicalCandidate(local, sourceType);
    if (!result[local.field]) {
      result[local.field] = [];
    }
    result[local.field].push(canonical);
  }

  return result;
}
