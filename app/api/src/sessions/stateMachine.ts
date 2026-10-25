import { ParticipantState, Side, ZoomOutPublicError } from "@zoomout/contracts";
import { SessionData } from "./sessionTypes.js";

const VALID_TRANSITIONS: Record<ParticipantState, ParticipantState[]> = {
  IDLE: ["RECORDING", "REVIEW"],
  RECORDING: ["TRANSCRIBING", "IDLE", "REVIEW"],
  TRANSCRIBING: ["REVIEW", "IDLE"],
  REVIEW: ["RECORDING", "READY"],
  READY: [], // Terminal for side once confirmed
};

export function canTransition(current: ParticipantState, target: ParticipantState): boolean {
  if (current === target) {
    return true;
  }
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

export function transitionParticipant(
  session: SessionData,
  side: Side,
  targetState: ParticipantState
): void {
  const current = session.states[side];
  if (current === targetState) {
    return;
  }

  if (current === "READY") {
    throw new ZoomOutPublicError(
      "CONFIRMATION_LOCKED",
      `Participant ${side} has already confirmed and cannot change state.`
    );
  }

  if (!canTransition(current, targetState)) {
    throw new ZoomOutPublicError(
      "INVALID_STATE",
      `Illegal participant state transition for ${side}: ${current} -> ${targetState}`
    );
  }

  session.states[side] = targetState;
}
