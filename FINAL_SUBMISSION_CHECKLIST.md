# EarnLoop — Urgent Submission Checklist

## Demonstration-ready
- [ ] Site loads from the intended Vercel URL on phone and desktop.
- [ ] Sign up, sign in, sign out, and password recovery work with a test account.
- [ ] Home, Explore, Create, Applications, Wallet, and account menu fit the viewport.
- [ ] Empty states are readable and don't imply an error when there is simply no data.
- [ ] Customer can create a task; worker can apply; owner can accept/reject; accepted worker can submit work; owner can approve or dispute.
- [ ] Admin hide/reopen works and hidden tasks cannot accept new applications.
- [ ] Unfunded rewards are clearly labelled as proposals and no withdrawal is advertised as available.
- [ ] Account deletion explains that a request is reviewed; no instant deletion is falsely claimed.
- [ ] Browser console has no blocking JavaScript errors during the main demo flow.
- [ ] GitHub repository contains no private service-account keys, passwords, tokens, or production exports.

## Security honesty
- [ ] Do not claim backup restoration, rate limiting, App Check enforcement, or production monitoring unless configured and tested.
- [ ] Do not claim account deletion is complete: current callable function only records a review request.
- [ ] Keep payouts disabled until trusted server-side accounting and payment-provider integration are implemented and tested.

## Evidence to capture
- Site home screen.
- Task creation and Explore listing.
- Application/submission flow.
- Admin moderation screen.
- Account menu and recovery/deletion request messages.
- Firebase rules test results and deployment status, where available.
