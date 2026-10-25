import { access, readFile } from "node:fs/promises";
import path from "node:path";

export function repositoryRoot() {
  return path.resolve(process.cwd(), "../..");
}

export function manifestPath() {
  return path.join(repositoryRoot(), "scripts", "provider-spike", "sample-manifest.json");
}

export function whisperScriptPath() {
  return path.join(repositoryRoot(), "scripts", "provider-spike", "transcribe_whisper.py");
}

export async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

export async function resolveElevenLabsConfig(): Promise<{
  apiKey: string | undefined;
  modelId: string;
  languageCode: string;
}> {
  let apiKey = process.env.ELEVENLABS_API_KEY?.trim() || undefined;
  let modelId = process.env.ELEVENLABS_STT_MODEL_ID?.trim() || undefined;
  let languageCode = process.env.ELEVENLABS_STT_LANGUAGE_CODE?.trim() || undefined;

  if (!apiKey) {
    const candidateFiles = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.join(repositoryRoot(), ".env"),
    ];
    for (const file of candidateFiles) {
      try {
        const content = await readFile(/* turbopackIgnore: true */ file, "utf8");
        const parsed = parseEnvContent(content);
        if (!apiKey && parsed.ELEVENLABS_API_KEY) apiKey = parsed.ELEVENLABS_API_KEY;
        if (!modelId && parsed.ELEVENLABS_STT_MODEL_ID) modelId = parsed.ELEVENLABS_STT_MODEL_ID;
        if (!languageCode && parsed.ELEVENLABS_STT_LANGUAGE_CODE) languageCode = parsed.ELEVENLABS_STT_LANGUAGE_CODE;
        if (apiKey) break;
      } catch {
        // Ignore missing env file
      }
    }
  }

  return {
    apiKey,
    modelId: modelId || "scribe_v1",
    languageCode: languageCode || "mal",
  };
}
