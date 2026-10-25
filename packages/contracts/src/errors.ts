import { z } from "zod";
import { PUBLIC_ERROR_CODES, PublicErrorCode } from "./constants.js";

export const PublicErrorPayloadSchema = z
  .object({
    code: z.enum(PUBLIC_ERROR_CODES),
    message: z.string().max(300),
    fallback: z.string().max(200).optional(),
  })
  .strict();

export type PublicErrorPayload = z.infer<typeof PublicErrorPayloadSchema>;

export class ZoomOutPublicError extends Error {
  public readonly code: PublicErrorCode;
  public readonly fallback?: string;

  constructor(code: PublicErrorCode, message: string, fallback?: string) {
    super(message);
    this.name = "ZoomOutPublicError";
    this.code = code;
    this.fallback = fallback;
  }

  toJSON(): PublicErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.fallback ? { fallback: this.fallback } : {}),
    };
  }
}

export function sanitizeError(err: unknown, defaultCode: PublicErrorCode = "BAD_EVENT"): PublicErrorPayload {
  if (err instanceof ZoomOutPublicError) {
    return err.toJSON();
  }
  // Never leak raw provider details or SDK errors into public payload
  return {
    code: defaultCode,
    message: "A sanitized system error occurred. Please try again or switch to typed input.",
  };
}
