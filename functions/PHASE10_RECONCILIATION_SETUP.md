# Phase 10 — Payment reconciliation

## Updated file
- `functions/index.js`: adds admin-only `reconcileFundingOrder` for a missed/ambiguous Razorpay webhook.

## Deploy
From the project root, merge this file into your existing `functions/index.js` (preserve any newer functions), then run:

```bash
cd functions
npm install
node --check index.js
cd ..
firebase deploy --only functions
```

## Use
Call `reconcileFundingOrder` from a trusted admin-only tool with `{ "orderId": "order_..." }`. It verifies the order and payments by querying Razorpay directly. Only a matching captured payment can mark the order and task funded. A non-captured order remains unfunded. All calls require an authenticated Firebase admin claim and are rate-limited.

Do not expose an arbitrary reconciliation button to ordinary users. Test with Razorpay test mode and a separate Firebase project. This is a reconciliation tool, not worker payout support.
