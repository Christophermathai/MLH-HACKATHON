import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(process.argv[2] ?? "scripts/provider-spike/sample-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const requiredScenarios = new Set([
  "Malayalam-only everyday speech",
  "Malayalam-English code switching",
  "Hesitation and an intentionally unclear phrase",
  "Malayalam speech with ordinary room noise",
  "Everyday petty disagreement",
]);

if (manifest.model !== "openai/whisper-large-v3") throw new Error("Unexpected model");
if (!Array.isArray(manifest.samples) || manifest.samples.length !== 5) {
  throw new Error("Manifest must contain exactly five samples");
}

const ids = new Set();
for (const sample of manifest.samples) {
  for (const field of ["id", "scenario", "audioPath", "referenceText", "provenance", "permission", "status"]) {
    if (typeof sample[field] !== "string" || sample[field].trim() === "") {
      throw new Error(`${sample.id ?? "sample"}: missing ${field}`);
    }
  }
  if (!Number.isFinite(sample.expectedDurationSeconds) || sample.expectedDurationSeconds <= 0) {
    throw new Error(`${sample.id}: expectedDurationSeconds must be positive`);
  }
  if (sample.durationSeconds !== null && (!Number.isFinite(sample.durationSeconds) || sample.durationSeconds <= 0)) {
    throw new Error(`${sample.id}: durationSeconds must be null or positive`);
  }
  if (!sample.audioPath.startsWith("samples-private/")) {
    throw new Error(`${sample.id}: audio must stay under samples-private`);
  }
  if (ids.has(sample.id)) throw new Error(`Duplicate sample id: ${sample.id}`);
  ids.add(sample.id);
  requiredScenarios.delete(sample.scenario);
}

if (requiredScenarios.size) throw new Error(`Missing scenarios: ${[...requiredScenarios].join(", ")}`);
console.log(`Manifest valid: ${manifest.samples.length} samples for ${manifest.model}`);
