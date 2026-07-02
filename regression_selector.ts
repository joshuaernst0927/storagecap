// regression_selector.ts
// Proves candidateSelector.ts prefers documented over calculated by
// candidateType, using synthetic candidates only -- no real deal data,
// no sheet names, no labels that matter to the outcome.
import { selectCandidate } from "./lib/extraction/candidateSelector";

let failures = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log((pass ? "PASS" : "FAIL") + " - " + label + ": expected=" + expected + " actual=" + actual);
  if (!pass) failures++;
}

// Two synthetic candidates for the same field, differing ONLY by candidateType.
// Deliberately give the calculated one higher confidence and a "nicer" sheet
// name, to prove candidateType wins on its own, not on confidence or naming.
const documented: any = {
  value: 50000,
  source: { sheetName: "Random Sheet Name Z", label: "Whatever Label" },
  confidence: 0.5,
  needsReview: false,
  candidateType: "documented",
};

const calculated: any = {
  value: 99999,
  source: { sheetName: "Totally Unrelated Sheet", label: "Some Other Label" },
  confidence: 0.99,
  needsReview: false,
  candidateType: "calculated",
};

const result = selectCandidate("someGenericField", [calculated, documented]);
assertEqual("Selector prefers documented over calculated regardless of confidence/sheet/label", result.selectedValue, 50000);

console.log("");
console.log(failures === 0 ? "ALL PASS" : failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
