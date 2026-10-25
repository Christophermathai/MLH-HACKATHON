Prepare and validate ZoomOut deployment readiness.

Canonical usage: `/deploy [environment]`

Suggested checks:
1. frontend build and type checks
2. gateway checks and tests
3. WebSocket happy-path and failure-path verification
4. provider configuration and secret checks
5. consent, privacy, and raw-audio cleanup verification

Report readiness, blockers, and any skipped verification.
