import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGatewayServer } from "./server.js";

const testConfig = {
  port: 8799,
  host: "127.0.0.1",
  providerMode: "mock" as const,
  allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
};

test("gateway server handles health and origin validation", async () => {
  const gateway = createGatewayServer(testConfig);
  await gateway.start();

  try {
    // 1. GET /health with allowed origin
    const resAllowed = await fetch(`http://${testConfig.host}:${testConfig.port}/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(resAllowed.status, 200);
    const bodyAllowed = (await resAllowed.json()) as any;
    assert.equal(bodyAllowed.status, "ok");
    assert.equal(bodyAllowed.mode, "mock");

    // 2. GET /health with forbidden origin
    const resForbidden = await fetch(`http://${testConfig.host}:${testConfig.port}/health`, {
      headers: { Origin: "http://malicious.example.com" },
    });
    assert.equal(resForbidden.status, 403);

    // 3. WebSocket connect with allowed origin
    const ws = new WebSocket(`ws://${testConfig.host}:${testConfig.port}/ws`, {
      headers: { Origin: "http://localhost:3000" },
    });

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });

    const pongPromise = new Promise<any>((resolve) => {
      ws.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    ws.send(JSON.stringify({ v: 1, type: "ping", requestId: "req-1" }));
    const pong = await pongPromise;
    assert.equal(pong.type, "pong");
    assert.equal(pong.requestId, "req-1");
    ws.close();

    // 4. WebSocket connect with forbidden origin rejected
    await assert.rejects(
      async () => {
        const forbiddenWs = new WebSocket(`ws://${testConfig.host}:${testConfig.port}/ws`, {
          headers: { Origin: "http://evil.com" },
        });
        await new Promise<void>((resolve, reject) => {
          forbiddenWs.on("open", () => resolve());
          forbiddenWs.on("unexpected-response", (req, res) => {
            if (res.statusCode === 403) {
              reject(new Error("403 Forbidden"));
            }
          });
          forbiddenWs.on("error", reject);
        });
      },
      { message: /403/ }
    );
  } finally {
    await gateway.close();
  }
});
