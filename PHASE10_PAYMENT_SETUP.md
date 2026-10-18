# EarnLoop Phase 10 — Secure task funding (Razorpay)

This update adds a real customer-to-platform task-funding flow. It does **not** implement worker withdrawals/payouts. Do not represent the wallet as withdrawable until a separate payout/recipient/KYC/reconciliation implementation is completed.

## Files updated
- `index.html` — Razorpay Checkout loader and owner-only task funding button.
- `script.js` — starts funding checkout through the callable function; it never marks a task funded from browser state.
- `functions/index.js` — server-created order and signature-verified `payment.captured` webhook; server updates `tasks/{taskId}.funded` only after provider confirmation.
- `functions/package.json` — Razorpay SDK dependency.
- `firestore.rules` — clients cannot read or write `fundingOrders`.

## Configure secrets (never commit these values)
From the Firebase project root:

```bash
cd functions
npm install
cd ..
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
firebase deploy --only functions
```

Enter the matching Razorpay **test-mode** values first. Set up a webhook in the Razorpay dashboard for event `payment.captured`. Use the deployed `razorpayWebhook` function URL as the webhook URL and the exact same webhook secret as `RAZORPAY_WEBHOOK_SECRET`. The webhook must be able to reach the deployed function.

Use test keys and test payments first. Switch to live credentials only after test-mode verification, provider onboarding, legal/policy review, and operational review. Never paste keys into `script.js`, GitHub, chat, or Vercel frontend variables.

## Flow
1. A signed-in task owner opens their own unfunded task and clicks **Fund this task securely**.
2. Callable `createTaskFundingOrder` checks auth, App Check setting, rate limit, task ownership/status and reward amount. Amount is derived from Firestore, not client input.
3. Razorpay Checkout opens using the returned public key ID and server-created order ID.
4. Browser success only displays a pending-confirmation message.
5. Only the signature-verified provider webhook for `payment.captured` updates the task to `funded: true`. Repeated webhook events are idempotent.

## Important deployment notes
- Ensure `ENFORCE_APP_CHECK` and the frontend App Check site key are configured consistently before enforcing App Check; otherwise callable requests can be rejected.
- The existing Firestore rules schema must match your live database before deployment. Test rules in the Emulator Suite first.
- A failed webhook returns HTTP 500 so the provider can retry. Monitor logs and reconcile failed/ambiguous orders before asking users to pay again.
- No client can write `fundingOrders`. Cloud Functions Admin SDK bypasses Firestore rules, so endpoint validation is essential.
- Existing tasks remain unfunded until a verified captured payment is received. Never manually flip `funded` from the browser.
- This flow does not pay workers. Do not add withdrawal UI or claim cash is available until payouts, recipient verification/KYC, ledger accounting, refunds/disputes, duplicate-payout protection and reconciliation are implemented.

## Test checklist
- [ ] Owner can create a test-mode order for their own open task.
- [ ] Another user cannot create an order for that task.
- [ ] Client cannot choose a smaller amount than the task's stored reward.
- [ ] Failed/cancelled payment leaves task `funded: false`.
- [ ] A forged webhook signature is rejected.
- [ ] A valid `payment.captured` webhook marks the right task funded.
- [ ] Duplicate webhook delivery does not duplicate accounting or alter the task twice.
- [ ] Wrong amount, currency, order, owner or task mismatch is rejected.
- [ ] Task cards show `FUNDED · Provider confirmed` only after server confirmation.
- [ ] Use Razorpay test mode and a separate Firebase test project before production.
