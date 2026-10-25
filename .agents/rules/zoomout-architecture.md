# ZoomOut architecture rules

Use `zoomout_architecture.md` as the source of truth for the following:

- three client screens: record, review, verdict;
- session states from `CREATED` through `DONE`;
- typed client/server WebSocket events;
- analyst, mediator, and judge responsibilities;
- Malayalam `ml-IN` STT with batch fallback;
- ordered, cached TTS chunks with a text-only fallback;
- consent gating, private side analysis, raw-audio deletion, and safety flags.

Do not add diarization, Redis, queues, participant voice cloning, or forced
apologies to the MVP. Keep vendor SDKs behind provider-agnostic adapters.
