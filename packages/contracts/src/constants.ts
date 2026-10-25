export const PROTOCOL_VERSION = 1;

export const LIMITS = {
  MAX_AUDIO_FRAME_BYTES: 32 * 1024, // 32 KiB
  MAX_AUDIO_TOTAL_BYTES: 5 * 1024 * 1024, // 5 MiB
  MAX_AUDIO_RECORDING_SECONDS: 60,
  MAX_CONTROL_JSON_BYTES: 64 * 1024, // 64 KiB
  MAX_OUTPUT_CLIP_BYTES: 2 * 1024 * 1024, // 2 MiB
  MAX_SESSION_AUDIO_CACHE_BYTES: 20 * 1024 * 1024, // 20 MiB
  MAX_TRANSCRIPT_CODE_POINTS: 4000,
  MAX_JUDGE_VISIBLE_CODE_POINTS: 1200,
  SESSION_LIFETIME_MS: 30 * 60 * 1000, // 30 minutes
  ROOM_CODE_LENGTH: 8,
  MAX_ACTIVE_ROOMS: 100,
  RATE_LIMIT_CREATE_PER_MIN: 10,
  RATE_LIMIT_CLAIM_PER_MIN: 20,
} as const;

export const PUBLIC_ERROR_CODES = [
  "BAD_EVENT",
  "INVALID_STATE",
  "BAD_AUDIO",
  "LIMIT_EXCEEDED",
  "SIDE_TAKEN",
  "UNAUTHORIZED",
  "SESSION_UNAVAILABLE",
  "CONFIRMATION_LOCKED",
  "STT_FAILED",
  "MODEL_INVALID",
  "MODEL_FAILED",
  "TTS_FAILED",
  "CAPACITY",
] as const;

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number];

export const SIDES = ["A", "B"] as const;
export type Side = (typeof SIDES)[number];

export const RECORDING_MODES = ["batch", "streaming"] as const;
export type RecordingMode = (typeof RECORDING_MODES)[number];

export const PARTICIPANT_STATES = [
  "IDLE",
  "RECORDING",
  "TRANSCRIBING",
  "REVIEW",
  "READY",
] as const;
export type ParticipantState = (typeof PARTICIPANT_STATES)[number];

export const SESSION_STATES = [
  "CREATED",
  "A_RECORDING",
  "A_TRANSCRIBING",
  "A_REVIEW",
  "A_READY",
  "B_RECORDING",
  "B_TRANSCRIBING",
  "B_REVIEW",
  "B_READY",
  "BOTH_READY",
  "MEDIATING",
  "JUDGING",
  "DONE",
  "FAILED",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const OUTCOMES = ["verdict", "safety", "incomplete"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const AUDIO_STATUSES = ["ready", "failed"] as const;
export type AudioStatus = (typeof AUDIO_STATUSES)[number];
