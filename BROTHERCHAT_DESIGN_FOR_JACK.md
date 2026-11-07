# Trinity Continuum | Brotherchat Customer Correspondence & Outreach System
## Design for Jack's review | November 2026 | NOT AUTHORIZED FOR ACTIVATION

**Decision requested:** whether to use `brotherchat@trinitycontinuum.com` as Trinity's clearly identified AI correspondent for approved outreach and inquiry replies. The existing mailbox has 5 GB allocated. No mailbox capacity increase, paid API subscription, DNS change, email sending, or customer-data import is authorized by this design.

### 1. Purpose and system boundaries
Build one coordinated system that (a) imports and deduplicates the prospect list, (b) prepares approved, industry-relevant outbound emails, (c) sends up to a configurable daily cap, initially 300/day **only if provider policies and reputation permit**, (d) routes prospects to https://trinitycontinuum.com/ and https://trinitycontinuum.com/project-interest.html, (e) captures and classifies inquiries, (f) generates individualized AI drafts promptly, (g) schedules replies according to inquiry content, (h) receives and threads subsequent replies, and (i) reports market interest and outreach performance.

Trinity's AI must identify itself as an AI correspondent. No false human authorship, fabricated engineering claims, or implied certification/performance guarantee.

### 2. Customer journey
Prospect record → eligibility/opt-out checks → approved outreach draft → send queue → provider acceptance/delivery events → website or tracked inquiry form → private lead record → immediate AI draft → content-based schedule → human review when required → outbound reply → incoming response association → next action / qualified lead → dashboard.

Prospects can reply directly by email; the form is an option, not a requirement. Replies must be matched to their existing contact/thread rather than treated as fresh cold outreach.

### 3. Outreach program
- Target ceiling 300/day, with per-hour throttling, gradual warm-up and automatic suspension for excessive bounces, complaints, authentication failures or provider warnings. A published 500/hour limit does **not** guarantee permission for bulk prospecting.
- Only send to contacts whose acquisition source and outreach eligibility are documented. Maintain a global suppression list, opt-outs, hard bounces, prior-contact dedupe, and manual exclusion.
- Every commercial message needs truthful From/Reply-To, subject and identification; accurate physical postal address; clear opt-out mechanism; suppression enforcement. Check CAN-SPAM, state rules, international jurisdiction and Namecheap's acceptable-use rules before activation.
- Approved templates can vary by industry and application, with human-controlled claims and proof sources. Personalization must not invent prior relationships.
- Include https://trinitycontinuum.com/ and https://trinitycontinuum.com/project-interest.html?campaign=<opaque-campaign-code>. Do not embed email addresses or sensitive personal data in URLs.
- Log queued, accepted, delivered (only when independently confirmed), bounced, complained, replied, unsubscribed and failed as distinct statuses. Never report 'sent' as 'delivered'.
- Do not send unsolicited follow-up sequences until approved separately.

### 4. Inquiry form and taxonomy
Capture name, organization, email, location (city/state/country), industry, project purpose, application selections, primary question category, description, questions, estimated timing, discovery source and opaque campaign ID. Optional details remain optional. Provide privacy notice, retention policy and contact channel. Collect only necessary personal information.

Suggested categories:
- Application: water purification; water capacity; electricity; thermal recovery/cooling; industrial process; data center; refinery/petrochemical; mining; municipal; disaster recovery; marine/port; other.
- Inquiry: general information; water quality; production capacity; power integration; thermal recovery; engineering evidence; site feasibility; permitting; economics/pricing; procurement; partnership.
- Industry and geography: controlled categories plus optional free text; normalize for analytics.
- Acquisition: direct; organic search; referral; event; outreach campaign; other/unknown. Do not assume attribution when absent.

### 5. AI response and timing
At submission time T0, persist the inquiry first. Trigger draft generation promptly; save the proposed subject/body, model version, approved knowledge-base version, draft completion timestamp, review flag, and scheduled send timestamp.

Example initial policy (configurable, not a performance guarantee):
- Simple general information: T0 + 15–30 min.
- Specific project/application: T0 + 30–60 min.
- Detailed technical questions: T0 + 60–90 min.
- Urgent inquiries: prioritize triage, not necessarily auto-send.
- Pricing, legal, guarantees, contractual terms, unverified engineering, security-sensitive or procurement commitments: hold for human review with no unattended delivery.

Timing can be deterministic from categories and measured complexity, with optional modest jitter; never misrepresent an AI response as personally written by a human. Do not let AI pick arbitrary unbounded delays. The scheduler checks at least every few minutes; delivery time is approximate and depends on provider availability. Prevent a send if the inquiry has been answered, closed, suppressed or placed on hold.

The AI uses only Jack-approved facts and public site content that has been verified. Do not feed customer inquiries to a model without an appropriate privacy/data-processing review. When the model is unavailable, queue for retry or staff review, not an unapproved technical answer. Log prompt/model/knowledge versions and draft decisions. Store sensitive secrets server-side only.

### 6. Technical architecture
- Static website with form submission over HTTPS to a server endpoint.
- Dedicated Trinity-owned database (separate from SHON/SHANE), private inquiry/prospect/contact/thread/campaign/suppression/draft/outbox/audit tables with RLS and least-privilege access.
- Backend intake validates input, enforces bot protection and rate limits, deduplicates requests, and persists before acknowledging.
- Durable background jobs: generate draft, classify, review gate, schedule send, send with idempotency key, reconcile provider result, retry transient failures with backoff, dead-letter queue for persistent failures.
- Inbound processing via an approved mail-provider webhook or authenticated IMAP bridge, with threading via Message-ID/In-Reply-To and fallback matching. The current ChatGPT Gmail connector is not assumed to send from Namecheap Brotherchat.
- Outbound: either approved Namecheap SMTP integration (if allowed for the intended volume) or verified third-party transactional/bulk provider. Sender-domain verification, SPF/DKIM/DMARC alignment and reply handling are prerequisites. No MX or mailbox migration without Jack's permission.
- Authenticated staff dashboard for review, approve/edit/cancel, lead status, suppression, campaigns, volume, bounce trends and marketing analysis.
- Separate service credentials and operational logs. No API keys in GitHub, client JS or form URLs.

### 7. Reporting
Daily/weekly summaries: contacts eligible, queued, accepted, delivered (verified), hard/soft bounced, complained, unsubscribed, replied, form-submitted, qualified, review-needed; rates by campaign, industry, application, state, question category and source. Distinguish observations from assumptions. Protect small groups and personal details.

### 8. Mailbox storage
Brotherchat currently allocated 5 GB (to be confirmed against Namecheap administration). Database stores lead metadata, draft history, and durable correspondence records; mailbox need not serve as sole archive. Estimate actual average message size and retention first. Example: 300 outbound messages/day at 30 KB each ≈ 9 MB/day or 270 MB/month before replies, attachments and provider overhead; this is only an illustration, not a measured usage forecast. Monitor mailbox occupancy and increase its allocation only if needed and approved.

### 9. Implementation and acceptance gates
**Gate A: design approval** — Jack approves AI sender identity, scope, content boundaries, approved technical claims, sending service and maximum volumes. No live sends.
**Gate B: private infrastructure** — select a no-cost/approved-cost Trinity project, secure schema, consent/privacy controls, abuse protection, test-only API keys.
**Gate C: inquiry journey** — submit synthetic form, persist once, immediately draft, choose adaptive schedule, verify hold/review, deliver a test email, capture reply, update records. Confirm no duplicate or unapproved send.
**Gate D: outreach pilot** — import a small reviewed contact subset, verify source/eligibility, suppression, headers, unsubscribe, SPF/DKIM/DMARC, delivery and reply tracking. Start at low volume; increase only after provider-policy approval and observed performance.
**Gate E: expansion** — 300/day configurable ceiling, alerts, dashboard, reporting, backup/restore, runbooks and ongoing review.

### 10. Present code status
A draft pull request contains preliminary inquiry schema, submission endpoint, immediate draft-generation path, scheduled reply worker and frontend fallback. This is a **prototype, not a live, tested production system**. The outreach queue, inbound threading, authenticated staff dashboard, comprehensive anti-abuse controls and adaptive timing engine are **design only**. The existing prototype's one-hour schedule must be revised to the adaptive policy and its end-to-end behavior tested before deployment.

### 11. Decisions for Jack
1. Approve Brotherchat as AI-identified sender or choose a new address?
2. Approve prospect outreach scope, allowable contact sources, daily cap and pilot volume?
3. Confirm approved technical facts, disallowed claims and which topics require Jack's review?
4. Approve a separate Trinity-owned database and select an email/API provider after verifying free limits and any charges?
5. Approve privacy notice, retention policy, reply routing and staff access?
6. Keep Brotherchat at 5 GB initially, with usage monitoring, or adjust allocation?

**Nothing in this document authorizes activating bulk sending, importing private customer records, enabling paid APIs, changing DNS or sending messages to real prospects.**
