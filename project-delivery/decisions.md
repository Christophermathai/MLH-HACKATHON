# ZoomOut delivery decisions

Status: proposed planning baseline, 2026-10-25. The user requested specifications, plans, and review notes for all eight brainstorms together. Draft planning is included in that request; this record does not imply individual product decisions or implementation are approved.

## Baseline and precedence

The source architecture remains [zoomout_architecture.md](../zoomout_architecture.md). This record resolves brainstorm ambiguities into explicit working defaults. Architecture extensions are listed in feature 002 rather than silently treated as pre-existing behavior. No application or provider behavior has been verified.

| Decision | Default used in these specs/plans | Rationale and impact |
| --- | --- | --- |
| D-01 Runtime | Next.js/TypeScript/Tailwind client, Node TypeScript gateway, npm workspaces | Shares contracts and matches the recommended brainstorm approach. FastAPI remains an alternative requiring plan/schema changes. |
| D-02 State | One process, in-memory rooms, absolute 30-minute lifetime | Bounded session-only retention; restart loses rooms. 003 and 007 implement disposal. |
| D-03 Identity | Eight-character random room code, separate 32-byte opaque side tokens, hashed server-side | Code invites first B claim; tokens authorize occupied-side reconnect. No account system. |
| D-04 Consent | Explicit unchecked consent, edited text locked after acceptance, 1-4000 Unicode code points | Idempotent immutable confirmation; changed text requires a new room. Both confirmations precede all shared result output. |
| D-05 Privacy | Analyst JSON stays server-private even after both consent | Only derived mediator/verdict is required on screen; less unnecessary exposure. |
| D-06 Input | Batch speech required; PCM streaming optional extension | Matches architecture fallback priority. Streaming FRs remain explicitly deferred if omitted. |
| D-07 Audio limits | 60 seconds, 5 MiB input, 32 KiB audio frames; 2 MiB per decoded output clip and 20 MiB session audio cache | Bounded buffers; exceeding output limits falls back to readable text. |
| D-08 Language/tone | Malayalam verdict with natural English terms allowed; score 0-10; no forced apology | Concrete default for Malayalam-first demo. Human review remains necessary. |
| D-09 Model bounds | 64 KiB structured result, one invalid-JSON retry, 60-second stage deadline, 1200 visible-character judge cap | Predictable failure behavior; no invented completion after truncation. |
| D-10 Output | Sentence clips with seq from 0, two active jobs max, primary then one fallback | Stream after the first sentence; aggregate provider fragments into decodable clips. |
| D-11 Completion | Final audio manifest then done:verdict/safety/incomplete; done is not playback finished | Explicit missing-clip and partial-generation handling. |
| D-12 Recovery | Own-side snapshot then cache replay and newer events; no paid regeneration on reconnect | Unsaved edits/incomplete recording are not durable; late callbacks are ignored. |
| D-13 Safety | Either valid flag skips mediator/playful judge after both consent; invalid safety evaluation fails closed | Generic calm output never identifies the flagged side. This does not guarantee detection of all harmful situations. |
| D-14 Provider selection | STT is user-selected `openai/whisper-large-v3`, locally executed in batch mode; exact TTS provider/model/format remains an output of measured feasibility checks | Whisper still requires five-sample and human validation before live readiness. Architecture TTS candidates are not assertions of current availability or pricing. |
| D-15 Demonstration | Local baseline; remote host/device chosen and recorded at execution | Live claims require real checks; prerecorded backup must be labelled and scenario-matched. |
| D-16 Resource controls | 100 active rooms; create 10/min/source, claim 20/min/source; Origin allowlist | Bounds the demo gateway without adding distributed infrastructure. |

## Contract extensions

Feature 002 adds bootstrap create/claim operations, authenticated join, start/cancel recording, typed-entry transition, authoritative snapshots, replay requests, audio status/manifests, a generic safety result, and explicit terminal outcomes. Existing architecture event names are preserved; added payload fields are documented as extensions.

## Review status

All choices are draft defaults used consistently across the generated documents. Check feature audit.md files for document-review results and implementation prerequisites. No application deployment, live provider run, or runtime compliance claim is authorized or implied by this documentation.
