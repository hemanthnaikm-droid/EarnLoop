# EarnLoop — Abuse Prevention and Monitoring

## Minimum controls
- Enable Firebase App Check for the web client and enforce it after monitoring valid traffic.
- Use Firebase Authentication and server-side authorization; never trust a role, reward, task status, or ownership value supplied by the browser.
- Keep Firestore rules restrictive. Client writes to accountDeletionRequests must remain denied; only trusted Cloud Functions using Admin SDK should write them.
- Add server-side rate limits for task creation, applications, submissions, reports, password/recovery-related custom endpoints, and any callable functions. Firebase Auth's own abuse protection does not replace limits on custom operations.
- Validate field types, lengths, allowed status transitions, ownership, and immutable fields on every write.
- Use server timestamps and server-calculated reward amounts. Do not implement withdrawals using client-written balances.
- Set budget alerts, monitor Firestore reads/writes, Cloud Function errors, Authentication abuse signals, and unexpected traffic spikes.

## Review signals
- Repeated task creation or reports from one account.
- Repeated application attempts against hidden/closed tasks.
- Repeated failed authorization or callable-function requests.
- Unusual read/write volume or unexpected cost increase.
- Attempts to alter reward, owner, status, review, or admin fields directly.

## Incident response quick steps
1. Record the time, project, affected feature, and observed symptoms; avoid copying passwords, tokens, or unnecessary personal data.
2. Restrict the vulnerable path with rules or a backend change; do not make broad permission changes without testing.
3. Preserve relevant logs and affected document IDs under restricted access.
4. Rotate exposed credentials immediately; never commit replacement secrets to GitHub.
5. Test the fix in a non-production environment, deploy, and verify with a least-privileged account.
6. Assess data exposure and notification obligations with the project owner/legal adviser.
7. Document root cause, impact, corrective action, and follow-up date.
