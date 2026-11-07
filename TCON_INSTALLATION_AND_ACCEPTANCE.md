# Trinity Communications & Outreach Network (TCON)
## Staging acceptance checklist | No production activation

### Current components
- `trinity-communications-admin.html` + `assets/trinity-admin.js`: private staff sign-in, contact CSV import (100/batch), contact eligibility review, suppression, campaign creation (disabled), message drafting and individual draft review.
- `supabase/functions/trinity-admin/index.ts`: server-validated staff identity and UUID allowlist. Imports start **unapproved**; no bulk approval shortcut.
- `supabase/trinity-outreach.sql`: RLS-protected data model and serialized campaign quota reservations. Campaign defaults: 0/day, 0/hour, disabled.
- `supabase/functions/trinity-outreach-worker/index.ts`: sending requires explicitly enabled secret flag, provider key, sender, address, unsubscribe endpoint and campaign approval.
- `supabase/functions/trinity-mail-events/index.ts`: HMAC-authenticated normalized delivery/bounce/complaint/inbound events. Requires a separately implemented provider adapter and verified event provenance.
- `supabase/functions/trinity-unsubscribe/index.ts`: signed unsubscribe confirmation.
- `supabase/functions/trinity-inquiry/index.ts`: intake response due times vary by category/length, with sensitive review holds in reply worker.

### Preconditions for deploying on a dedicated Trinity Supabase project
1. Obtain Jack's written approval, decide AI persona and sending provider. No paid API or provider plan without authorization.
2. Create a **separate** Trinity project; never use SHON or SHANE. Confirm billing before provisioning.
3. Review/apply SQL to dedicated project, run database security advisors, check RLS and RPC permissions. Admin service key only in server secrets.
4. Configure `TRINITY_ADMIN_USER_IDS` from approved staff Supabase Auth UUIDs, configure frontend publishable key and project URL privately, require secure staff passwords and MFA where available.
5. Set all worker flags to false. Do not configure cron until test-only environment is validated.
6. Implement and verify provider adapter: signature verification on provider callbacks, normalization, idempotency and message-id mapping. Current normalized event function is **not** a direct Resend or Namecheap webhook.
7. Configure domain-authenticated outbound sender, reply routing, valid postal address, signed unsubscribe URL, provider terms compliance and suppression. Check SPF/DKIM/DMARC.
8. Add throttling/abuse protection to public form; add explicit privacy/retention notices; inspect DNS and deployment configuration.
9. Build real campaign approval and configuration controls (currently campaigns remain disabled), inbox display and analytics beyond basic summary. Implement safe retry/reconciliation and event delivery status.
10. End-to-end test: staff login; unauthorized rejection; CSV import with quoted commas; duplicate/suppressed addresses; contact review; campaign hold; draft review; concurrent quota claims; provider failure; inbound threading; bounce suppression; opt-out; scheduled AI response; no duplicate send; restoration after interruption.
11. Begin a low-volume approved pilot only after all tests pass. The 300/day figure is a configurable ceiling, not a target until provider approval and delivery health are demonstrated.

### Important status distinction
These files are **committed staging source code**, not an installed or verified production application. There is no live Trinity database, authenticated staff service, real provider bridge, live cron, or end-to-end test result. Existing website navigation and mailboxes are unchanged.

### Review links
- Draft PR: https://github.com/TrinityContinuum/trinitycontinuum-website/pull/31
- Sample console: `brotherchat-console.html`
- Staff management page: `trinity-communications-admin.html`
