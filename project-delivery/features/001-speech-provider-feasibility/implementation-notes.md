# Speech provider feasibility: implementation notes

## Current evidence

- 2026-10-25: User selected `openai/whisper-large-v3` as the STT model.
- Implemented a five-scenario Malayalam/code-switching manifest, private-audio/output ignore rules, local Transformers transcription runner, deterministic result scorer, metric tests, and a partial provider report.
- Official documentation checked for Whisper Large v3, Transformers Whisper, ElevenLabs v3, and Google Chirp 3 HD; links and documented/unverified distinctions are in provider-results.md.
- Local environment: Node v24.22.0, Python 3.12.10, CUDA PyTorch 2.11.0, Transformers 5.20.2, and NVIDIA GeForce RTX 4060 Laptop GPU (8188 MiB). Whisper Large v3 is cached locally and CUDA reports available.
- A live non-speech HTTP-to-GPU smoke pass completed in 12.6 seconds end to end with 1.172 seconds measured inference. It verifies integration only; live Malayalam quality, five-sample latency, exact model revision, TTS audio/tags, and human review remain blocked.
- Added `app/frontend`, a Next.js usability lab that consumes the same five-scenario manifest. It supports microphone capture or audio upload, temporary server-side transcription, deterministic WER, latency display, meaning preservation and 1-5 usability review, browser-local evidence history, and JSON export.

## Inputs needed before live execution

Five authorized recordings, Malayalam human review, and TTS credentials/voice selection are still required for live completion. The local Python/CUDA/model prerequisites are satisfied on this machine.

## Execution record

### 2026-10-25: P1 and blocked handoff

- Files: `.gitignore`, `scripts/provider-spike/*`, spec/plan/decisions/status, provider-results.md, and shared D-14.
- Verification: `node scripts/provider-spike/validate_manifest.mjs`; `node --test scripts/provider-spike/metrics.test.mjs`; fake `score_results.mjs`; `git check-ignore` for private audio/output/environment files.
- Results: manifest and scoring mechanics pass. Fake results are clearly labeled and do not satisfy live speech criteria.
- Blockers: actual sample durations cannot be recorded until audio exists; Python/model unavailable; no TTS credentials; no Malayalam human review.
- Deviation: the user selected one STT model, so comparative STT ranking was replaced with an approval gate for Whisper Large v3.

### 2026-10-25: model usability frontend

- Files: `app/frontend/*`, `context/brand-guidelines.md`, and the one-file mode in `scripts/provider-spike/transcribe_whisper.py`.
- Safety: simulation mode is visibly labeled and cannot be confused with measured model evidence; uploaded audio is size/type checked and deleted from the temporary directory after each request.
- Verification: `npm run typecheck`, `npm run lint`, and `npm run build` pass. The Playwright smoke workflow passed with local Chrome at desktop and mobile sizes, covering five-scenario loading, upload, simulated transcription, WER display, human review, local persistence, and a clean browser console.
- Limitation: this validates frontend usability and integration control flow only. Live Whisper and Malayalam accuracy still require the prerequisites below.

### 2026-10-25: live runtime recovery

- Installed the signed Python 3.12 runtime and CUDA-enabled PyTorch 2.11.0; verified `torch.cuda.is_available()` on the RTX 4060.
- Cached `openai/whisper-large-v3` under the ignored provider-spike cache and enabled offline model loading for the frontend.
- Replaced Librosa decoding because Windows Application Control blocked Numba's native module. SoundFile plus NumPy now handles PCM loading/resampling, and browser microphone recordings are converted to mono WAV before upload.
- Live verification: a small Windows system WAV traversed `/api/transcribe`, loaded the cached model, inferred on `cuda:0`, and returned a live JSON result. This was not Malayalam speech and is not quality evidence.

## Resume pointer

Read [status.md](status.md). Resume by adding the five private recordings, updating actual durations/statuses, running the live Whisper command, and obtaining Malayalam review. Preserve unrelated working-tree changes.
