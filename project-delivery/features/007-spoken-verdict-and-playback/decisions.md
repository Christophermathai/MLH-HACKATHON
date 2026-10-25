# Spoken verdict, playback, and result screen: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Assign seq from 0 before dispatch. Use at most two concurrent sentence jobs, counting fallback inside the same slot. Each audio_chunk is one complete independently decodable sentence clip; aggregate provider transport fragments before sending. Use a tested MIME from 001; validate PCM-WAV or provider format in target browsers. A 20-second deadline applies to each provider attempt; try one configured fallback once.

Ownership boundary: Owns sentence splitting, TTS scheduling, audio manifests/cache, player state, and result view. 006 owns verdict content; 003 owns authorization and expiry.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/007-spoken-verdict-and-playback/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-02, D-07, D-10, D-11, D-12 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

Live codec compatibility and first-sentence latency require real provider/browser evidence. Sentence clips preserve streaming output but do not promise provider-fragment playback or word-level alignment.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
