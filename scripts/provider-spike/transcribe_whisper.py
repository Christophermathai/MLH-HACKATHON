"""Run speech-to-text over the sample manifest (ElevenLabs Scribe v1 with local Whisper fallback)."""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import re
import time
from pathlib import Path


MODEL_ID = "openai/whisper-large-v3"
MALAYALAM_STYLE_PROMPT = "ഇന്ന് ചായ ഉണ്ടാക്കാമെന്ന് പറഞ്ഞിട്ട് നീ മറന്നുപോയി. അങ്ങനെ സംഭവിച്ചതേ നല്ലതിനാവൂ."


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("sample-manifest.json"))
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("output") / "whisper-results.json")
    parser.add_argument("--audio", type=Path, help="Transcribe one local audio file instead of the manifest")
    parser.add_argument("--sample-id", default="adhoc", help="Identifier attached to a one-file run")
    parser.add_argument("--stdout", action="store_true", help="Write a one-file JSON response to stdout")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--language", default="malayalam")
    return parser.parse_args()


def _resolve_elevenlabs_api_key() -> str | None:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        return key
    repo_root = Path(__file__).resolve().parents[2]
    for env_path in (repo_root / ".env", repo_root / "app" / "frontend" / ".env.local", repo_root / "app" / "api" / ".env"):
        if env_path.is_file():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                s = line.strip()
                if s.startswith("ELEVENLABS_API_KEY="):
                    val = s.split("=", 1)[1].strip().strip("\"'")
                    if val:
                        return val
    return None


def _transcribe_elevenlabs(audio_path: Path, api_key: str) -> tuple[str, float]:
    import requests

    if not audio_path.is_file():
        raise FileNotFoundError(f"Missing audio: {audio_path}")

    model_id = os.environ.get("ELEVENLABS_STT_MODEL_ID", "scribe_v1").strip() or "scribe_v1"
    lang_code = os.environ.get("ELEVENLABS_STT_LANGUAGE_CODE", "mal").strip() or "mal"

    started = time.perf_counter()
    with audio_path.open("rb") as fh:
        resp = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": api_key},
            data={"model_id": model_id, "language_code": lang_code},
            files={"file": (audio_path.name, fh, "audio/mpeg")},
            timeout=120,
        )
    elapsed = round(time.perf_counter() - started, 3)
    if not resp.ok:
        raise RuntimeError(f"ElevenLabs STT failed ({resp.status_code}): {resp.text[:300]}")
    payload = resp.json()
    return (payload.get("text") or "").strip(), elapsed


def main() -> int:
    args = parse_args()
    elevenlabs_key = _resolve_elevenlabs_api_key()

    if elevenlabs_key:
        model_id = os.environ.get("ELEVENLABS_STT_MODEL_ID", "scribe_v1").strip() or "scribe_v1"
        runtime = {
            "mode": "elevenlabs",
            "language": "mal",
            "task": "transcribe",
            "model": f"elevenlabs/{model_id}",
            "python": platform.python_version(),
        }
        if args.audio:
            text, elapsed = _transcribe_elevenlabs(args.audio, elevenlabs_key)
            response = {
                "mode": "live",
                "model": f"elevenlabs/{model_id}",
                "sampleId": args.sample_id,
                "text": text,
                "elapsedSeconds": elapsed,
                "runtime": runtime,
            }
            serialized = json.dumps(response, ensure_ascii=False)
            if args.stdout:
                print(serialized)
            else:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(serialized + "\n", encoding="utf-8")
            return 0

        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        results = []
        for sample in manifest["samples"]:
            audio_path = args.manifest.parent / sample["audioPath"]
            text, elapsed = _transcribe_elevenlabs(audio_path, elevenlabs_key)
            results.append({
                "id": sample["id"],
                "text": text,
                "elapsedSeconds": elapsed,
                "meaningPreserved": None,
                "reviewerNotes": "Malayalam review pending",
            })

        payload = {
            "schemaVersion": 1,
            "model": f"elevenlabs/{model_id}",
            "run": runtime,
            "results": results,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {len(results)} transcriptions to {args.output}")
        return 0

    raise RuntimeError("ELEVENLABS_API_KEY is not configured in environment or .env.")


if __name__ == "__main__":
    raise SystemExit(main())
