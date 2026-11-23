// Read-only private Coordination Desk queue; no delivery acknowledgement or external writes.
// The trusted admin Worker must authenticate the request and provide an authorized actor.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function coordinationQueueApi(req,env,actor){
 if(typeof actor!=='string'||!actor.trim())return json({error:'Trusted administrator required'},403);
 if(!env.DB)return json({error:'Database unavailable'},503);
 if(new URL(req.url).pathname!=='/api/scheduler/coordination-events'||req.method!=='GET')return json({error:'Not found'},404);
 try{
  const result=await env.DB.prepare("SELECT e.id,e.booking_id,e.event_type,e.source_id,e.actor,e.payload_json,e.state,e.created_at,b.organization,b.requester_name,b.start_utc FROM scheduler_coordination_events e JOIN scheduler_bookings b ON b.id=e.booking_id WHERE e.state IN ('pending','retry') ORDER BY e.created_at ASC LIMIT 100").all();
  return json({events:result.results||[],read_only:true,delivery_configured:false,notification_sent:false});
 }catch{return json({error:'Coordination queue unavailable'},503)}
}
