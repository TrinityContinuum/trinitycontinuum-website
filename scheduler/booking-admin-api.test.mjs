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
