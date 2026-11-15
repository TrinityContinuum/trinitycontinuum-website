# Trinity appointment queue — controlled release status

**Live and tested on November 14, 2026:** Public form -> Cloudflare D1 intake + Web3Forms -> Namecheap notification; private password-protected admin Worker for manual decisions and prepared email/calendar drafts. Both intake and admin Workers were deployed and tested. Keep them operational.

**NOT LIVE:** Auto-approval email/Google Meet delivery added to GitHub only; external authorizations, migrations, security checks, and deployment are still required.

## Why this is separate
Web3Forms free has no active webhook or submissions API, and its documented browser endpoint cannot be safely proxied by free server-side code. Therefore the new browser integration must post the appointment to an independent Cloudflare intake endpoint *and* keep the current Web3Forms browser submission, with clear partial-failure reporting and durable IDs.

## Historical deployment gates (initial setup completed, for reference)
1. Deploy a separate Worker for `intake.js`. Bind existing `trinity-appointments-db` as DB and the already stored Turnstile Secret as TURNSTILE_SECRET in this new Worker, and test the Cloudflare Turnstile site token from the actual domain. Do not assume secrets from other workers propagate.
2. Bind the D1 database to a separate `admin.js` Worker. Enable Cloudflare Access on the whole admin Worker hostname. Set APPROVER_EMAILS to Jack's verified login identity. Verify that anonymous requests, nonstaff logins, and direct `/api/requests` calls are forbidden.
3. Verify both Workers with test requests, including duplicate submission IDs, failed Turnstile tokens, outside-origin rejection, and a private queue read. Ensure visitor PII is not written to public logs.
4. Stage a website change which creates a UUID and submits the same visitor fields to D1 plus Web3Forms. Preserve the Web3Forms browser-side call: its free endpoint may reject server-side calls. Roll out only after both independent operations are tested; provide clear error state for one succeeding and the other failing.
5. Implement retention controls, conflict-free real calendar availability, and server-side Central Time lunch blocking (11:30 AM–1 PM), including DST/time-zone conversion; no unverified slots may be described as available.
6. To achieve one-click Confirm & Send, connect a verified authenticated outbound mail transport and Google Calendar/Meet; both require account authorization. Current admin page only prepares text for corporate Namecheap reply and never books or sends.

## Status and safety
Code and documentation only. No paid plan, no change to Namecheap DNS/MX, no changes to existing gateway. Manual approval helper remains functional. Existing Web3Forms delivery stays live.

## Interim private authentication — revision November 14

`admin.js` now uses HTTPS HTTP Basic authentication (username `jack`) because Zero Trust Free activation in this account presented billing authorization. Before deploying, add Cloudflare Worker **secret** `ADMIN_PASSWORD` (generated unique random string of at least 32 characters, never copied into chat or GitHub). Keep existing plain text `APPROVER_EMAILS=jack@trinitycontinuum.com` and D1 binding `DB`. The admin Worker returns HTTP 401 unless the secret exists and is at least 24 characters long; all routes, including `/`, `/api/requests`, and `/api/decisions`, are protected. Use a password manager and do not share the password. Basic authentication has no built-in MFA or throttling; use a unique high-entropy password, rotate it if exposed, and migrate to SSO/Access when acceptable. Never paste the admin source or deploy until the secret exists.

After deploying, test unauthenticated requests fail and authenticated requests succeed before treating the dashboard as live. No actual browser auth test has yet occurred. Do not confuse access to records with automatic sending or calendar booking; those are not integrated. Public Web3Forms intake remains live. The original Access code and documentation are superseded by this interim password design.


## 2026-11-14 automated completion staging (NOT LIVE)

The public form, Web3Forms corporate inbound email, D1 intake, and password-protected admin decisions were proven in browser tests. The existing admin Worker is live for **manual** approvals. Do not disable that.

New staging files:
- `automation-core.js`: independently reviewed business logic for 30-minute calendar events, conflict checking, local time zone conversion including DST ambiguity checks, protected Central lunch, Google Meet creation, corporate mail via Resend, and do-not-repeat-attempt safeguards. NOT a separate deployable Worker.
- `003_automation.sql`: D1 audit/outbound delivery table, NOT yet run.
- `admin.js`: consolidated staged admin Worker containing the same automation core behind `APPROVAL_AUTOMATION_ENABLED=true` and a protected `/api/approve-and-send` endpoint. The live Worker has NOT been updated to this source. No test appointments can be sent by the staged automation. The automatic send control is absent until all required credentials exist.

Activation gates; **do not deploy or enable before all gates are met**:
1. Confirm the owner and calendar ID for Jack's actual corporate scheduling calendar; the ChatGPT connected Gmail account is `jackspurewater@gmail.com`, not `jack@trinitycontinuum.com`. Google authorization must belong to the exact calendar owner, not an assumed linked account.
2. Set up Google Calendar API OAuth (client ID, client secret, offline refresh token with calendar permission) and store as Cloudflare Worker secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`; configure `GOOGLE_CALENDAR_ID` to the correct calendar. Never paste these in GitHub/chat.
3. Verify `trinitycontinuum.com` as a sender domain with Resend using appropriate SPF/DKIM records **without overwriting existing Namecheap Private Email MX, SPF or DKIM**. Do not update DNS without explicit management approval. Store `RESEND_API_KEY` secret and `RESEND_FROM` verified sender (e.g., corporate address if supported). The from address requires provider approval and is not proven just because the Namecheap mailbox works.
4. Run `003_automation.sql` on `trinity-appointments-db`. Test Google token + free/busy read + event insertion + Meet creation with no real guests, then test outbound corporate email to Jack only. Verify sender/recipient and idempotency. Audit security: Basic auth lacks MFA/rate-limiting; protect against CSRF and credentials leakage before activation. For **any** uncertain state, manually reconcile events and sent mail rather than blindly retrying.
5. Set `APPROVAL_AUTOMATION_ENABLED=true` only after the above tests and monitoring. Deploy the staged `admin.js` and repeat end-to-end test on a clearly marked internal appointment. Do not send real invites to diagnostic addresses or existing SYSTEM TEST records.

Limitations: Google Calendar invitation sending and Resend outbound mail are **two separate notifications**. They require distinct connected credentials. If calendar succeeds but mail fails, audit row is partial and operation blocks automatic retry. This needs operational review before any production enabling. No promise of automated sending or Google Meet invitations until live provider integrations and tests actually succeed.
