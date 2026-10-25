import {
  AnalystOutput,
  MediatorResult,
  ZoomOutPublicError,
} from "@zoomout/contracts";
import {
  SttProvider,
  SttResult,
  AnalystProvider,
  MediatorProvider,
  JudgeStreamProvider,
  TtsProvider,
  TtsSentenceResult,
} from "./types.js";

// Minimal valid silent MP3 frame base64
const DUMMY_MP3_BASE64 =
  "//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAAC8AAAAAAA";

function checkSignal(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new ZoomOutPublicError("BAD_EVENT", "Operation cancelled by client");
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new ZoomOutPublicError("BAD_EVENT", "Operation cancelled by client"));
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new ZoomOutPublicError("BAD_EVENT", "Operation cancelled by client"));
    }
    signal?.addEventListener("abort", onAbort);
  });
}

export class FakeSttProvider implements SttProvider {
  constructor(
    private options: {
      shouldFail?: boolean;
      text?: string;
      delayMs?: number;
      partials?: string[];
    } = {}
  ) {}

  async batch(audio: Buffer, mime: string, signal?: AbortSignal): Promise<SttResult> {
    checkSignal(signal);
    if (this.options.delayMs) {
      await delay(this.options.delayMs, signal);
    }
    if (this.options.shouldFail) {
      throw new ZoomOutPublicError("STT_FAILED", "Speech recognition failed or model unavailable");
    }
    return {
      text: this.options.text ?? "ഞാൻ പറഞ്ഞത് അവൻ കേട്ടില്ല, ഫോണിൽ നോക്കിക്കൊണ്ടിരുന്നു.",
      unclear_lines: [],
    };
  }

  async stream(
    chunkStream: AsyncIterable<Buffer>,
    signal?: AbortSignal,
    onPartial?: (text: string) => void
  ): Promise<SttResult> {
    checkSignal(signal);
    const partials = this.options.partials ?? [
      "ഞാൻ...",
      "ഞാൻ പറഞ്ഞത്...",
      "ഞാൻ പറഞ്ഞത് അവൻ...",
      "ഞാൻ പറഞ്ഞത് അവൻ കേട്ടില്ല, ഫോണിൽ നോക്കിക്കൊണ്ടിരുന്നു.",
    ];

    for (const partial of partials) {
      checkSignal(signal);
      if (this.options.delayMs) {
        await delay(this.options.delayMs, signal);
      }
      onPartial?.(partial);
    }

    if (this.options.shouldFail) {
      throw new ZoomOutPublicError("STT_FAILED", "Streaming STT provider aborted");
    }

    return {
      text: this.options.text ?? partials[partials.length - 1],
      unclear_lines: [],
    };
  }
}

export class FakeAnalystProvider implements AnalystProvider {
  constructor(
    private options: {
      abuseFlag?: boolean;
      shouldFail?: boolean;
      delayMs?: number;
    } = {}
  ) {}

  async analyze(side: "A" | "B", confirmedText: string, signal?: AbortSignal): Promise<AnalystOutput> {
    checkSignal(signal);
    if (this.options.delayMs) {
      await delay(this.options.delayMs, signal);
    }
    if (this.options.shouldFail) {
      throw new ZoomOutPublicError("MODEL_FAILED", "Analyst model execution failed");
    }

    if (this.options.abuseFlag) {
      return {
        side,
        upset_about: ["Threats and intimidation"],
        stated_facts: [confirmedText],
        assumptions_made: ["Situation cannot be safely discussed"],
        possible_feelings: ["Afraid", "Overwhelmed"],
        unclear_lines: [],
        safety_flags: {
          abuse_or_coercion_signals: true,
          notes: "Coercion signals detected in transcript.",
        },
      };
    }

    return {
      side,
      upset_about: ["Dishes left in sink"],
      stated_facts: [confirmedText],
      assumptions_made: ["Other person expects them to do all chores"],
      possible_feelings: ["Unappreciated", "Exhausted"],
      unclear_lines: [],
      safety_flags: {
        abuse_or_coercion_signals: false,
        notes: "",
      },
    };
  }
}

export class FakeMediatorProvider implements MediatorProvider {
  constructor(
    private options: {
      shouldFail?: boolean;
      pettyScore?: number;
      delayMs?: number;
    } = {}
  ) {}

  async mediate(
    analystA: AnalystOutput,
    analystB: AnalystOutput,
    signal?: AbortSignal
  ): Promise<MediatorResult> {
    checkSignal(signal);
    if (this.options.delayMs) {
      await delay(this.options.delayMs, signal);
    }
    if (this.options.shouldFail) {
      throw new ZoomOutPublicError("MODEL_FAILED", "Mediator model execution failed");
    }

    return {
      what_each_is_upset_about: {
        A: analystA.upset_about,
        B: analystB.upset_about,
      },
      where_interpretations_differ: [
        "Whether chore timing reflects personal consideration or casual oversight",
      ],
      petty_score: this.options.pettyScore ?? 4,
      zoom_out: {
        immediate_issue: "Dirty plates in the kitchen sink",
        possible_underlying_feelings: [
          "Fatigue after a long day and desire for relaxation",
        ],
        bigger_picture: "Both participants want their time and effort acknowledged",
      },
      truce: {
        next_step: "Person B clears table, Person A prepares tea, no lectures tonight",
        requires_apology: false,
      },
    };
  }
}

export class FakeJudgeStreamProvider implements JudgeStreamProvider {
  constructor(
    private options: {
      sentences?: string[];
      shouldFailMidStream?: boolean;
      delayMs?: number;
    } = {}
  ) {}

  async streamVerdict(
    mediator: MediatorResult,
    signal?: AbortSignal,
    onSentence?: (sentence: string, seq: number) => void
  ): Promise<string> {
    checkSignal(signal);
    const sentences = this.options.sentences ?? [
      "Petty Court is now in session.",
      "Both parties are convicted of caring intensely about kitchen utensils.",
      "Underneath it, both of you were just tired after a demanding workday.",
      "The sentence: one pot of hot chai, shared peacefully, zero lectures.",
    ];

    const emitted: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      checkSignal(signal);
      if (this.options.shouldFailMidStream && i === 2) {
        throw new ZoomOutPublicError("MODEL_FAILED", "Judge token stream interrupted");
      }
      if (this.options.delayMs) {
        await delay(this.options.delayMs, signal);
      }
      const s = sentences[i];
      emitted.push(s);
      onSentence?.(s, i);
    }

    return emitted.join(" ");
  }
}

export class FakeTtsProvider implements TtsProvider {
  constructor(
    private options: {
      failedSeqs?: number[];
      delaysBySeq?: Record<number, number>;
      defaultDelayMs?: number;
    } = {}
  ) {}

  async synthesizeSentence(
    seq: number,
    sentenceText: string,
    signal?: AbortSignal
  ): Promise<TtsSentenceResult> {
    checkSignal(signal);
    const delayMs = this.options.delaysBySeq?.[seq] ?? this.options.defaultDelayMs ?? 10;
    if (delayMs > 0) {
      await delay(delayMs, signal);
    }

    if (this.options.failedSeqs?.includes(seq)) {
      return {
        seq,
        mime: "audio/mp3",
        data: "",
        status: "failed",
        code: "TTS_FAILED",
      };
    }

    return {
      seq,
      mime: "audio/mp3",
      data: DUMMY_MP3_BASE64,
      status: "ready",
    };
  }
}
