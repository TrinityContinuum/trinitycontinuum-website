# Factory bid release preflight | Operator instructions
**Internal only. No external solicitation.** This describes how to use `scripts/check-factory-bid-release.cjs` after Jack supplies the signed source and approval records.

## Assemble one common issue directory
Put every approved A–M exhibit inside one private directory. Preserve the original file names and approved revisions. Generate SHA-256 hashes from the actual file bytes; never copy placeholder hashes from another package. Create `manifest.json` alongside the files. The script validates paths relative to that directory and reads files locally without uploading them.

Example manifest **shape only** (all values below are placeholders, not approvals):
```json
{
  "issueId": "REPLACE_WITH_OWNER_APPROVED_ID",
  "revision": "REPLACE",
  "approvedFactoryDesignId": "REPLACE_WITH_CONTROLLING_DRAWING_INDEX",
  "ownerApprovalDate": "REPLACE_WITH_SIGNED_APPROVAL_DATE",
  "ownerApprover": "REPLACE_WITH_SIGNATORY",
  "deadline": "REPLACE_WITH_DATE_TIME_AND_ZONE",
  "bidManager": "REPLACE_WITH_APPROVED_CONTACT",
  "ownerReleaseAuthorized": false,
  "gates": [
    {"id":"G01","status":"open","evidence":""},
    {"id":"G02","status":"open","evidence":""},
    {"id":"G03","status":"open","evidence":""},
    {"id":"G04","status":"open","evidence":""},
    {"id":"G05","status":"open","evidence":""},
    {"id":"G06","status":"open","evidence":""},
    {"id":"G07","status":"open","evidence":""}
  ],
  "recipients": [],
  "exhibits": []
}
```

For each of **exactly three** approved recipients, add an object with `name`, `email`, `ndaApproved: true` and `ownerApproved: true` only after verifying the NDA and signed authorization. For each of **exactly thirteen** exhibits A–M, add `id`, `file` (relative file path), `revision`, `sourceOwner`, `confidentiality` and `sha256` (64-character SHA-256 hex of actual bytes). Keep any external shared URL out of this internal manifest until approved.

## Run locally
```sh
node scripts/check-factory-bid-release.cjs /private/bid-issue/manifest.json
node --test tests/factory-bid-release.test.cjs
```

Expected with the above placeholder manifest: **HOLD**, nonzero exit. Only authenticated approvals and complete source files can produce a PASS. A PASS checks manifest structure and file integrity; it does **not** certify engineering correctness, verify the signatory's identity, or authorize distribution.

## Human verification still required
- Confirm the source document revisions and signatories against the actual approved records, not just manifest strings.
- Have the qualified engineers reconcile factory area/bays, electrical demand, equipment, kitchen, laboratory, test stands and EHS.
- Confirm the identical exact file set and revision/hash manifest for each of the three GC recipients.
- Confirm Jack's written release approval and confidentiality permissions before emailing anything.
- Keep the six-trailer product RFQs in a separate approved issue set and separate procurement log.

**Status today: HOLD.** This procedure does not modify or publish the live website.
