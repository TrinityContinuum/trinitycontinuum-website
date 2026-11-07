#!/usr/bin/env node
// Offline six-trailer vendor RFQ release preflight; never transmits files.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const TRAILERS = ['TR01','TR02','TR03','TR04','TR05','TR06'];
const DOCUMENT_TYPES = ['drawingRegister','bom','pAndId','icd','acceptanceCriteria'];
function validate(manifest, root) {
 const errors=[];
 if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['Manifest must be an object'];
 if (manifest.ownerReleaseAuthorized !== true || !manifest.ownerApprover || !manifest.ownerApprovalDate) errors.push('Signed owner release approval required');
 if (!manifest.issueId || !manifest.revision || !manifest.bidManager || !manifest.deadline) errors.push('Issue ID, revision, bid manager and deadline required');
 if (!Array.isArray(manifest.trailers) || manifest.trailers.length!==6 || TRAILERS.some((id,i)=>manifest.trailers[i]?.id!==id)) return [...errors,'Six ordered trailer packages TR01-TR06 required'];
 const allRecipients=new Set();
 for (const trailer of manifest.trailers) {
  const prefix=trailer.id;
  if (trailer.engineeringGatesApproved !== true || !trailer.engineeringApprovalEvidence) errors.push(prefix+': engineering release evidence missing');
  if (!Array.isArray(trailer.recipients) || trailer.recipients.length!==3) errors.push(prefix+': exactly three vendors required');
  else {
   const within=new Set();
   for (const recipient of trailer.recipients) {
    const email=recipient?.email?.trim().toLowerCase();
    if (!recipient?.name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !recipient.ndaApproved || !recipient.ownerApproved) errors.push(prefix+': vendor identity/NDA/approval incomplete');
    if (within.has(email)) errors.push(prefix+': duplicate vendor recipient');
    within.add(email);allRecipients.add(email);
   }
  }
  if (!Array.isArray(trailer.documents) || trailer.documents.length!==DOCUMENT_TYPES.length || DOCUMENT_TYPES.some((type,i)=>trailer.documents[i]?.type!==type)) {errors.push(prefix+': approved drawing register, BOM, P&ID, ICD and acceptance criteria required');continue;}
  for (const doc of trailer.documents) {
   if (!doc.file || !doc.revision || !doc.sourceOwner || !/^[a-f0-9]{64}$/i.test(doc.sha256||'')) {errors.push(prefix+': incomplete '+doc.type+' document metadata');continue;}
   const resolved=path.resolve(root,doc.file);
   if (!resolved.startsWith(path.resolve(root)+path.sep)) {errors.push(prefix+': document path escapes package root');continue;}
   if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {errors.push(prefix+': missing '+doc.type+' file');continue;}
   const actual=crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
   if (actual.toLowerCase()!==doc.sha256.toLowerCase()) errors.push(prefix+': checksum mismatch for '+doc.type);
  }
 }
 return errors;
}
if (require.main===module) {
 const filename=process.argv[2];
 if (!filename) {console.error('Usage: node scripts/check-trailer-rfq-release.cjs <manifest.json>');process.exit(2);}
 try {
  const errors=validate(JSON.parse(fs.readFileSync(filename,'utf8')),path.dirname(path.resolve(filename)));
  if (errors.length) {console.error('HOLD: '+errors.join('; '));process.exit(1);}
  console.log('Preflight PASS: six trailer manifests, file hashes and approval fields present. NOT permission to send.');
 } catch(e) {console.error('HOLD: '+e.message);process.exit(1);}
}
module.exports={validate};
