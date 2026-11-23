# Trinity central booking — management-review implementation (NOT DEPLOYED)

## Management authorization — November 22, 2026
- **Booking hours:** Monday through Friday, `America/Chicago`, appointment START TIMES at 13:30, 14:00, 14:30, 15:00, 15:30 and 16:00, subject to actual availability. The 16:00 meeting ends 16:30. No weekend starts.
- **Holiday rule:** Automatically exclude all observed **U.S. federal holidays**, calculated server-side across calendar-year boundaries; additional Trinity/company holidays or Jack's travel are excluded by owner-authorized busy events or a future explicit blackout policy. Public calendar holiday subscriptions alone are not assumed to mark availability busy.
- **Meeting duration / buffer / lead:** 30-minute meeting, 15-minute intermeeting conflict buffer, minimum 24-hour notice, 60-day horizon. A 15-minute buffer means a 14:00 start will be unavailable after a 13:30 booking; do NOT promise six bookings daily.
- **Production posture:** Policy is staged in migration 004 with `enabled=0`, so no automatic bookings have been activated. Running unit tests is **not** a substitute for a real connected business calendar, cloud D1, event creation, holidays, private master reconciliation or explicit release approval.
- **Evidence:** `tests/booking-policy.test.mjs` covers weekday 13:30–16:00 starts, observed holidays, DST and an atomic SQLite 15-minute booking buffer; see workflow `.github/workflows/booking-policy-test.yml`.
- **Integration gate:** Authorize `jack@trinitycontinuum.com` business calendar (or identified Trinity-controlled booking calendar) to the booking Worker with scoped Google OAuth. Reconcile all Jack's existing busy events, currently split between business and personal accounts, without exposing personal titles, attendees or data. Secure the admin surface with MFA, migrate D1 with backup, test real free/busy, booking, Meet and notifications, plus cancellations and reschedules before publishing a booking link. No password/OAuth credentials in GitHub or public files.

## Verified integration progress, November 22, 2026
- **Live Google sharing verified:** From Jack's corporate Google Calendar connector, a free/busy query of the personal calendar `jackspurewater@gmail.com` now succeeds, and reported an existing 2026-11-23 13:30–14:00 Central conflict. Jack shared free/busy only with `jack@trinitycontinuum.com`; titles and attendee details are not exposed. This is *not* proof the Cloudflare Worker's distinct Google OAuth refresh token has the same rights.
- **Secondary calendar is mandatory in the Worker:** Set `GOOGLE_BUSY_CALENDAR_IDS_JSON=["jackspurewater@gmail.com"]` as a **private Worker environment setting**, together with `GOOGLE_CALENDAR_ID=jack@trinitycontinuum.com`. Missing or empty secondary calendars now fail closed. The implementation checks both for every slot preview and booking attempt.
- **Cloudflare deployment access BLOCKED:** Read-only GitHub Actions check [45110888351](https://github.com/TrinityContinuum/trinitycontinuum-website/actions/runs/45110888351) received Cloudflare Workers HTTP 400 (9106 authentication failed) and D1 HTTP 401 (10000 authentication error) from the existing `CLOUDFLARE_API_TOKEN` secret. Do **not** claim Cloudflare DB or Worker activation. The owner must rotate/re-authorize a scoped Cloudflare API token and securely update that GitHub Actions secret, without putting the token in code, tickets or chat. Then rerun the read-only gate before any migration/deploy.
- Google OAuth credentials and Turnstile secret must be verified separately in the actual Worker; GitHub secret replacement alone does not authorize customer appointment creation. Booking remains disabled until a real internal appointment canary succeeds end-to-end.

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
