# Trinity Continuum — Master Request & Delivery Checklist
**Baseline:** Jack's November 6, 2026 requests and corrections. **Owner approval:** required for release, costs, external solicitations, and unverified claims. **Current status:** development branch only; no customer gateway live release.

## How to maintain
- `[x]` = demonstrably completed (include evidence/commit, receipt, or approval).
- `[ ]` = still open. A commit is implementation evidence, not live acceptance.
- Update this one file after every work pass. Add date, evidence, responsible party, and blockers in the change log. Do not mark a gate complete because a draft exists.
- **Priority:** P0 intake gateway; P1 REV B website/qualification; P2 one-factory GC bid; P3 Gold 34 gates and six trailers; P4 Brotherchat; P5 trucker-owned concept (exploratory). Parallel work is allowed, but preserve P0.
- **Budget:** $0 incremental recurring spend preferred; no temporary/expiring storage; no paid provisioning without explicit quoted-cost approval. No customer data in SHANE/SHON.

## P0 — Secure website contact and project-requirements gateway
- [x] Inspect existing website and confirm contact form is mailto-based, not stored server-side (GitHub Pages repo review).
- [x] Build separate seven-category inquiry worksheet with conditional water/power/thermal, factory, and exploratory trucker fields (development branch `inquiry-preview.html`).
- [x] Add state/DC/international selection and callback phone requirement (`assets/inquiry-preview.js`).
- [x] Add API foundation with validation, rate limiting, restricted record listing, and durable database schema (`intake-api/server.js`, `schema.sql`).
- [x] Add atomic inquiry + per-recipient notification-job writes and separate retry worker (`intake-api/mail-worker.js`).
- [x] Add guarded HTTPS endpoint configuration and default-OFF release switch (`assets/inquiry-config.js`).
- [x] Add fail-closed API configuration, strong admin token check and DB readiness endpoint; three startup regression tests committed; initial CI regressions fixed; intake workflow run 42293984225 PASS on commit 89b555a, including three startup regression tests.\n- [x] Add 12-gate acceptance ledger (`docs/trinity-release-acceptance-ledger.md`).
- [x] Add CI syntax workflow (`.github/workflows/trinity-intake-checks.yml`); first inspected run FAILED at server.js SQL quoting; corrective commit 596c995 passed intake foundation checks (run 42293215996) and website browser smoke tests (run 42293215914). These are CI checks, not live delivery acceptance.
- [ ] Find and approve **durable non-expiring** Trinity-only data storage with backup/restore and export, ideally $0 incremental.
- [ ] Verify a host supports chosen email transport; Render free SMTP ports may be restricted.
- [ ] Provision backend, database, secrets, and sender with no paid commitment or temporary account.
- [ ] Add reliable failure alerts, abuse protection, persistent rate limiting, administration workflow, privacy/retention controls.
- [ ] Test all seven categories and technical branches, invalid input, duplicate handling, failure/retry, mobile/keyboard.
- [ ] Verify real inquiry saved, Jack notification received, customer acknowledgment received, reply delivery and SPF/DKIM/DMARC.
- [ ] Add approved 'Tell Us What You Need' CTAs to homepage, contact, industries, manufacturing and outreach pages.
- [ ] Obtain owner approval and publish only after all 12 acceptance gates have documented PASS evidence.
- [ ] Verify production website and links after deployment; preserve previous version/rollback.
**Evidence:** [Draft PR #27](https://github.com/TrinityContinuum/trinitycontinuum-website/pull/27). **Live gate count: 0/12 verified.**

## P1 — REV B website and seven-page qualification materials
- [ ] Compare Jack's already-published changes to requested REV B, avoiding duplicate edits.
- [ ] Verify executive opening leads with integrated modular **Water + Power + Thermal** customer value, including UltraPure vacuum-distilled water, electricity and useful thermal recovery.
- [ ] Audit claims, six-trailer flagship vs historical four-trailer material, planning vs verified performance, navigation, mobile, contact paths.
- [ ] Check original seven-page Professional Qualification Package and REV B supporting documents against website; preserve previous versions.
- [ ] Obtain Jack's approval for any remaining material change before updating published claims.
**Important:** Jack indicated some REV B edits may already be on the site. Do not mark complete without page-by-page comparison.

## P2 — ONE existing factory design; three comparable turnkey GC bids
- [x] Record Jack's correction: **one existing controlled factory design**, not alternative capacity-tier factory designs; three comparable GC proposals.
- [ ] Obtain/review controlled Gold Volume 24 Manufacturing Facility REV B, First Factory Build Sequence, replication playbook, controlled CAD reference, CAD master index and EBOM/MBOM crosswalk.
- [ ] Create one controlled issue register with revision, NDA, access permissions, bid assumptions and exclusions.
- [ ] Prepare uniform turnkey lump-sum GC bid package: site, design completion, permits, civil/building, utilities, equipment, installation, commissioning, training, as-builts and warranty.
- [ ] Include manufacturing equipment only as supported by controlled source: CNC, machining, welding, robotics, cranes, QA/QC, testing, turbocharger-related scope if applicable.
- [ ] Identify three qualified GC candidates, record qualifications and owner-approved recipients.
- [ ] Jack approves the identical issue set and solicitation before any external sending.
- [ ] Track all three bid receipts, RFIs, addenda and apples-to-apples comparison; report exclusions and risks.
- [ ] Do not present 500/600/700/1000 capacity scenarios as alternative factory bids or guaranteed production.
**Blocker:** controlled private source files not yet reviewed in this work session.

## P3 — Gold engineering, six-trailer RFQs and interface control
- [ ] Access Gold engineering master index, Onshape handoff, manufacturing handoff, drawing register, closure register and 34-gate certificate.
- [ ] Independently test all **34 engineering gates** against controlled evidence; record PASS/OPEN/FAIL, owner, evidence and next action.
- [ ] Keep design and fabrication release separate; no implied fabrication authorization.
- [ ] Review six-trailer controlled RFQ master and TR01 pretreatment, TR02 primary thermal, TR03 power/recovery, TR04 secondary thermal, TR05 vacuum distillation, TR06 storage/distribution.
- [ ] Prepare six consistent vendor response templates, drawing/BOM revision register, manufacturing-CAD conversion requirement and deviations log.
- [ ] Verify owner-approved targets: **three quotes per trailer, 18 targeted quotes total**; do not claim 18 received.
- [ ] Inspect six-trailer ICD and controlled P&IDs/drawings/BOMs; verify existing standardized mating connections and flow paths before proposing changes.
- [ ] Record independent interface PASS/OPEN/FAIL for water, electrical, thermal, controls, mechanical, safety, transport and commissioning.
- [ ] Clearly label illustrated ZIP and bird's-eye imagery **conceptual, not fabrication CAD**.
- [ ] Keep 1-MW class and 30 million gallons/year as design/planning references until independently substantiated.
**Blocker:** controlled source materials and actual vendor responses have not been independently reviewed here.

## P4 — Brotherchat dedicated business mailbox
- [x] Record dedicated `brotherchat@trinitycontinuum.com` mailbox creation and inbound Yahoo-to-Brotherchat test as previously reported.
- [ ] Rotate any mailbox password previously exposed in conversation or screenshots.
- [ ] Verify outbound sender, reply path, SPF/DKIM/DMARC and Spam/Trash behavior.
- [ ] Confirm owner-approved routing, retention and role; do not use Brotherchat as customer intake destination.
- [ ] Do not publish credentials or forward customer records without authorization.

## P5 — Trucker-owned relocatable Water + Power + Thermal concept
- [x] Preserve as a **separate exploratory opportunity**, not the six-trailer Gold flagship or an approved commercial product.
- [x] Add optional interest fields to category C: region, intended use, ownership/operating interest.
- [ ] Draft owner-facing concept brief describing potential owner-operator roles, deployment scenarios, responsibilities and open engineering questions.
- [ ] Compare feasible equipment size/weight, road legality, water sourcing/discharge, grid connection, thermal uses, service/maintenance, insurance, permits and operational staffing.
- [ ] Build optional business-model scenarios (ownership, lease, revenue-sharing) clearly marked hypothetical, with no invented pricing or return guarantees.
- [ ] Define decision gates for Jack: technical feasibility, regulatory review, economics, customer validation and pilot criteria.
- [ ] Obtain Jack's approval before public product claims, financing offers, or outreach.
**No approved commercial offer or guaranteed performance exists in this checklist.**

## Common release and communications controls
- [ ] Establish a single controlled revision register across website, qualifications, factory, Gold, RFQs and concept materials.
- [ ] Preserve original documents and deployed website before updates; maintain rollback path.
- [ ] Keep confidential engineering sources behind approved NDA/data-room permissions.
- [ ] Track every outbound solicitation by sender, recipient, issue revision, date, response and follow-up.
- [ ] Verify that any requested actual external sends were authorized and delivered; drafts do not count.
- [ ] Deliver Jack an evidence-based summary of what changed, what was tested, what was sent, and what still needs his approval.

## Change log
- **Verified green intake CI:** commit 89b555a, GitHub Actions run 42293984225 SUCCESS; server, worker, browser-script syntax and npm tests passed. This is not a live end-to-end gate.
- **Latest CI regression:** run 42293724388 failed on JavaScript syntax in new fail-closed configuration. Corrected in commit 2cc74d9; no passing outcome claimed yet.\n- **Current backend hardening:** fail-closed missing/weak configuration, DB readiness endpoint, three startup regression tests. New test run pending; live gate count remains 0/12.
- **2026-11-06 baseline:** Prior website investigation, draft intake form, backend foundation, mail outbox and guarded activation documented in PR #27. No production release or verified end-to-end mail delivery.
- **Current pass:** Consolidated all known Jack requests, including trucker ownership, into this tracked checklist. No external bids, messages, or deployments were sent by creating this file.\n- **Current CI inspection:** Intake foundation checks PASS on commit 596c995 (run 42293215996); website browser smoke tests PASS (run 42293215914). No live gateway acceptance gate is passed by these checks.

## Controlled source references (not verified as accessed)
- Factory Gold Volume 24: https://drive.google.com/file/d/1gUWemjXJycjjthQOElc9rc26hJyax8JF/view
- Factory build sequence: https://docs.google.com/document/d/1T36tnTm_FbkJoYa5-zAxJOcSi-Wb1kpl/edit
- Gold engineering overview: https://docs.google.com/document/d/1oZ8rgfEKyPsDqlixoV3zu_BuMOwpuCUEHXmAWXptVLI/edit
- 34-gate worksheet: https://docs.google.com/document/d/1rhuEP_vKbc5_JlG5maK-qyoDYhoILdHA8KOYM_UbvM0/edit
- Six-trailer RFQ master: https://docs.google.com/document/d/1lFwZKHa9T_BvRIlSkLN8a4D1DtHniiqA_cNOeHGKQZ8/edit
- Six-trailer ICD: https://docs.google.com/spreadsheets/d/1cIvmFmY3JbX_W3cn7Za-YR4JDbC_10X74UWCjIe_oX0/edit
