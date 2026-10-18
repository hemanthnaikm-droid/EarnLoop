# EarnLoop Stage 8 — Consolidated implementation

This bundle consolidates the latest available Stage 8 project files and supporting security tooling into one package.

## Included
- Updated frontend files: `index.html`, `script.js`, `style.css`
- Cloud Functions source and package manifest under `functions/`
- Firestore rules (`firestore.rules`)
- Emulator rules test suite under `tests/`
- Backup/restore PowerShell scripts under `scripts/`
- Abuse prevention, monitoring, incident response, and final submission runbooks
- `.gitignore`

## Deploy carefully
1. Back up the existing repository and Firebase rules first.
2. Merge the frontend files into the current project; do not overwrite newer unrelated work.
3. Merge `functions/index.js` into the existing functions project and preserve any other deployed functions. Check dependencies and callable function names before deployment.
4. Review `firestore.rules` against the live schema before deploying; security rules can block existing app operations if schemas differ.
5. Run the rules tests in `tests/` using the Firebase Emulator Suite before publishing rules.
6. Configure Firebase App Check site key and test the production domain before enabling enforcement.
7. Configure billing alerts, Cloud Logging alerts, scheduled backups and a successful restore test separately.

## Verification status
Local JavaScript syntax and package JSON parsing can be checked offline. This bundle has not been deployed to the user's Firebase project. It does not claim App Check enforcement, alerts, backups, or restore operations are active until those are configured and tested in the target project.
