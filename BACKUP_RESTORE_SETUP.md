# EarnLoop Firestore Backup & Restore — Stage 8

These are additive operational scripts; they do not overwrite the app's HTML/CSS/JS or Cloud Functions.

## Prerequisites

- Google Cloud CLI installed (`gcloud`, and `gsutil` for listing/verification).
- Authenticated operator: `gcloud auth login`.
- Correct project selected/authorized and Firestore export/import permissions.
- A Cloud Storage bucket in a suitable location, with restricted IAM access and appropriate retention/versioning policies.
- Firestore export/import may require billing-enabled Google Cloud resources. Check current project billing and pricing before running.

## Create a backup (PowerShell on Windows)

```powershell
.\scripts\backup-firestore.ps1 -ProjectId "YOUR_FIREBASE_PROJECT_ID" -Bucket "YOUR_PRIVATE_BUCKET_NAME"
```

The script stores exports beneath `gs://BUCKET/earnloop-firestore-backups/PROJECT/TIMESTAMP/`.

## Verify that export files exist

```powershell
.\scripts\verify-backup.ps1 -BackupUri "gs://YOUR_BUCKET/earnloop-firestore-backups/YOUR_PROJECT/TIMESTAMP"
```

File existence is not a restore test.

## Test restore safely

1. Create a separate non-production Firebase/GCP project with Firestore enabled.
2. Use a backup made from a test or approved source.
3. Run:

```powershell
.\scripts\restore-firestore.ps1 -ProjectId "YOUR_TEST_PROJECT_ID" -BackupUri "gs://YOUR_BUCKET/earnloop-firestore-backups/YOUR_PROJECT/TIMESTAMP" -WhatIf
```

4. If the target and source are correct, rerun without `-WhatIf` and confirm the PowerShell confirmation prompt.
5. Verify users/tasks/applications/submissions/reports and security-sensitive fields through the app and authorized admin checks. Do not point production users at the test project.

## Scope and limitations

- These scripts back up/import Firestore documents only.
- They do not export Firebase Authentication users, Cloud Storage objects, Hosting deployment history, Functions secrets, App Check configuration, IAM, or project billing/settings.
- Firestore import is not a full destructive rollback; documents created after the backup can remain. Plan recovery for the actual incident and test it before production use.
- Keep backup buckets private; apply least-privilege IAM, encryption defaults, lifecycle/retention rules and audit logging. Never commit credentials or exported user data to GitHub.
- Schedule exports separately with Cloud Scheduler/Functions or another approved scheduler only after cost, permissions, retention and failure alerts are configured.
