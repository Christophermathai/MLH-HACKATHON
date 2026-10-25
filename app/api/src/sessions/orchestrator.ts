import crypto from "node:crypto";
import {
  AudioManifest,
  AudioManifestEntry,
} from "@zoomout/contracts";
import { SessionData } from "./sessionTypes.js";
import {
  AnalystProvider,
  MediatorProvider,
  JudgeStreamProvider,
  TtsProvider,
} from "../providers/types.js";
import { broadcast } from "../transport/projections.js";

export class PipelineOrchestrator {
  constructor(
    private analystProvider: AnalystProvider,
    private mediatorProvider: MediatorProvider,
    private judgeProvider: JudgeStreamProvider,
    private ttsProvider: TtsProvider
  ) {}

  public async onSideConfirmed(session: SessionData, side: "A" | "B"): Promise<void> {
    const text = session.confirmedText[side];
    if (!text) {
      return;
    }

    const controller = new AbortController();
    session.activeControllers.add(controller);

    try {
      // 1. Run private side analysis in background
      const analysis = await this.analystProvider.analyze(side, text, controller.signal);
      session.analystResults[side] = analysis;
    } catch (err) {
      // Analyst error
      session.sessionState = "FAILED";
      session.outcome = "incomplete";
      broadcast(session, "done", { outcome: "incomplete" });
      return;
    } finally {
      session.activeControllers.delete(controller);
    }

    // 2. Check if both sides are confirmed and both analyst runs have resolved
    await this.tryStartMediation(session);
  }

  public async tryStartMediation(session: SessionData): Promise<void> {
    const bothConfirmed = session.confirmedRevision.A === 1 && session.confirmedRevision.B === 1;
    const bothAnalysesReady = session.analystResults.A !== null && session.analystResults.B !== null;

    if (!bothConfirmed || !bothAnalysesReady) {
      return;
    }

    // Exactly-once generation guard
    if (session.generationId !== null) {
      return;
    }

    const generationId = "gen-" + crypto.randomUUID().slice(0, 8);
    session.generationId = generationId;

    const controller = new AbortController();
    session.activeControllers.add(controller);

    try {
      const analystA = session.analystResults.A!;
      const analystB = session.analystResults.B!;

      // 3. Safety evaluation check
      const safetyTriggered =
        analystA.safety_flags.abuse_or_coercion_signals ||
        analystB.safety_flags.abuse_or_coercion_signals;

      if (safetyTriggered) {
        session.sessionState = "DONE";
        session.outcome = "safety";
        session.audioManifest = {
          totalSentences: 0,
          textComplete: true,
          entries: [],
          generationId,
        };

        const genericSafetyMessage =
          "ZoomOut is designed for everyday petty disagreements. " +
          "When serious distress, coercion, or safety concerns are indicated, " +
          "we recommend speaking privately with a trusted person or dedicated support service.";

        broadcast(session, "safety_result", { message: genericSafetyMessage });
        broadcast(session, "done", { outcome: "safety", generationId });
        return;
      }

      // 4. Mediation stage
      session.sessionState = "MEDIATING";
      const mediator = await this.mediatorProvider.mediate(analystA, analystB, controller.signal);
      session.sharedResult = mediator;
      broadcast(session, "analysis_json", mediator);

      // 5. Judge streaming stage
      session.sessionState = "JUDGING";
      const sentences: string[] = [];
      const manifestEntries: AudioManifestEntry[] = [];
      const ttsPromises: Promise<void>[] = [];

      // Concurrency semaphore (max 2 concurrent TTS requests)
      let activeTts = 0;
      const ttsQueue: (() => void)[] = [];

      const acquireSlot = () =>
        new Promise<void>((resolve) => {
          if (activeTts < 2) {
            activeTts += 1;
            resolve();
          } else {
            ttsQueue.push(() => {
              activeTts += 1;
              resolve();
            });
          }
        });

      const releaseSlot = () => {
        activeTts -= 1;
        const next = ttsQueue.shift();
        if (next) {
          next();
        }
      };

      const dispatchTts = async (seq: number, sentenceText: string) => {
        await acquireSlot();
        try {
          const res = await this.ttsProvider.synthesizeSentence(seq, sentenceText, controller.signal);
          session.audioCache.set(seq, {
            seq,
            mime: res.mime,
            data: res.data,
            status: res.status,
            code: res.code,
          });

          manifestEntries[seq] = {
            seq,
            status: res.status,
            code: res.code,
          };

          if (res.status === "ready") {
            broadcast(session, "audio_chunk", {
              seq,
              mime: res.mime,
              data: res.data,
              generationId,
            });
          }

          broadcast(session, "audio_status", {
            seq,
            status: res.status,
            code: res.code,
            generationId,
          });
        } catch {
          manifestEntries[seq] = {
            seq,
            status: "failed",
            code: "TTS_FAILED",
          };
          broadcast(session, "audio_status", {
            seq,
            status: "failed",
            code: "TTS_FAILED",
            generationId,
          });
        } finally {
          releaseSlot();
        }
      };

      const fullVerdictText = await this.judgeProvider.streamVerdict(
        mediator,
        controller.signal,
        (sentence, seq) => {
          sentences.push(sentence);
          broadcast(session, "verdict_text_delta", { text: sentence });
          ttsPromises.push(dispatchTts(seq, sentence));
        }
      );

      session.verdictText = fullVerdictText;

      // Wait for all TTS jobs to settle
      await Promise.allSettled(ttsPromises);

      // Final manifest
      const audioManifest: AudioManifest = {
        totalSentences: sentences.length,
        textComplete: true,
        entries: manifestEntries.filter(Boolean),
        generationId,
      };

      session.audioManifest = audioManifest;
      broadcast(session, "audio_manifest", audioManifest);

      session.sessionState = "DONE";
      session.outcome = "verdict";
      broadcast(session, "done", { outcome: "verdict", generationId });
    } catch (err) {
      session.sessionState = "FAILED";
      session.outcome = "incomplete";
      broadcast(session, "done", { outcome: "incomplete", generationId });
    } finally {
      session.activeControllers.delete(controller);
    }
  }
}
