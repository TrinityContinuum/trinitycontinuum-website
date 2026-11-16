import {cancelMeeting} from './google-calendar-adapter.mjs';
const reply=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
// Call only from the private admin worker after authentication and same-origin checks.
export async function bookingAdminApi(req,env){
 const match=/^\/api\/scheduler\/bookings\/([0-9a-f-]{36})\/cancel$/.exec(new URL(req.url).pathname);
 if(!match||req.method!=='POST')return reply({error:'Not found'},404);
 if(!env.DB)return reply({error:'Database unavailable'},503);
 let x;try{x=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
 if(typeof x?.reopen_slot!=='boolean')return reply({error:'Specify reopen_slot'},400);
 const id=match[1];
 try{
  const b=await env.DB.prepare('SELECT id,status,google_event_id FROM scheduler_bookings WHERE id=?').bind(id).first();
  if(!b)return reply({error:'Not found'},404);
  if(b.status==='cancelled')return reply({ok:true,status:'cancelled',already_cancelled:true});
  if(b.status==='completed')return reply({error:'Completed meeting'},409);
  if(b.google_event_id){try{await cancelMeeting(env,b.google_event_id)}catch{return reply({error:'Google Calendar cancellation failed; local booking unchanged'},503)}}
  else if(['calendar_created','confirmation_sent'].includes(b.status))return reply({error:'Missing calendar event ID; reconciliation required'},409);
  const changes=[
   env.DB.prepare("UPDATE scheduler_bookings SET status='cancelled',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status=?").bind(id,b.status),
   env.DB.prepare("INSERT INTO scheduler_audit(entity_type,entity_id,action,actor,detail_json) VALUES('scheduler_booking',?,'cancel','administrator',?)").bind(id,JSON.stringify({reopen_slot:x.reopen_slot,previous_status:b.status}))
  ];
  if(x.reopen_slot)changes.push(env.DB.prepare('DELETE FROM scheduler_slot_claims WHERE booking_id=?').bind(id));
  await env.DB.batch(changes);
  return reply({ok:true,status:'cancelled',slot_reopened:x.reopen_slot,calendar_notification_requested:Boolean(b.google_event_id)});
 }catch{return reply({error:'Could not finalize cancellation; reconciliation required'},503)}
}
