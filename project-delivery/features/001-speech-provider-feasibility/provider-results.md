# Speech provider feasibility results

Status: PARTIAL / LIVE MEASUREMENTS BLOCKED, 2026-10-25.

## STT decision

- Selected by user: `openai/whisper-large-v3`.
- Execution path: local Hugging Face Transformers automatic-speech-recognition pipeline.
- Validated mode: batch only; true streaming is not claimed.
- Input prepared by harness: mono waveform resampled to 16 kHz; 30-second chunking; batch size 1.
- Decoding: language `malayalam`, task `transcribe`.
- Runtime verified on this machine: Python 3.12.10, PyTorch 2.11.0+cu128, Transformers 5.20.2, and NVIDIA GeForce RTX 4060 Laptop GPU with 8188 MiB VRAM. The model is cached locally.
- Approval state: BLOCKED until the five private Malayalam audio files and Malayalam review are available.
- Fallback while blocked: typed input and deterministic mock transcript events.

Official documentation checked on 2026-10-25:

- Model card: https://huggingface.co/openai/whisper-large-v3
- Transformers Whisper documentation: https://huggingface.co/docs/transformers/model_doc/whisper

The model card identifies the exact checkpoint, local pipeline usage, known-language prompting, local-file input, and 30-second chunking for long-form audio. These are documented capabilities, not measured performance for ZoomOut.

## STT measurements

No live Malayalam sample result is recorded. The manifest and scoring harness are implemented and fake-verified, but the five audio files are intentionally absent from Git. Do not certify Malayalam or code-switching quality from the fake fixture.

A live integration smoke pass used a short non-speech Windows WAV and completed successfully through the frontend API on `cuda:0`: 1.172 seconds measured inference and approximately 12.6 seconds end to end including process/model startup. The arbitrary transcript is not quality evidence; the pass only establishes that upload, decoding, cached model loading, CUDA inference, response serialization, and temporary-file cleanup work together.

The Next.js Whisper Evidence Desk now provides the operator workflow needed to collect those runs: scenario selection, record/upload, transcript and WER/latency review, meaning judgment, usability rating, notes, and JSON export. Its simulation mode has been browser-tested but remains interface evidence only.

Approval gate: all five samples measured with one configuration, Malayalam meaning review complete, and no meaning-changing error severe enough to invalidate the demo. Otherwise retain typed input as the MVP fallback.

## TTS candidates

| Candidate | Documented configuration | Measured state |
| --- | --- | --- |
| ElevenLabs | `eleven_v3`, neutral non-cloned voice, Malayalam text; tagged and untagged variants | BLOCKED: no account key/voice ID or generated sample |
| Google Cloud TTS | `ml-IN-Chirp3-HD-Charon`, PCM/LINEAR16 candidate fallback | BLOCKED: no Application Default Credentials or generated sample |

Official documentation checked on 2026-10-25:

- ElevenLabs TTS guide: https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
- Google Chirp 3 HD: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd

The current ElevenLabs guide documents `eleven_v3` and audio tags but recommends testing content and voice. Google documents Malayalam `ml-IN`, Chirp 3 HD voice naming, regions, and output formats. Neither candidate has been human-reviewed here. No TTS primary is approved.

Neutral TTS test text:

```text
കോടതി ഇപ്പോൾ ആരംഭിക്കുന്നു. ഈ ചെറിയ തർക്കത്തിന് ഒരു വലിയ ശ്വാസം മതി.
```

Tagged variant:

```text
[dramatic] കോടതി ഇപ്പോൾ ആരംഭിക്കുന്നു. [warm] ഈ ചെറിയ തർക്കത്തിന് ഒരു വലിയ ശ്വാസം മതി.
```

If tags are spoken or degrade Malayalam, strip tags and use punctuation/rhythm. Never clone a participant voice.

## Retention and cleanup

- Credentials: environment/local provider authentication only; none written to the repository.
- Private or consented audio: ignored under `scripts/provider-spike/samples-private/`; delete after the spike.
- Generated results/audio: ignored under `scripts/provider-spike/output/`; redact before copying aggregate evidence here.
- Retained in Git: manifest scripts/reference text, harness, fake results, and this partial report.

## Handoff

Feature 004 may implement the batch adapter shape around `openai/whisper-large-v3`, but live readiness remains blocked. Feature 007 may develop against fake audio manifests; no live TTS provider has been selected. Typed input and text-only verdict remain required fallbacks.
