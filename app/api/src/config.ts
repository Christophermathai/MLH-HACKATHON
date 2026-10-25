import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") }); // app/api/.env (when built in dist)
dotenv.config({ path: path.resolve(__dirname, "../../.env") }); // root .env
dotenv.config({ path: path.resolve(process.cwd(), "app/api/.env") });
dotenv.config(); // CWD .env

export interface ServerConfig {
  port: number;
  host: string;
  providerMode: "mock" | "live";
  allowedOrigins: string[];
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  openaiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const port = parseInt(env.PORT || "8787", 10);
  const host = env.HOST || "127.0.0.1";
  const rawMode = (env.PROVIDER_MODE || "mock").toLowerCase();
  if (rawMode !== "mock" && rawMode !== "live") {
    throw new Error(`Invalid PROVIDER_MODE "${rawMode}". Must be "mock" or "live".`);
  }
  const providerMode = rawMode as "mock" | "live";

  const rawOrigins = env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000";
  const allowedOrigins = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const llmApiKey = (
    env.LLM_API_KEY ||
    env.DIGITALOCEAN_ACCESS_TOKEN ||
    env.DO_ACCESS_TOKEN ||
    env.GEMINI_API_KEY ||
    env.GROQ_API_KEY ||
    env.OPENAI_API_KEY
  )?.trim() || undefined;

  const llmBaseUrl = (
    env.LLM_BASE_URL ||
    (env.DIGITALOCEAN_ACCESS_TOKEN || env.DO_ACCESS_TOKEN ? "https://inference.do-ai.run/v1" : undefined) ||
    (env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined) ||
    (env.GEMINI_API_KEY ? "https://generativelanguage.googleapis.com/v1beta/openai" : undefined) ||
    (env.OLLAMA_BASE_URL ? env.OLLAMA_BASE_URL : undefined) ||
    "https://api.openai.com/v1"
  ).trim();

  const llmModel = (
    env.LLM_MODEL ||
    (env.DIGITALOCEAN_ACCESS_TOKEN || env.DO_ACCESS_TOKEN ? "gemma-4-31B-it" : undefined) ||
    (env.GROQ_API_KEY ? "gemma2-9b-it" : undefined) ||
    (env.GEMINI_API_KEY ? "gemma-2-9b-it" : undefined) ||
    (env.OLLAMA_BASE_URL ? "gemma2" : undefined) ||
    "gemma-2-9b-it"
  ).trim();

  const openaiApiKey = env.OPENAI_API_KEY?.trim() || llmApiKey;
  const elevenlabsApiKey = env.ELEVENLABS_API_KEY?.trim() || undefined;
  const elevenlabsVoiceId = env.ELEVENLABS_VOICE_ID?.trim() || undefined;

  if (providerMode === "live") {
    const missing: string[] = [];
    const isLocalOllama = llmBaseUrl.includes("11434");
    if (!llmApiKey && !isLocalOllama) {
      missing.push("OPENAI_API_KEY");
    }
    if (!elevenlabsApiKey) missing.push("ELEVENLABS_API_KEY");
    if (missing.length > 0) {
      throw new Error(
        `Missing required live configuration: ${missing.join(", ")}. Set these variables or run with PROVIDER_MODE=mock.`
      );
    }
  }

  return {
    port,
    host,
    providerMode,
    allowedOrigins,
    llmApiKey,
    llmBaseUrl,
    llmModel,
    openaiApiKey,
    elevenlabsApiKey,
    elevenlabsVoiceId,
  };
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.") ||
      host.endsWith(".devtunnels.ms") ||
      host === "devtunnels.ms" ||
      host.includes("ngrok")
    ) {
      return true;
    }
  } catch {}
  return false;
}
