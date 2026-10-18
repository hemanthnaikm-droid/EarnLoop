# Stage 8 — Remaining security implementation

## Implemented in this package
- Callable-function rate limiting using Firestore transactions:
  - deletion request: 3 per UID per 24 hours
  - admin review: 60 per admin UID per minute
  - deletion processing: 10 per admin UID per hour
- Security audit events for request, review, completion, and failure.
- Transactional processing claim to reduce duplicate concurrent deletion processing.
- Firestore rules for securityAuditLogs: admin read-only; client writes denied.
- Expiration metadata on rate-limit records.

## Must be configured in Firebase Console
1. Deploy Cloud Functions and reviewed Firestore rules.
2. Configure Firestore TTL for `_rateLimits.expiresAt` if automatic cleanup is desired. TTL is not automatic until enabled.
3. Enable Firebase App Check for the web app and test it. After the client initializes App Check with the correct site key, change callable options to `enforceAppCheck: true` and redeploy.
4. Configure Firebase budget alerts and monitor Cloud Function errors, Firestore usage, Auth events and unusual traffic.
5. Configure scheduled backups/exports, secure storage, and a restoration drill. A written runbook is not a backup.
6. Review all collections and personal-data fields before using deletion with real users. The deletion function only redacts the known collections/fields listed in `functions/index.js`.

## Important boundary
The current UI still writes tasks, applications, submissions and reports directly to Firestore. Callable-function rate limits do not rate-limit those direct client writes. To enforce per-user quotas on those operations, route them through backend callables or add and test a separate trusted quota design before public launch.
