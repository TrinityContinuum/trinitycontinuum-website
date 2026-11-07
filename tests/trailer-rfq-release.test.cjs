'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {validate}=require('../scripts/check-trailer-rfq-release.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'trinity-trailers-'));
 const bytes=Buffer.from('approved test fixture');fs.writeFileSync(path.join(root,'source.txt'),bytes);
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const manifest={issueId:'RFQ-TEST',revision:'A',bidManager:'Test Manager',deadline:'Test deadline',ownerReleaseAuthorized:true,ownerApprover:'Test Owner',ownerApprovalDate:'Test date',
 trailers:['TR01','TR02','TR03','TR04','TR05','TR06'].map(id=>({id,engineeringGatesApproved:true,engineeringApprovalEvidence:'Test evidence',recipients:[1,2,3].map(i=>({name:id+' Vendor '+i,email:id.toLowerCase()+'vendor'+i+'@example.com',ndaApproved:true,ownerApproved:true})),documents:['drawingRegister','bom','pAndId','icd','acceptanceCriteria'].map(type=>({type,file:'source.txt',revision:'A',sourceOwner:'Test engineer',sha256}))}))};
 return {root,manifest};
}
test('six complete mock trailer sets pass structural checks',t=>{const {root,manifest}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));assert.deepEqual(validate(manifest,root),[]);});
test('unapproved owner and engineering gates block issue',t=>{const {root,manifest}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));manifest.ownerReleaseAuthorized=false;manifest.trailers[3].engineeringGatesApproved=false;assert.match(validate(manifest,root).join(';'),/owner release/);assert.match(validate(manifest,root).join(';'),/TR04/);});
test('missing vendor NDA and duplicate vendors block issue',t=>{const {root,manifest}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));manifest.trailers[0].recipients[0].ndaApproved=false;manifest.trailers[0].recipients[2].email=manifest.trailers[0].recipients[1].email;assert.match(validate(manifest,root).join(';'),/NDA/);assert.match(validate(manifest,root).join(';'),/duplicate/);});
test('tampered document blocks issue',t=>{const {root,manifest}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'source.txt'),'tampered');assert.match(validate(manifest,root).join(';'),/checksum mismatch/);});
test('missing ICD blocks issue',t=>{const {root,manifest}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));manifest.trailers[2].documents.splice(3,1);assert.match(validate(manifest,root).join(';'),/TR03.*approved drawing register/);});
