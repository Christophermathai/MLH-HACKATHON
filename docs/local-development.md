# ZoomOut Local Development & Architecture Guide

Welcome to the **ZoomOut** codebase! This guide gets you set up quickly and explains how the system works, where contracts live, and how upcoming features fit together.

---

## 1. High-Level Flow: Record -> Review -> Verdict

ZoomOut helps two participants resolve a petty disagreement with perspective:
1. **Record (`/record`):** Participant A creates a room and records their account (or types it). Participant B joins with the 8-character room code and records their side.
2. **Review & Consent (`/review`):** Each person reviews and edits their transcript in private. When satisfied, each grants explicit consent to share for mediation. Transcripts and side analysis remain strictly confidential until **both** participants have consented.
3. **Verdict (`/verdict`):** The Petty Court judge speaks a lighthearted, balanced verdict aloud sentence by sentence, followed by an objective zoom-out perspective and a practical truce.

---

## 2. Architecture & Service Ports

The monorepo uses npm workspaces:

| Component | Directory | Local Port | Tech Stack / Role |
|---|---|---|---|
| **Contracts** | `packages/contracts` | N/A | Shared runtime schemas (Zod), protocol constants, envelopes, and validators. |
| **Gateway** | `app/api` | `8787` | Node TypeScript WebSocket gateway, session state, rate limits, provider orchestration. |
| **Frontend** | `app/frontend` | `3000` | Next.js 16 (App Router), React 19, Tailwind CSS client. |

---

## 3. Quick Start

### 3.1 Prerequisites
- Node.js `v22` or `v24` (Node `v24.22.0` used in development)
- npm `10+` or `11+`

### 3.2 Install Dependencies
```bash
npm install
```

### 3.3 Configuration (Mock Mode vs Live Mode)

Create your local `.env` from `.env.example`:
```bash
cp .env.example .env
```

ZoomOut defaults to **`PROVIDER_MODE=mock`**. In mock mode, the system runs with deterministic fake adapters for Speech-to-Text, LLM analysis/mediation, Judge streaming, and TTS synthesis. **No API keys or cloud accounts are needed.**

If running with `PROVIDER_MODE=live`, the gateway requires:
- `OPENAI_API_KEY`: For LLM analysis and mediation.
- `ELEVENLABS_API_KEY`: For streaming TTS judge verdict voice.

*If live mode is activated without required keys, the gateway fails fast on startup with a clear error.*

### 3.4 Running Locally

- **Run all services concurrently:**
  ```bash
  npm run dev:all
  ```
- **Run gateway only (port 8787):**
  ```bash
  npm run dev:api
  ```
- **Run frontend only (port 3000):**
  ```bash
  npm run dev:frontend
  ```

---

## 4. Verification & Testing

Every workspace provides standard lifecycle scripts:

```bash
# Build all packages and applications
npm run build

# Typecheck all TypeScript code
npm run typecheck

# Run all unit and integration tests
npm run test

# Run end-to-end gateway smoke test
npm run test:e2e
```

---

## 5. Where Schemas and Contracts Live

- **Contract source:** `packages/contracts/src/`
  - `constants.ts`: Frame limits (32 KiB audio, 64 KiB control JSON), session timeouts (30 min), error codes.
  - `events.ts`: `parseClientMessage`, `parseServerMessage`, `createClientMessage`, `createServerMessage`.
  - `models.ts`: `AnalystSchema` (server-private), `MediatorSchema` (`petty_score` 0-10, `requires_apology: false`), `SafetyResultSchema`.
  - `bootstrap.ts`: `CreateRoomResponseSchema`, `ClaimParticipantRequestSchema`, `SessionSnapshotSchema`, `assertNoPrivateDataInSnapshot`.
  - `errors.ts`: `ZoomOutPublicError`, `sanitizeError`.
- **Event contract guide:** [docs/event-contract.md](event-contract.md)
- **Baseline fixtures:** `tests/fixtures/events/` and `tests/fixtures/providers/`

---

## 6. Implementation Status & Feature Roadmap

| Feature | Scope | Specification | Status |
|---|---|---|---|
| **001** | Speech provider feasibility (Whisper Large v3) | [001 Spec](../project-delivery/features/001-speech-provider-feasibility/spec.md) | Harness ready, live measurements pending. |
| **002** | Application foundation and shared contracts | [002 Spec](../project-delivery/features/002-foundation-and-contracts/spec.md) | **Completed** (Workspaces, Schemas, Fakes, Smoke exchange). |
| **003** | Session gateway, participant isolation, recovery | [003 Spec](../project-delivery/features/003-session-gateway-and-recovery/spec.md) | Pending implementation. |
| **004** | Recording and transcription | [004 Spec](../project-delivery/features/004-recording-and-transcription/spec.md) | Pending implementation. |
| **005** | Transcript review and consent | [005 Spec](../project-delivery/features/005-transcript-review-and-consent/spec.md) | Pending implementation. |
| **006** | Analysis, mediation, judge text, and safety | [006 Spec](../project-delivery/features/006-analysis-mediation-and-safety/spec.md) | Pending implementation. |
| **007** | Spoken verdict, playback, and result screen | [007 Spec](../project-delivery/features/007-spoken-verdict-and-playback/spec.md) | Pending implementation. |
| **008** | Integration, failure recovery, and demo rehearsal | [008 Spec](../project-delivery/features/008-integration-and-demo-readiness/spec.md) | Pending implementation. |
