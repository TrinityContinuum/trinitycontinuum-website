# Trinity appointment administration — current safe operating path
**Revision:** November 22, 2026 Central
**Public helper:** RETIRED. The former `/tools/appointment-approval.html` and `/tools/appointment-intake-diagnostic.html` publicly hosted utilities are now inert notice pages. Their original code remains in Git history; do not restore a public data-entry or diagnostic-write form.

## Authorized manual workflow
1. Public visitors may request meetings via `https://trinitycontinuum.com/meetings.html`. The public form submits the request to the existing private Cloudflare D1 queue and Web3Forms notification flow. It **does not automatically book** a slot.
2. Jack's **private appointment administration Worker** is at `https://trinity-appointment-admin.jackspurewater.workers.dev/`. It is not part of public site navigation. Only the authorized owner uses the existing `jack` administrator account and the unique secret stored in the approved password manager / Cloudflare Worker configuration. Do NOT send or paste the password to ChatGPT, email or GitHub.
3. Live unauthenticated GETs to the dashboard, `/api/requests`, `/api/automation-status` and `/api/decisions` all returned HTTP 401 on November 22. This proves public denial and a reachable Worker, **not** that authenticated D1 reads work.
4. After owner login, the private dashboard should show the appointment request queue, and permit a reviewed **Accept first / Accept second / Request alternative / Decline** manual decision. The action **Record Jack's decision** saves an internal decision only; it **does not send the visitor an email or book a meeting**.
5. The private dashboard also offers **Copy reply text**, **Open addressed email draft**, and **Open Google Calendar event**. Jack must review, send, verify calendar availability and add a unique Google Meet invitation manually unless the authorized automation integration has separately passed live acceptance.
6. Owner tests exactly ONE internal synthetic request through the normal public Meetings page, with legitimate Turnstile, then reads the same request ID in the private queue. Verify receipt of the Web3Forms notification in the intended Trinity mailbox, record a manual decision, verify D1 readback and actual visitor notification under controlled staff identities. Preserve audit history and do not delete production records.
7. To enable true visitor self-booking at **1:30–4:00 PM Central starts, Monday–Friday, except observed federal holidays and other approved blackouts**, complete the separate staged booking integration in [PR #43](https://github.com/TrinityContinuum/trinitycontinuum-website/pull/43): corporate Google OAuth, all relevant Jack busy calendars, private D1 backup/migrations, Google Meet links, replay/double-booking checks and owner-authorized live acceptance. Keep `DIRECT_BOOKING_ENABLED` off until those pass.

## Verification and security
- [Read-only private Worker authentication proof](https://github.com/TrinityContinuum/trinitycontinuum-website/actions/runs/45109798209): unauthenticated routes reject with 401; source-only six-test manual-control suite passes.
- HTTP Basic over HTTPS is **not MFA**. Before any broader operator access or automatic messages, move private administration behind MFA-backed identity enforcement with per-user accountability and rate limits.
- Avoid the public helper pages for personal data; do not give strangers the private Worker URL, login, raw queue records, visitor email lists or admin tokens.
- Preserve all existing D1 records, intake Worker, Google Workspace corporate mail and the original filmed/illustrated website.

**Operational status:** Public form and private Worker are present. Unauthorized access denied; authenticated manual queue read/write needs a one-time owner test. Direct booking and automated approval/sending remain gated until real Google Calendar/Meet and provider acceptance.
