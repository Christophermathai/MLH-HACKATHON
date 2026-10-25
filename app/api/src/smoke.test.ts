import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayServer } from "./server.js";

test("e2e smoke: server starts up and responds to health endpoint", async () => {
  const gateway = createGatewayServer({
    port: 8798,
    host: "127.0.0.1",
    providerMode: "mock",
    allowedOrigins: ["http://localhost:3000"],
  });

  await gateway.start();
  try {
    const res = await fetch("http://127.0.0.1:8798/health");
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.status, "ok");
    assert.equal(data.mode, "mock");
  } finally {
    await gateway.close();
  }
});
