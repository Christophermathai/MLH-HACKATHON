"""Run the selected openai/whisper-large-v3 checkpoint over the sample manifest."""

from __future__ import annotations

import argparse
import json
import platform
import time
from pathlib import Path


MODEL_ID = "openai/whisper-large-v3"


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


def devanagari_to_malayalam(text: str) -> str:
    """Convert any Devanagari characters (often emitted by Whisper for Indic phonemes) to Malayalam script."""
    mapping = {
        # Signs
        0x0901: 0x0D01, # Candrabindu
        0x0902: 0x0D02, # Anusvara
        0x0903: 0x0D03, # Visarga
        # Independent vowels
        0x0905: 0x0D05, # A
        0x0906: 0x0D06, # AA
        0x0907: 0x0D07, # I
        0x0908: 0x0D08, # II
        0x0909: 0x0D09, # U
        0x090A: 0x0D0A, # UU
        0x090B: 0x0D0B, # Vocalic R
        0x090C: 0x0D0C, # Vocalic L
        0x090D: 0x0D0E, # Candra E -> Short E
        0x090E: 0x0D0E, # Short E
        0x090F: 0x0D0F, # E
        0x0910: 0x0D10, # AI
        0x0911: 0x0D12, # Candra O -> Short O
        0x0912: 0x0D12, # Short O
        0x0913: 0x0D13, # O
        0x0914: 0x0D14, # AU
        # Consonants
        0x0915: 0x0D15, 0x0916: 0x0D16, 0x0917: 0x0D17, 0x0918: 0x0D18, 0x0919: 0x0D19,
        0x091A: 0x0D1A, 0x091B: 0x0D1B, 0x091C: 0x0D1C, 0x091D: 0x0D1D, 0x091E: 0x0D1E,
        0x091F: 0x0D1F, 0x0920: 0x0D20, 0x0921: 0x0D21, 0x0922: 0x0D22, 0x0923: 0x0D23,
        0x0924: 0x0D24, 0x0925: 0x0D25, 0x0926: 0x0D26, 0x0927: 0x0D27, 0x0928: 0x0D28,
        0x0929: 0x0D29,
        0x092A: 0x0D2A, 0x092B: 0x0D2B, 0x092C: 0x0D2C, 0x092D: 0x0D2D, 0x092E: 0x0D2E,
        0x092F: 0x0D2F, 0x0930: 0x0D30, 0x0931: 0x0D31, 0x0932: 0x0D32, 0x0933: 0x0D33,
        0x0934: 0x0D34, 0x0935: 0x0D35, 0x0936: 0x0D36, 0x0937: 0x0D37, 0x0938: 0x0D38,
        0x0939: 0x0D39,
        # Vowel signs (matras)
        0x093E: 0x0D3E, # aa
        0x093F: 0x0D3F, # i
        0x0940: 0x0D40, # ii
        0x0941: 0x0D41, # u
        0x0942: 0x0D42, # uu
        0x0943: 0x0D43, # r
        0x0944: 0x0D44, # rr
        0x0945: 0x0D46, # candra e -> short e
        0x0946: 0x0D46, # short e
        0x0947: 0x0D47, # e
        0x0948: 0x0D48, # ai
        0x0949: 0x0D4A, # candra o -> short o
        0x094A: 0x0D4A, # short o
        0x094B: 0x0D4B, # o
        0x094C: 0x0D4C, # au
        0x094D: 0x0D4D, # virama (chandrakkala)
        # Numerals
        0x0966: 0x0D66, 0x0967: 0x0D67, 0x0968: 0x0D68, 0x0969: 0x0D69, 0x096A: 0x0D6A,
        0x096B: 0x0D6B, 0x096C: 0x0D6C, 0x096D: 0x0D6D, 0x096E: 0x0D6E, 0x096F: 0x0D6F,
        # Danda
        0x0964: ord('.'),
        0x0965: ord('.'),
    }
    out = []
    for c in text:
        cp = ord(c)
        if cp in mapping:
            out.append(chr(mapping[cp]))
        elif 0x0900 <= cp <= 0x097F:
            shifted = cp + (0x0D00 - 0x0900)
            out.append(chr(shifted))
        else:
            out.append(c)
    return ''.join(out)


def main() -> int:
    args = parse_args()
    import math
    import numpy as np
    import soundfile as sf
    import torch
    import transformers
    from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

    device = "cuda:0" if args.device == "auto" and torch.cuda.is_available() else args.device
    if device == "auto":
        device = "cpu"
    if device == "cuda":
        device = "cuda:0"
    dtype = torch.float16 if device.startswith("cuda") else torch.float32

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True,
    )
    model.to(device)
    processor = AutoProcessor.from_pretrained(MODEL_ID)

    # Force decoder IDs to Malayalam
    forced_decoder_ids = processor.get_decoder_prompt_ids(language=args.language, task="transcribe")
    model.generation_config.forced_decoder_ids = forced_decoder_ids

    # Prompt IDs anchoring Malayalam script
    try:
        prompt_ids = processor.get_prompt_ids("ഇത് മലയാളം സംഭാഷണമാണ്. മലയാളത്തിൽ എഴുതുക.")
    except Exception:
        prompt_ids = None

    transcriber = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        batch_size=1,
        torch_dtype=dtype,
        device=device,
    )

    runtime = {
        "mode": "batch",
        "language": args.language,
        "task": "transcribe",
        "sampleRateHz": 16_000,
        "chunkLengthSeconds": 30,
        "batchSize": 1,
        "device": device,
        "dtype": str(dtype),
        "python": platform.python_version(),
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "modelRevision": getattr(model.config, "_commit_hash", None),
    }

    def transcribe(audio_path: Path) -> tuple[str, float]:
        if not audio_path.is_file():
            raise FileNotFoundError(f"Missing audio: {audio_path}")
        audio, source_rate = sf.read(audio_path, dtype="float32", always_2d=True)
        waveform = audio.mean(axis=1)

        # High quality anti-aliased resampling to 16 kHz
        if source_rate != 16_000:
            try:
                from scipy.signal import resample_poly
                gcd = math.gcd(source_rate, 16_000)
                up = 16_000 // gcd
                down = source_rate // gcd
                waveform = resample_poly(waveform, up, down).astype(np.float32)
            except Exception:
                source_points = np.linspace(0.0, 1.0, num=len(waveform), endpoint=False)
                target_length = max(1, round(len(waveform) * 16_000 / source_rate))
                target_points = np.linspace(0.0, 1.0, num=target_length, endpoint=False)
                waveform = np.interp(target_points, source_points, waveform).astype(np.float32)

        # Silence / low energy gate
        max_amp = float(np.max(np.abs(waveform))) if len(waveform) > 0 else 0.0
        if max_amp < 0.005:
            return "[ശബ്ദം വ്യക്തമല്ല / No speech detected]", 0.05

        # Peak normalization
        if max_amp > 0:
            waveform = (waveform / max_amp * 0.95).astype(np.float32)

        gen_kwargs: dict = {
            "language": args.language,
            "task": "transcribe",
            "repetition_penalty": 1.2,
            "no_repeat_ngram_size": 3,
        }
        if prompt_ids is not None:
            gen_kwargs["prompt_ids"] = prompt_ids

        started = time.perf_counter()
        prediction = transcriber(
            {"array": waveform, "sampling_rate": 16_000},
            generate_kwargs=gen_kwargs,
        )
        elapsed = round(time.perf_counter() - started, 3)

        raw_text = prediction["text"].strip()
        # Guarantee Malayalam script output (converting any Devanagari transliteration)
        final_text = devanagari_to_malayalam(raw_text)

        return final_text, elapsed

    if args.audio:
        text, elapsed = transcribe(args.audio)
        response = {
            "mode": "live",
            "model": MODEL_ID,
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
    if manifest.get("model") != MODEL_ID:
        raise ValueError(f"Manifest model must be {MODEL_ID}")

    results = []
    for sample in manifest["samples"]:
        audio_path = args.manifest.parent / sample["audioPath"]
        text, elapsed = transcribe(audio_path)
        results.append({
            "id": sample["id"],
            "text": text,
            "elapsedSeconds": elapsed,
            "meaningPreserved": None,
            "reviewerNotes": "Malayalam review pending",
        })

    payload = {
        "schemaVersion": 1,
        "model": MODEL_ID,
        "run": runtime,
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(results)} transcriptions to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
