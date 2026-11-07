# Trinity Continuum: Secure Inquiry Gateway | Implementation Contract
Date: 2026-11-06
Status: DEVELOPMENT SPECIFICATION ONLY. No live intake or email delivery has been implemented or verified.
Authority: Jack Coates's Nov 6 1:34 PM contact-gateway directive. Preserve public engineering claims and all existing pages.

## Sequence and acceptance
1. Identify current hosting and backend capabilities, domain DNS, deploy pipeline, approved costs, data-controller access, and mail sending provider. Do not place secrets in this repository or client-side JS.
2. Build authenticated server-side POST /api/inquiries with strict schema validation, length limits, normalized email, category whitelist, consent timestamp, honeypot and rate limiting, bot protection, and no attachments by default. HTTPS required. Keep confidential engineering data out of public form fields.
3. Store records durably with unique non-enumerable inquiry ID, submitted UTC timestamp, category, state, contact information, status, owner, follow-up date, source and audit history. Use restricted administrator permissions and defined retention policy. Restrict exports; log access.
4. Send acknowledgment to submitter and notification to jack@trinitycontinuum.com via authenticated server-side provider. Queue/retry failures, alert on persistent failure, and preserve inquiry regardless of email status. Verify SPF/DKIM/DMARC on actual outbound samples. Never send through client-side mailto as the primary submission.
5. Build accessible responsive public worksheet: seven categories (A industrial/data center, B government/emergency, C product water/power/thermal, D manufacturing/construction/design-build, E supplier/OEM/engineering, F investor/professional, G general); alphabetized US 50 states plus DC and International; name, organization, work email, state, city/site, role, project title, description, preferred contact method required; phone optional unless callback selected; optional website and referral.
6. Conditional technical fields: water volume GPD/GPY, feedwater, quality/end use, storage/testing/discharge; power kW/MW, duty, voltage/frequency, grid/island/black-start; thermal duty/steam/temperature/cooling; trailers/platforms, site, interfaces, permits, timeline, optional budget, deployment, free text. Every unknown technical field may be marked 'Need assessment'.
7. Construction/RFP worksheet for facility site, land status, scope/disciplines, building/utilities, equipment/lines, schedule, qualifications, and bidder contact. Historical 500/600/700/1000 throughput scenarios are NOT public forecasts or the three-GC bidding instruction. Later Nov 6 1:36 PM factory directive controls: ONE existing facility design, three GCs, same bid set, no alternate designs or output guarantee.
8. Optional trucker-owned relocatable system interest subtype within product category; record intended operating region, utilities, mobile use case, ownership interest. Do not imply approved product, mobility specifications, pricing, financing, or anywhere-deployment capability.
9. Place consistent 'Tell Us What You Need' calls to action on homepage, contact, industries, manufacturing and outreach landing pages, preserving content.
10. Test all seven categories on desktop/mobile and keyboard/screen reader: validation, consent, duplicate/retry, spam defenses, persistence, admin retrieval/export, acknowledgment, Jack inbox receipt, reply routing, mail authentication, failure alerts and test-data cleanup. Never claim PASS until independently observed.
11. Provide Jack commit/PR, changed pages, provider, data location, access, exact test outcomes, sample ID, screenshots, monthly costs, blockers. Do not deploy publicly without approved provider, privacy notice, and validated end-to-end delivery.

## Explicit blockers
- No backend hosting/provider, credentials, storage location, retention terms or transactional mail sender has yet been confirmed.
- Current contact.html uses client-side mail preparation and does not store/submit server-side.
- Brotherchat is a separate coordination mailbox, NOT the destination for website leads; Jack is the required notification recipient.
- No confidential CAD or investor records may be uploaded through public intake.

## Parallel workstreams after gateway
- Existing factory: one approved design, one comparable turnkey GC bid package, three bids; reconcile source docs and revision/equipment schedules, RFI and acceptance register. Jack approves release and recipients.
- Six trailers: independent tagged ICD/BOM/drawing verification, 34 open gates, conceptual illustration review, and 18 manufacturing bid tracking. Do not redesign or assert fabrication approval.
- Brotherchat: rotate exposed password, test outbound, headers and reply, confirm routing; do not publish until Jack approves.
- Trucker concept: separate exploratory offering and interest fields, no unapproved commercial or technical claims.
