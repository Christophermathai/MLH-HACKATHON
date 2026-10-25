import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { pathExists, resolveElevenLabsConfig, whisperScriptPath } from "@/lib/serverPaths";
import type { RuntimeHealth } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkCommand(executable: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 2500);
    child.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

export async function GET() {
  const demo = process.env.WHISPER_DEMO_MODE === "1";
  const elevenLabs = await resolveElevenLabsConfig();

  if (demo) {
    const health: RuntimeHealth = {
      mode: "simulated",
      model: `elevenlabs/${elevenLabs.modelId}`,
      pythonAvailable: true,
      dependenciesAvailable: true,
      message: "Simulation mode is active. Results are interface fixtures, not model evidence.",
    };
    return NextResponse.json(health, { headers: { "Cache-Control": "no-store" } });
  }

  if (elevenLabs.apiKey) {
    const health: RuntimeHealth = {
      mode: "live",
      model: `elevenlabs/${elevenLabs.modelId}`,
      pythonAvailable: true,
      dependenciesAvailable: true,
      message: `ElevenLabs Scribe (${elevenLabs.modelId} · Malayalam) is connected and ready.`,
    };
    return NextResponse.json(health, { headers: { "Cache-Control": "no-store" } });
  }

  const model = process.env.WHISPER_MODEL ?? "openai/whisper-large-v3";
  const executable = process.env.WHISPER_PYTHON ?? "python";
  const pythonAvailable = await checkCommand(executable, ["--version"]);
  const dependencyProbe =
    "import importlib.util, sys; names=('numpy','soundfile','torch','transformers'); sys.exit(0 if all(importlib.util.find_spec(name) for name in names) else 1)";
  const dependenciesAvailable = pythonAvailable && (await checkCommand(executable, ["-c", dependencyProbe]));
  const scriptAvailable = await pathExists(whisperScriptPath());
  const health: RuntimeHealth =
    pythonAvailable && dependenciesAvailable && scriptAvailable
      ? {
          mode: "live",
          model,
          pythonAvailable,
          dependenciesAvailable,
          message: "Local Whisper runner and dependencies are available.",
        }
      : {
          mode: "blocked",
          model,
          pythonAvailable,
          dependenciesAvailable,
          message: "Set ELEVENLABS_API_KEY in .env or configure local Whisper dependencies.",
        };
  return NextResponse.json(health, { headers: { "Cache-Control": "no-store" } });
}
