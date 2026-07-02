// regression_needsreview.ts
// Proves that a candidate extracted from an authoritative sheet does not
// have needsReview forced true by a broad/ambiguous label pattern.
// Uses deterministicExtractor directly with synthetic sheet data.
// No real deal data. Sheet name and keyword chosen to satisfy the generic
// capex classification rule in sheetClassifier.ts (/cap\s*ex/i + keyword).
import { extractAll } from "./lib/extraction/deterministicExtractor";
import { classifyWorkbook } from "./lib/extraction/sheetClassifier";

let failures = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log((pass ? "PASS" : "FAIL") + " - " + label + ": expected=" + expected + " actual=" + actual);
  if (!pass) failures++;
}

// Synthetic sheet: name matches /cap\s*ex/i, first row contains keyword
// "capital improvements" to satisfy sheetClassifier keyword scoring.
// Label is "Total" -- baseNeedsReview: true in CONCEPT_PATTERNS.
// After the needsReview fix: isAuthoritative=true on capex sheet,
// so needsReview should be false despite the broad label.
const syntheticSheet = {
  sheetName: "CapEx Detail",
  rows: [
    {
      rowIndex: 0,
      cells: [
        { row: 0, col: 0, address: "A1", value: "capital improvements" },
      ],
    },
    {
      rowIndex: 1,
      cells: [
        { row: 1, col: 0, address: "A2", value: "Total" },
        { row: 1, col: 1, address: "B2", value: 50000 },
      ],
    },
  ],
};

const classifications = classifyWorkbook([syntheticSheet]);
console.log("Sheet classified as:", classifications[0].category, "confidence:", classifications[0].confidence);

const candidates = extractAll([syntheticSheet], classifications, "synthetic.xlsx");
console.log("Total candidates found:", candidates.length);

const capexCandidates = candidates.filter(
  (c) => c.field === "historicalCapexTotal" && c.source.sheetCategory === "capex"
);

assertEqual("At least one capex candidate found", capexCandidates.length > 0, true);

if (capexCandidates.length > 0) {
  const c = capexCandidates[0];
  console.log("  label:", c.source.label, "needsReview:", c.needsReview, "candidateType:", c.candidateType);
  assertEqual(
    "Broad label on authoritative capex sheet does not force needsReview=true",
    c.needsReview,
    false
  );
  assertEqual("candidateType is documented", c.candidateType, "documented");
}

console.log("");
console.log(failures === 0 ? "ALL PASS" : failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
