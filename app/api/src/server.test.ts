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

test("Gateway Server Suite", async (t) => {
  await t.test("handles health and origin validation", async () => {
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

  await t.test("handles audio recording and emits final_transcript", async () => {
    const recordTestConfig = {
      ...testConfig,
      port: 8798,
    };

    const customStt = {
      batch: async (audio: Buffer, mime: string) => {
        assert.ok(audio.length > 0, "Expected non-empty audio buffer");
        assert.equal(mime, "audio/webm");
        return { text: "എനിക്ക് ഈ കരാറിൽ പൂർണ്ണ സമ്മതമാണ്." };
      },
    };

    const gateway = createGatewayServer(recordTestConfig, { stt: customStt });
    await gateway.start();

    try {
      // 1. Create a room
      const createRes = await fetch(`http://${recordTestConfig.host}:${recordTestConfig.port}/api/rooms`, {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
      });
      const { room, resumeToken } = (await createRes.json()) as any;

      // 2. Connect WebSocket
      const ws = new WebSocket(`ws://${recordTestConfig.host}:${recordTestConfig.port}/ws`, {
        headers: { Origin: "http://localhost:3000" },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
      });

      const messages: any[] = [];
      ws.on("message", (data) => {
        try {
          const m = JSON.parse(data.toString());
          messages.push(m);
        } catch {}
      });

      function waitForMessage(type: string): Promise<any> {
        return new Promise((resolve) => {
          const found = messages.find((m) => m.type === type);
          if (found) return resolve(found);
          const onMsg = (data: any) => {
            try {
              const parsed = JSON.parse(data.toString());
              if (parsed.type === type) {
                ws.off("message", onMsg);
                resolve(parsed);
              }
            } catch {}
          };
          ws.on("message", onMsg);
        });
      }

      // 3. Join as Side A
      const snapshotPromise = waitForMessage("session_snapshot");
      ws.send(JSON.stringify({
        v: 1,
        type: "join",
        payload: { room, side: "A", resumeToken },
      }));

      const joinSnapshot = await snapshotPromise;
      assert.ok(joinSnapshot, "Expected initial session_snapshot");
      assert.equal(joinSnapshot.payload.ownState, "IDLE");

      // 4. Start recording
      const startedPromise = waitForMessage("recording_started");
      ws.send(JSON.stringify({
        v: 1,
        type: "start_recording",
        payload: { mode: "batch", mime: "audio/webm" },
      }));

      const started = await startedPromise;
      assert.ok(started, "Expected recording_started response");

      // 5. Send binary audio chunks
      const chunk1 = Buffer.from([1, 2, 3, 4]);
      const chunk2 = Buffer.from([5, 6, 7, 8]);
      ws.send(chunk1);
      ws.send(chunk2);

      // 6. Stop recording
      const finalPromise = waitForMessage("final_transcript");
      ws.send(JSON.stringify({
        v: 1,
        type: "stop_recording",
        payload: {},
      }));

      const finalTranscriptMsg = await finalPromise;
      assert.ok(finalTranscriptMsg, "Expected final_transcript message from server");
      assert.equal(finalTranscriptMsg.payload.text, "എനിക്ക് ഈ കരാറിൽ പൂർണ്ണ സമ്മതമാണ്.");

      // Verify snapshot was updated to REVIEW state
      const reviewSnapshot = messages
        .filter((m) => m.type === "session_snapshot")
        .slice(-1)[0];
      assert.equal(reviewSnapshot.payload.ownState, "REVIEW");

      await new Promise<void>((r) => {
        ws.on("close", () => r());
        ws.close();
      });
    } finally {
      await gateway.close();
    }
  });
});
