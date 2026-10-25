# Recording and transcription: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Batch capture is the required MVP path; PCM streaming is an explicit extension phase. Limit recordings to 60 seconds and 5 MiB total with 32 KiB frames. Encoded batch MIME must match a configuration validated in 001; unsupported browser/provider combinations go to typed input. Use 60-second batch and 15-second streaming-inactivity deadlines.

Ownership boundary: Owns microphone lifecycle, input encoding, STT adapters, and raw-audio cleanup. 005 owns text editing and confirmation; 003 owns recipient binding and state.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/004-recording-and-transcription/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-06, D-07, D-14 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

Browser/provider codec compatibility requires unit 001 evidence and a real-device check. Optional streaming is separately tracked so batch MVP completion does not imply streaming completion.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
