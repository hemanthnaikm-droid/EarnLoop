# Stage 8 implementation notes

## Security work included in source
- Firestore rules deny client writes to accountDeletionRequests and deny direct deletion of user/task/application/submission/report records.
- Account deletion is a server-side request/review/process workflow, not a client-side direct delete.
- Recent authentication is required for a request.
- Admin actions require the `admin: true` Firebase Authentication custom claim.
- Open disputes block approval and processing.
- Processor redacts known email fields in task/application/submission/report records, deletes the profile document and Firebase Authentication account only after explicit admin approval, and records status for audit/retry.

## Must be configured and verified in Firebase
- Deploy the three callable functions.
- Configure admin claims using a trusted environment.
- Test App Check and enable enforcement after web initialization.
- Configure backup and restore, monitoring/alerts, abuse controls and incident response. Documentation is a runbook, not a live configuration change.
- Review data retention obligations and add every personal-data collection in the actual schema to the processor before production.
