# Trinity appointment administration: verified integration contract

Source: existing Cloudflare `trinity-appointment-admin` Worker provided by the operator on November 15, 2026. This document does not include credentials.

## Current behavior
- HTTPS Basic authentication with username `jack`, configured `ADMIN_PASSWORD` secret (minimum 24 characters).
- `APPROVER_EMAILS` must equal `jack@trinitycontinuum.com`.
- A D1 database binding named `DB`.
- `GET /` serves the private queue UI.
- `GET /api/requests` lists the newest 100 requests, joining `appointments` with `appointment_decisions`.
- `POST /api/decisions` accepts `{id,choice}`, with choice `first`, `second`, `alternate`, or `decline`. An INSERT OR IGNORE ensures a recorded decision is not silently overwritten.
- UI provides copyable reply, `mailto:` draft, and a Google Calendar TEMPLATE URL. No email is sent, no calendar event is created, and no Google Meet is generated automatically.
- D1 schema includes `appointments` and `appointment_decisions`; the latter is referenced by a migration named `002_decisions.sql`.

## Existing safeguards to retain
- Authenticate and authorize before returning private requests.
- Keep appointment request records and decisions durable and non-public.
- Never treat a saved approval decision as a sent email or confirmed calendar booking.
- Preserve existing `/api/intake` and the current public form until replacement is proven.
- Avoid changing existing database tables destructively.

## Backend integration requirements
1. Obtain and back up the actual Worker source and D1 schema/migrations; confirm the admin and intake Workers bind to the same database.
2. Move to individually attributable administrator authentication with MFA before introducing write-capable calendar or mail tokens. Do not put privileged secrets in browser code.
3. Add configurable weekday windows and per-date overrides; keep 11:30–13:00 Central blocked by default until Jack approves a change.
4. Store all booking instants in UTC with an IANA timezone and derive owner-local calendar dates correctly.
5. Server-side Google Calendar free/busy check; atomically reserve slots in D1 with an idempotency key and uniqueness protection, then create a calendar event.
6. Record distinct states: interested, awaiting_time, approval_pending, reserved, calendar_created, confirmation_sent, cancelled, failed_recovery.
7. For early/late windows create approval requests only. For regular windows create an instant booking only after confirmed free/busy and durable reservation.
8. Use a durable outbox for Namecheap confirmation notifications. Retry safely; never assert an email was sent without provider acknowledgment.
9. Recover partial failures between reservation, calendar creation, and notification; prevent duplicates and expose reconciliation to administrators.
10. Verify with integration tests using an isolated staging D1 database and test calendar before deploying to production.

## Important discrepancy
The existing public form explicitly excludes 11:30 AM–1:00 PM Central, while the proposed default business-hours window is 9:00 AM–5:00 PM. The break must remain excluded until Jack approves the schedule. Proposed windows are not authorized availability.
