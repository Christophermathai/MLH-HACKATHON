# Speech provider spike

This harness evaluates the user-selected `openai/whisper-large-v3` checkpoint in batch mode. Audio belongs in the ignored `samples-private/` directory and must be synthetic or explicitly consented.

## Prepare

1. Install Python 3.10 or newer and create a virtual environment.
2. Install `requirements.txt`.
3. Record the five manifest scripts as mono WAV files at the listed paths.
4. Update each `durationSeconds` and `status` after inspecting the audio.

The model is large. CUDA is selected automatically when available; CPU execution is supported but may be slow. Record the generated model revision, device, dtype, and library versions in the result file.

## Run

```powershell
node scripts/provider-spike/validate_manifest.mjs
node --test scripts/provider-spike/metrics.test.mjs
python scripts/provider-spike/transcribe_whisper.py
node scripts/provider-spike/score_results.mjs scripts/provider-spike/sample-manifest.json scripts/provider-spike/output/whisper-results.json scripts/provider-spike/output/scored-results.json
```

Fill `meaningPreserved` and `reviewerNotes` in `whisper-results.json` after Malayalam review, then rerun scoring. Generated output is ignored because it can include private transcriptions; copy only redacted aggregate evidence into `provider-results.md`.

The included `fake-results.json` tests manifest/scoring mechanics only:

```powershell
node scripts/provider-spike/score_results.mjs scripts/provider-spike/sample-manifest.json scripts/provider-spike/fake-results.json
```

Do not treat fake results as model evidence. This spike validates batch inference, not true streaming ASR.
