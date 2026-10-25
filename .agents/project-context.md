# ZoomOut project context

ZoomOut helps two people put a petty disagreement into perspective. Each person
records their side in Malayalam or mixed Malayalam-English. Side-specific
analysis stays private until both people confirm their transcript and consent.
The system then produces a balanced Petty Court verdict, a zoom-out, and a truce.

## Architecture

- `app/frontend`: Next.js, TypeScript, and Tailwind client.
- `app/api`: Node or FastAPI WebSocket gateway and session orchestration.
- One WebSocket connection per participant per session.
- STT and TTS provider adapters hide vendor-specific SDKs and expose stable
  streaming and batch interfaces.
- In-memory or SQLite session state is sufficient for the MVP.

## Flow and agents

`record -> live transcript -> edit -> confirm and consent -> verdict`

The analyst runs privately for each side, the mediator runs after both sides are
ready, and the judge streams short spoken verdict text. Person B may record while
Person A is processing.

## Safeguards

- Never expose side analysis before both consent flags are true.
- Treat inferred emotions as possibilities, never facts.
- Delete raw audio after transcription.
- Serious safety flags suppress playful treatment and reconciliation pressure.
- Keep text output available when TTS or networking fails.
- Use one neutral judge voice and never clone participant voices.

`zoomout_architecture.md` is the source of truth for detailed schemas, events,
fallbacks, and demo priorities.
