import {cancelMeeting} from './google-calendar-adapter.mjs';
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
// The caller must authenticate the actor, verify Origin, and pass a trusted identity.
export async function bookingAdminApi(req,env,actor){
 const path=new URL(req.url).pathname;
 if(!actor)return json({error:'Administrator identity required'},403);
 if(!env.DB)return json({error:'Database unavailable'},503);
 if(path==='/api/scheduler/bookings'&&req.method==='GET'){
  try{const data=await env.DB.prepare("SELECT id,requester_name,requester_email,organization,topic,start_utc,end_utc,status,google_meet_url FROM scheduler_bookings ORDER BY start_utc DESC LIMIT 150").all();return json({bookings:data.results||[]})}
  catch{return json({error:'Bookings unavailable'},503)}
 }
 const match=/^\/api\/scheduler\/bookings\/([0-9a-f-]{36})\/cancel$/.exec(path);
 if(!match||req.method!=='POST')return json({error:'Not found'},404);
 let x;try{x=await req.json()}catch{return json({error:'Invalid JSON'},400)}
 if(typeof x?.reopen_slot!=='boolean')return json({error:'Specify reopen_slot'},400);
 const id=match[1];
 let b;
 try{b=await env.DB.prepare('SELECT id,status,google_event_id,start_utc,end_utc FROM scheduler_bookings WHERE id=?').bind(id).first()}
 catch{return json({error:'Booking lookup unavailable'},503)}
 if(!b)return json({error:'Booking not found'},404);
 if(b.status==='cancelled')return json({ok:true,status:'cancelled',already_cancelled:true});
 if(b.status==='completed')return json({error:'Completed meeting'},409);
 if(['calendar_created','confirmation_sent'].includes(b.status)&&!b.google_event_id)return json({error:'Missing calendar ID; reconciliation required'},409);
 // Unique ledger row acts as a durable exclusive cancellation claim.
 // Competing cancellation requests cannot both own the operation.
 try{
  await env.DB.prepare("INSERT INTO scheduler_cancellations(booking_id,state,actor,reopen_requested) VALUES(?,'processing',?,?)").bind(id,actor,Number(x.reopen_slot)).run();
 }catch{
  return json({error:'Cancellation already underway; check reconciliation state before retrying'},409);
 }
 if(b.google_event_id){
  try{
   await cancelMeeting(env,b.google_event_id);
   await env.DB.prepare("UPDATE scheduler_cancellations SET state='calendar_removed',notification_state='requested',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE booking_id=?").bind(id).run();
  }catch{
   await env.DB.prepare("UPDATE scheduler_cancellations SET state='needs_reconciliation',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE booking_id=?").bind(id).run().catch(()=>{});
   return json({error:'Calendar cancellation not verified; manual reconciliation required'},503);
  }
 }
 try{
  // Do not free occupancy merely because a cancelled booking used to exist.
  // Jack must still have an enabled window covering the entire appointment.
  const window=x.reopen_slot?await env.DB.prepare('SELECT id FROM scheduler_open_slots WHERE enabled=1 AND start_utc<=? AND end_utc>=? LIMIT 1').bind(b.start_utc,b.end_utc).first():null;
  const release=Boolean(window);
  const ops=[
   env.DB.prepare("UPDATE scheduler_bookings SET status='cancelled',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status=?").bind(id,b.status),
   env.DB.prepare("UPDATE scheduler_cancellations SET state='completed',notification_state=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE booking_id=?").bind(b.google_event_id?'requested':'not_applicable',id),
   env.DB.prepare("INSERT INTO scheduler_audit(entity_type,entity_id,action,actor,detail_json) VALUES('scheduler_booking',?,'cancel',?,?)").bind(id,actor,JSON.stringify({previous_status:b.status,reopen_requested:x.reopen_slot,slot_released:release,notification_verified:false}))
  ];
  if(release)ops.push(env.DB.prepare('DELETE FROM scheduler_slot_claims WHERE booking_id=?').bind(id));
  const result=await env.DB.batch(ops);
  if(result[0]?.meta?.changes!==1)throw Error('concurrent_booking_change');
  return json({ok:true,status:'cancelled',slot_reopened:release,notification_status:b.google_event_id?'requested_not_verified':'not_applicable'});
 }catch{
  await env.DB.prepare("UPDATE scheduler_cancellations SET state='needs_reconciliation' WHERE booking_id=?").bind(id).run().catch(()=>{});
  return json({error:'Calendar may be cancelled but database reconciliation is required'},503);
 }
}
