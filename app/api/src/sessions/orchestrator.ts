import crypto from "node:crypto";
import { WebSocket } from "ws";
import {
  createServerMessage,
  MediatorResult,
  SafetyResult,
  AudioManifest,
  Outcome,
} from "@zoomout/contracts";
import {
  AnalystProvider,
  MediatorProvider,
  JudgeStreamProvider,
  TtsProvider,
} from "../providers/types.js";

export interface PipelineProviders {
  analyst: AnalystProvider;
  mediator: MediatorProvider;
  judge: JudgeStreamProvider;
  tts: TtsProvider;
}

export interface OrchestratedRoom {
  room: string;
  transcripts: { A: string | null; B: string | null };
  confirmed: { A: boolean; B: boolean };
  consent: { A: boolean; B: boolean };
  sessionState: any;
  generationId: string | null;
  sharedResult: MediatorResult | null;
  verdictText: string | null;
  safetyResult: SafetyResult | null;
  outcome: Outcome | null;
  audioManifest: AudioManifest | null;
  audioChunks: Map<number, { seq: number; mime: string; data: string }>;
  sockets: { A: WebSocket | null; B: WebSocket | null };
}

export function broadcastToRoom(room: OrchestratedRoom, type: any, payload: any) {
  const message = JSON.stringify(createServerMessage(type, payload));
  if (room.sockets.A && room.sockets.A.readyState === WebSocket.OPEN) {
    try {
      room.sockets.A.send(message);
    } catch {}
  }
  if (room.sockets.B && room.sockets.B.readyState === WebSocket.OPEN) {
    try {
      room.sockets.B.send(message);
    } catch {}
  }
}

export async function runOrchestrationPipeline(
  room: OrchestratedRoom,
  providers: PipelineProviders,
  signal?: AbortSignal
): Promise<void> {
  const textA = room.transcripts.A?.trim();
  const textB = room.transcripts.B?.trim();

  if (!textA || !textB || !room.confirmed.A || !room.confirmed.B) {
    return;
  }

  const generationId = crypto.randomUUID();
  room.generationId = generationId;
  room.sessionState = "MEDIATING";

  try {
    // 1. Analyst Phase (Run privately and in parallel)
    const [analysisA, analysisB] = await Promise.all([
      providers.analyst.analyze("A", textA, signal),
      providers.analyst.analyze("B", textB, signal),
    ]);

    if (signal?.aborted) return;

    // 2. Deterministic Safety Check
    const safetyA = analysisA.safety_flags.abuse_or_coercion_signals;
    const safetyB = analysisB.safety_flags.abuse_or_coercion_signals;

    if (safetyA || safetyB) {
      room.sessionState = "RESOLVED";
      room.outcome = "safety";
      const safetyMessage =
        "ഈ സംഭാഷണത്തിൽ ഒരു പെറ്റി കോടതിക്ക് അപ്പുറമുള്ള ഗൗരവമുള്ള പ്രശ്നങ്ങളോ ആശങ്കകളോ ഉൾപ്പെട്ടിരിക്കാം. നിങ്ങൾ ആരോടും മാപ്പ് പറയുകയോ നിർബന്ധിച്ച് ഒത്തുതീർപ്പാക്കുകയോ ചെയ്യേണ്ടതില്ല. വിശ്വസ്തരായ സുഹൃത്തുക്കളോടോ പ്രൊഫഷണലുകളോടോ സംസാരിക്കാൻ ശുപാർശ ചെയ്യുന്നു. (This conversation may involve serious issues or safety concerns beyond the scope of a playful petty court. You are not required to apologize or reconcile. We recommend speaking with someone you trust.)";

      const safetyResult: SafetyResult = { message: safetyMessage };
      room.safetyResult = safetyResult;

      broadcastToRoom(room, "safety_result", safetyResult);
      broadcastToRoom(room, "done", { outcome: "safety", generationId });
      return;
    }

    // 3. Mediator Phase
    const mediatorResult = await providers.mediator.mediate(analysisA, analysisB, signal);
    if (signal?.aborted) return;

    room.sharedResult = mediatorResult;
    broadcastToRoom(room, "analysis_json", mediatorResult);

    // 4. Judge Phase & TTS Synthesis
    room.sessionState = "JUDGING";
    const fullSentences: Array<{ sentence: string; seq: number }> = [];

    // Synthesize sentences with max concurrency 2
    const pendingSyntheses: Promise<void>[] = [];
    let activeJobs = 0;
    const jobQueue: Array<() => Promise<void>> = [];

    function processQueue() {
      while (activeJobs < 2 && jobQueue.length > 0) {
        activeJobs++;
        const job = jobQueue.shift()!;
        job().finally(() => {
          activeJobs--;
          processQueue();
        });
      }
    }

    const verdictText = await providers.judge.streamVerdict(
      mediatorResult,
      signal,
      (sentence: string, seq: number) => {
        fullSentences.push({ sentence, seq });
        broadcastToRoom(room, "verdict_text_delta", { text: sentence + " " });

        const synthJob = async () => {
          try {
            const ttsResult = await providers.tts.synthesizeSentence(seq, sentence, signal);
            if (ttsResult.status === "ready" && ttsResult.data) {
              room.audioChunks.set(seq, {
                seq,
                mime: ttsResult.mime,
                data: ttsResult.data,
              });
              broadcastToRoom(room, "audio_chunk", {
                seq,
                mime: ttsResult.mime,
                data: ttsResult.data,
                generationId,
              });
              broadcastToRoom(room, "audio_status", {
                seq,
                status: "ready",
                generationId,
              });
            } else {
              broadcastToRoom(room, "audio_status", {
                seq,
                status: "failed",
                code: ttsResult.code || "TTS_FAILED",
                generationId,
              });
            }
          } catch {
            broadcastToRoom(room, "audio_status", {
              seq,
              status: "failed",
              code: "TTS_EXCEPTION",
              generationId,
            });
          }
        };

        const jobPromise = new Promise<void>((resolve) => {
          jobQueue.push(async () => {
            await synthJob();
            resolve();
          });
          processQueue();
        });

        pendingSyntheses.push(jobPromise);
      }
    );

    room.verdictText = verdictText;

    // Wait for all TTS sentence jobs to complete
    await Promise.all(pendingSyntheses);

    const manifest: AudioManifest = {
      totalSentences: fullSentences.length,
      textComplete: true,
      entries: fullSentences.map((s) => ({
        seq: s.seq,
        status: room.audioChunks.has(s.seq) ? "ready" : "failed",
      })),
      generationId,
    };
    room.audioManifest = manifest;

    broadcastToRoom(room, "audio_manifest", manifest);
    broadcastToRoom(room, "done", { outcome: "verdict", generationId });

    room.sessionState = "RESOLVED";
    room.outcome = "verdict";
  } catch (err: any) {
    if (signal?.aborted) return;
    room.sessionState = "FAILED";
    room.outcome = "incomplete";
    broadcastToRoom(room, "error", {
      code: "MODEL_FAILED",
      message: err?.message || "An unexpected error occurred during court mediation",
    });
  }
}
