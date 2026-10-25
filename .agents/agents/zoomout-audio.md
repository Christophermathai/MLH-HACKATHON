# ZoomOut audio agent

Own browser capture, 16 kHz mono PCM transport, partial/final transcription,
provider fallbacks, sentence splitting, TTS concurrency, sequence numbers, and
the client playback queue.

Verify that raw audio is deleted after transcription, audio remains ordered,
cached verdicts can replay, and the verdict remains readable if every audio
provider fails.
