# Trinity project-interest and Brotherchat pipeline

## Status
Code only. NOT deployed. The public page remains email-preparation mode until a separate Trinity backend is configured. No customer data should be collected before verification.

## Deployment (no paid services without approval)
1. Create a **separate Trinity-owned Supabase project** after verifying free-tier eligibility and organization ownership. Do not use SHON/SHANE databases.
2. Apply `supabase/trinity-inquiries.sql` in the new project's SQL editor. Check security advisors. Table is RLS-enabled with no public policies.
3. Deploy `trinity-inquiry` with JWT verification OFF. Restrict origins to the published Trinity domain, add bot controls and rate limiting before public activation. Its server-side service role key must remain secret.
4. Set `window.TRINITY_INQUIRY_ENDPOINT = 'https://<trinity-ref>.supabase.co/functions/v1/trinity-inquiry'` in `assets/config.js` **only after** a live end-to-end test. Until then the site falls back to preparing an email.
5. Deploy `trinity-reply-worker` with JWT verification OFF, secured by a strong `TRINITY_WORKER_SECRET` and never exposed in client code. Schedule a trusted POST with `Authorization: Bearer <secret>` every few minutes. Worker processes inquiries due after one hour.
6. AI replies require `OPENAI_API_KEY` and may incur API charges. Without this, the worker creates a cautious template draft. `BROTHERCHAT_SEND_ENABLED` defaults to OFF. Sending currently requires `RESEND_API_KEY` and verified authorization to send as `brotherchat@trinitycontinuum.com`; this is a proposed provider, not an existing connection. Confirm free quota, sender verification and DNS implications with Jack before enabling. Do not change MX or Namecheap email hosting.
7. Sensitive question categories always become `needs_review`, never auto-send. Build an authenticated staff dashboard to inspect drafts and responses before enabling the scheduler.
8. Confirm privacy notice, retention, unsubscribe rules for follow-up marketing, monitoring, duplicate suppression and per-IP abuse limits. Inquiry replies are transactional, not automatic marketing consent.

## Verification checklist
- Submit one synthetic inquiry; confirm one private row, source, campaign, industry, question category, and due time.
- Confirm anonymous browser cannot SELECT rows.
- Confirm spam honeypot and invalid payload do not store data.
- Confirm 59-minute inquiry is not processed; 61-minute inquiry is drafted.
- Confirm duplicate submissions do not create duplicate replies.
- Confirm no email sends with BROTHERCHAT_SEND_ENABLED unset.
- Verify sending domain authentication, Reply-To and real mailbox reply delivery before enabling auto-send.
- Confirm dashboard only accessible to authorized Trinity staff.

This repository does not contain customer credentials, a live email API key, or a deployed Trinity Supabase project.
