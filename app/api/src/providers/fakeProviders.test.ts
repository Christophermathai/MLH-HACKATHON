import test from "node:test";
import assert from "node:assert/strict";
import {
  FakeSttProvider,
  FakeAnalystProvider,
  FakeMediatorProvider,
  FakeJudgeStreamProvider,
  FakeTtsProvider,
} from "./fakeProviders.js";
import { ZoomOutPublicError } from "@zoomout/contracts";

test("AC-002-05: Fake STT streaming exercises partial transcripts and cancellation", async () => {
  const stt = new FakeSttProvider({ delayMs: 5 });
  const partials: string[] = [];

  const result = await stt.stream?.(
    (async function* () {
      yield Buffer.from("audio");
    })(),
    undefined,
    (text) => partials.push(text)
  );

  assert.equal(partials.length, 4);
  assert.equal(partials[0], "ഞാൻ...");
  assert.equal(result?.text, "ഞാൻ പറഞ്ഞത് അവൻ കേട്ടില്ല, ഫോണിൽ നോക്കിക്കൊണ്ടിരുന്നു.");

  // Test cancellation via AbortSignal
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    async () => {
      await stt.stream?.(
        (async function* () {
          yield Buffer.from("audio");
        })(),
        controller.signal
      );
    },
    (err: any) => err instanceof ZoomOutPublicError && err.code === "BAD_EVENT"
  );
});

test("AC-002-05: Fake Analyst exercises normal analysis, abuse detection, and failure", async () => {
  const normalAnalyst = new FakeAnalystProvider();
  const normalRes = await normalAnalyst.analyze("A", "Dishes were in the sink");
  assert.equal(normalRes.side, "A");
  assert.equal(normalRes.safety_flags.abuse_or_coercion_signals, false);

  const abuseAnalyst = new FakeAnalystProvider({ abuseFlag: true });
  const abuseRes = await abuseAnalyst.analyze("B", "Threats and isolation");
  assert.equal(abuseRes.safety_flags.abuse_or_coercion_signals, true);

  const failingAnalyst = new FakeAnalystProvider({ shouldFail: true });
  await assert.rejects(
    async () => {
      await failingAnalyst.analyze("A", "text");
    },
    (err: any) => err instanceof ZoomOutPublicError && err.code === "MODEL_FAILED"
  );
});

test("AC-002-05: Fake Mediator produces valid comparison and supports failure", async () => {
  const mediator = new FakeMediatorProvider();
  const res = await mediator.mediate(
    {
      side: "A",
      upset_about: ["Dishes"],
      stated_facts: ["Dishes left"],
      assumptions_made: [],
      possible_feelings: [],
      unclear_lines: [],
      safety_flags: { abuse_or_coercion_signals: false, notes: "" },
    },
    {
      side: "B",
      upset_about: ["Nagging"],
      stated_facts: ["Tired after work"],
      assumptions_made: [],
      possible_feelings: [],
      unclear_lines: [],
      safety_flags: { abuse_or_coercion_signals: false, notes: "" },
    }
  );

  assert.equal(res.petty_score, 4);
  assert.equal(res.truce.requires_apology, false);
});

test("AC-002-05: Fake Judge streams sentences and supports mid-stream interruption", async () => {
  const judge = new FakeJudgeStreamProvider({ delayMs: 5 });
  const sentences: string[] = [];

  const fullText = await judge.streamVerdict(
    {} as any,
    undefined,
    (s) => sentences.push(s)
  );

  assert.equal(sentences.length, 4);
  assert.ok(fullText.includes("Petty Court is now in session."));

  // Mid stream failure
  const failingJudge = new FakeJudgeStreamProvider({ shouldFailMidStream: true });
  await assert.rejects(
    async () => {
      await failingJudge.streamVerdict({} as any);
    },
    (err: any) => err instanceof ZoomOutPublicError && err.code === "MODEL_FAILED"
  );
});

test("AC-002-05: Fake TTS exercises reordered completion and individual sentence gap failure", async () => {
  // Sentence 0 takes 30ms, Sentence 1 takes 5ms, Sentence 2 fails with TTS_FAILED
  const tts = new FakeTtsProvider({
    delaysBySeq: { 0: 30, 1: 5 },
    failedSeqs: [2],
  });

  const [p0, p1, p2] = await Promise.all([
    tts.synthesizeSentence(0, "Sentence zero"),
    tts.synthesizeSentence(1, "Sentence one"),
    tts.synthesizeSentence(2, "Sentence two"),
  ]);

  assert.equal(p0.status, "ready");
  assert.equal(p0.seq, 0);

  assert.equal(p1.status, "ready");
  assert.equal(p1.seq, 1);

  assert.equal(p2.status, "failed");
  assert.equal(p2.seq, 2);
  assert.equal(p2.code, "TTS_FAILED");
});
