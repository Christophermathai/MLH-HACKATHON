# Whisper Evidence Desk

Next.js usability lab for the five Malayalam speech scenarios in feature 001. It records or uploads audio, runs `openai/whisper-large-v3`, calculates normalized word error rate, captures human meaning/usability judgments, and exports a local evidence log.

## Run the interface safely

```powershell
cd app/frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

The example environment enables simulation mode. Simulated passes are labeled in the UI and must not be treated as model evidence.

## Run the live model

Install Python 3.10+ and `scripts/provider-spike/requirements.txt`, then set `WHISPER_DEMO_MODE=0` in `.env.local`. If Python is not on `PATH`, set `WHISPER_PYTHON` to its executable path. The first pass downloads and loads `openai/whisper-large-v3` and can take several minutes.

Uploaded audio is limited to 5 MiB and is removed from the server's temporary directory after each request. Saved evaluations stay in browser local storage until exported or cleared by the browser.

## Verify

```powershell
npm run typecheck
npm run lint
npm run build
```

`node scripts/browser-smoke.mjs` runs the workflow against an already-running simulation server and uses the locally installed Chrome by default.
