# Trinity scheduler integration and deployment gate

Development branch only. **Do not merge or deploy as-is.** The existing meetings.html and production Workers remain authoritative until staging passes.

## Implemented in this branch
- Jack's approval/automatic preference in authenticated admin API and UI.
- Public booking handler with Turnstile, 30-minute slots, Central-time rule evaluation, lunch blackout, date overrides, idempotency key, and 15-minute occupancy cells.
- Google Calendar REST adapter: event overlap check and Google Meet creation, idempotent event ID.
- Trinity mail gateway adapter using HTTPS bearer secret, not Gmail.
- Four interested-contact import candidates, subject to source verification.

## Outstanding deployment blockers
1. Obtain the **actual** existing appointment-admin Worker source and integrate it as `legacy-admin-worker.mjs`. The wrapper imports this file but it is not in the repository. Verify its authentication behavior. Require MFA or access gateway, proper CSRF, and throttling before production.
2. Connect public bookingApi to the public Cloudflare Worker route, retaining the old /api/intake and Turnstile workflow. Current public handler is a module, not wired to production.
3. Provision staging D1 and apply 003, 004, 006, then optionally reviewed 005. The migrations have not been executed. Verify original table IDs and constraints.
4. Implement secure OAuth refresh token flow or service-account delegation as appropriate. `GOOGLE_CALENDAR_ACCESS_TOKEN` is **short-lived staging only**. No credential is stored in Git. Verify authorized write access to Jack's intended calendar.
5. Verify `TRINITY_MAIL_GATEWAY_URL` actually implements the JSON contract in namecheap-mail-adapter.mjs, supports provider idempotency, and sends through approved Namecheap domain infrastructure. Existing Trinity email gateway was reported with sending disabled; do not assume it works.
6. Implement durable recovery for reservations with status `reserved` or `calendar_created`, reconcile Google event IDs, and retry mail with deduplication. The schema supports outbox but worker has not implemented the queue processor.
7. Add booking public UI that submits an Idempotency-Key and Turnstile token; current scheduler/index.html is a preview and intentionally not live.
8. Configure Cloudflare WAF/rate limits, admin access protection, CORS, secrets, and monitor. Run staging tests for daylight-saving transitions, double clicks, concurrent overlapping bookings, partial Google/SMTP failures, rejected invitations, and existing request form regression.
9. Obtain Jack's approval of early/regular/late window defaults and lunch block. Confirm automatic bookings and approval-mode operational semantics.
10. Validate provider replies and attendee invitations, not just HTTP 200. Roll out to production only after end-to-end staging evidence.

## Cloudflare bindings
- `DB`: D1 binding
- `TURNSTILE_SECRET_KEY`: secret
- `GOOGLE_CALENDAR_ID`: optional calendar ID, default primary
- `GOOGLE_CALENDAR_ACCESS_TOKEN`: staging-only temporary secret
- `TRINITY_MAIL_GATEWAY_URL`: HTTPS gateway URL
- `TRINITY_MAIL_GATEWAY_TOKEN`: secret

## Safety and correctness
A booking with approval_pending is **not confirmed**. A reservation with status reserved or calendar_created is **not yet fully confirmed to the requester**. Do not send confirmations before calendar creation. Never expose private /desk or /api/opportunities publicly. Current code is an integration candidate, not a verified deployable product.
