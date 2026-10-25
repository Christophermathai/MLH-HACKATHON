import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGatewayServer } from "../server.js";
import { loadConfig } from "../config.js";
import {
  parseClientMessage,
  createServerMessage,
  ClientConfirmTranscriptPayloadSchema,
} from "@zoomout/contracts";

test("Feature 005 - Confirmation validation and consent contracts", async (t) => {
  await t.test("accepts valid Malayalam transcript with consent:true", () => {
    const valid = {
      text: "ഇന്ന് ചായ ഉണ്ടാക്കാമെന്ന് പറഞ്ഞിട്ട് നീ മറന്നുപോയി.",
      consent: true,
    };
    const parsed = ClientConfirmTranscriptPayloadSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.text, valid.text);
      assert.equal(parsed.data.consent, true);
    }
  });

  await t.test("rejects missing consent or consent:false", () => {
    const invalidNoConsent = {
      text: "Valid text",
      consent: false,
    };
    const parsed = ClientConfirmTranscriptPayloadSchema.safeParse(invalidNoConsent);
    assert.equal(parsed.success, false);
  });

  await t.test("rejects empty or whitespace-only transcript", () => {
    const empty = { text: "   ", consent: true };
    const parsed = ClientConfirmTranscriptPayloadSchema.safeParse(empty);
    assert.equal(parsed.success, false);
  });

  await t.test("rejects oversized transcript exceeding 4000 code points", () => {
    const oversized = { text: "അ".repeat(4001), consent: true };
    const parsed = ClientConfirmTranscriptPayloadSchema.safeParse(oversized);
    assert.equal(parsed.success, false);
  });

  await t.test("gateway handles confirm_transcript, locks text, and emits side_ready", async () => {
    const config = loadConfig({
      PORT: "9876",
      HOST: "127.0.0.1",
      PROVIDER_MODE: "mock",
    });
    const gateway = createGatewayServer(config);
    await gateway.start();

    try {
      // 1. Create Room
      const resCreate = await fetch("http://127.0.0.1:9876/api/rooms", { method: "POST" });
      const roomData = (await resCreate.json()) as any;
      const { room, resumeToken } = roomData;

      // 2. Connect WebSocket
      const ws = new WebSocket("ws://127.0.0.1:9876/ws");
      await new Promise((resolve) => ws.on("open", resolve));

      const received: any[] = [];
      ws.on("message", (raw) => {
        received.push(JSON.parse(raw.toString()));
      });

      // Join
      ws.send(
        JSON.stringify({
          v: 1,
          type: "join",
          payload: { room, side: "A", resumeToken },
        })
      );
      await new Promise((r) => setTimeout(r, 60));

      // Confirm transcript
      ws.send(
        JSON.stringify({
          v: 1,
          type: "confirm_transcript",
          payload: {
            text: "ഞാൻ പറഞ്ഞത് സത്യമാണ്.",
            consent: true,
          },
        })
      );
      await new Promise((r) => setTimeout(r, 60));

      const sideReadyEvent = received.find((m) => m.type === "side_ready");
      assert.ok(sideReadyEvent, "Should emit side_ready event");
      assert.equal(sideReadyEvent.payload.side, "A");

      // Verify server room state
      const serverRoom = gateway.rooms.get(room);
      assert.ok(serverRoom);
      assert.equal(serverRoom.confirmed.A, true);
      assert.equal(serverRoom.consent.A, true);
      assert.equal(serverRoom.transcripts.A, "ഞാൻ പറഞ്ഞത് സത്യമാണ്.");
      assert.equal(serverRoom.states.A, "READY");

      ws.close();
    } finally {
      await gateway.close();
    }
  });
});
