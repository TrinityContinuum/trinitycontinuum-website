# Trinity-owned appointment scheduler

Trinity's D1 database, not Google Calendar, is authoritative for automatic reservations. Google is not required for booking, and optional calendar synchronization must never block a valid Trinity booking.

## Implemented in this development branch

- Public `meetings.html` retains the existing manual request form and includes a hidden independent booking form, revealed only if the isolated Worker reports automatic booking enabled.
- `assets/trinity-booking.js` generates Central Time 30/60-minute choices, including DST-aware UTC conversion, and checks availability before submitting.
- `booking/independent-worker.js` verifies Turnstile, applies owner policy, reserves D1 half-hour interval locks atomically, writes a confirmed booking, action history and pending notification records, and provides authenticated owner booking, cancellation and policy endpoints.
- `booking-admin.html` provides a private token-authenticated management interface for hours, enable/disable, reservation review and cancellation. No credentials are stored in localStorage.
- Additive SQL migrations 001–003 and a dispatch-only isolated Cloudflare staging deployment workflow. The existing manual intake Worker is not overwritten.

## Still required before production acceptance

1. Execute and verify D1 migrations and deploy the isolated Worker; add its Turnstile and owner authentication secrets. The workflow is not evidence of deployment.
2. Build and verify actual outbound visitor and owner email delivery with provider message IDs, retries and monitoring. The outbox currently records **pending** work only. Do not claim an email was sent.
3. Add owner rescheduling and corresponding attendee communication; current owner interface supports cancellation, not rescheduling.
4. Independently execute full integration tests including competing reservations, cancellation/rebook, Turnstile, policy changes, DST, notification failures and production health.
5. Verify the live public page and owner access, then deliberately enable automatic bookings. Initial policy remains disabled to protect visitors.

**Never advertise the service as fully operational before these acceptance checks pass.** The public manual appointment-request form remains the fallback.
