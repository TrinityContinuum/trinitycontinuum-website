#!/usr/bin/env node
// Fail-closed, offline preflight for the single-factory GC bid issue.
// Usage: node scripts/check-factory-bid-release.cjs <manifest.json>
// Does not send, publish, or modify files.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const REQUIRED = 'ABCDEFGHIJKLM'.split('');
function validate(manifest, root) {
  const failures = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['Manifest must be an object'];
  for (const field of ['issueId', 'revision', 'approvedFactoryDesignId', 'ownerApprovalDate', 'ownerApprover', 'deadline', 'bidManager']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) failures.push('Missing '+field);
  }
  if (!Array.isArray(manifest.gates) || manifest.gates.length !== 7 || manifest.gates.some((g,i) => g?.id !== 'G0'+(i+1) || g?.status !== 'approved' || !g?.evidence)) failures.push('G01-G07 must be approved with evidence in order');
  if (!Array.isArray(manifest.recipients) || manifest.recipients.length !== 3) failures.push('Exactly three approved GC recipients required');
  else {
    const addresses = manifest.recipients.map(x => x?.email?.toLowerCase().trim());
    if (addresses.some(x => !x || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) || new Set(addresses).size !== 3) failures.push('Three unique valid GC emails required');
    if (manifest.recipients.some(x => !x?.name || x.ndaApproved !== true || x.ownerApproved !== true)) failures.push('Each recipient needs name, NDA and owner approval');
  }
  if (!Array.isArray(manifest.exhibits) || manifest.exhibits.length !== 13) failures.push('Exactly thirteen exhibits A-M required');
  else {
    const ids = manifest.exhibits.map(x => x?.id);
    if (REQUIRED.some((id,i) => ids[i] !== id)) failures.push('Exhibits A-M must appear in order');
    for (const exhibit of manifest.exhibits) {
      if (!exhibit?.file || !exhibit?.revision || !exhibit?.sourceOwner || !exhibit?.confidentiality || !/^[a-f0-9]{64}$/i.test(exhibit?.sha256 || '')) {
        failures.push('Incomplete metadata for exhibit '+(exhibit?.id || '?')); continue;
      }
      const resolved = path.resolve(root,exhibit.file);
      if (!resolved.startsWith(path.resolve(root)+path.sep)) { failures.push('Exhibit outside package root: '+exhibit.id); continue; }
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) { failures.push('Missing exhibit file: '+exhibit.id); continue; }
      const actual = crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
      if (actual.toLowerCase() !== exhibit.sha256.toLowerCase()) failures.push('SHA-256 mismatch: '+exhibit.id);
    }
  }
  if (manifest.ownerReleaseAuthorized !== true) failures.push('Owner release authorization not granted');
  return failures;
}
if (require.main === module) {
  const input = process.argv[2];
  if (!input) { console.error('Usage: node scripts/check-factory-bid-release.cjs <manifest.json>'); process.exit(2); }
  try {
    const manifest = JSON.parse(fs.readFileSync(input,'utf8'));
    const failures = validate(manifest,path.dirname(path.resolve(input)));
    if (failures.length) { console.error('HOLD: '+failures.length+' bid-release preflight failure(s)\n'+failures.map(x=>' - '+x).join('\n')); process.exit(1); }
    console.log('Preflight PASS: required files, checksums, metadata, approvals and recipient controls present. This is NOT permission to send.');
  } catch (error) { console.error('HOLD: '+error.message); process.exit(1); }
}
module.exports = { validate };
