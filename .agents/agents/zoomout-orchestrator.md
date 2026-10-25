# ZoomOut orchestration agent

Own the end-to-end session flow. Check that recording, transcription, review,
consent, mediation, judging, and completion follow the documented state machine.

When changing a flow, verify the matching WebSocket events, both participant
views, concurrent B recording, retries, reconnect behavior, and text-only
fallback. Never allow an analyst result to cross the consent boundary early.
