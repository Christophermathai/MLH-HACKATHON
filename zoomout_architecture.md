# ZoomOut: Architecture (Streaming Audio In and Out)

> *Big feelings. Small problems. Bigger perspective.*

Two people each record their side of a petty disagreement in Malayalam (or mixed Malayalam-English). A set of agents analyses each side privately, then a "Petty Court" judge speaks a playful, balanced verdict aloud, followed by a zoom-out view and a practical truce.

---

## 1. System Overview

```
BROWSER (Next.js + TypeScript + Tailwind)
  mic -> AudioWorklet (16 kHz PCM chunks)
     <-> WebSocket (audio up; events + audio chunks down)
  UI: record -> live transcript -> edit -> consent -> verdict
  Player: ordered queue of audio chunks (Web Audio API)

SERVER (Node or FastAPI WebSocket gateway)
  Session store: room code, side A/B state, transcripts, consent flags
  |- STT adapter      -> Whisper Large v3 batch transcription (ml-IN)
  |                      fallback: typed transcript input
  |- Analyst agent x2 -> per-side private analysis (JSON)
  |- Mediator agent   -> compares both sides (JSON)
  |- Judge agent      -> streams spoken verdict text with emotion tags
  '- TTS adapter      -> ElevenLabs (v3 or v4) streaming
                         fallback: Google Cloud TTS (Chirp 3 HD, ml-IN) / cached audio
```

---

## 2. Technology Choices

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind | Three screens only: record, review, verdict |
| Audio capture | `getUserMedia` + AudioWorklet | 16 kHz mono PCM chunks (MediaRecorder works as a simpler fallback) |
| Transport | WebSocket | One socket per participant per session |
| Speech-to-text | `openai/whisper-large-v3` via Transformers | User-selected local batch path. Validate Malayalam and code-switching on five samples before calling it demo-ready |
| LLM | Any structured-JSON-capable LLM API | Separate calls for JSON analysis and spoken verdict |
| Text-to-speech | ElevenLabs Eleven v3 (compare v4) | v3 lists Malayalam; supports inline audio tags such as `[excited]`, `[whispers]` |
| TTS fallback | Google Cloud TTS Chirp 3 HD (ml-IN) | Same `speak(text)` interface |
| State | In-memory (Map) or SQLite | Redis/queue not needed for the MVP |

---

## 3. Session State Machine

```
CREATED
  -> A_RECORDING -> A_TRANSCRIBING -> A_REVIEW -> A_READY
  -> B_RECORDING -> B_TRANSCRIBING -> B_REVIEW -> B_READY
  (B can start while A is still processing)
  -> BOTH_READY (both consented to share)
  -> MEDIATING -> JUDGING (text + audio streaming) -> DONE
```

Rules:
- Each person's analysis stays **private** until both have confirmed their transcript and consented to sharing.
- The system knows who submitted each recording, so **no diarization** is needed.
- Raw audio is deleted once transcription completes.

---

## 4. Input Pipeline (Streaming Speech-to-Text)

1. The browser captures a bounded recording and sends encoded chunks over the WebSocket.
2. On stop, the server runs local batch transcription with `openai/whisper-large-v3`, language `malayalam`, task `transcribe`.
3. The final transcript opens in an editable box (`final_transcript`).
4. The person corrects errors, taps **Confirm**, and consents to sharing.

**Fallback:** if model execution or transcription fails, use typed transcript input through the same review and consent flow.

**Provider-agnostic interface:**

```ts
interface SttProvider {
  batch(audio: Buffer): Promise<string>;
}
```

Run Whisper Large v3 on five Malayalam/code-switched samples in hour 0. Record word edits, latency, and Malayalam meaning review. If it is not ready, keep typed input for the demo.

---

## 5. Agent Pipeline

### 5.1 Analyst agent (one per side, runs in the background)

Input: one confirmed transcript. Output (JSON, private):

```json
{
  "side": "A",
  "upset_about": ["..."],
  "stated_facts": ["..."],
  "assumptions_made": ["..."],
  "possible_feelings": ["..."],
  "unclear_lines": ["..."],
  "safety_flags": { "abuse_or_coercion_signals": false, "notes": "" }
}
```

Prompt rules:
- The transcript may contain speech-recognition errors. Flag unclear lines, do not invent meaning.
- Emotions are **possibilities, not facts**.
- If `abuse_or_coercion_signals` is true, skip the playful verdict (see Safety).

### 5.2 Mediator agent (runs after both sides are ready)

Input: both analyst JSONs. Output (JSON for the screen):

```json
{
  "what_each_is_upset_about": { "A": ["..."], "B": ["..."] },
  "where_interpretations_differ": ["..."],
  "petty_score": 4,
  "zoom_out": {
    "immediate_issue": "...",
    "possible_underlying_feelings": ["..."],
    "bigger_picture": "..."
  },
  "truce": {
    "next_step": "...",
    "requires_apology": false
  }
}
```

### 5.3 Judge agent (streams plain spoken text)

Input: mediator JSON. Output: plain text, short sentences, 1-2 emotion tags per section, no markdown or emoji.

Structure of the spoken verdict:
1. Dramatic opening: case name and "charges".
2. Playful ruling that pokes fun at the **situation, never the people**.
3. Gentle zoom-out line.
4. Truce "sentence" (practical, silly, no forced apology).

Example tagged style (illustrative):

```
[dramatic] Court is now in session.
The case: The Great Dishes Disaster.
[amused] Both parties are guilty of caring a little too much about a plate.
[warm] Underneath it, maybe both of you just wanted to feel noticed.
[playful] The sentence: one chai, shared, no speeches.
```

---

## 6. Output Pipeline (Streaming Text-to-Speech)

The key trick is to start speaking after the first sentence, not after the whole verdict.

```
Judge LLM (token stream)
   -> sentence splitter (. ? ! and Malayalam danda boundaries)
   -> TTS request per sentence (ordered)
   -> audio chunks over WebSocket (audio_chunk with sequence number)
   -> client queue plays in order, text appears in sync
```

Details:
- Number every chunk (`seq`) so the client can reorder and replay reliably.
- Run at most 2 TTS requests concurrently (free-tier concurrency is limited), keeping order via `seq`.
- Cache the final audio per session so replays cost no credits.
- Keep a text version and a play/pause control on screen (venues are noisy).
- Use one neutral judge voice for both sides so it never sounds like it favours one person.
- Do not clone participants' voices.

**Emotion tags:** inline tags are documented mostly with English examples. Test a Malayalam line with `[excited]` and `[sad]` before relying on them. If tags are ignored or read aloud, express emotion through punctuation and sentence rhythm instead.

**Credits:** Eleven v3 is billed per character, so a 400-character verdict costs roughly 400 credits. Generate once, cache, and pre-generate the demo audio the night before. Check your account for the current free-tier allowance.

---

## 7. WebSocket Event Schema

Client -> Server:

| Event | Payload |
|---|---|
| `join` | `{ room, side }` |
| `audio_chunk` | binary PCM frame |
| `stop_recording` | `{}` |
| `confirm_transcript` | `{ text, consent: true }` |

Server -> Client:

| Event | Payload |
|---|---|
| `partial_transcript` | `{ text }` |
| `final_transcript` | `{ text, unclear_lines? }` |
| `side_ready` | `{ side }` |
| `both_ready` | `{}` |
| `analysis_json` | mediator output |
| `verdict_text_delta` | `{ text }` |
| `audio_chunk` | `{ seq, mime, data }` |
| `done` | `{}` |
| `error` | `{ code, message, fallback? }` |

---

## 8. Safety and Privacy

- Treat inferred emotions as possibilities, not facts.
- Do not trivialise abuse, coercion, or serious power imbalances. If flagged, skip the Petty Court tone, show a calm message, and suggest talking to a trusted person or professional.
- Do not pressure anyone to apologise or reconcile.
- Keep each side's analysis private until both consent.
- Delete raw audio after transcription. Keep transcripts only for the session.
- Show a notice: *"ZoomOut is for everyday disagreements, not for situations involving abuse or safety concerns."*

---

## 9. Failure and Fallback Plan

| Failure | Fallback |
|---|---|
| Whisper model unavailable or transcription fails | Use typed text input |
| STT quality poor | Keep typed text input and mark live voice readiness blocked |
| TTS fails or credits run out | Google Cloud TTS, or pre-generated audio |
| All audio fails | Full verdict still shown as text |
| LLM returns invalid JSON | Strip code fences, retry once, then show a simple error |
| Network drops | Resume session by room code; transcripts are kept server-side |

---

## 10. Build Plan (about 6 hours, two people)

| Time | Focus |
|---|---|
| 0-1 h | Validate Whisper Large v3 on five Malayalam/code-switched samples; test one ElevenLabs Malayalam line with tags |
| 1-2.5 h | Recording UI, WebSocket gateway, transcript review screen |
| 2.5-3.5 h | Analyst, mediator, and judge prompts with structured JSON |
| 3.5-4.5 h | Streaming TTS, audio queue, verdict screen, progress states |
| 4.5-5.25 h | Consent, error handling, fallbacks, audio cleanup |
| 5.25-6 h | End-to-end test, cached demo audio, rehearsal |

**If time is short:** keep batch transcription with a processing animation and typed fallback. Streaming **output** creates the wow moment, so keep it.

---

## 11. Demo Script (3 minutes)

1. Pitch (20 s): "Big feelings, small problems."
2. Person A records a petty complaint in Malayalam (30 s). Show live transcript.
3. Person B records while A's analysis runs in the background (30 s).
4. Both review and consent (15 s).
5. The Petty Court verdict is spoken aloud with on-screen text, followed by the zoom-out view and truce (60 s).
6. Close with the privacy and safety notes (15 s).

Keep a pre-recorded run as a backup in case the live demo fails.
