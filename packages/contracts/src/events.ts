import { z } from "zod";
import {
  PROTOCOL_VERSION,
  SIDES,
  RECORDING_MODES,
  OUTCOMES,
  AUDIO_STATUSES,
  LIMITS,
} from "./constants.js";
import { MediatorSchema, SafetyResultSchema } from "./models.js";
import { SessionSnapshotSchema, AudioManifestSchema } from "./bootstrap.js";
import { PublicErrorPayloadSchema, ZoomOutPublicError } from "./errors.js";

// ==========================================
// Client Event Payloads (Client -> Server)
// ==========================================

export const ClientJoinPayloadSchema = z
  .object({
    room: z.string().length(LIMITS.ROOM_CODE_LENGTH),
    side: z.enum(SIDES),
    resumeToken: z.string().min(32),
  })
  .strict();

export const ClientStartRecordingPayloadSchema = z
  .object({
    mode: z.enum(RECORDING_MODES),
    mime: z.string().min(1).max(100),
    sampleRate: z.literal(16000).optional(),
    channels: z.literal(1).optional(),
    format: z.literal("pcm_s16le").optional(),
  })
  .strict();

export const ClientStopRecordingPayloadSchema = z.object({}).strict();
export const ClientCancelRecordingPayloadSchema = z.object({}).strict();
export const ClientStartTypedInputPayloadSchema = z.object({}).strict();

export const ClientConfirmTranscriptPayloadSchema = z
  .object({
    text: z.string().trim().min(1).max(LIMITS.MAX_TRANSCRIPT_CODE_POINTS),
    consent: z.literal(true),
  })
  .strict();

export const ClientReplayAudioPayloadSchema = z.object({}).strict();

export const CLIENT_EVENT_MAP = {
  join: ClientJoinPayloadSchema,
  start_recording: ClientStartRecordingPayloadSchema,
  stop_recording: ClientStopRecordingPayloadSchema,
  cancel_recording: ClientCancelRecordingPayloadSchema,
  start_typed_input: ClientStartTypedInputPayloadSchema,
  confirm_transcript: ClientConfirmTranscriptPayloadSchema,
  replay_audio: ClientReplayAudioPayloadSchema,
} as const;

export type ClientEventType = keyof typeof CLIENT_EVENT_MAP;

// ==========================================
// Server Event Payloads (Server -> Client)
// ==========================================

export const ServerRecordingStartedPayloadSchema = z
  .object({
    mode: z.enum(RECORDING_MODES),
    mime: z.string().min(1).max(100),
  })
  .strict();

export const ServerPartialTranscriptPayloadSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const ServerFinalTranscriptPayloadSchema = z
  .object({
    text: z.string(),
    unclear_lines: z.array(z.string().max(1000)).max(20).optional(),
  })
  .strict();

export const ServerSideReadyPayloadSchema = z
  .object({
    side: z.enum(SIDES),
  })
  .strict();

export const ServerBothReadyPayloadSchema = z.object({}).strict();

export const ServerVerdictTextDeltaPayloadSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const ServerAudioChunkPayloadSchema = z
  .object({
    seq: z.number().int().min(0),
    mime: z.string().min(1).max(100),
    data: z.string(), // base64 encoded sentence clip
    generationId: z.string().optional(),
  })
  .strict();

export const ServerAudioStatusPayloadSchema = z
  .object({
    seq: z.number().int().min(0),
    status: z.enum(AUDIO_STATUSES),
    code: z.string().optional(),
    generationId: z.string().optional(),
  })
  .strict();

export const ServerDonePayloadSchema = z
  .object({
    outcome: z.enum(OUTCOMES),
    generationId: z.string().optional(),
  })
  .strict();

export const SERVER_EVENT_MAP = {
  session_snapshot: SessionSnapshotSchema,
  recording_started: ServerRecordingStartedPayloadSchema,
  partial_transcript: ServerPartialTranscriptPayloadSchema,
  final_transcript: ServerFinalTranscriptPayloadSchema,
  side_ready: ServerSideReadyPayloadSchema,
  both_ready: ServerBothReadyPayloadSchema,
  analysis_json: MediatorSchema,
  verdict_text_delta: ServerVerdictTextDeltaPayloadSchema,
  safety_result: SafetyResultSchema,
  audio_chunk: ServerAudioChunkPayloadSchema,
  audio_status: ServerAudioStatusPayloadSchema,
  audio_manifest: AudioManifestSchema,
  done: ServerDonePayloadSchema,
  error: PublicErrorPayloadSchema,
} as const;

export type ServerEventType = keyof typeof SERVER_EVENT_MAP;

// ==========================================
// Envelopes & Parsing
// ==========================================

export interface Envelope<TType extends string, TPayload> {
  v: 1;
  type: TType;
  payload: TPayload;
  requestId?: string;
}

const BaseEnvelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.string(),
  payload: z.unknown(),
  requestId: z.string().uuid().optional(),
});

export function parseClientMessage(raw: unknown): Envelope<ClientEventType, any> {
  let json: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length > LIMITS.MAX_CONTROL_JSON_BYTES) {
      throw new ZoomOutPublicError("LIMIT_EXCEEDED", "Payload exceeds 64 KiB control frame limit");
    }
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ZoomOutPublicError("BAD_EVENT", "Malformed JSON control envelope");
    }
  }

  const baseResult = BaseEnvelopeSchema.safeParse(json);
  if (!baseResult.success) {
    throw new ZoomOutPublicError("BAD_EVENT", "Invalid message envelope structure or unsupported version");
  }

  const { v, type, payload, requestId } = baseResult.data;
  const payloadSchema = (CLIENT_EVENT_MAP as Record<string, z.ZodTypeAny>)[type];

  if (!payloadSchema) {
    if (type in SERVER_EVENT_MAP) {
      throw new ZoomOutPublicError(
        "BAD_EVENT",
        `Direction violation: server event "${type}" cannot be sent by client`
      );
    }
    throw new ZoomOutPublicError("BAD_EVENT", `Unknown client event type "${type}"`);
  }

  const payloadResult = payloadSchema.safeParse(payload);
  if (!payloadResult.success) {
    throw new ZoomOutPublicError(
      "BAD_EVENT",
      `Invalid payload for client event "${type}": ${payloadResult.error.issues[0]?.message || "schema violation"}`
    );
  }

  return {
    v: 1,
    type: type as ClientEventType,
    payload: payloadResult.data,
    ...(requestId ? { requestId } : {}),
  };
}

export function parseServerMessage(raw: unknown): Envelope<ServerEventType, any> {
  let json: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length > LIMITS.MAX_CONTROL_JSON_BYTES) {
      throw new ZoomOutPublicError("LIMIT_EXCEEDED", "Payload exceeds 64 KiB control frame limit");
    }
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ZoomOutPublicError("BAD_EVENT", "Malformed JSON control envelope");
    }
  }

  const baseResult = BaseEnvelopeSchema.safeParse(json);
  if (!baseResult.success) {
    throw new ZoomOutPublicError("BAD_EVENT", "Invalid message envelope structure or unsupported version");
  }

  const { v, type, payload, requestId } = baseResult.data;
  const payloadSchema = (SERVER_EVENT_MAP as Record<string, z.ZodTypeAny>)[type];

  if (!payloadSchema) {
    if (type in CLIENT_EVENT_MAP) {
      throw new ZoomOutPublicError(
        "BAD_EVENT",
        `Direction violation: client event "${type}" cannot be sent by server`
      );
    }
    throw new ZoomOutPublicError("BAD_EVENT", `Unknown server event type "${type}"`);
  }

  const payloadResult = payloadSchema.safeParse(payload);
  if (!payloadResult.success) {
    throw new ZoomOutPublicError(
      "BAD_EVENT",
      `Invalid payload for server event "${type}": ${payloadResult.error.issues[0]?.message || "schema violation"}`
    );
  }

  return {
    v: 1,
    type: type as ServerEventType,
    payload: payloadResult.data,
    ...(requestId ? { requestId } : {}),
  };
}

export function createClientMessage<T extends ClientEventType>(
  type: T,
  payload: z.infer<(typeof CLIENT_EVENT_MAP)[T]>,
  requestId?: string
): Envelope<T, z.infer<(typeof CLIENT_EVENT_MAP)[T]>> {
  return {
    v: 1,
    type,
    payload,
    ...(requestId ? { requestId } : {}),
  };
}

export function createServerMessage<T extends ServerEventType>(
  type: T,
  payload: z.infer<(typeof SERVER_EVENT_MAP)[T]>,
  requestId?: string
): Envelope<T, z.infer<(typeof SERVER_EVENT_MAP)[T]>> {
  return {
    v: 1,
    type,
    payload,
    ...(requestId ? { requestId } : {}),
  };
}
