"use client";

import React, { useId, useState } from "react";

export interface ReviewScreenProps {
  initialText: string;
  unclearLines?: string[];
  isTyped?: boolean;
  isConfirmed: boolean;
  isOtherSideReady?: boolean;
  roomCode: string;
  onConfirm: (text: string, consent: true) => Promise<void> | void;
  onStartNewRoom?: () => void;
  disabled?: boolean;
}

const MAX_CODE_POINTS = 4000;

export function ReviewScreen({
  initialText,
  unclearLines = [],
  isTyped = false,
  isConfirmed,
  isOtherSideReady = false,
  roomCode,
  onConfirm,
  onStartNewRoom,
  disabled = false,
}: ReviewScreenProps) {
  const [text, setText] = useState(initialText);
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const consentId = useId();
  const textareaId = useId();

  // Unicode code points count
  const codePoints = Array.from(text.trim()).length;
  const isTooLong = codePoints > MAX_CODE_POINTS;
  const isEmpty = codePoints === 0;
  const isValid = !isEmpty && !isTooLong && consent && !isSubmitting && !isConfirmed && !disabled;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirm(text.trim(), true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to submit transcript confirmation");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="review-screen max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Room: {roomCode}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isConfirmed
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {isConfirmed ? "Confirmed & Locked" : isTyped ? "Typed Input" : "Review Speech"}
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight mt-1">Review Your Side</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isConfirmed
            ? "Your side is locked and ready for mediation."
            : "Check your transcript carefully. You can edit errors or type in Malayalam or English before confirming."}
        </p>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg p-4 text-xs text-sky-900 dark:text-sky-200">
        <p className="font-semibold mb-1">Important Safety Notice</p>
        <p>
          ZoomOut is for everyday disagreements, not for situations involving abuse or safety concerns.
          Your text locks when you confirm. Start a new room if you need to change it.
        </p>
      </div>

      {/* Unclear lines hint */}
      {!isConfirmed && unclearLines.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold mb-1">Speech Recognition Hints</p>
          <p className="mb-2">The following phrases may need review:</p>
          <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
            {unclearLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript Input / Display */}
      <form onSubmit={handleConfirm} className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor={textareaId} className="text-sm font-medium">
              Your Perspective (Malayalam / English)
            </label>
            <span
              className={`text-xs ${
                isTooLong ? "text-red-500 font-semibold" : "text-muted-foreground"
              }`}
            >
              {codePoints} / {MAX_CODE_POINTS} characters
            </span>
          </div>

          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isConfirmed || disabled || isSubmitting}
            rows={6}
            lang="ml"
            className="w-full p-3 border rounded-lg bg-background text-foreground font-sans text-base focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-75 disabled:bg-muted resize-y"
            placeholder="നിങ്ങളുടെ ഭാഗം ഇവിടെ വിശദീകരിക്കുക... (Explain your side here in Malayalam or English)"
          />
          {isTooLong && (
            <p className="text-xs text-red-500 mt-1">
              Text exceeds the maximum limit of {MAX_CODE_POINTS} characters.
            </p>
          )}
        </div>

        {/* Consent Section (Only if not yet confirmed) */}
        {!isConfirmed && (
          <div className="space-y-4 pt-2">
            <div className="flex items-start space-x-3 p-3 bg-muted/40 rounded-lg border">
              <input
                id={consentId}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={isSubmitting || disabled}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor={consentId} className="text-xs leading-relaxed text-foreground select-none">
                I confirm this text represents my side. I agree to AI processing of this text and
                sharing the combined perspective and verdict after both people consent.
              </label>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              ZoomOut keeps session text and results only until this room expires (up to 30 minutes).
            </p>

            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid}
              className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-lg shadow transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Locking & Confirming..." : "Confirm & Share with Court"}
            </button>
          </div>
        )}
      </form>

      {/* Waiting / Confirmed State */}
      {isConfirmed && (
        <div className="border rounded-lg p-5 bg-muted/20 text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-emerald-600 dark:text-emerald-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold text-sm">Your side has been confirmed and locked.</span>
          </div>

          <div className="text-xs text-muted-foreground">
            {isOtherSideReady ? (
              <p className="text-foreground font-medium animate-pulse">
                Both participants have consented! The court is now in session...
              </p>
            ) : (
              <div className="space-y-1">
                <p>Waiting for the other participant to review and consent.</p>
                <p className="text-[11px]">The AI mediator will begin as soon as both sides confirm.</p>
              </div>
            )}
          </div>

          {onStartNewRoom && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onStartNewRoom}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Need to change your account? Start a new room
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
