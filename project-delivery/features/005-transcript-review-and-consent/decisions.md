# Transcript review and consent: decisions

Status: proposed implementation defaults; no individual user approval recorded.

## Chosen approach

Trim leading/trailing whitespace, preserve internal Unicode content, and accept 1-4000 Unicode code points. Consent starts unchecked. Confirmation locks text for that session; a changed account requires a new room. Room codes alone do not recover content. Use Malayalam-capable text fields and keyboard controls.

Ownership boundary: Owns the review screen and consent interaction. Gateway confirmation/state enforcement remains in 003; 004 supplies optional real speech transcripts.

## Rationale and alternatives

Use the recommended approach from the [brainstorm](../../brainstorms/005-transcript-review-and-consent/brainstorm.md). Alternatives remain documented there; they are not silently combined with this plan. The spec turns ambiguous behavior into explicit defaults so each requirement has an observable acceptance condition.

Applicable shared decisions: D-04, D-05, D-12 in [project decisions](../../decisions.md). If one changes, revise this spec/plan and every affected consumer before implementation diverges.

## Evidence and limitations

Confirmation locking and 4000-character limits are explicit working defaults. Unsaved edits survive normal component state only; they are not promised to survive reload.

No selected library/model version, account availability, deployed host, or measured quality is asserted by this record. Record those execution decisions here with evidence when they are made.

## Change log

- 2026-10-25: Drafted feature defaults, ownership, requirement/phase mapping, and verification expectations from the architecture and brainstorm.
