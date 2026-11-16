import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingAdminApi} from './booking-admin-api.mjs';

const id='11111111-1111-4111-8111-111111111111';
const url='https://admin.example.test/api/scheduler/bookings/'+id+'/cancel';
const request=(payload)=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
const booking=(status='reserved',event=null)=>({id,status,google_event_id:event,start_utc:'2026-11-20T15:00:00Z',end_utc:'2026-11-20T15:30:00Z'});
function dbFor(found,opts={}){
 const calls=[];
 return {calls,prepare(sql){
  const q={bind(...params){calls.push({sql,params});return this;},
   async first(){if(sql.includes('FROM scheduler_bookings'))return found;if(sql.includes('FROM scheduler_open_slots'))return null;return null;},
   async run(){if(opts.failClaim&&sql.startsWith('INSERT INTO scheduler_cancellations'))throw Error('duplicate');return {success:true}},
   async all(){return {results:[]}}};
  return q;
 },async batch(){return [{meta:{changes:1}}]}};
}
test('booking admin rejects missing trusted actor',async()=>{
 const r=await bookingAdminApi(request({reopen_slot:false}),{DB:dbFor(booking())},'');
 assert.equal(r.status,403);
});
test('booking admin rejects absent database',async()=>{
 const r=await bookingAdminApi(request({reopen_slot:false}),{},'jack');
 assert.equal(r.status,503);
});
test('booking admin rejects malformed cancellation payload',async()=>{
 const r=await bookingAdminApi(request({reopen_slot:'yes'}),{DB:dbFor(booking())},'jack');
 assert.equal(r.status,400);
});
test('booking admin reports cancelled booking idempotently without Google call',async()=>{
 const db=dbFor(booking('cancelled','tcvalidid'));
 const r=await bookingAdminApi(request({reopen_slot:false}),{DB:db},'jack');
 assert.equal(r.status,200);
 assert.equal((await r.json()).already_cancelled,true);
 assert.equal(db.calls.some(x=>x.sql.includes('INSERT INTO scheduler_cancellations')),false);
});
test('booking admin rejects completed booking',async()=>{
 const r=await bookingAdminApi(request({reopen_slot:false}),{DB:dbFor(booking('completed'))},'jack');
 assert.equal(r.status,409);
});
test('booking admin rejects missing calendar event ID',async()=>{
 const r=await bookingAdminApi(request({reopen_slot:false}),{DB:dbFor(booking('calendar_created'))},'jack');
 assert.equal(r.status,409);
});
test('duplicate cancellation claim returns 409',async()=>{
 const db=dbFor(booking(),{failClaim:true});
 const r=await bookingAdminApi(request({reopen_slot:false}),{DB:db},'jack');
 assert.equal(r.status,409);
});
test('unknown booking returns 404',async()=>{
 const r=await bookingAdminApi(request({reopen_slot:false}),{DB:dbFor(null)},'jack');
 assert.equal(r.status,404);
});
test('booking list requires trusted actor',async()=>{
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/bookings'),{DB:dbFor(null)},'');
 assert.equal(r.status,403);
});

test('reconciliation queue requires trusted actor',async()=>{
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation'),{DB:dbFor(null)},'');
 assert.equal(r.status,403);
});
test('reconciliation queue is read-only and does not touch Google',async()=>{
 const db=dbFor(null);
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation'),{DB:db},'jack');
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.read_only,true);
 assert.equal(data.calendar_state_verified,false);
 assert.deepEqual(data.reconciliation_required,[]);
 assert.equal(db.calls.some(x=>/INSERT|UPDATE|DELETE/.test(x.sql)),false);
});

test('calendar inspection requires trusted administrator',async()=>{
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation/'+id+'/inspect'),{DB:dbFor(null)},'');
 assert.equal(r.status,403);
});
test('calendar inspection reports missing ledger record without external calls',async()=>{
 const db=dbFor(null);
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation/'+id+'/inspect'),{DB:db},'jack');
 assert.equal(r.status,404);
});
test('calendar inspection does not mutate missing-calendar-ID record',async()=>{
 const db=dbFor(null);
 db.prepare=(sql)=>({bind(){return this},async first(){return {booking_id:id,state:'needs_reconciliation',booking_status:'reserved',google_event_id:null}}});
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation/'+id+'/inspect'),{DB:db},'jack');
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.calendar.state,'no_event_id');
 assert.equal(data.read_only,true);
});


test('reconciliation queue shows unresolved states oldest-first and excludes completed',async()=>{
 const rows=[
  {booking_id:'a',state:'processing',expected_status:'reserved',reopen_requested:0,notification_state:'not_verified',updated_at:'2026-11-16T01:00:00Z',booking_status:'reserved',google_event_id:'tcfirst'},
  {booking_id:'b',state:'calendar_removed',expected_status:'calendar_created',reopen_requested:1,notification_state:'requested',updated_at:'2026-11-16T02:00:00Z',booking_status:'calendar_created',google_event_id:'tcsecond'},
  {booking_id:'c',state:'needs_reconciliation',expected_status:'reserved',reopen_requested:0,notification_state:'not_verified',updated_at:'2026-11-16T03:00:00Z',booking_status:'reserved',google_event_id:'tcthird'}
 ];
 const calls=[];
 const db={prepare(sql){
  calls.push(sql);
  return {async all(){
   assert.match(sql,/WHERE c.state IN/);
   assert.match(sql,/ORDER BY c.updated_at ASC/);
   assert.match(sql,/LIMIT 150/);
   return {results:rows};
  }};
 }};
 const original=globalThis.fetch;
 let networkCalls=0;
 globalThis.fetch=async()=>{networkCalls++;throw Error('unexpected external call')};
 try{
  const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation'),{DB:db},'verified-admin');
  assert.equal(r.status,200);
  const data=await r.json();
  assert.deepEqual(data.reconciliation_required,rows);
  assert.equal(data.read_only,true);
  assert.equal(data.calendar_state_verified,false);
  assert.equal(networkCalls,0);
  assert.equal(calls.length,1);
  assert.doesNotMatch(calls[0],/^(INSERT|UPDATE|DELETE)/i);
 }finally{globalThis.fetch=original}
});
test('reconciliation queue database failure returns 503 without modifying records',async()=>{
 const db={prepare(){return {async all(){throw Error('sqlite failure')}}}};
 const r=await bookingAdminApi(new Request('https://admin.example.test/api/scheduler/cancellation-reconciliation'),{DB:db},'verified-admin');
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/unavailable/);
});
