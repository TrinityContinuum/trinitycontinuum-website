# Trinity appointment intake (Cloudflare Free preparation)

STATUS: Source code prepared only. Not yet deployed, configured, or connected to public form.
Do NOT deploy over the existing trinity-email-gateway Worker.
No changes to Namecheap DNS, MX, SMTP, existing D1 database, or previously accepted meetings.

## Free plan basis
- Cloudflare Workers Free: currently 100,000 requests/day and 10 ms CPU/request.
- Cloudflare D1 has a free tier with daily row read/write limits.
- Cloudflare Email Service can send to *verified destination addresses* free, including on Workers Free. Arbitrary visitor acknowledgment emails would require a separate paid-capable sender or other integration.
- The sender domain must be onboarded to Cloudflare Email Service. This requires a check of DNS ownership/settings and may be unavailable if Trinity is not on Cloudflare DNS. Do not change existing Namecheap MX records or corporate email routing.
- Cloudflare Turnstile has a free plan.

## Activation checklist (requires account owner / authorized Cloudflare dashboard access)
1. Confirm you are in Jack's Cloudflare account and Free Workers plan. Do not enable any paid plan.
2. Create new D1 database "trinity-appointments-db", separate from "trinity-email-db". Record the generated database_id in wrangler.toml.
3. Apply migrations/001.sql to the new D1 database (production).
4. Create a free Cloudflare Turnstile managed widget restricted to trinitycontinuum.com and www.trinitycontinuum.com. Save its **site key** for the public form. Save the **secret** only in a Cloudflare Worker secret named TURNSTILE_SECRET (never GitHub).
5. Under Cloudflare Email Service, verify jack@trinitycontinuum.com as a destination. Confirm that enabling Email Service and selecting a sender domain will NOT alter corporate MX mail delivery. If the domain cannot be onboarded without interfering with Namecheap, STOP; use an alternate vetted notification provider instead.
6. Configure EMAIL_FROM as a Worker environment variable using a permitted sender address from the onboarded domain.
7. Deploy a NEW Worker, "trinity-appointments", using this directory as project root (or Wrangler CLI, after explicit review).
8. GET /health must show ready=true. It does not prove email delivery.
9. Configure the public form to POST to the actual deployed Worker URL and embed the Turnstile site key. Do not invent worker URL or publish an endpoint before it exists.
10. Submit TEST ONLY with an external email address. Confirm HTTP response, D1 record, Cloudflare sending logs, receipt in Jack's independent Namecheap inbox (and Spam), and visitor no-booking language.
11. Only then remove the mailto fallback. Keep Trinity approval before booking and send Google Meet invitations manually after approval.

## Security and behavior
- CORS and POST allow Trinity website origins only; strict Origin check.
- Server validates input and verifies Turnstile tokens; no public submission without verification.
- Request is saved to a separate D1 table; notifications are sent to a fixed Jack destination.
- No visitor auto-replies and no automatic calendar bookings.
- D1 entries contain contact information; restrict database access and set a retention/deletion policy before production.
- Failing notification returns a reference and failure warning, not fake "email delivered" success.
- Add Worker observability, limits, and a recovery procedure for failed notification_status rows before the service is advertised as live.
