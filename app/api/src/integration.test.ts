import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGatewayServer } from "./server.js";
import { loadConfig } from "./config.js";
import {
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "./providers/fakeProviders.js";

test("Feature 008 - End-to-End Integration, Recovery, and Security Tests", async (t) => {
  const config = loadConfig({
    PORT: "9879",
    HOST: "127.0.0.1",
    PROVIDER_MODE: "mock",
  });

  const gateway = createGatewayServer(config, {
    analyst: new FakeAnalystProvider(),
    mediator: new FakeMediatorProvider({ pettyScore: 8 }),
    judge: new FakeJudgeStreamProvider(),
    tts: new FakeTtsProvider(),
  });
  await gateway.start();

  try {
    await t.test("FR-008-01 & AC-008-01: Two-participant full journey from room creation to audio playback", async () => {
      // 1. Participant A creates room
      const resCreate = await fetch("http://127.0.0.1:9879/api/rooms", { method: "POST" });
      assert.equal(resCreate.status, 201);
      const { room, resumeToken: tokenA } = (await resCreate.json()) as any;

      // 2. Participant B claims Side B
      const resClaim = await fetch(`http://127.0.0.1:9879/api/rooms/${room}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });
      assert.equal(resClaim.status, 201);
      const { resumeToken: tokenB } = (await resClaim.json()) as any;

      // 3. Both connect over WebSocket
      const wsA = new WebSocket("ws://127.0.0.1:9879/ws");
      const wsB = new WebSocket("ws://127.0.0.1:9879/ws");
      await Promise.all([
        new Promise((resolve) => wsA.on("open", resolve)),
        new Promise((resolve) => wsB.on("open", resolve)),
      ]);

      const eventsA: any[] = [];
      const eventsB: any[] = [];
      wsA.on("message", (raw) => eventsA.push(JSON.parse(raw.toString())));
      wsB.on("message", (raw) => eventsB.push(JSON.parse(raw.toString())));

      // Join
      wsA.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "A", resumeToken: tokenA } }));
      wsB.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "B", resumeToken: tokenB } }));
      await new Promise((r) => setTimeout(r, 60));

      // Side A switches to typed input
      wsA.send(JSON.stringify({ v: 1, type: "start_typed_input", payload: {} }));
      await new Promise((r) => setTimeout(r, 40));

      // Side A confirms transcript
      wsA.send(JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: { text: "അവൻ എപ്പോഴും ഫ്രിഡ്ജ് തുറന്നിട്ട് മറന്നുപോകുന്നു.", consent: true },
      }));
      await new Promise((r) => setTimeout(r, 60));

      // Side A is ready, but pipeline must NOT start before Side B confirms (AC-008-01)
      assert.ok(eventsA.some((e) => e.type === "side_ready" && e.payload.side === "A"));
      assert.equal(eventsA.some((e) => e.type === "analysis_json"), false);

      // Side B confirms transcript
      wsB.send(JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: { text: "ഞാൻ വെള്ളം എടുക്കാൻ പോയപ്പോൾ ഫോൺ ബെല്ലടിച്ചു.", consent: true },
      }));

      // Wait for complete pipeline execution
      await new Promise((r) => setTimeout(r, 300));

      // Both receive `both_ready`
      assert.ok(eventsA.some((e) => e.type === "both_ready"));
      assert.ok(eventsB.some((e) => e.type === "both_ready"));

      // Both receive `analysis_json`
      const analysisA = eventsA.find((e) => e.type === "analysis_json");
      const analysisB = eventsB.find((e) => e.type === "analysis_json");
      assert.ok(analysisA);
      assert.ok(analysisB);
      assert.equal(analysisA.payload.petty_score, 8);
      assert.equal(analysisA.payload.truce.requires_apology, false);

      // Both receive streamed judge deltas
      const deltasA = eventsA.filter((e) => e.type === "verdict_text_delta");
      assert.ok(deltasA.length > 0);

      // Both receive audio chunks
      const audioChunksA = eventsA.filter((e) => e.type === "audio_chunk");
      assert.ok(audioChunksA.length > 0);

      // Manifest and completion
      const manifest = eventsA.find((e) => e.type === "audio_manifest");
      assert.ok(manifest);
      assert.equal(manifest.payload.textComplete, true);

      const done = eventsA.find((e) => e.type === "done");
      assert.ok(done);
      assert.equal(done.payload.outcome, "verdict");

      wsA.close();
      wsB.close();
    });

    await t.test("FR-008-02 & AC-008-02: Security isolation, unauthorized claims, and invalid tokens", async () => {
      // 1. Create Room
      const resCreate = await fetch("http://127.0.0.1:9879/api/rooms", { method: "POST" });
      const { room } = (await resCreate.json()) as any;

      // 2. Claim Side B
      await fetch(`http://127.0.0.1:9879/api/rooms/${room}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });

      // 3. Attempt to claim Side B AGAIN (Must fail with 409 SIDE_TAKEN)
      const resDoubleClaim = await fetch(`http://127.0.0.1:9879/api/rooms/${room}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });
      assert.equal(resDoubleClaim.status, 409);
      const errClaim = (await resDoubleClaim.json()) as any;
      assert.equal(errClaim.code, "SIDE_TAKEN");

      // 4. Attempt to join with invalid resume token (Must be rejected with UNAUTHORIZED)
      const ws = new WebSocket("ws://127.0.0.1:9879/ws");
      await new Promise((resolve) => ws.on("open", resolve));

      const received: any[] = [];
      ws.on("message", (raw) => received.push(JSON.parse(raw.toString())));

      ws.send(JSON.stringify({
        v: 1,
        type: "join",
        payload: {
          room,
          side: "A",
          resumeToken: "0000000000000000000000000000000000000000000000000000000000000000",
        },
      }));

      await new Promise((r) => setTimeout(r, 60));
      const errEvent = received.find((e) => e.type === "error");
      assert.ok(errEvent);
      assert.equal(errEvent.payload.code, "UNAUTHORIZED");

      ws.close();
    });

    await t.test("FR-008-04 & AC-008-04: Reconnect recovery restores authoritative state and audio replay", async () => {
      // 1. Create Room
      const resCreate = await fetch("http://127.0.0.1:9879/api/rooms", { method: "POST" });
      const { room, resumeToken: tokenA } = (await resCreate.json()) as any;

      // Claim Side B
      const resClaim = await fetch(`http://127.0.0.1:9879/api/rooms/${room}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });
      const { resumeToken: tokenB } = (await resClaim.json()) as any;

      // Join and confirm both
      const wsA = new WebSocket("ws://127.0.0.1:9879/ws");
      const wsB = new WebSocket("ws://127.0.0.1:9879/ws");
      await Promise.all([
        new Promise((resolve) => wsA.on("open", resolve)),
        new Promise((resolve) => wsB.on("open", resolve)),
      ]);

      wsA.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "A", resumeToken: tokenA } }));
      wsB.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "B", resumeToken: tokenB } }));
      await new Promise((r) => setTimeout(r, 60));

      wsA.send(JSON.stringify({ v: 1, type: "confirm_transcript", payload: { text: "Text A", consent: true } }));
      wsB.send(JSON.stringify({ v: 1, type: "confirm_transcript", payload: { text: "Text B", consent: true } }));

      await new Promise((r) => setTimeout(r, 250));

      // Side A disconnects
      wsA.close();
      await new Promise((r) => setTimeout(r, 50));

      // Side A reconnects with original resume token
      const wsA2 = new WebSocket("ws://127.0.0.1:9879/ws");
      await new Promise((resolve) => wsA2.on("open", resolve));

      const reconEvents: any[] = [];
      wsA2.on("message", (raw) => reconEvents.push(JSON.parse(raw.toString())));

      wsA2.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "A", resumeToken: tokenA } }));
      await new Promise((r) => setTimeout(r, 60));

      // Snapshot must contain authoritative state, sharedResult, and audioManifest
      const snapshot = reconEvents.find((e) => e.type === "session_snapshot");
      assert.ok(snapshot, "Reconnect must receive session_snapshot");
      assert.equal(snapshot.payload.ownConfirmed, true);
      assert.equal(snapshot.payload.sessionState, "RESOLVED");
      assert.ok(snapshot.payload.sharedResult);
      assert.ok(snapshot.payload.audioManifest);

      // Replay audio over reconnected socket
      reconEvents.length = 0;
      wsA2.send(JSON.stringify({ v: 1, type: "replay_audio", payload: {} }));
      await new Promise((r) => setTimeout(r, 60));

      const replayedChunks = reconEvents.filter((e) => e.type === "audio_chunk");
      assert.ok(replayedChunks.length > 0, "Reconnected client should receive replayed chunks");
      assert.ok(reconEvents.some((e) => e.type === "done"));

      wsA2.close();
      wsB.close();
    });
  } finally {
    await gateway.close();
  }
});

