# Speech provider feasibility: decisions

Status: STT direction approved by user; TTS choices remain pending measured evidence.

## Chosen approach

Use five synthetic or explicitly consented samples. Validate the official `openai/whisper-large-v3` checkpoint as the only STT candidate, locally through Transformers in batch mode. Compare the proposed ElevenLabs voice with Google TTS fallback. Cap the spike at one hour and publish a partial report if model execution, TTS access, samples, or human review are unavailable.

Ownership boundary: Owns provider evidence and selection. Feature 002 owns application contracts; 004 and 007 own production adapters.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/001-speech-provider-feasibility/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-06, D-08, D-14 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

Live account access and Malayalam human review are execution prerequisites. No provider capability, price, or account quota was checked in this documentation task.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
- 2026-10-25: User selected Whisper Large v3 for STT; removed the Google/OpenAI STT comparison and established a five-sample approval gate for `openai/whisper-large-v3`.
