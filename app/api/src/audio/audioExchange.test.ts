import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createGatewayServer } from "../server.js";

const port = 8796;
const host = "127.0.0.1";

test("AC-004-03 / AC-004-07: WebSocket audio recording, chunk streaming, and transcription exchange", async () => {
  const gateway = createGatewayServer({
    port,
    host,
    providerMode: "mock",
    allowedOrigins: ["http://localhost:3000"],
  });

  await gateway.start();

  try {
    // 1. Create Room (Person A)
    const createRes = await fetch(`http://${host}:${port}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const roomA = (await createRes.json()) as any;

    // 2. Claim Room (Person B)
    const claimRes = await fetch(`http://${host}:${port}/api/rooms/${roomA.room}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "B" }),
    });
    const roomB = (await claimRes.json()) as any;

    // 3. Connect Person A and Person B
    const wsA = new WebSocket(`ws://${host}:${port}/ws`, {
      headers: { Origin: "http://localhost:3000" },
    });
    const wsB = new WebSocket(`ws://${host}:${port}/ws`, {
      headers: { Origin: "http://localhost:3000" },
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        wsA.on("open", () => resolve());
        wsA.on("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        wsB.on("open", () => resolve());
        wsB.on("error", reject);
      }),
    ]);

    // Track messages for A and B
    const messagesA: any[] = [];
    const messagesB: any[] = [];
    wsA.on("message", (data) => messagesA.push(JSON.parse(data.toString())));
    wsB.on("message", (data) => messagesB.push(JSON.parse(data.toString())));

    // Join both participants
    wsA.send(
      JSON.stringify({
        v: 1,
        type: "join",
        payload: { room: roomA.room, side: "A", resumeToken: roomA.resumeToken },
      })
    );
    wsB.send(
      JSON.stringify({
        v: 1,
        type: "join",
        payload: { room: roomB.room, side: "B", resumeToken: roomB.resumeToken },
      })
    );

    // Wait for session snapshots
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(messagesA.some((m) => m.type === "session_snapshot"));
    assert.ok(messagesB.some((m) => m.type === "session_snapshot"));

    // 4. Person A starts audio recording
    wsA.send(
      JSON.stringify({
        v: 1,
        type: "start_recording",
        payload: {
          mode: "batch",
          mime: "audio/webm;codecs=opus",
        },
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    const startMsg = messagesA.find((m) => m.type === "recording_started");
    assert.ok(startMsg, "Person A should receive recording_started");
    assert.equal(startMsg.payload.mime, "audio/webm;codecs=opus");

    // Person B should NOT receive any recording notification from Person A
    assert.ok(!messagesB.some((m) => m.type === "recording_started"));

    // 5. Person A streams binary audio frames
    const frame1 = Buffer.alloc(1024, 0xaa);
    const frame2 = Buffer.alloc(2048, 0xbb);
    wsA.send(frame1);
    wsA.send(frame2);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // 6. Person A stops recording
    wsA.send(
      JSON.stringify({
        v: 1,
        type: "stop_recording",
        payload: {},
      })
    );

    // Wait for transcription to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    const transcriptMsg = messagesA.find((m) => m.type === "final_transcript");
    assert.ok(transcriptMsg, "Person A must receive final_transcript");
    assert.ok(transcriptMsg.payload.text.length > 0);

    // Person B MUST NOT receive Person A's transcript (AC-004-03)
    assert.ok(
      !messagesB.some((m) => m.type === "final_transcript"),
      "Person B must NOT receive Person A's transcript"
    );

    // 7. Person B uses typed input
    wsB.send(
      JSON.stringify({
        v: 1,
        type: "start_typed_input",
        payload: {},
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const bTyped = messagesB.find((m) => m.type === "final_transcript");
    assert.ok(bTyped, "Person B should receive empty final_transcript for typing");
    assert.equal(bTyped.payload.text, "");

    wsA.close();
    wsB.close();
  } finally {
    await gateway.close();
  }
});
