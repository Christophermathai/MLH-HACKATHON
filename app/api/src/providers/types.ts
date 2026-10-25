import {
  AnalystOutput,
  MediatorResult,
  AudioStatus,
} from "@zoomout/contracts";

export interface SttResult {
  text: string;
  unclear_lines?: string[];
}

export interface SttProvider {
  batch(audio: Buffer, mime: string, signal?: AbortSignal): Promise<SttResult>;
  stream?(
    chunkStream: AsyncIterable<Buffer>,
    signal?: AbortSignal,
    onPartial?: (text: string) => void
  ): Promise<SttResult>;
}

export interface AnalystProvider {
  analyze(
    side: "A" | "B",
    confirmedText: string,
    signal?: AbortSignal
  ): Promise<AnalystOutput>;
}

export interface MediatorProvider {
  mediate(
    analystA: AnalystOutput,
    analystB: AnalystOutput,
    signal?: AbortSignal
  ): Promise<MediatorResult>;
}

export interface JudgeStreamProvider {
  streamVerdict(
    mediator: MediatorResult,
    signal?: AbortSignal,
    onSentence?: (sentence: string, seq: number) => void
  ): Promise<string>;
}

export interface TtsSentenceResult {
  seq: number;
  mime: string;
  data: string; // base64 encoded audio
  status: AudioStatus;
  code?: string;
}

export interface TtsProvider {
  synthesizeSentence(
    seq: number,
    sentenceText: string,
    signal?: AbortSignal
  ): Promise<TtsSentenceResult>;
}
