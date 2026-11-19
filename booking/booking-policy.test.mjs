import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_POLICY,classifySlot} from './initial-policy.js';
const policy={...INITIAL_POLICY,automatic_enabled:true};
const now=Date.parse('2026-11-19T00:00:00Z');
function check(start,duration=30,p=policy){const a=new Date(start);return classifySlot(a.toISOString(),new Date(a.getTime()+duration*60000).toISOString(),p,now)}
test('weekday 30-minute slots book automatically',()=>{
 assert.equal(check('2026-11-23T19:30:00Z'),'automatic_candidate');
 assert.equal(check('2026-11-23T21:30:00Z'),'automatic_candidate');
});
test('weekday one-hour slots require full hour inside approved window',()=>{
 assert.equal(check('2026-11-23T21:00:00Z',60),'automatic_candidate');
 assert.equal(check('2026-11-23T21:30:00Z',60),'manual_approval');
});
test('outside hours and weekends need approval',()=>{
 assert.equal(check('2026-11-23T18:30:00Z'),'manual_approval');
 assert.equal(check('2026-11-21T20:00:00Z'),'manual_approval');
});
test('DST changes preserve Central local times',()=>{
 assert.equal(check('2027-03-15T18:30:00Z'),'manual_approval'); // beyond 60-day horizon
 const springNow=Date.parse('2027-03-14T00:00:00Z');
 const start='2027-03-15T18:30:00Z';
 assert.equal(classifySlot(start,'2027-03-15T19:00:00Z',policy,springNow),'automatic_candidate');
});
test('disabled automatic booking always routes to approval',()=>{
 assert.equal(check('2026-11-23T19:30:00Z',30,INITIAL_POLICY),'manual_approval');
});
test('invalid meeting length is rejected',()=>{
 assert.equal(check('2026-11-23T19:30:00Z',45),'invalid');
});
test('blackout dates require approval',()=>{
 assert.equal(check('2026-11-23T19:30:00Z',30,{...policy,blackouts:['2026-11-23']}),'manual_approval');
});
