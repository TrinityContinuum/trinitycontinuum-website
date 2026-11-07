'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {validate} = require('../scripts/check-factory-bid-release.cjs');
function fixture() {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'trinity-bid-'));
 const data = Buffer.from('test controlled exhibit');
 fs.writeFileSync(path.join(dir,'exhibit.txt'),data);
 const sha256 = crypto.createHash('sha256').update(data).digest('hex');
 const manifest = {
  issueId:'FACTORY-001',revision:'A',approvedFactoryDesignId:'FACTORY-APPROVED-001',
  ownerApprovalDate:'2026-11-06',ownerApprover:'Owner',deadline:'date and time',bidManager:'Bid Manager',
  ownerReleaseAuthorized:true,
  gates:Array.from({length:7},(_,i)=>({id:'G0'+(i+1),status:'approved',evidence:'approval record'})),
  recipients:[1,2,3].map(i=>({name:'GC '+i,email:'gc'+i+'@example.com',ndaApproved:true,ownerApproved:true})),
  exhibits:'ABCDEFGHIJKLM'.split('').map(id=>({id,file:'exhibit.txt',revision:'A',sourceOwner:'Design authority',confidentiality:'NDA',sha256}))
 };
 return {dir,manifest};
}
test('complete mock manifest passes structural preflight',t=>{
 const {dir,manifest}=fixture();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.deepEqual(validate(manifest,dir),[]);
});
test('missing owner authorization, unapproved gate and NDA block issue',t=>{
 const {dir,manifest}=fixture();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 manifest.ownerReleaseAuthorized=false;manifest.gates[2].status='open';manifest.recipients[1].ndaApproved=false;
 const failures=validate(manifest,dir).join(';');
 assert.match(failures,/Owner release/);assert.match(failures,/G01-G07/);assert.match(failures,/NDA/);
});
test('changed exhibit bytes fail checksum verification',t=>{
 const {dir,manifest}=fixture();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'exhibit.txt'),'tampered');
 assert.match(validate(manifest,dir).join(';'),/SHA-256 mismatch/);
});
test('path traversal cannot read outside controlled package',t=>{
 const {dir,manifest}=fixture();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 manifest.exhibits[0].file='../outside.txt';
 assert.match(validate(manifest,dir).join(';'),/outside package root/);
});
test('duplicate GC recipient is rejected',t=>{
 const {dir,manifest}=fixture();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 manifest.recipients[2].email=manifest.recipients[0].email;
 assert.match(validate(manifest,dir).join(';'),/unique valid GC emails/);
});
