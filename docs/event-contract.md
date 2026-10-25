# ZoomOut Event & Protocol Contract

This document provides the definitive specification for the wire protocol, event envelopes, bootstrap REST endpoints, WebSocket lifecycle, and shared model schemas in ZoomOut.

Shared schemas and validators are implemented in `@zoomout/contracts` (`packages/contracts`).

---

## 1. Protocol Architecture & Envelopes

ZoomOut uses a **single versioned JSON envelope** for all control messages exchanged over WebSocket between browser clients and the gateway server:

```json
{
  "v": 1,
  "type": "<event_type>",
  "payload": { ... },
  "requestId": "optional-uuid-v4"
}
```

### Constraints & Framing
- `v`: Protocol version integer, strictly `1`.
- `requestId`: Optional UUID v4 supplied by client control messages; gateway may echo it in direct responses.
- **Maximum JSON Control Frame:** 64 KiB (`LIMITS.MAX_CONTROL_JSON_BYTES`). Messages exceeding this are rejected with code `LIMIT_EXCEEDED`.
- **Binary Input Frames:** Audio chunks during live recording are transmitted as raw binary frames (not wrapped in JSON) up to 32 KiB (`LIMITS.MAX_AUDIO_FRAME_BYTES`) per chunk, capped at 5 MiB / 60 seconds per recording.
- **Direction Enforcement:** Client messages cannot send server event types, and server messages cannot send client event types. Swapped directions are rejected with code `BAD_EVENT`.

---

## 2. Bootstrap & Participant Claim (HTTP)

### 2.1 Room Creation (Person A)
- **Endpoint:** `POST /api/rooms`
- **Request Body:** `{}` (empty object)
- **Response Status:** `201 Created`
- **Response Payload:**
  ```json
  {
    "room": "ABCD1234",
    "side": "A",
    "resumeToken": "<32-byte-hex-token>",
    "expiresAt": "2026-10-25T13:00:00.000Z"
  }
  ```
- **Security Rule:** The room code (`ABCD1234`) is safe to share with Person B. The `resumeToken` is strictly private and stored in `sessionStorage` on Person A's device.

### 2.2 Room Claim (Person B)
- **Endpoint:** `POST /api/rooms/{room}/participants`
- **Request Body:** `{ "side": "B" }`
- **Response Status:**
  - `201 Created` (First claim):
    ```json
    {
      "room": "ABCD1234",
      "side": "B",
      "resumeToken": "<32-byte-hex-token>",
      "expiresAt": "2026-10-25T13:00:00.000Z"
    }
    ```
  - `409 Conflict` (Side B already claimed):
    ```json
    {
      "code": "SIDE_TAKEN",
      "message": "Side B has already been claimed for this room."
    }
    ```

---

## 3. WebSocket Lifecycle & Session Snapshot

### 3.1 Connection & Authentication
- **Endpoint:** `ws://<host>:<port>/ws`
- **Mandatory First Message (`join`):**
  ```json
  {
    "v": 1,
    "type": "join",
    "payload": {
      "room": "ABCD1234",
      "side": "A",
      "resumeToken": "<token>"
    }
  }
  ```
- On successful join, the server immediately pushes `session_snapshot` containing the authoritative state.
- If credentials or room are invalid, server returns sanitized error (`UNAUTHORIZED` or `SESSION_UNAVAILABLE`) and closes the socket.

### 3.2 Session Snapshot Schema (`session_snapshot`)
```json
{
  "room": "ABCD1234",
  "side": "A",
  "expiresAt": "2026-10-25T13:00:00.000Z",
  "ownState": "READY",
  "ownText": "My statement...",
  "ownConfirmed": true,
  "ownConsent": true,
  "readiness": {
    "A": true,
    "B": false
  },
  "sessionState": "A_READY",
  "generationId": null,
  "sharedResult": null,
  "verdictText": null,
  "outcome": null,
  "audioManifest": null
}
```

> [!IMPORTANT]
> **Privacy Projection:** The snapshot never exposes Person B's transcript or private analyst notes to Person A. `assertNoPrivateDataInSnapshot()` verifies this projection.

---

## 4. Client Events (Browser -> Gateway)

| Event Type | Payload Fields | Purpose / Behavior |
|---|---|---|
| `join` | `room`, `side`, `resumeToken` | Authenticates socket and binds to room/side. |
| `start_recording` | `mode` ("batch"\|"streaming"), `mime`, optional audio params | Begins recording session. |
| `stop_recording` | `{}` | Ends audio input; triggers batch STT. |
| `cancel_recording`| `{}` | Aborts current recording, cleans up temporary audio buffers. |
| `start_typed_input`| `{}` | Abandons voice input and opens empty editable text box. |
| `confirm_transcript` | `text` (1-4000 chars), `consent: true` | Locks edited text and grants consent to share for mediation. Immutable once confirmed. |
| `replay_audio` | `{}` | Requests re-sending cached audio clips after verdict completion. |

---

## 5. Server Events (Gateway -> Browser)

| Event Type | Payload Fields | Purpose / Visibility |
|---|---|---|
| `session_snapshot` | Authoritative snapshot (Section 3.2) | Sent on join / reconnect. |
| `recording_started`| `mode`, `mime` | Confirms recording capture started. |
| `partial_transcript`| `text` | Live interim transcript (side owner only). |
| `final_transcript` | `text`, `unclear_lines?` | Completed transcript ready for review (side owner only). |
| `side_ready` | `side` ("A"\|"B") | Broadcast when a side confirms text and consents. |
| `both_ready` | `{}` | Broadcast when both A and B have consented. |
| `analysis_json` | Validated Mediator object | Public mediation output (only after both consent). |
| `verdict_text_delta`| `text` | Streaming verdict sentence text for display (tags stripped). |
| `safety_result` | `message` | Generic safety advice if safety trigger tripped. |
| `audio_chunk` | `seq`, `mime`, `data` (base64), `generationId?` | One complete decodable spoken sentence audio clip. |
| `audio_status` | `seq`, `status` ("ready"\|"failed"), `code?` | Status of a specific sentence audio job. |
| `audio_manifest` | `totalSentences`, `textComplete`, `entries` | Summary of all audio clips for current generation. |
| `done` | `outcome` ("verdict"\|"safety"\|"incomplete") | Server generation concluded. |
| `error` | `code`, `message`, `fallback?` | Sanitized public error notice. |

---

## 6. AI Model Schemas

### 6.1 Private Analyst Schema (`AnalystSchema`)
Runs privately per side. Output is strictly confidential and kept server-side:
```json
{
  "side": "A",
  "upset_about": ["string array, max 20 entries"],
  "stated_facts": ["string array, max 20 entries"],
  "assumptions_made": ["string array, max 20 entries"],
  "possible_feelings": ["string array, max 20 entries"],
  "unclear_lines": ["string array, max 20 entries"],
  "safety_flags": {
    "abuse_or_coercion_signals": false,
    "notes": "string, max 1000 chars"
  }
}
```

### 6.2 Public Mediator Schema (`MediatorSchema`)
Runs after both sides consent. Rendered on both participants' screens:
```json
{
  "what_each_is_upset_about": {
    "A": ["string array"],
    "B": ["string array"]
  },
  "where_interpretations_differ": ["string array"],
  "petty_score": 4,
  "zoom_out": {
    "immediate_issue": "string",
    "possible_underlying_feelings": ["string array"],
    "bigger_picture": "string"
  },
  "truce": {
    "next_step": "string",
    "requires_apology": false
  }
}
```
*Note: `petty_score` is an integer between 0 and 10. `requires_apology` must be strictly `false`.*

---

## 7. Audio Delivery, Gaps, and Completion

Spoken verdict audio is generated on a per-sentence basis with sequential indices (`seq` starting from 0):
- **Concurrency:** At most 2 sentence TTS requests run concurrently.
- **Gap Handling:** If an individual sentence fails synthesis, an `audio_status` event is broadcast with `status: "failed"` and `code: "TTS_FAILED"`. The client marks that `seq` as a resolved gap and continues playback without hanging.
- **Manifest:** When generation finishes, `audio_manifest` provides the authoritative list of ready and failed clips.
- **Terminal Outcomes (`done`):**
  - `"verdict"`: Verdict text completed, audio manifest resolved (even if all audio clips failed).
  - `"safety"`: Safety flag tripped; calm text provided, zero audio.
  - `"incomplete"`: Stream aborted or failed before verdict text completed.
