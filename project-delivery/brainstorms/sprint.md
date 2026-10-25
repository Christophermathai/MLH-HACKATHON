# ZoomOut shared delivery order

Status: proposed sprint. All units are pending.
Planning basis: two developers, approximately six hours from the architecture.
The complete reliability scope may exceed that window; the schedule below is a target with explicit checkpoints, not an estimate that every proposed task fits.

## Dependency order

```text
001 provider spike --------> 004 transcription ---------+
          |                                            |
          +---------------> 007 TTS/player              |
                                                       v
002 contracts --> 003 sessions --> 005 review/consent --> 006 AI --> 007 verdict --> 008 demo
       |                                                      
       +--> mocked recording, review, AI, and player work in parallel
```

Unit 004 supplies real transcript input to 005; typed fixtures unblock 005 earlier. Unit 007 needs provider results from 001 and judge output from 006 for live integration. Unit 008 verifies all preceding units.

## Two-developer target

| Window | Frontend developer | Backend developer | Integration checkpoint |
| --- | --- | --- | --- |
| 0-1 h | 002 scaffold and contract draft; review language samples | 001 provider spike; agree contracts | Startup works; selected formats or documented blockers |
| 1-2.5 h | 005 typed review/consent, then 004 capture | 003 sessions and confirmation; 004 batch STT adapter | Two isolated participants confirm their own edited text |
| 2.5-3.5 h | 007 verdict view and player against fixtures | 006 analyst/mediator/judge and safety branch | Consented text produces readable verdict or calm safety result |
| 3.5-4.5 h | 007 ordered playback, pause, replay | 007 TTS streaming and session cache | First complete sentence starts speaking; order is preserved |
| 4.5-5.25 h | 008 client failure/reconnect checks | 008 server fallback, expiry, cleanup checks | Audio failures preserve text; privacy gates remain intact |
| 5.25-6 h | Joint 008 device rehearsal and backup preparation | Joint 008 live checks and runbook | Repeatable demo with known limitations recorded |

Both developers review shared schema changes before changing consumers. Contract work in 002 is the first integration checkpoint; mocks allow independent work afterward.

## Scope checkpoints

- If speech access is blocked after the initial spike, continue with typed input and fake adapters while recording the blocker. A text-only demonstration does not complete voice requirements.
- If live partial transcription is too costly, ship batch transcription first as the architecture permits.
- Keep the three screens, explicit consent, private per-side state, a safety branch, and readable verdict throughout implementation.
- Preserve streaming output as the first audio priority. Defer decorative motion and richer score visualizations.
- Do not defer privacy enforcement or raw-audio cleanup to the final rehearsal.
- Prerecorded output must match its labeled demo scenario; do not present unrelated cached audio as a newly generated verdict.
- Leave unfinished scope visibly pending. Extend the schedule if required instead of marking unverified integration complete.

## Definition of an integrated MVP

Two independent participants can join, provide speech (batch or streaming), correct their own transcript, explicitly consent, and receive a balanced spoken verdict plus zoom-out and truce. A flagged scenario bypasses playful judgment. Reconnect respects participant ownership; expired sessions lose retained content. TTS failure leaves complete readable output. Raw audio is removed after transcription, and session artifacts are removed on expiry.

Record observed results for real provider behavior separately from mocked tests. Each unit's brainstorm contains its acceptance checks and open specification decisions.
