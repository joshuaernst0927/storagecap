// lib/extraction/capexResolver.ts
//
// Deal-agnostic resolution of a single historicalCapexTotal value.
// Callers detect documented CapEx evidence via structural signals (a
// dedicated capex/spend-ledger section with a labeled total) and pass the
// results in here. This module contains no sheet name, label string, or
// deal-specific assumption of any kind.

export const CAPEX_RESERVE_PER_SF_PER_YEAR = 0.15;

export type CapexCandidateType = "documented" | "calculated" | "blended";

export interface DocumentedCapexEvidence {
  amount: number;
  coveredMonths: number;
  totalMonths: number;
}

export interface CapexResolverInput {
  totalSF: number | null;
  documented: DocumentedCapexEvidence | null;
}

export interface CapexResolverResult {
  value: number | null;
  candidateType: CapexCandidateType | null;
  coveragePeriod: { coveredMonths: number; totalMonths: number } | null;
  reason: string;
}

export function resolveHistoricalCapex(input: CapexResolverInput): CapexResolverResult {
  const { totalSF, documented } = input;

  if (documented && documented.totalMonths > 0 && documented.coveredMonths >= documented.totalMonths) {
    return {
      value: documented.amount,
      candidateType: "documented",
      coveragePeriod: { coveredMonths: documented.coveredMonths, totalMonths: documented.totalMonths },
      reason: "Full-period documented CapEx evidence found; used as-is.",
    };
  }

  if (documented && documented.totalMonths > 0 && documented.coveredMonths > 0 && documented.coveredMonths < documented.totalMonths) {
    if (totalSF === null) {
      return {
        value: documented.amount,
        candidateType: "documented",
        coveragePeriod: { coveredMonths: documented.coveredMonths, totalMonths: documented.totalMonths },
        reason: "Partial-period documented CapEx found but no SF available to prorate remaining months; returning documented amount only.",
      };
    }
    const uncoveredMonths = documented.totalMonths - documented.coveredMonths;
    const proratedReserve = totalSF * CAPEX_RESERVE_PER_SF_PER_YEAR * (uncoveredMonths / 12);
    return {
      value: documented.amount + proratedReserve,
      candidateType: "blended",
      coveragePeriod: { coveredMonths: documented.coveredMonths, totalMonths: documented.totalMonths },
      reason: "Blended: documented amount for covered months plus prorated $0.15/SF/year reserve for uncovered months, annualized.",
    };
  }

  if (totalSF !== null) {
    return {
      value: totalSF * CAPEX_RESERVE_PER_SF_PER_YEAR,
      candidateType: "calculated",
      coveragePeriod: null,
      reason: "No documented CapEx evidence found; used flat $0.15/SF/year reserve.",
    };
  }

  return {
    value: null,
    candidateType: null,
    coveragePeriod: null,
    reason: "No documented CapEx evidence and no total SF available to calculate a reserve.",
  };
}
