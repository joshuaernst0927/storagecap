// lib/extraction/buildPipelineExtraction.ts
//
// Phase 2 assembly layer. Wires extractAll() output through
// toCanonicalCandidates.ts and candidateSelector.ts to produce a
// complete PipelineExtraction object. Does not touch
// deterministicExtractor.ts, validate_extraction.ts, or upload-deal.ts.

import type { ExtractedFieldCandidate as LocalCandidate } from './deterministicExtractor';
import { toCanonicalCandidateMap } from './toCanonicalCandidates';
import { selectAll } from './candidateSelector';
import type {
  PipelineExtraction,
  ExtractionSourceRef,
  ExtractionSourceType,
} from '../pipelineData';

const SCHEMA_VERSION = '2.0';

export function buildPipelineExtraction(
  localCandidates: LocalCandidate[],
  sourceFiles: ExtractionSourceRef[],
  sourceType: ExtractionSourceType = 'Excel'
): PipelineExtraction {
  const candidateMap = toCanonicalCandidateMap(localCandidates, sourceType);
  const canonical = selectAll(candidateMap);

  const warnings: string[] = [];
  let needsReview = false;

  for (const [field, entry] of Object.entries(canonical)) {
    if (entry.needsReview) {
      needsReview = true;
      warnings.push(`Field "${field}" needs review: ${
        entry.conflicts && entry.conflicts.length > 0
          ? `${entry.conflicts.length} conflicting candidate(s)`
          : 'no confident candidate found'
      }`);
    }
  }

  return {
    version: SCHEMA_VERSION,
    extractedAt: new Date().toISOString(),
    sourceFiles,
    canonical,
    candidates: candidateMap,
    warnings,
    needsReview,
  };
}
