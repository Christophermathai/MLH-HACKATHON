# Spoken verdict, playback, and result screen: implementation notes

- Created `SentenceSplitter` (`app/api/src/audio/sentenceSplitter.ts`):
  - Incremental sentence boundary detector supporting ., !, ?, \n, and Malayalam danda (\u0964, \u0965).
- Created `ElevenLabsTtsProvider` (`app/api/src/providers/elevenlabsTts.ts`):
  - Synthesizes spoken verdict sentences using ElevenLabs `eleven_multilingual_v2` into decodable MP3 audio clips.
- Integrated Pipeline Concurrency & Replay in `orchestrator.ts` & `server.ts`:
  - Enforces max concurrency 2 for TTS jobs.
  - Generates `AudioManifest` entries with `totalSentences` and `textComplete`.
  - Caches audio chunks by `seq` for free replay (`replay_audio`) without re-synthesizing.
- Created `VerdictScreen.tsx` (`app/frontend/src/features/verdict/VerdictScreen.tsx`):
  - Sequential playback queue matching sentence `seq`.
  - Play/pause controls and full replay button.
  - Displays petty score (0–10), perspectives of both sides, differing interpretations, zoom-out, and practical truce.
  - Displays calm safety screen if outcome is safety.
- Created `SessionView.tsx` (`app/frontend/src/features/session/SessionView.tsx`):
  - Seamlessly coordinates Lobby (Create / Join room), Recording screen, Review screen, and Verdict screen.
