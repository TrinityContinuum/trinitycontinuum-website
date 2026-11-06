# Trinity inquiry backend foundation (NOT DEPLOYED)

This branch contains an API, PostgreSQL schema and independent mail outbox worker. An inquiry and two outgoing mail jobs are inserted in one transaction, so notification work survives application restarts. The worker processes each notification separately with retry backoff. Mail delivery can still be duplicated after a crash between provider acceptance and recording success; recipient-side idempotency is not guaranteed. SMTP requires a network/service permitting the configured port.

## Required configuration
DATABASE_URL, ADMIN_TOKEN (32+ characters), PUBLIC_ORIGIN, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM; DB_SSL if appropriate. Never commit secrets or actual customer records. Execute schema.sql against a dedicated durable database. Run API via npm start and worker via node mail-worker.js as a separate long-lived process.

## Release blockers
- Durable, non-expiring database plan with backups and export; no temporary Render free PostgreSQL.
- Verified outbound transport on selected service. Render free services may restrict SMTP ports; consider approved HTTPS mail provider instead of this SMTP worker.
- Domain/sender DNS alignment and live tests with Jack's mailbox.
- Customer-facing form wired to backend with server URL and bot protection, privacy notice and retention policy.
- Administrative export and protected status updates, failure alerting for exhausted retries, operational monitoring.
- Production-grade abuse controls and rate limit persistence across service restarts; integration tests and accessibility verification.
- Explicit approval for any recurring costs and live public release.

Current status: development code only. No production submissions or emails have been sent.
