import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { ZoomOutPublicError } from "@zoomout/contracts";
import { SttProvider, SttResult } from "./types.js";

export class WhisperSttProvider implements SttProvider {
  constructor(
    private options: {
      pythonPath?: string;
      scriptPath?: string;
      language?: string;
      openaiApiKey?: string;
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

    // If OpenAI API key is available, we could call OpenAI or local Whisper
    const scriptPath =
      this.options.scriptPath ??
      path.resolve(process.cwd(), "../../scripts/provider-spike/transcribe_whisper.py");
    const pythonBin = this.options.pythonPath ?? (process.platform === "win32" ? "python" : "python3");

    // Write audio to temporary file for local Whisper runner
    const ext = mime.includes("webm") ? ".webm" : mime.includes("ogg") ? ".ogg" : ".wav";
    const tempFile = path.join(os.tmpdir(), `zoomout-stt-${crypto.randomUUID()}${ext}`);

    try {
      await fs.writeFile(tempFile, audio);

      if (signal?.aborted) {
        throw new ZoomOutPublicError("BAD_EVENT", "Transcription aborted by client");
      }

      const result = await this.invokeLocalWhisper(pythonBin, scriptPath, tempFile, signal);
      return result;
    } finally {
      // Immediate raw audio deletion from disk (FR-004-06, FR-004-07)
      try {
        await fs.unlink(tempFile);
      } catch {}
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
          // Parse json from stdout
          // The script writes JSON as the last line or full stdout
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
