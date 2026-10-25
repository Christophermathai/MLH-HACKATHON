import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, isOriginAllowed } from "./config.js";

test("loadConfig in mock mode succeeds with defaults and no API keys", () => {
  const config = loadConfig({
    PROVIDER_MODE: "mock",
  });
  assert.equal(config.port, 8787);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.providerMode, "mock");
  assert.deepEqual(config.allowedOrigins, [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
});

test("loadConfig in live mode throws clear error when credentials are missing", () => {
  assert.throws(
    () => {
      loadConfig({
        PROVIDER_MODE: "live",
      });
    },
    {
      message: /Missing required live configuration: OPENAI_API_KEY, ELEVENLABS_API_KEY/,
    }
  );
});

test("loadConfig in live mode succeeds when credentials are provided", () => {
  const config = loadConfig({
    PROVIDER_MODE: "live",
    OPENAI_API_KEY: "test-openai-key",
    ELEVENLABS_API_KEY: "test-eleven-key",
  });
  assert.equal(config.providerMode, "live");
  assert.equal(config.openaiApiKey, "test-openai-key");
  assert.equal(config.elevenlabsApiKey, "test-eleven-key");
});

test("isOriginAllowed validates allowed origins and rejects untrusted origins", () => {
  const allowed = ["http://localhost:3000", "http://127.0.0.1:3000"];
  assert.equal(isOriginAllowed(undefined, allowed), true);
  assert.equal(isOriginAllowed("http://localhost:3000", allowed), true);
  assert.equal(isOriginAllowed("http://127.0.0.1:3000", allowed), true);
  assert.equal(isOriginAllowed("http://malicious-site.com", allowed), false);
});
