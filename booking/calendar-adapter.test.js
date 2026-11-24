import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarAdapter} from './calendar-adapter.js';
import {INITIAL_POLICY,classifySlot} from './initial-policy.js';

const start='2026-12-01T22:00:00.000Z',end='2026-12-01T22:30:00.000Z';
const now=Date.parse('2026-11-30T12:00:00Z');
const bookingId='12345678-abcd-4321-aaaa-0123456789ab';
const eventId=bookingId.replaceAll('-','');
const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
const adapter=(transport)=>calendarAdapter({getAccessToken:async()=> 'mock-only-not-a-real-token',transport});
const event=(extra={})=>({id:eventId,extendedProperties:{private:{trinityBookingId:bookingId}},...extra});

test('4 PM Central start accepted and 4:30 PM start rejected',()=>{
 const p={...INITIAL_POLICY,automatic_enabled:true};
 assert.equal(classifySlot(start,end,p,now),'automatic_candidate');
 assert.equal(classifySlot(end,'2026-12-01T23:00:00.000Z',p,now),'manual_approval');
});
test('automatic acceptance is off by default',()=>{
 assert.equal(classifySlot(start,end,INITIAL_POLICY,now),'manual_approval');
});
test('free and busy calendar states',async()=>{
 for(const busy of [[],[{start,end}]]){
  const c=adapter(async(url,options)=>{
   assert.ok(url.endsWith('/freeBusy'));
   assert.equal(options.method,'POST');
   assert.deepEqual(JSON.parse(options.body).items,[{id:'primary'}]);
   return response(200,{calendars:{primary:{busy}}});
  });
  assert.equal(await c.isFree(start,end),busy.length===0);
 }
});
test('provider failure is not treated as availability',async()=>{
 await assert.rejects(adapter(async()=>response(401,{})).isFree(start,end));
 await assert.rejects(adapter(async()=>response(200,{calendars:{primary:{errors:[{}]}}})).isFree(start,end));
});
test('pending conference is not ready, valid Meet URL is ready',async()=>{
 const c=adapter(async(url,options)=>{
  assert.ok(url.includes('conferenceDataVersion=1'));
  const b=JSON.parse(options.body);
  assert.equal(b.id,eventId);
  assert.equal(b.guestsCanSeeOtherGuests,false);
  return response(200,event());
 });
 assert.equal((await c.createMeeting({bookingId,start,end,email:'test@example.invalid'})).ready,false);
 const d=adapter(async()=>response(200,event({hangoutLink:'https://meet.google.com/abc-defg-hij'})));
 assert.equal((await d.getMeeting(bookingId)).ready,true);
});
test('unrelated event and deceptive conference URL rejected',async()=>{
 await assert.rejects(adapter(async()=>response(200,{id:eventId})).getMeeting(bookingId));
 const c=adapter(async()=>response(200,event({hangoutLink:'https://meet.google.com.example.invalid/abc-defg-hij'})));
 assert.equal((await c.getMeeting(bookingId)).ready,false);
});
test('duplicate insert reconciles by deterministic event ID',async()=>{
 let calls=0;
 const c=adapter(async()=>++calls===1?response(409,{}):response(200,event({hangoutLink:'https://meet.google.com/abc-defg-hij'})));
 assert.equal((await c.createMeeting({bookingId,start,end,email:'test@example.invalid'})).ready,true);
 assert.equal(calls,2);
});
