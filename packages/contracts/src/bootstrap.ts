import { z } from "zod";
import {
  SIDES,
  PARTICIPANT_STATES,
  SESSION_STATES,
  OUTCOMES,
  AUDIO_STATUSES,
  LIMITS,
} from "./constants.js";
import { MediatorSchema } from "./models.js";

export const CreateRoomResponseSchema = z
  .object({
    room: z.string().length(LIMITS.ROOM_CODE_LENGTH),
    side: z.literal("A"),
    resumeToken: z.string().min(32),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type CreateRoomResponse = z.infer<typeof CreateRoomResponseSchema>;

export const ClaimParticipantRequestSchema = z
  .object({
    side: z.literal("B"),
  })
  .strict();

export type ClaimParticipantRequest = z.infer<typeof ClaimParticipantRequestSchema>;

export const ClaimParticipantResponseSchema = z
  .object({
    room: z.string().length(LIMITS.ROOM_CODE_LENGTH),
    side: z.literal("B"),
    resumeToken: z.string().min(32),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type ClaimParticipantResponse = z.infer<typeof ClaimParticipantResponseSchema>;

export const AudioManifestEntrySchema = z
  .object({
    seq: z.number().int().min(0),
    status: z.enum(AUDIO_STATUSES),
    code: z.string().optional(),
  })
  .strict();

export type AudioManifestEntry = z.infer<typeof AudioManifestEntrySchema>;

export const AudioManifestSchema = z
  .object({
    totalSentences: z.number().int().min(0),
    textComplete: z.boolean(),
    entries: z.array(AudioManifestEntrySchema),
    generationId: z.string().optional(),
  })
  .strict();

export type AudioManifest = z.infer<typeof AudioManifestSchema>;

export const SessionSnapshotSchema = z
  .object({
    room: z.string().length(LIMITS.ROOM_CODE_LENGTH),
    side: z.enum(SIDES),
    expiresAt: z.string().datetime(),
    ownState: z.enum(PARTICIPANT_STATES),
    ownText: z.string().max(LIMITS.MAX_TRANSCRIPT_CODE_POINTS).nullable(),
    ownConfirmed: z.boolean(),
    ownConsent: z.boolean(),
    readiness: z
      .object({
        A: z.boolean(),
        B: z.boolean(),
      })
      .strict(),
    presence: z
      .object({
        A: z.boolean(),
        B: z.boolean(),
      })
      .strict()
      .optional(),
    sessionState: z.enum(SESSION_STATES),
    generationId: z.string().nullable(),
    sharedResult: MediatorSchema.nullable().optional(),
    verdictText: z.string().max(LIMITS.MAX_JUDGE_VISIBLE_CODE_POINTS).nullable().optional(),
    outcome: z.enum(OUTCOMES).nullable().optional(),
    audioManifest: AudioManifestSchema.nullable().optional(),
  })
  .strict();

export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

export function assertNoPrivateDataInSnapshot(snapshot: Record<string, unknown>): void {
  const forbiddenKeys = [
    "analyst",
    "analyst_notes",
    "analyst_output",
    "private_analysis",
    "safety_flags",
    "otherText",
    "other_transcript",
    "raw_audio",
  ];
  for (const key of forbiddenKeys) {
    if (key in snapshot) {
      throw new Error(`Privacy violation: forbidden key "${key}" detected in public snapshot`);
    }
  }
}
