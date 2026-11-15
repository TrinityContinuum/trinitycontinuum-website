# Trinity automatic appointment queue — staging checkpoint

Current live request flow: browser -> Web3Forms free -> Jack's Namecheap inbox. Proven independently; do not disable.
New staged queue code: `intake.js` and `admin.js`. Neither is deployed or active. Never expose the admin endpoint without Cloudflare Access.

## Why this is separate
Web3Forms free has no active webhook or submissions API, and its documented browser endpoint cannot be safely proxied by free server-side code. Therefore the new browser integration must post the appointment to an independent Cloudflare intake endpoint *and* keep the current Web3Forms browser submission, with clear partial-failure reporting and durable IDs.

## Deployment gates
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
