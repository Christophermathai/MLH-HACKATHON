import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGatewayServer } from "./server.js";

const port = 8795;
const host = "127.0.0.1";

test("browser-to-gateway smoke exchange: bootstrap, claims, and WebSocket session", async () => {
  const gateway = createGatewayServer({
    port,
    host,
    providerMode: "mock",
    allowedOrigins: ["http://localhost:3000"],
  });

  await gateway.start();

  try {
    // 1. Health check
    const healthRes = await fetch(`http://${host}:${port}/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as any;
    assert.equal(health.status, "ok");
    assert.equal(health.mode, "mock");

    // 2. Room creation (Person A)
    const createRes = await fetch(`http://${host}:${port}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.equal(createRes.status, 201);
    const roomA = (await createRes.json()) as any;
    assert.equal(roomA.side, "A");
    assert.equal(typeof roomA.room, "string");
    assert.equal(roomA.room.length, 8);
    assert.ok(roomA.resumeToken);

    // 3. Side B claim
    const claimRes = await fetch(`http://${host}:${port}/api/rooms/${roomA.room}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "B" }),
    });
    assert.equal(claimRes.status, 201);
    const roomB = (await claimRes.json()) as any;
    assert.equal(roomB.side, "B");
    assert.equal(roomB.room, roomA.room);
    assert.ok(roomB.resumeToken);

    // 4. Repeated Side B claim rejected with 409 SIDE_TAKEN
    const repeatClaimRes = await fetch(`http://${host}:${port}/api/rooms/${roomA.room}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "B" }),
    });
    assert.equal(repeatClaimRes.status, 409);
    const conflict = (await repeatClaimRes.json()) as any;
    assert.equal(conflict.code, "SIDE_TAKEN");

    // 5. WebSocket join with valid token receives session snapshot
    const wsA = new WebSocket(`ws://${host}:${port}/ws`, {
      headers: { Origin: "http://localhost:3000" },
    });

    await new Promise<void>((resolve, reject) => {
      wsA.on("open", () => resolve());
      wsA.on("error", reject);
    });

    const snapshotPromise = new Promise<any>((resolve) => {
      wsA.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "session_snapshot") {
          resolve(msg);
        }
      });
    });

    wsA.send(
      JSON.stringify({
        v: 1,
        type: "join",
        payload: {
          room: roomA.room,
          side: "A",
          resumeToken: roomA.resumeToken,
        },
      })
    );

    const snapshotMsg = await snapshotPromise;
    assert.equal(snapshotMsg.type, "session_snapshot");
    assert.equal(snapshotMsg.payload.room, roomA.room);
    assert.equal(snapshotMsg.payload.side, "A");
    assert.equal(snapshotMsg.payload.ownState, "IDLE");

    // 6. WebSocket typed input and confirmation
    const finalTranscriptPromise = new Promise<any>((resolve) => {
      wsA.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "final_transcript") {
          resolve(msg);
        }
      });
    });

    wsA.send(JSON.stringify({ v: 1, type: "start_typed_input", payload: {} }));
    const finalTranscript = await finalTranscriptPromise;
    assert.equal(finalTranscript.type, "final_transcript");

    const sideReadyPromise = new Promise<any>((resolve) => {
      wsA.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "side_ready") {
          resolve(msg);
        }
      });
    });

    wsA.send(
      JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: {
          text: "He leaves plates in the sink.",
          consent: true,
        },
      })
    );

    const sideReady = await sideReadyPromise;
    assert.equal(sideReady.type, "side_ready");
    assert.equal(sideReady.payload.side, "A");

    wsA.close();

    // 7. WebSocket join with invalid token rejected with UNAUTHORIZED
    const wsUnauthorized = new WebSocket(`ws://${host}:${port}/ws`, {
      headers: { Origin: "http://localhost:3000" },
    });

    await new Promise<void>((resolve, reject) => {
      wsUnauthorized.on("open", () => resolve());
      wsUnauthorized.on("error", reject);
    });

    const errorPromise = new Promise<any>((resolve) => {
      wsUnauthorized.on("message", (raw) => {
        resolve(JSON.parse(raw.toString()));
      });
    });

    wsUnauthorized.send(
      JSON.stringify({
        v: 1,
        type: "join",
        payload: {
          room: roomA.room,
          side: "A",
          resumeToken: "bad-token-1234567890abcdef1234567890abcdef",
        },
      })
    );

    const errorMsg = await errorPromise;
    assert.equal(errorMsg.type, "error");
    assert.equal(errorMsg.payload.code, "UNAUTHORIZED");

    wsUnauthorized.close();
  } finally {
    await gateway.close();
  }
});
