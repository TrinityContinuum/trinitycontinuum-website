# Trinity central booking — management-review implementation (NOT DEPLOYED)

## Required behavior

**Single source of truth:** Trinity's Cloudflare D1 private appointment data, not Jack's private/personal Google Calendar. The existing `appointments` table holds approval-required meeting requests; `appointment_bookings` holds confirmed direct bookings and uncertain-outcome records. An administrative master schedule must reconcile both with pre-existing Google invitations before cutover.

- **Inside Jack-enabled hours:** show only 30-minute slots after live free/busy checks on the specifically authorized *business* calendar; repeat the check server-side immediately before accepting a booking. Book only when the D1 slot reservation succeeds and Google event creation confirms.
- **Outside enabled hours / insufficient notice / already booked / inaccessible Google Calendar:** require manual request and Jack approval; never claim a confirmed appointment.
- **Time zone:** All configurable hours in America/Chicago, DST aware; lunch 11:30–13:00 Central hard-blocked; nonexistent/ambiguous DST slots blocked.
- **Current conflicts:** Google free/busy must include current personal-availability busy blocks only if management explicitly authorizes that read-only conflict source. Personal calendar must not become public booking destination.
- **Authority:** Jack selects daily allowed windows, notice period and booking horizon from the authenticated `/admin` policy screen. Default = zero windows and disabled.
- **Approvals:** Existing D1 request and manual approval queue remain intact; do not rebook or delete prior meetings.

## Staged files
- `004_direct_booking.sql`: disabled-by-default policy and unique per-slot D1 booking ledger.
- `direct-booking.js`: separate experimental Cloudflare Worker for `/api/public/policy`, `/api/public/slots`, `/api/public/book`, `/admin`, `/api/admin/policy`, `/api/admin/bookings`. Separate worker; DO NOT replace existing `intake.js` or existing `admin.js`.
- `instant-booking.html`: public feature page, with direct-booking API unset and approval-request fallback.

## Deployment and security gates — mandatory
1. **Jack confirms the business-calendar owner and calendar ID** (it must not silently be Jack's personal calendar), and approves specific bookable hours; account OAuth must be authorized by that actual owner.
2. Obtain management approval of the existing appointments; reconcile pre-existing email/phone/Meet/Google events into Trinity's master register with appointment IDs before treating it as complete.
3. Backup `trinity-appointments-db`, verify existing tables and migrations, then apply `004_direct_booking.sql` only after review. Do not change existing records.
4. Provision a **new** Cloudflare Worker with its own database binding `DB`, Turnstile secret, Basic-auth password (temporary only; MFA-backed Access strongly preferred), Google client ID/secret/refresh token, and corporate `GOOGLE_CALENDAR_ID` as Worker secrets; never commit secrets or put them in HTML.
5. Deploy with `DIRECT_BOOKING_ENABLED=false` or unset. Restrict admin access with MFA/Access, rate limits, CSP, Origin checks and security review. Verify anonymous API requests cannot enumerate private appointment data and that hostile origins cannot submit.
6. Verify calendar free/busy, event creation, Google Meet generation, attendee invitations, and cancellation/reconciliation on **internal test identities**, not live prospects. Test concurrent slot requests, daylight saving transitions, blocked lunch, post-hours submissions, bad Turnstile tokens, calendar errors and duplicate/idempotent requests.
7. After all gates pass, set `window.TRINITY_DIRECT_BOOKING_API` to the actual approved Worker origin in `assets/config.js` and add navigation to `instant-booking.html`. Only then allow `DIRECT_BOOKING_ENABLED=true`. Watch D1/calendar for divergence; roll back switch if uncertain.
8. Keep existing Web3Forms and `/api/intake` approvals functional and notify Adam/Mirael/Jack of a single booking reference.

## Known restrictions / before production
- The direct-booking Worker and existing manual-approval Worker are **separate code paths**; admin-side combined reporting, cancellations/reschedules, explicit invitation delivery monitoring, and complete legacy event import are still required before claiming a unified operational calendar.
- The 30-minute duration is a staging choice, not a fixed management setting. Add variable duration and buffer policy if Jack requests it.
- The staged event endpoint sends guest updates via Google; a separate Trinity corporate confirmation sender is not wired here. Do not falsely claim corporate email delivery.
- If the Google event is created but D1 confirmation fails, the slot remains `needs_reconciliation` rather than being released. This is intentional to avoid duplicate bookings.
- A standalone Worker on a public hostname requires robust rate limiting and approved authentication. HTTP Basic is interim only.
- **No external deployment, credentials, D1 migration, user notifications, calendar inserts, or production site changes have been executed from this branch.**
