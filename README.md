# EarnLoop Firestore Rules Tests

This package adds automated emulator tests for the Firestore rules. It does not replace the web app or deploy anything by itself.

## Run locally

1. Install Node.js 20 or later and Java (needed by the Firebase Emulator).
2. Install Firebase CLI if not already installed: `npm install -g firebase-tools`.
3. In this folder run: `npm install`.
4. In one terminal start the Firestore emulator with these rules:
   `firebase emulators:start --only firestore --project earnloop-rules-test --config firebase.test.json`
5. In another terminal run: `npm run test:rules`.

The included `firebase.test.json` uses port 8080 and points the emulator to `firestore.rules`. Tests use the emulator only; they do not connect to your production project or alter live data.

## Before using against production

- Run these tests first and fix any schema mismatch revealed by your current app.
- Extend tests to cover every existing collection and every Cloud Function transition.
- Keep Admin SDK writes inside trusted Cloud Functions; Admin SDK bypasses Firestore rules, so functions need their own authorization and validation tests.
