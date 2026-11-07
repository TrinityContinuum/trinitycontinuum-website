# Trinity Intake: Zero-Additional-Cost Infrastructure Decision Record
Status: **OPEN, not deployed**. The $0 goal is a constraint, not a reason to use disposable storage.

## Existing assets verified
- GitHub Pages hosts the public Trinity site. Static pages cannot privately receive and store submissions.
- Trinity Render workspace exists; no web service, PostgreSQL or key-value instances were listed during inspection.
- Existing Namecheap Private Email provides Trinity business mailboxes, but a mail account is not a secure server-side lead database.
- SHANE and SHON resources are out of scope; do not use or share their projects.
- Render free PostgreSQL has an expiration constraint, so it is **rejected** for durable customer records.

## Candidate pathways to verify, not yet approved
1. **Existing paid entitlement already held by Trinity**: check Namecheap hosting, business-email APIs or other durable hosting included in existing subscriptions. Do not assume Private Email alone provides a server-side form endpoint.
2. **Non-expiring free managed database + free HTTPS API**: independently confirm storage lifecycle, backup/export, inactive-project policies, quotas, authentication, serverless execution and sender compatibility. If the database pauses, verify automated restore and alerting before launch. This is not equivalent to guaranteed continuous availability.
3. **Owner-approved low-cost managed database** only if no durable $0 option passes; show exact cost before provisioning.

## Release prerequisites
- Confirm legal ownership, admin access, backups, retention and a tested export/restore process.
- Confirm a mail transport that works from selected hosting; free Render may block direct SMTP ports, so HTTPS provider API may be needed.
- Test real submission and recipient delivery with consent, correct Reply-To, sender SPF/DKIM/DMARC and bounce/failure visibility.
- No public form activation, paid resource, or third-party solicitation without the appropriate approval.

## Evidence
GitHub Actions commit 596c995: intake checks run 42293215996 PASS; website browser smoke run 42293215914 PASS. These do not prove live backend operation.
