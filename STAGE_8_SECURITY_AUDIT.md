# EarnLoop — Stage 8 Public-Beta Security Audit

## Purpose
Fast-track release checklist for the current EarnLoop HTML/CSS/JS + Firebase project. This is a runbook, not proof that the live Firebase project has passed these checks.

## Known status from project history
- User-reported tests passed for task applications, work submissions, approval/dispute handling, reward integrity, and hidden-task restrictions.
- Account-deletion function currently records a request only. It does not delete Firebase Auth or Firestore data.
- Rewards are proposals and are not funded or withdrawable. No live payment provider is integrated.
- Live deployment, rules publication, backups, App Check, monitoring, and restoration have not been independently verified here.

## P0 — before public beta
- [ ] Confirm Firebase Authentication providers and authorized domains are configured correctly.
- [ ] Review Firestore rules in the Firebase Emulator Suite using both ordinary-user and admin test accounts.
- [ ] Confirm admin access is based on trusted Firebase custom claims, never a client-editable profile field.
- [ ] Confirm browser code contains no service-account JSON, private API keys, or secrets. Firebase web config is not a service-account secret; still restrict APIs and authorized domains.
- [ ] Verify hidden tasks cannot receive new applications through old pages or direct Firestore requests.
- [ ] Verify users can read/update only records allowed by the app's intended ownership model.
- [ ] Test account-deletion requests with no dispute and with an open dispute. Confirm neither case silently deletes data.
- [ ] Confirm privacy notice accurately explains collected data, purpose, sharing, retention, deletion requests, and support contact.
- [ ] Confirm rewards are clearly labelled proposed/unfunded until actual funds are held securely.
- [ ] Test a clean mobile browser session and desktop browser session.

## P1 — required before accepting sensitive or high-volume use
- [ ] Enable Firebase App Check for the web app; monitor first, then enforce after valid clients are registered.
- [ ] Add server-side rate limits to expensive or abuse-prone operations; client-only limits are not security controls.
- [ ] Set billing alerts/budgets and review Firebase usage dashboards.
- [ ] Configure a monitored admin/support contact and incident response owner.
- [ ] Configure scheduled backups/export and perform a restoration drill.
- [ ] Test account recovery and deletion flows in a non-production Firebase project.

## Release decision
Do not describe the service as production-secure until every P0 item has evidence. A code ZIP or syntax check alone does not verify deployed Firebase configuration.
