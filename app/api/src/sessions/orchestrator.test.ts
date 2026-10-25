import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGatewayServer } from "../server.js";
import { loadConfig } from "../config.js";
import {
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "../providers/fakeProviders.js";

test("Feature 006 & 007 - End-to-end Pipeline, Safety Gate, and Spoken Verdict", async (t) => {
  await t.test("Full flow: both sides confirm, mediator produces shared result, judge streams, TTS chunks delivered", async () => {
    const config = loadConfig({
      PORT: "9877",
      HOST: "127.0.0.1",
      PROVIDER_MODE: "mock",
    });

    const gateway = createGatewayServer(config, {
      analyst: new FakeAnalystProvider(),
      mediator: new FakeMediatorProvider({ pettyScore: 7 }),
      judge: new FakeJudgeStreamProvider(),
      tts: new FakeTtsProvider(),
    });
    await gateway.start();

    try {
      // 1. Create Room
      const resCreate = await fetch("http://127.0.0.1:9877/api/rooms", { method: "POST" });
      const { room, resumeToken: tokenA } = (await resCreate.json()) as any;

      // 2. Claim Side B
      const resClaim = await fetch(`http://127.0.0.1:9877/api/rooms/${room}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });
      const { resumeToken: tokenB } = (await resClaim.json()) as any;

      // 3. Connect Sockets
      const wsA = new WebSocket("ws://127.0.0.1:9877/ws");
      const wsB = new WebSocket("ws://127.0.0.1:9877/ws");
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

      // Side A confirms
      wsA.send(JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: { text: "സിങ്ക് നിറയെ പാത്രങ്ങൾ ഇട്ടിട്ട് അവൻ ടിവി കാണുകയായിരുന്നു.", consent: true },
      }));
      await new Promise((r) => setTimeout(r, 60));

      // Side B confirms -> triggers BOTH_READY & pipeline!
      wsB.send(JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: { text: "ഞാൻ ഓഫീസിൽ നിന്ന് വന്ന് ക്ഷീണിച്ചു ഇരിക്കുകയായിരുന്നു.", consent: true },
      }));

      // Wait for pipeline execution
      await new Promise((r) => setTimeout(r, 250));

      // Verify both received `both_ready`
      assert.ok(eventsA.some((e) => e.type === "both_ready"));
      assert.ok(eventsB.some((e) => e.type === "both_ready"));

      // Verify mediator analysis_json
      const analysisA = eventsA.find((e) => e.type === "analysis_json");
      assert.ok(analysisA, "Side A should receive analysis_json");
      assert.equal(analysisA.payload.petty_score, 7);
      assert.equal(analysisA.payload.truce.requires_apology, false);

      // Verify streamed judge text
      const deltasA = eventsA.filter((e) => e.type === "verdict_text_delta");
      assert.ok(deltasA.length > 0, "Side A should receive verdict_text_delta");

      // Verify audio chunks
      const audioChunksA = eventsA.filter((e) => e.type === "audio_chunk");
      assert.ok(audioChunksA.length > 0, "Side A should receive audio chunks");
      assert.equal(audioChunksA[0].payload.seq, 0);

      // Verify manifest and completion
      const manifestEvent = eventsA.find((e) => e.type === "audio_manifest");
      assert.ok(manifestEvent, "Should receive audio_manifest");
      assert.equal(manifestEvent.payload.textComplete, true);

      const doneEvent = eventsA.find((e) => e.type === "done");
      assert.ok(doneEvent, "Should receive done event");
      assert.equal(doneEvent.payload.outcome, "verdict");

      // Test Free Replay (FR-007-06): replay_audio sends cached chunks
      eventsA.length = 0;
      wsA.send(JSON.stringify({ v: 1, type: "replay_audio", payload: {} }));
      await new Promise((r) => setTimeout(r, 60));

      const replayedChunks = eventsA.filter((e) => e.type === "audio_chunk");
      assert.equal(replayedChunks.length, audioChunksA.length, "Replay should return all cached audio chunks");
      assert.ok(eventsA.some((e) => e.type === "done"));

      wsA.close();
      wsB.close();
    } finally {
      await gateway.close();
    }
  });

  await t.test("Safety Gate: When abuse or coercion is flagged, bypasses mediator/judge/TTS and returns calm safety response", async () => {
    const config = loadConfig({
      PORT: "9878",
      HOST: "127.0.0.1",
      PROVIDER_MODE: "mock",
    });

    let mediatorCalled = false;
    let judgeCalled = false;
    let ttsCalled = false;

    class FlaggedAnalyst extends FakeAnalystProvider {
      async analyze(side: "A" | "B", confirmedText: string) {
        if (side === "A") {
          return {
            side,
            upset_about: ["Severe threats"],
            stated_facts: [confirmedText],
            assumptions_made: [],
            possible_feelings: ["Afraid"],
            unclear_lines: [],
            safety_flags: {
              abuse_or_coercion_signals: true,
              notes: "Domestic violence and coercion signals detected.",
            },
          };
        }
        return super.analyze(side, confirmedText);
      }
    }

    class MonitoredMediator extends FakeMediatorProvider {
      async mediate(a: any, b: any) {
        mediatorCalled = true;
        return super.mediate(a, b);
      }
    }

    class MonitoredJudge extends FakeJudgeStreamProvider {
      async streamVerdict(m: any, s: any, cb: any) {
        judgeCalled = true;
        return super.streamVerdict(m, s, cb);
      }
    }

    class MonitoredTts extends FakeTtsProvider {
      async synthesizeSentence(seq: number, text: string) {
        ttsCalled = true;
        return super.synthesizeSentence(seq, text);
      }
    }

    const gateway = createGatewayServer(config, {
      analyst: new FlaggedAnalyst(),
      mediator: new MonitoredMediator(),
      judge: new MonitoredJudge(),
      tts: new MonitoredTts(),
    });
    await gateway.start();

    try {
      const resCreate = await fetch("http://127.0.0.1:9878/api/rooms", { method: "POST" });
      const { room, resumeToken: tokenA } = (await resCreate.json()) as any;

      const resClaim = await fetch(`http://127.0.0.1:9878/api/rooms/${room}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "B" }),
      });
      const { resumeToken: tokenB } = (await resClaim.json()) as any;

      const wsA = new WebSocket("ws://127.0.0.1:9878/ws");
      const wsB = new WebSocket("ws://127.0.0.1:9878/ws");
      await Promise.all([
        new Promise((resolve) => wsA.on("open", resolve)),
        new Promise((resolve) => wsB.on("open", resolve)),
      ]);

      const eventsA: any[] = [];
      wsA.on("message", (raw) => eventsA.push(JSON.parse(raw.toString())));

      wsA.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "A", resumeToken: tokenA } }));
      wsB.send(JSON.stringify({ v: 1, type: "join", payload: { room, side: "B", resumeToken: tokenB } }));
      await new Promise((r) => setTimeout(r, 60));

      // Both confirm
      wsA.send(JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: { text: "അവൻ എന്നെ ഭീഷണിപ്പെടുത്തി.", consent: true },
      }));
      wsB.send(JSON.stringify({
        v: 1,
        type: "confirm_transcript",
        payload: { text: "സാധാരണ ഒരു സംസാരം ആയിരുന്നു.", consent: true },
      }));

      await new Promise((r) => setTimeout(r, 200));

      // Verify Safety branch was taken
      const safetyEvent = eventsA.find((e) => e.type === "safety_result");
      assert.ok(safetyEvent, "Should receive safety_result event");
      assert.ok(safetyEvent.payload.message.includes("പെറ്റി കോടതിക്ക് അപ്പുറമുള്ള"));

      const doneEvent = eventsA.find((e) => e.type === "done");
      assert.ok(doneEvent);
      assert.equal(doneEvent.payload.outcome, "safety");

      // CRITICAL SAFETY ASSERTIONS (FR-006-04):
      assert.equal(mediatorCalled, false, "Mediator must NOT be called on safety flags");
      assert.equal(judgeCalled, false, "Judge must NOT be called on safety flags");
      assert.equal(ttsCalled, false, "TTS must NOT be called on safety flags");
      assert.equal(eventsA.some((e) => e.type === "analysis_json"), false, "No petty score or playful mediator output");

      wsA.close();
      wsB.close();
    } finally {
      await gateway.close();
    }
  });
});
