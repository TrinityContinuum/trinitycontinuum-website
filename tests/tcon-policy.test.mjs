import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleMinutes,mayQueue,normalizedEmail,campaignCode,validateBatch,DAILY_CEILING,HOURLY_CEILING} from '../assets/tcon-policy.mjs';
test('general inquiries schedule quickly',()=>assert.equal(scheduleMinutes('General evaluation',2),20));
test('length increases delay within cap',()=>assert.equal(scheduleMinutes('Other',100),55));
test('technical and commercial categories require review',()=>{
 for(const category of ['Costs / commercial terms','Engineering specifications / validation','Procurement / availability','Site suitability / permitting'])assert.equal(scheduleMinutes(category,120),null);
});
test('ineligible and already contacted leads cannot queue',()=>{
 const campaign={enabled:true,approved_at:'2026-11-07',daily_limit:20,hourly_limit:5};
 assert.equal(mayQueue({eligibility_confirmed:true,status:'eligible'},campaign),true);
 assert.equal(mayQueue({eligibility_confirmed:true,status:'contacted'},campaign),false);
 assert.equal(mayQueue({eligibility_confirmed:false,status:'eligible'},campaign),false);
 assert.equal(mayQueue({eligibility_confirmed:true,status:'eligible'},campaign,true),false);
 assert.equal(mayQueue({eligibility_confirmed:true,status:'eligible'},{...campaign,enabled:false}),false);
});
test('normalize addresses and validate codes',()=>{
 assert.equal(normalizedEmail('  Sales@Example.COM '),'sales@example.com');
 assert.equal(campaignCode('mining-2026'),'mining-2026');
 assert.equal(campaignCode('../unsafe'),null);
});
test('import batch bounds and hard ceilings',()=>{
 assert.equal(validateBatch([]),false);
 assert.equal(validateBatch(Array(100).fill({})),true);
 assert.equal(validateBatch(Array(101).fill({})),false);
 assert.equal(DAILY_CEILING,300);assert.equal(HOURLY_CEILING,100);
});
