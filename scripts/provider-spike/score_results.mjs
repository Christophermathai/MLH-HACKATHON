import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { scoreWords } from "./metrics.mjs";

const [manifestArg, resultsArg, reportArg] = process.argv.slice(2);
if (!manifestArg || !resultsArg) {
  throw new Error("Usage: node score_results.mjs <manifest.json> <results.json> [report.json]");
}

const manifest = JSON.parse(await readFile(resolve(manifestArg), "utf8"));
const run = JSON.parse(await readFile(resolve(resultsArg), "utf8"));
if (run.model !== manifest.model) throw new Error(`Result model mismatch: ${run.model}`);
const predictions = new Map(run.results.map((item) => [item.id, item]));
const scored = manifest.samples.map((sample) => {
  const prediction = predictions.get(sample.id);
  if (!prediction) return { id: sample.id, status: "blocked", reason: "missing-result" };
  const score = scoreWords(sample.referenceText, prediction.text ?? "");
  return {
    id: sample.id,
    status: "measured",
    referenceText: sample.referenceText,
    predictedText: prediction.text,
    elapsedSeconds: prediction.elapsedSeconds,
    ...score,
    meaningPreserved: prediction.meaningPreserved ?? null,
    reviewerNotes: prediction.reviewerNotes ?? "Malayalam review pending"
  };
});
const measured = scored.filter((item) => item.status === "measured");
const summary = {
  schemaVersion: 1,
  model: run.model,
  run: run.run,
  measuredCount: measured.length,
  meanWordErrorRate: measured.length ? measured.reduce((sum, item) => sum + item.wordErrorRate, 0) / measured.length : null,
  humanReviewComplete: measured.length === 5 && measured.every((item) => typeof item.meaningPreserved === "boolean"),
  results: scored
};
const output = `${JSON.stringify(summary, null, 2)}\n`;
if (reportArg) await writeFile(resolve(reportArg), output, "utf8");
else process.stdout.write(output);
