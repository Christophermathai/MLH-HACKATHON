import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { ZoomOutPublicError, devanagariToMalayalam } from "@zoomout/contracts";
import { SttProvider, SttResult } from "./types.js";

export class WhisperSttProvider implements SttProvider {
  constructor(
    private options: {
      pythonPath?: string;
      scriptPath?: string;
      language?: string;
      openaiApiKey?: string;
      elevenlabsApiKey?: string;
      elevenlabsModelId?: string;
      elevenlabsLanguageCode?: string;
    } = {}
  ) {}

  public async batch(
    audio: Buffer,
    mime: string,
    signal?: AbortSignal
  ): Promise<SttResult> {
    if (signal?.aborted) {
      throw new ZoomOutPublicError("BAD_EVENT", "Transcription aborted by client");
    }

    const elevenlabsApiKey =
      this.options.elevenlabsApiKey ?? process.env.ELEVENLABS_API_KEY?.trim();

    if (elevenlabsApiKey && !this.options.scriptPath) {
      return this.invokeElevenLabsStt(audio, mime, elevenlabsApiKey, signal);
    }

    const scriptPath =
      this.options.scriptPath ??
      path.resolve(process.cwd(), "../../scripts/provider-spike/transcribe_whisper.py");
    const pythonBin = this.options.pythonPath ?? (process.platform === "win32" ? "python" : "python3");

    const ext = mime.includes("webm") ? ".webm" : mime.includes("ogg") ? ".ogg" : ".wav";
    const tempFile = path.join(os.tmpdir(), `zoomout-stt-${crypto.randomUUID()}${ext}`);

    try {
      await fs.writeFile(tempFile, audio);

      if (signal?.aborted) {
        throw new ZoomOutPublicError("BAD_EVENT", "Transcription aborted by client");
      }

      const result = await this.invokeLocalWhisper(pythonBin, scriptPath, tempFile, signal);
      // Guarantee Malayalam script
      result.text = devanagariToMalayalam(result.text);
      return result;
    } finally {
      // Immediate raw audio deletion from disk (FR-004-06, FR-004-07)
      try {
        await fs.unlink(tempFile);
      } catch {}
    }
  }

  private async invokeElevenLabsStt(
    audio: Buffer,
    mime: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<SttResult> {
    const ext = mime.includes("webm")
      ? ".webm"
      : mime.includes("ogg")
        ? ".ogg"
        : mime.includes("mp3") || mime.includes("mpeg")
          ? ".mp3"
          : ".wav";
    const modelId =
      this.options.elevenlabsModelId ?? process.env.ELEVENLABS_STT_MODEL_ID ?? "scribe_v1";
    const languageCode =
      this.options.elevenlabsLanguageCode ?? process.env.ELEVENLABS_STT_LANGUAGE_CODE ?? "mal";

    const form = new FormData();
    form.append("model_id", modelId);
    form.append("language_code", languageCode);
    form.append(
      "file",
      new Blob([new Uint8Array(audio)], { type: mime || "audio/wav" }),
      `zoomout-stt-${crypto.randomUUID()}${ext}`
    );

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: form,
        signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new ZoomOutPublicError(
          "STT_FAILED",
          `ElevenLabs STT failed (${response.status}): ${errBody.slice(0, 200)}`
        );
      }

      const payload = (await response.json()) as { text?: string };
      return {
        text: (payload.text ?? "").trim(),
        unclear_lines: [],
      };
    } catch (err: any) {
      if (signal?.aborted || err?.name === "AbortError") {
        throw new ZoomOutPublicError("BAD_EVENT", "Transcription aborted");
      }
      if (err instanceof ZoomOutPublicError) {
        throw err;
      }
      throw new ZoomOutPublicError(
        "STT_FAILED",
        `ElevenLabs STT request failed: ${err?.message ?? "unknown error"}`
      );
    }
  }

  private invokeLocalWhisper(
    pythonBin: string,
    scriptPath: string,
    audioPath: string,
    signal?: AbortSignal
  ): Promise<SttResult> {
    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        "--audio",
        audioPath,
        "--stdout",
        "--language",
        this.options.language ?? "malayalam",
      ];

      const child = spawn(pythonBin, args, {
        windowsHide: true,
      });

      let stdoutData = "";
      let stderrData = "";

      child.stdout.on("data", (chunk) => {
        stdoutData += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderrData += chunk.toString();
      });

      const onAbort = () => {
        try {
          child.kill();
        } catch {}
        reject(new ZoomOutPublicError("BAD_EVENT", "Transcription aborted"));
      };

      signal?.addEventListener("abort", onAbort, { once: true });

      child.on("close", (code) => {
        signal?.removeEventListener("abort", onAbort);

        if (code !== 0) {
          return reject(
            new ZoomOutPublicError(
              "STT_FAILED",
              `Whisper process exited with code ${code}: ${stderrData.slice(0, 200)}`
            )
          );
        }

        try {
          const lines = stdoutData.trim().split("\n");
          const jsonLine = lines[lines.length - 1];
          const parsed = JSON.parse(jsonLine);

          const transcript = parsed.transcript || parsed.text || "";
          resolve({
            text: transcript,
            unclear_lines: parsed.unclear_lines ?? [],
          });
        } catch (err: any) {
          reject(
            new ZoomOutPublicError(
              "STT_FAILED",
              `Failed to parse Whisper runner output: ${err.message}`
            )
          );
        }
      });

      child.on("error", (err) => {
        signal?.removeEventListener("abort", onAbort);
        reject(
          new ZoomOutPublicError(
            "STT_FAILED",
            `Failed to start local Whisper runner: ${err.message}`
          )
        );
      });
    });
  }
}
