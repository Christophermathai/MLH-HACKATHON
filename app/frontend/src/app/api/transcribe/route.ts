import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { devanagariToMalayalam } from "@zoomout/contracts";
import { manifestPath, whisperScriptPath } from "@/lib/serverPaths";
import type { Manifest, TranscriptionResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const AUDIO_EXTENSIONS = new Map([
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["audio/webm", ".webm"],
  ["audio/ogg", ".ogg"],
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"],
  ["audio/mp4", ".m4a"],
  ["audio/x-m4a", ".m4a"],
  ["audio/aac", ".aac"],
]);

function normalizedAudioType(type: string) {
  return type.split(";", 1)[0].trim().toLowerCase();
}

function runPython(audioPath: string, sampleId: string) {
  return new Promise<TranscriptionResult>((resolve, reject) => {
    const executable = process.env.WHISPER_PYTHON ?? "python";
    const child = spawn(/* turbopackIgnore: true */ executable, [whisperScriptPath(), "--audio", audioPath, "--sample-id", sampleId, "--stdout"], {
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Whisper timed out after ten minutes."));
    }, 10 * 60 * 1000);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000); });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr || `Whisper exited with code ${code}`));
      try {
        resolve(JSON.parse(stdout) as TranscriptionResult);
      } catch {
        reject(new Error("Whisper returned an invalid response."));
      }
    });
  });
}

export async function POST(request: Request) {
  let temporaryPath: string | undefined;
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const sampleId = form.get("sampleId");
    if (!(audio instanceof File) || typeof sampleId !== "string") {
      return NextResponse.json({ error: "Audio and sampleId are required." }, { status: 400 });
    }
    const audioType = normalizedAudioType(audio.type);
    const extension = AUDIO_EXTENSIONS.get(audioType);
    if (!extension) {
      return NextResponse.json({ error: `Unsupported audio format (${audioType || "unknown"}). Use WAV, WebM, OGG, MP3, M4A, or AAC.` }, { status: 400 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: "The selected audio file is empty." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: `Audio is ${(audio.size / 1024 / 1024).toFixed(1)} MiB; the test limit is 5 MiB.` }, { status: 400 });
    }
    const manifest = JSON.parse(await readFile(manifestPath(), "utf8")) as Manifest;
    const sample = manifest.samples.find((candidate) => candidate.id === sampleId);
    if (!sample) return NextResponse.json({ error: "Unknown speech scenario." }, { status: 400 });

    if (process.env.WHISPER_DEMO_MODE === "1") {
      const result: TranscriptionResult = {
        mode: "simulated",
        model: manifest.model,
        text: sample.referenceText,
        elapsedSeconds: 0.42,
        warning: "Simulated response for interface testing. Do not use as model evidence.",
      };
      return NextResponse.json(result);
    }

    temporaryPath = path.join(tmpdir(), `zoomout-${randomUUID()}${extension}`);
    await writeFile(temporaryPath, Buffer.from(await audio.arrayBuffer()), { flag: "wx" });
    const pyResult = await runPython(temporaryPath, sampleId);
    pyResult.text = devanagariToMalayalam(pyResult.text);
    return NextResponse.json(pyResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  } finally {
    if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
