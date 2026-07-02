// regression_evidence_strength.ts
// Proves the current selector cannot distinguish documented CapEx evidence
// from a dedicated capex-classified source vs. documented evidence from an
// incidental T-12/operatingStatement/unknown source, when both share
// candidateType: documented. Uses only sheetCategory (already produced
// generically by sheetClassifier.ts) -- no sheet names, no labels, no deal.
import { selectCandidate } from "./lib/extraction/candidateSelector";

let failures = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log((pass ? "PASS" : "FAIL") + " - " + label + ": expected=" + expected + " actual=" + actual);
  if (!pass) failures++;
}

// Weaker evidence: documented, but from an incidental/unknown context, given
// a deliberately HIGHER confidence and BETTER row position to prove the tie
// -break has to come from evidence strength, not from those other fields.
const incidental: any = {
  value: 76914.21,
  source: { sheetCategory: "unknown", rowNumber: 999, cellAddress: "Z99" },
  confidence: 0.9,
  needsReview: false,
  candidateType: "documented",
};

// Stronger evidence: documented, from a sheet structurally classified as a
// dedicated capex context, given a deliberately LOWER confidence and worse
// row position.
const dedicated: any = {
  value: 124102.87,
  source: { sheetCategory: "capex", rowNumber: 1, cellAddress: "A1" },
  confidence: 0.5,
  needsReview: false,
  candidateType: "documented",
};

const result = selectCandidate("historicalCapexTotal", [incidental, dedicated]);
assertEqual(
  "Selector prefers dedicated-capex-context documented evidence over incidental documented evidence, regardless of confidence/row",
  result.selectedValue,
  124102.87
);

console.log("");
console.log(failures === 0 ? "ALL PASS" : failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
