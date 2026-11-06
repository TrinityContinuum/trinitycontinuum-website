# Manufacturing website gateways | REV C / Volume 24 REV G | Verification manifest
**2026-11-06.** Owner-review only. Source: Jack's 15:38 email and PR #28 source. **Do not merge, publish, share unrestricted source files or solicit GCs.**

| Record | Exact ID from owner email and current PR | Claimed revision | Draft gateway | Repository-link verification | Source access/content test |
| --- | --- | --- | --- | --- | --- |
| Factory turnkey GC owner-review Word | `1Ph8B7atyZqOx7cLDZwV58COI02FnU9kz` | REV C | `manufacturing.html#factory-master-package` → Drive | MATCHES PR #28 HTML | NOT VERIFIED; no authenticated Drive access |
| Factory turnkey GC owner-review PDF | `1hzJzDUj3mogb320tY5On6ytb84LYo-RX` | REV C | same | MATCHES PR #28 HTML | NOT VERIFIED |
| Volume 24 source-gateway annex | `1-j4Y-jkFv24y4UX7KqCTqztZw_WvlNQR` | REV G | same | MATCHES PR #28 HTML | NOT VERIFIED |
| Gold Master Volume 24 historical | `1gUWemjXJycjjthQOElc9rc26hJyax8JF` | REV B | retained in Drive, not directly linked by draft | Owner email only | NOT VERIFIED |
| Factory document-control release checklist | `1Vd39pytwypUtozn-v_NLGPCYeJXSb-Y9p4a29YTE3wo` | unspecified | not in public gateway | Owner email only | NOT VERIFIED |
| Single factory management directive | `1qSSOzcYVXo6qFKULfyLvnqRtVeI89ZUyovmi6PWPnrg` | unspecified | not in public gateway | Owner email only | NOT VERIFIED |
| Historical Adam master package Word/PDF | `1E70J7UtbKEsJIIoe2tp8-1PRwm0pvlnX` / `1Hbjo__CYtFqUBKQvoyGfn_5g6QGpt_9B` | REV A | not controlling gateway | Local REV A attachments previously reviewed | Historical only |

## Inspection results
- PR #28 is **draft, open and unmerged** at inspection, head `6de493179952ac65dd846656b2ac4d58f6041f5f`, branch `manufacturing-facility-gateways-rev-a-20261106`. PR description is stale (mentions REV A/B), **but actual `manufacturing.html` links correctly identify REV C Word/PDF and REV G annex**. Do not overwrite correct HTML based on stale PR body.
- `documents.html` links to `manufacturing.html#factory-master-package`; the anchor exists in PR HTML. Static route and anchor verified by repository inspection, **not** deployed browser or external Drive access.
- No Google Drive connector or authenticated Drive mount was available in this session. File ID matches **are not proof of access, source contents, revision authority, confidentiality or permission**.
- All source URLs are present in draft public HTML. Even if Drive permissions currently restrict content, publishing would disclose the filenames/revisions and source URLs. Owner must explicitly approve that exposure and independently confirm that anonymous visitors cannot view/download restricted files.

## Outstanding evidence holds
- **FAC-BLDG-003:** Recover MFG-09.74 original factory/site plan, native architecture, signed revisions; reconcile 96k/205k/250k/312k/340k sq ft and 10/12 bays.
- **FAC-EQ-004:** Recover MFG-09.73 original 36-line/66-unit equipment matrix; verify OEM/model/quantity, foundations, footprint, utility loads, six-trailer assembly and historical $7,694,700 allowance.
- **FAC-UTIL-006:** Recover MFG-09.75 original one-line and licensed calculations; reconcile 13.8 kV, 3,000 kVA, 4,000 A, 2,000 kW/2,500 kVA generator versus 4,000 kVA/2,650 kVA reference.
- Kitchen 5,000 sq ft, separate dining/breakroom, lockers/showers, water/QA lab, test stands, receiving, fabrication and FAT must remain in one factory scope. Original room sheets and schedules absent.
- Maintain distinct REV A/B/C and Volume 24 REV B/G lineage. REV G is described as **source-gateway annex**, not independently verified as replacement for the controlling approved factory plan.

## Readiness decision
**PUBLICATION: HOLD.** Draft link labels/IDs internally consistent; external access, confidentiality, source authority and deployed browser checks remain unverified. **GC BID: HOLD.** Original factory design and release gates unresolved. Require Jack's explicit written publication and GC-issue approvals as separate decisions.
