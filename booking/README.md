# Automatic booking, owner controls: integration gates

This branch is **development only**. The existing live manual appointment form and D1 intake remain untouched. No automatic booking is advertised as operational.

## Intended visitor flow
1. Server reads real free/busy from Jack's authoritative calendar, applies America/Chicago business hours, 11:30–13:00 CT exclusion, buffer, meeting duration and blackout dates.
2. Visitor selects an available 30-minute slot, completes Turnstile and contact form.
3. Server rechecks free/busy, atomically reserves a unique active slot in D1, creates the real calendar event and persists notification work.
4. **Only after calendar event success** display a confirmed booking and send a confirmation containing date, timezone and private meeting link. On calendar failure, keep booking unconfirmed, reconcile or release it, and never tell a visitor it is confirmed.
5. Idempotent booking IDs, unique active slot index, audit events, retryable notification outbox, rate limits and privacy controls prevent duplicates and lost updates.

## Jack's controls
Authenticated Jack-only dashboard actions: cancel booking and notify attendee; propose alternate slot (no forced move until accepted); move booking when agreed and calendar confirms; invite attendee to rebook with fresh availability link. All actions update the calendar and durable D1 history and notify attendee. Owner identity must be derived from verified server-side session, **never** a client-supplied actor field. Use optimistic concurrency and idempotent notification keys.

## Required work before activation
- Identify actual Cloudflare appointment Worker and D1 binding, deployed environment and secrets. Keep separate from Coordination Desk D1.
- Verify calendar provider integration and permission to read free/busy and create/update/delete events. No direct integration has yet been verified.
- Implement public availability endpoint and calendar-first reconciliation; ensure multi-instance concurrency across D1 and calendar, not merely D1 uniqueness.
- Implement authenticated owner endpoints, notification queue, secure cancel/reschedule links, privacy retention and tests.
- Integrate frontend as an optional **Automatic / Manual** administrator switch. Manual remains functional and default until live tests pass.
- Correct contact.html and privacy.html after verifying actual storage/retention policies.
- Run tests for DST, conflicts, lunch exclusion, cancellation, proposal, double click, replay, notifications, calendar outage, and owner authorization.
- No deploy, merge, domain changes, mail sends or spending until end-to-end verification.

## What is already implemented here
- Additive D1 tables for bookings, action log and notification outbox.
- Unique active-slot database index.
- Pure input validation, reservation primitive and owner state transitions in booking-core.js.
- **Not implemented yet:** authoritative availability, calendar sync, visitor confirmations, owner dashboard, notification worker, authenticated API endpoints. These are mandatory before go-live.
