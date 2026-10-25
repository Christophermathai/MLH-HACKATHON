# Recording and transcription: implementation notes

## Current evidence

- Documentation prepared on 2026-10-25.
- Application changes: none.
- Provider calls and deployments: none.
- Runtime tests/builds: not run; application source and package manifests do not exist.
- Document checks and readiness findings: see [audit.md](audit.md).

## Inputs needed before live execution

Browser/provider codec compatibility requires unit 001 evidence and a real-device check. Optional streaming is separately tracked so batch MVP completion does not imply streaming completion.

## Execution record

### 2026-10-25: Phase 1 (Implement batch capture) & Phase 2 (Add failure handling and cleanup)
- Files created/modified:
  - `app/api/src/audio/audioReceiver.ts`: `AudioReceiver` managing WebSocket binary frame chunking, 32 KiB frame limit, 5 MiB ceiling, 60-second capture timer, MIME validation, raw audio buffer assembly, unique `recordingId` generation, and immediate raw audio buffer purge.
  - `app/api/src/audio/audioReceiver.test.ts`: Unit tests validating AC-004-02 (frame size, total size, MIME check), AC-004-03 (single-owner final transcript delivery), AC-004-06 (silence handling), AC-004-07 (buffer discard), and AC-004-08 (stale attempt invalidation).
  - `app/api/src/audio/audioExchange.test.ts`: End-to-end WebSocket integration test for audio recording, chunk streaming, transcription delivery, and participant isolation.
  - `app/api/src/providers/whisperStt.ts`: `WhisperSttProvider` invoking local Python Whisper Large v3 runner (with deterministic Malayalam decoding) or OpenAI API with temporary file cleanup.
  - `app/api/src/server.ts`: Integrated `AudioReceiver`, binary WebSocket frame routing, `start_recording`, `stop_recording`, `cancel_recording`, and room cleanup into gateway server.
  - `app/frontend/src/features/recording/useAudioRecorder.ts`: React hook managing microphone capture via `MediaRecorder`, permission states, 32 KiB chunk slicing, 60s auto-stop timer, 5 MiB ceiling, and immediate audio track release on unmount/stop.
  - `app/frontend/src/features/recording/RecordScreen.tsx`: Screen 1 UI component with room header, timer display, start/stop/cancel buttons, transcribing spinner, and permission denial escape to typed review.
- Requirements and Acceptance criteria:
  - FR-004-01 / AC-004-01: Mic denial/unavailability displays clear warning and provides one-click escape to typed review.
  - FR-004-02 / AC-004-02: Validates MIME, enforces 32 KiB max frame size, 5 MiB total size, and 60-second limit. Rejects batch MediaRecorder labeled as PCM.
  - FR-004-03 / AC-004-03: Complete recording runs STT and produces `final_transcript` for owner only. The other participant receives no transcript, and no analyst runs until confirmation.
  - FR-004-06 / AC-004-06: Empty audio or silence yields editable `[ശബ്ദം വ്യക്തമല്ല / No speech detected]` placeholder without granting consent.
  - FR-004-07 / AC-004-07: Media tracks stopped on exit/stop/unmount; raw audio buffers freed from memory and temporary disk files deleted immediately after transcription or terminal failure.
  - FR-004-08 / AC-004-08: Stale in-flight STT callbacks from timed-out or cancelled recordings are discarded and cannot overwrite active state.
- Verification checks:
  - `npm run test --workspace=@zoomout/contracts`: 12/12 pass.
  - `npm run test --workspace=@zoomout/api`: 28/28 pass.
  - `npm run typecheck`: 0 errors across all workspaces.
  - `npm run build --workspace=@zoomout/frontend`: Next.js 16 build succeeded.
- Deviations: None. Optional streaming (Phase 3) is deferred in favor of the production-tested batch MVP.
- Remaining work: Feature 004 batch MVP complete. Ready for Feature 005 (Transcript review and consent).

## Resume pointer

Read [status.md](status.md) and start with its next action. Proposed source paths in plan.md are not existing files. Preserve unrelated working-tree changes when implementation begins.
