import { z } from "zod";
import { SIDES } from "./constants.js";

const boundedString = z.string().max(1000);
const boundedStringArray = z.array(boundedString).max(20);

// Private Analyst Schema (server-only, never sent over public WebSocket or snapshot)
export const AnalystSchema = z
  .object({
    side: z.enum(SIDES),
    upset_about: boundedStringArray,
    stated_facts: boundedStringArray,
    assumptions_made: boundedStringArray,
    possible_feelings: boundedStringArray,
    unclear_lines: boundedStringArray,
    safety_flags: z
      .object({
        abuse_or_coercion_signals: z.boolean(),
        notes: boundedString,
      })
      .strict(),
  })
  .strict();

export type AnalystOutput = z.infer<typeof AnalystSchema>;

// Public Mediator Schema (shared screen result after both consent)
export const MediatorSchema = z
  .object({
    what_each_is_upset_about: z
      .object({
        A: boundedStringArray,
        B: boundedStringArray,
      })
      .strict(),
    where_interpretations_differ: boundedStringArray,
    petty_score: z.number().int().min(0).max(10),
    zoom_out: z
      .object({
        immediate_issue: boundedString,
        possible_underlying_feelings: boundedStringArray,
        bigger_picture: boundedString,
      })
      .strict(),
    truce: z
      .object({
        next_step: boundedString,
        requires_apology: z.literal(false),
      })
      .strict(),
  })
  .strict();

export type MediatorResult = z.infer<typeof MediatorSchema>;

// Public Safety Result Schema (shared generic outcome when safety flag is tripped)
export const SafetyResultSchema = z
  .object({
    message: boundedString,
  })
  .strict();

export type SafetyResult = z.infer<typeof SafetyResultSchema>;
