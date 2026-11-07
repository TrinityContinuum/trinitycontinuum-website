# TCON Namecheap Private Email bridge

Status: integration design only. No SMTP credentials, mailboxes, DNS, or production mail routing changed.

## Goal
Enable authorized TCON correspondence using Trinity Continuum's existing Namecheap Private Email mailboxes, without replacing MX records or introducing a new paid email service.

## Existing transport
- SMTP: mail.privateemail.com, port 465 with TLS (verify current account settings before use).
- IMAP: mail.privateemail.com, port 993 with TLS (verify current account settings before use).
- Mailbox username is the full Trinity email address; credentials are provided only through secret storage, never source code or browser UI.
- Sender address must match an authorized mailbox or explicitly configured alias. Never spoof From or Reply-To.

## Architecture
TCON admin UI -> authenticated server-side API -> review/approval queue -> rate-limited outbound worker -> Namecheap SMTP -> recipient. Incoming replies -> Namecheap IMAP -> authorized server-side sync -> inquiry thread. ChatGPT may prepare content and initiate authorized actions only through an explicitly connected supported tool or service API; a website backend alone does not grant this chat direct sending capability.

## Security and policy
- Keep SMTP and IMAP secrets server-side only, not in GitHub, browser storage, logs, or public preview.
- Separate Jack-approved identities and mailbox permissions. No impersonation.
- Default outbound status is draft/pending approval; no automatic campaigns.
- Require authenticated operator, recipient validation, idempotency key, audit trail, delivery/error state, unsubscribe and suppression handling for marketing, and configurable provider-compliant hourly/daily limits.
- Store only necessary correspondence; segregate confidential data from public preview and unrelated projects.
- Do not change existing DNS MX, SPF, DKIM, or DMARC records without first inspecting the current records and obtaining approval.

## Acceptance gates
1. Verify authorized mailbox and credentials using server-side connection check, without exposing secrets.
2. Send a single explicitly approved test to an authorized recipient and inspect the actual RFC5322 From, Reply-To, SPF, DKIM and DMARC alignment.
3. Confirm recipient can reply and IMAP sync associates reply with the correct TCON inquiry.
4. Verify no duplicate sends, failed-send handling, rate limits, and opt-out controls.
5. Confirm TCON's authenticated API is available to the intended operator/ChatGPT integration; do not claim ChatGPT direct sending until tested end to end.
6. Activate production only after Jack's approval and end-to-end acceptance.

## Non-goals
No mailbox migration, no new paid service, no bulk unsolicited outreach, no Trinity main-branch deployment, and no modifications to SHANE or SHON.
