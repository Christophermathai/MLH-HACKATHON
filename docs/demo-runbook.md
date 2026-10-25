# ZoomOut — 3-Minute Demo Runbook

**Tagline:** *Big feelings. Small problems. Calm perspectives.*

This runbook guides a seamless, repeatable 3-minute live demonstration of ZoomOut for hackathon judges and evaluators.

---

## 1. Setup & Pre-Flight Checklist

1. **Gateway Server:**
   ```bash
   npm run start --workspace=@zoomout/api
   # Running on http://127.0.0.1:8787 (WebSocket: ws://127.0.0.1:8787/ws)
   ```
2. **Frontend Client:**
   ```bash
   npm run dev --workspace=zoomout-model-lab
   # Open http://localhost:3000 on two browser windows (or two devices on the same local network)
   ```
3. **Environment:**
   - `ELEVENLABS_API_KEY`: Configured for live Malayalam STT (`scribe_v1`) and TTS.
   - `OPENAI_API_KEY`: Configured for Analyst, Mediator, and Judge LLM.
   - *Offline / Free Mode Fallback:* Set `PROVIDER_MODE=mock` in `.env` for deterministic mock responses with zero API dependency.

---

## 2. Roles & Narrative Scenario

- **Participant A (Presenter 1):** Upset that dirty chai cups and dishes were left in the sink.
- **Participant B (Presenter 2):** Was exhausted after a long workday and needed a short break before doing chores.
- **The Petty Core:** Neither person actually cares about a dirty cup; both people were tired and wanted their time and effort to be acknowledged.

---

## 3. The 3-Minute Live Journey

### Minute 0:00 – 0:30 · Room Creation & Private Claim
1. **Presenter 1 (Window 1):**
   - Navigates to `http://localhost:3000/`.
   - Clicks **"Create New Dispute Room (Side A)"**.
   - A unique 8-character room code appears (e.g., `A4F92B1C`).
2. **Presenter 2 (Window 2):**
   - Navigates to `http://localhost:3000/`.
   - Enters the 8-character room code into the join field and clicks **"Join as Participant B"**.
   - Both devices are now connected securely over WebSockets.

---

### Minute 0:30 – 1:15 · Side A Speaks & Confirms
1. **Presenter 1:**
   - Clicks **"Record"** (or uploads a clip / clicks "Type your side instead").
   - Speaks Malayalam testimony:
     > *"സിങ്ക് നിറയെ പാത്രങ്ങൾ ഇട്ടിട്ട് അവൻ ടിവി കാണുകയായിരുന്നു. ഒരു ചായ പോലും തന്നില്ല."*
     > *(He left all the plates in the sink and was watching TV. Didn't even make tea.)*
   - Clicks **"Stop"**.
   - ElevenLabs Scribe returns the transcript in ~3 seconds.
   - Explains the **Zero-Retention Guarantee**: ZoomOut removes raw audio immediately.
   - Checks the mandatory consent box and clicks **"Confirm & Share with Court"**.
   - Window 1 transitions into a locked waiting state: *"Waiting for the other participant to review and consent..."*

---

### Minute 1:15 – 1:45 · Side B Speaks & Confirms
1. **Presenter 2:**
   - Clicks **"Record"** and speaks:
     > *"ഞാൻ ഓഫീസിൽ നിന്ന് വന്ന് നല്ല ക്ഷീണത്തിലായിരുന്നു. അൽപം കഴിഞ്ഞു കഴുകാമെന്ന് കരുതിയതാണ്."*
     > *(I was exhausted after coming home from office. I planned to wash them in a little while.)*
   - Clicks **"Stop"**. Transcript appears.
   - Checks the consent box and clicks **"Confirm & Share with Court"**.

---

### Minute 1:45 – 2:30 · Both Consented: Shared Mediator Verdict
1. **Instant Transition on Both Screens:**
   - Once both participants have consented, the court immediately opens on both devices.
   - **Petty Score:** Displayed prominently (e.g., `7/10` — delightfully trivial!).
   - **Perspectives:** Side A's feelings and Side B's feelings presented side-by-side with balanced empathy.
   - **Zoom-Out Box:** Highlights the bigger picture (*"Underneath the dirty cups, both of you were tired and seeking acknowledgment"*).
   - **Practical Truce:** A mutual, humorous next step with **zero forced apology** (*"Person B clears the table, Person A prepares hot chai, no lectures tonight"*).

---

### Minute 2:30 – 3:00 · The Judge Speaks
1. The court delivers the spoken Malayalam ruling aloud.
2. Sentences stream incrementally into the audio queue and play sequentially without buffering delays.
3. Presenters demonstrate the **"Replay Full Verdict"** button, showing that cached session audio replays instantly without re-calling external APIs.

---

## 4. Fallback & Edge-Case Demos

- **Noisy Venue / Audio Off:** The full Malayalam transcript and judge text are displayed visually in real-time.
- **Safety Gate:** If someone submits a testimony mentioning domestic abuse or violence, the system immediately halts the playful court, suppresses the judge/TTS, and displays a calm, non-accusatory care recommendation in Malayalam and English.
- **Microphone Denied:** Both participants have a one-click fallback to type their testimony directly.

