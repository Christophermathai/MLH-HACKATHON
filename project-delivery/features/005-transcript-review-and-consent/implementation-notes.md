# Transcript review and consent: implementation notes

- Created `ReviewScreen.tsx` (`app/frontend/src/features/review/ReviewScreen.tsx`):
  - Multiline Malayalam/English text area.
  - Unicode code point counting enforcing 1–4000 limit.
  - Displays speech uncertainty hints when provided.
  - Unchecked consent checkbox with required consent copy.
  - Mandatory safety copy explaining everyday disagreement scope and 30-min room lifetime.
  - Locked state with waiting indicator when user confirms and waits for the other participant.
- Added `confirmation.test.ts` (`app/api/src/sessions/confirmation.test.ts`):
  - Validates Malayalam text acceptance with `consent: true`.
  - Rejects `consent: false` or missing consent.
  - Rejects empty/whitespace input and input > 4000 code points.
  - Tests gateway WebSocket `confirm_transcript` exchange, text locking, and `side_ready` broadcast.
