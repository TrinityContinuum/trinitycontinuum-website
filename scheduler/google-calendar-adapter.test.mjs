import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMeeting} from './google-calendar-adapter.mjs';
const env={GOOGLE_CALENDAR_ACCESS_TOKEN:'test-token',GOOGLE_CALENDAR_ID:'calendar@example.test'};
const eventId='tc123456789';
async function withMockFetch(mock,fn){
 const original=globalThis.fetch;
 globalThis.fetch=mock;
 try{return await fn()}finally{globalThis.fetch=original}
}
const response=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('inspection refuses malformed IDs without network access',async()=>{
 let calls=0;
 await withMockFetch(async()=>{calls++;throw Error('unexpected')},async()=>{
  await assert.rejects(inspectMeeting(env,'../other'),/invalid_google_event_id/);
 });
 assert.equal(calls,0);
});
test('inspection reports present event and never writes',async()=>{
 let method,url;
 await withMockFetch(async(u,opts)=>{url=u;method=opts.method||'GET';return response({id:eventId,status:'confirmed',start:{dateTime:'2026-11-20T15:00:00Z'},end:{dateTime:'2026-11-20T15:30:00Z'}})},async()=>{
  const result=await inspectMeeting(env,eventId);
  assert.equal(result.state,'present');
  assert.equal(result.notification_verified,false);
 });
 assert.equal(method,'GET');
 assert.match(url,/calendar%40example.test\/events\/tc123456789$/);
});
test('inspection recognizes cancelled calendar event',async()=>{
 await withMockFetch(async()=>response({id:eventId,status:'cancelled'}),async()=>{
  assert.equal((await inspectMeeting(env,eventId)).state,'cancelled');
 });
});
for(const status of [404,410]){
 test('inspection records observed absence for '+status,async()=>{
  await withMockFetch(async()=>response({error:'missing'},status),async()=>{
   const r=await inspectMeeting(env,eventId);
   assert.equal(r.state,'absent');
   assert.equal(r.notification_verified,false);
  });
 });
}
test('inspection rejects mismatched calendar event identity',async()=>{
 await withMockFetch(async()=>response({id:'tcother',status:'confirmed'}),async()=>{
  await assert.rejects(inspectMeeting(env,eventId),/calendar_event_identity_mismatch/);
 });
});
test('inspection does not treat authorization failure as absence',async()=>{
 await withMockFetch(async()=>response({error:'denied'},403),async()=>{
  await assert.rejects(inspectMeeting(env,eventId),/calendar_http_403/);
 });
});
test('inspection refuses unconfigured calendar',async()=>{
 await assert.rejects(inspectMeeting({},eventId),/calendar_not_configured/);
});
