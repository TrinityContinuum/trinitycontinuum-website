# Cancellation and rescheduling release gates

Production release remains blocked. The existing Cloudflare private admin Worker source is not in this branch, and migrations 003–008 have not been applied to staging or production.

## Required cancellation acceptance tests

1. Unauthorized GET and POST return 401. Authenticated POST from another Origin returns 403. Audit actor equals the authenticated account, never request JSON.
2. Two simultaneous cancellation requests for one booking: exactly one durable cancellation claim; the second returns 409 without a second Google API request.
3. A competing status update during an active cancellation is rejected by migration 008's trigger. Confirm the cancellation transaction is rolled back if the expected status differs.
4. Google API failure leaves the booking active and marks the cancellation ledger needs_reconciliation. Do not automatically release claims.
5. Google success followed by D1 failure leaves needs_reconciliation and does not assert success; manual recovery must compare Google event state before finishing.
6. With reopen_slot=false, preserve occupancy claims. With reopen_slot=true and no currently enabled Jack-approved window, preserve claims. With an enabled covering window, release claims only after cancellation is committed.
7. Confirm cancellation is recorded with actor, prior status, reopening choice, and notification state. Google sendUpdates=all means notification requested, not verified delivered.
8. Existing cancelled booking is idempotent and does not call Google again. A pending ledger must be reconciled, not blindly retried.
9. Repeated daylight-saving hours and missing spring hours are rejected by the administrative availability form.
10. Calendar events outside this scheduler, including DeSoto County's existing event, remain untouched.

## Additional release blockers

- Replace short-lived Google token with secure refresh mechanism.
- Verify Namecheap gateway delivery and replies; implement independently verifiable attendee notification evidence or explicitly label it unverified.
- Obtain and audit the actual legacy private admin Worker before building or deploying the integration.
- Run staging database migrations in order, with backup and rollback plan.
- Build and test rescheduling as a distinct operation: reserve the new time, verify conflicts, update the calendar, notify attendees, release the old time only when safe, preserve history and audit.
- Validate CSP nonce, CSS, admin controls, accessibility, and mobile layout in staging.
- Confirm Jack-approved default booking hours, lead time, buffers, and override rules. No public instant slots without explicit approval.

Do not merge or deploy until these acceptance gates pass.
