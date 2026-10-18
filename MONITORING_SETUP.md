# EarnLoop Stage 8 — Monitoring and incident response

## 1. Deploy the updated function source

Merge this `index.js` into the existing Firebase Functions source folder, preserving other exports and using the existing `package.json`/lockfile. Ensure `firebase-functions` is already installed. The added structured logs use `firebase-functions/logger`.

From the Firebase project root:

```powershell
firebase use
firebase deploy --only functions
```

Confirm the selected project ID before deployment. Do not deploy from a folder containing unreviewed functions.

## 2. Inspect function logs

```powershell
firebase functions:log
```

For deeper filtering, open Google Cloud Console → Logging → Logs Explorer and filter by resource type `cloud_function` or `cloud_run_revision` (the resource depends on the Functions generation). Search for structured event names such as `account_deletion_requested`, `account_deletion_reviewed`, `account_deletion_completed`, and `account_deletion_processing_failed`.

Logs deliberately omit passwords, tokens, and free-text review notes. Restrict log access to authorized operators and set retention appropriate to the privacy policy.

## 3. Configure alerts in Google Cloud Console

Create alert policies for:
- Function execution errors above your acceptable baseline.
- Repeated `account_deletion_processing_failed` events.
- Elevated callable-function latency or error rate.
- Budget threshold notifications for the billing account.

Use a monitored test event first to confirm each notification reaches the intended operator. Cloud Monitoring alert policy setup and billing budget setup are project-specific and are not activated by this source file.

## 4. Incident response checklist

1. Record the incident time, affected service, and observed symptoms; do not copy secrets into tickets.
2. If abuse is ongoing, disable the affected callable endpoint or revoke compromised credentials; preserve required audit evidence.
3. Review Cloud Function and Firebase Auth logs and check whether Firestore writes completed partially.
4. Restore only from a verified backup in a separate test project first; never overwrite production as an experiment.
5. Rotate exposed credentials, fix the cause, and redeploy.
6. Document impact, recovery actions, and any required user/regulatory notification with qualified guidance.

## Important

This adds structured application logs only. It does not create alert policies, billing budgets, on-call contacts, backups, or incident notifications automatically. Confirm actual project configuration in the consoles before claiming these controls are active.
