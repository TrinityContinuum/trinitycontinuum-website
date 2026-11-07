# Trinity Private Email Gateway (isolated prototype)

This service is **not production-ready or connected to ChatGPT**. It provides an isolated API prototype for the existing Namecheap mailbox `adam@trinitycontinuum.com`.

## Configuration

Use Render environment secrets, not GitHub files or chat messages:

- `MAIL_USER=adam@trinitycontinuum.com`
- `MAIL_PASSWORD`: existing Namecheap Private Email mailbox password, entered privately by the mailbox owner
- `GATEWAY_TOKEN`: high-entropy random bearer token, stored privately
- `PORT`: supplied by Render

No DNS, mailbox, Gmail, BrotherChat or website changes are required.

Run with `npm ci` (after generating a lockfile) or `npm install`, then `npm start` from this directory.

## Endpoints

- `GET /health`: liveness only, not proof of SMTP or IMAP connectivity.
- `POST /v1/send`: bearer-protected JSON `{ "to": ["recipient@example.com"], "subject": "Subject", "text": "Body" }`.
- `GET /v1/inbox?limit=10`: bearer-protected recent inbox metadata.

## Production blockers

1. Do not deploy publicly until request rate limiting, replay/idempotency protection, audit logging without message-body leakage, recipient allowlisting or campaign consent rules, and full security review are implemented.
2. Add message retrieval, thread-safe replies, pagination and robust delivery/bounce monitoring.
3. Verify Namecheap SMTP/IMAP access using secure Render secrets, test both directions and check SPF/DKIM/DMARC.
4. Establish a compatible authenticated ChatGPT plugin/MCP connection. A standalone REST API is **not** a ChatGPT integration.
5. Confirm the owner's approval before enabling unattended campaign sends.
6. Keep BrotherChat credentials and permissions entirely separate.

The gateway deliberately exits when credentials are missing and does not contain mailbox passwords.
