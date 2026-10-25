import { TtsProvider, TtsSentenceResult } from "./types.js";
import { ZoomOutPublicError } from "@zoomout/contracts";

export class ElevenLabsTtsProvider implements TtsProvider {
  private apiKey: string;
  private voiceId: string;
  private modelId: string;

  constructor(options: { apiKey?: string; voiceId?: string; modelId?: string } = {}) {
    this.apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    this.voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Default neutral voice (Rachel)
    this.modelId = options.modelId ?? process.env.ELEVENLABS_TTS_MODEL_ID ?? "eleven_multilingual_v2";
  }

  async synthesizeSentence(
    seq: number,
    sentenceText: string,
    signal?: AbortSignal
  ): Promise<TtsSentenceResult> {
    if (!this.apiKey) {
      throw new ZoomOutPublicError("TTS_FAILED", "ElevenLabs API key not configured");
    }

    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: sentenceText,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return {
          seq,
          mime: "audio/mpeg",
          data: "",
          status: "failed",
          code: `TTS_HTTP_${response.status}`,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return {
        seq,
        mime: "audio/mpeg",
        data: base64,
        status: "ready",
      };
    } catch (err: any) {
      if (signal?.aborted) {
        throw new ZoomOutPublicError("BAD_EVENT", "TTS synthesis cancelled");
      }
      return {
        seq,
        mime: "audio/mpeg",
        data: "",
        status: "failed",
        code: err?.message || "TTS_NETWORK_ERROR",
      };
    }
  }
}

