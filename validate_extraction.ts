// validate_extraction.ts
// Read-only diagnostic. Does not write or modify any file.
import * as fs from "fs";
import * as path from "path";
import { ingestWorkbook } from "./lib/extraction/workbookIngest";
import { classifyWorkbook } from "./lib/extraction/sheetClassifier";
import { extractAll, ExtractedFieldCandidate } from "./lib/extraction/deterministicExtractor";

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx validate_extraction.ts "<path-to-workbook.xlsx>"');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved);
  console.log(`\n=== Ingesting: ${resolved} ===`);

  const workbook = ingestWorkbook(buffer);
  console.log(`Sheets found: ${workbook.sheets.map((s) => s.sheetName).join(", ")}`);

  console.log(`\n=== Sheet Classification ===`);
  const classifications = classifyWorkbook(workbook.sheets);
  for (const c of classifications) {
    console.log(`- "${c.sheetName}" -> ${c.category} (confidence ${c.confidence.toFixed(2)})`);
    for (const reason of c.reasons) {
      console.log(`    reason: ${reason}`);
    }
  }

  console.log(`\n=== Extracted Candidates ===`);
  const fileName = path.basename(resolved);
  const candidates = extractAll(workbook.sheets, classifications, fileName);
  if (candidates.length === 0) {
    console.log("(no candidates found)");
  }
  for (const cand of candidates) {
    console.log(
      `- ${cand.field} = ${cand.value} | sheet "${cand.source.sheet}" cell ${cand.source.cell} | label "${cand.source.label}" | confidence ${cand.confidence.toFixed(2)} | needsReview=${cand.needsReview}`
    );
  }

  console.log(`\n=== Summary by Field ===`);
  const byField = new Map<string, ExtractedFieldCandidate[]>();
  for (const cand of candidates) {
    const list = byField.get(cand.field) ?? [];
    list.push(cand);
    byField.set(cand.field, list);
  }

  const allFields: string[] = [
    "t12Revenue",
    "t12TotalExpenses",
    "t12NOI",
    "historicalCapexTotal",
    "capexYear",
  ];

  for (const field of allFields) {
    const list = byField.get(field) ?? [];
    if (list.length === 0) {
      console.log(`- ${field}: NO CANDIDATES FOUND (needsReview)`);
      continue;
    }
    const sorted = [...list].sort((a, b) => b.confidence - a.confidence);
    console.log(`- ${field}: ${sorted.length} candidate(s) found`);
    for (const cand of sorted) {
      console.log(
        `    value=${cand.value} confidence=${cand.confidence.toFixed(2)} sheet="${cand.source.sheet}" cell=${cand.source.cell}`
      );
    }
  }

  console.log("\nDone.");
}

main();
