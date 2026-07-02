// regression_capex.ts
// Read-only regression harness for resolveHistoricalCapex. Does not touch
// live deal data, candidateSelector.ts, or deterministicExtractor.ts.
// Fixture A uses Tulsa\'s real documented figure strictly as fixture
// expected-output evidence -- quarantined, never a rule source. Fixtures
// B and C are synthetic and deal-agnostic, designed to be structurally
// unlike Tulsa.
import { resolveHistoricalCapex } from "./lib/extraction/capexResolver";

let failures = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log((pass ? "PASS" : "FAIL") + " - " + label + ": expected=" + expected + " actual=" + actual);
  if (!pass) failures++;
}

// Fixture A -- Tulsa, quarantined evidence only. Fully documented, 12/12 months.
{
  const result = resolveHistoricalCapex({
    totalSF: 50500,
    documented: { amount: 124102.87, coveredMonths: 12, totalMonths: 12 },
  });
  assertEqual("Fixture A (documented) candidateType", result.candidateType, "documented");
  assertEqual("Fixture A (documented) value", result.value, 124102.87);
}

// Fixture B -- synthetic, no documented CapEx data of any kind.
{
  const totalSF = 52000;
  const result = resolveHistoricalCapex({ totalSF, documented: null });
  assertEqual("Fixture B (calculated) candidateType", result.candidateType, "calculated");
  assertEqual("Fixture B (calculated) value", result.value, totalSF * 0.15);
}

// Fixture C -- synthetic, partial-period documented data, unrelated to Tulsa.
{
  const totalSF = 60000;
  const documentedAmount = 40000;
  const coveredMonths = 6;
  const totalMonths = 12;
  const result = resolveHistoricalCapex({
    totalSF,
    documented: { amount: documentedAmount, coveredMonths, totalMonths },
  });
  const expectedValue = documentedAmount + totalSF * 0.15 * ((totalMonths - coveredMonths) / 12);
  assertEqual("Fixture C (blended) candidateType", result.candidateType, "blended");
  assertEqual("Fixture C (blended) value", result.value, expectedValue);
  assertEqual("Fixture C (blended) coveredMonths", result.coveragePeriod ? result.coveragePeriod.coveredMonths : null, coveredMonths);
}

console.log("");
console.log(failures === 0 ? "ALL PASS" : failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);
