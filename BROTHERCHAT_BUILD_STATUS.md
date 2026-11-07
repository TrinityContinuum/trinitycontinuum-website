# Brotherchat build status / preapproval staging

All new pages and functions remain on the draft pull request branch, not merged or deployed. **Do not activate email sending before Jack approves the sender identity and commercial outreach policy.**

## Files added
- `brotherchat-console.html`: isolated, sample-only management preview. No navigation links from existing public pages.
- `assets/brotherchat-console.js`: sample outreach text, campaign link and response-timing preview. No network calls.
- `supabase/trinity-outreach.sql`: separate Trinity prospect, campaign, suppression, outbox, events, threads and audit tables with RLS.
- `supabase/functions/trinity-outreach-worker/index.ts`: guarded outreach queue sender, disabled by default. Requires approved provider and all secrets.
- `supabase/functions/trinity-unsubscribe/index.ts`: HMAC-verified opt-out confirmation endpoint.
- `supabase/functions/trinity-inquiry/index.ts`: now assigns bounded response times by category and question length.
- Existing `trinity-reply-worker`: immediate reply draft, approval hold for sensitive subjects, scheduled sending only after explicit configuration.

## Not yet connected or verified
No Trinity database project, deployment, SMTP/API sender verification, inbound IMAP/webhook processor, contact import interface, authenticated management API, real analytics dashboard, customer-data retention policy, complete bot protection, or full integration tests. The preview page is **not an authenticated admin interface** and must never expose real contacts or secrets.

## Engineering gates still required
1. Fix outbound rate-limit concurrency: the current database claim checks prior *sent* rows but not all in-flight sends; implement atomic campaign quota reservation before production.
2. Implement signed-in management API and real dashboard for CSV import, deduplication, eligibility review, campaign approval, message drafting and status.
3. Add inbound email ingestion and threading with verified webhook signatures or authenticated IMAP.
4. Add provider webhook verification, bounce/complaint processing, retries with backoff and manual reconciliation of ambiguous sends.
5. Verify campaign approval, content review, business postal address, working opt-out and sender-domain authorization.
6. Test public form validation, abuse limits, response timing, review holds, suppression, duplicate handling, authentication and database permissions.
7. Run a synthetic end-to-end trial (form → draft → scheduled send → test inbox → reply → tracking), then approved low-volume outreach pilot.
8. Review privacy/data retention and provider commercial-email rules; no added paid service without approval.

## Sender identity choice
Use configuration `TRINITY_OUTREACH_FROM` and editable console sender name. The final mailbox/persona can be Brotherchat or another Jack-approved Trinity identity. Do not hardcode a new mailbox or create one before approval.

## Approval and safety
Existing public website pages remain untouched by this staging work. No sending, provider setup, database migration, mailbox changes, or production activation is authorized by this branch.

## November 7 implementation update
Added authenticated admin API and staff management page, reviewed CSV import, draft approval, campaign creation disabled by default, serialized quota claims, HMAC-protected normalized mail-event intake and acceptance checklist. See `TCON_INSTALLATION_AND_ACCEPTANCE.md`. These are source implementations, not deployed or end-to-end tested. A provider-specific verified bridge, campaign activation UI, live analytics, abuse protection and installation remain pending.

## November 7 hardening pass
- Added global 300/day quota logic and a transaction-scoped advisory lock in `trinity_claim_outbox` to serialize worker reservations across campaigns. Requires real PostgreSQL concurrency tests before production claims.
- Outbound eligibility now requires contact status `eligible`, preventing automatic repeat cold outreach after a contact becomes `contacted`.
- Added pure policy module `assets/tcon-policy.mjs`, Node tests `tests/tcon-policy.test.mjs`, and an isolated GitHub Actions workflow. No claim is made that the workflow has passed until checks are observed.
- Remaining: provider bridge, real database, auth deployment, production tests, full dashboard and reporting, security review, privacy policy and campaign activation controls.
