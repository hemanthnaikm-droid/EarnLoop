# EarnLoop — Backup and Restore Runbook

## Before changing production
1. Record the Firebase project ID and the time of the change.
2. Export/download the current Firestore rules and save a dated copy in a restricted location.
3. Save the current Git commit hash and a copy of the deployed source ZIP.
4. For Firestore data, configure an approved Cloud Firestore export to Cloud Storage (or another supported backup method) using a trusted operator account. Never put service-account credentials in the website or public repository.
5. Verify the export completed and record its location, timestamp, and operator.

## Restore drill (use a separate test project)
1. Create a non-production Firebase project with matching required indexes and rules.
2. Restore/import the backup according to the official Firebase/GCP procedure for the chosen backup method.
3. Apply reviewed rules only after confirming collection schemas.
4. Sign in with test customer, worker, and admin accounts.
5. Check task, application, submission, report, and deletion-request records for expected relationships.
6. Verify that ordinary users cannot access another user's private records.
7. Record outcome, elapsed time, missing data, and remediation items.

## Recovery precautions
- Never test a restore by overwriting production.
- Firestore exports do not automatically back up Firebase Authentication users, hosting configuration, secrets, or source control. Document separate recovery steps for each.
- Keep backups access-controlled and apply a documented retention period.
- Do not claim backups are working until a restore drill has succeeded.
