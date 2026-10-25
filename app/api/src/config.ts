import dotenv from "dotenv";

dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  providerMode: "mock" | "live";
  allowedOrigins: string[];
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

  const openaiApiKey = env.OPENAI_API_KEY?.trim() || undefined;
  const elevenlabsApiKey = env.ELEVENLABS_API_KEY?.trim() || undefined;
  const elevenlabsVoiceId = env.ELEVENLABS_VOICE_ID?.trim() || undefined;

  if (providerMode === "live") {
    const missing: string[] = [];
    if (!openaiApiKey) missing.push("OPENAI_API_KEY");
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
