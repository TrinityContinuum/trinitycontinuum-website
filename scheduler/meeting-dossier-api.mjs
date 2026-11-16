// Private administrator API. Caller authenticates, checks Origin/CSRF and supplies trusted actor.
// No public routes, automatic emails, or calendar writes.
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const uuid=/^[0-9a-f-]{36}$/i;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s)&&!Number.isNaN(Date.parse(s));
export async function meetingDossierApi(request,env,actor){
 if(typeof actor!=='string'||!actor.trim())return json({error:'Trusted administrator required'},403);
 if(!env.DB)return json({error:'Database unavailable'},503);
 const path=new URL(request.url).pathname;
 const match=/^\/api\/scheduler\/bookings\/([0-9a-f-]{36})\/dossier$/.exec(path);
 const taskMatch=/^\/api\/scheduler\/follow-ups\/([0-9a-f-]{36})$/.exec(path);
 if(!match&&!taskMatch)return json({error:'Not found'},404);
 try{
  if(taskMatch&&request.method==='PATCH'){
   const input=await request.json().catch(()=>null);
   if(!input||!['open','in_progress','done','cancelled'].includes(input.status))return json({error:'Invalid task status'},400);
   const current=await env.DB.prepare('SELECT id,booking_id,status FROM scheduler_follow_up_tasks WHERE id=?').bind(taskMatch[1]).first();
   if(!current)return json({error:'Task not found'},404);
   const result=await env.DB.prepare("UPDATE scheduler_follow_up_tasks SET status=?,completed_at=CASE WHEN ?='done' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status=?").bind(input.status,input.status,current.id,current.status).run();
   if(result.meta?.changes!==1)return json({error:'Task changed concurrently; reload'},409);
   await env.DB.prepare("INSERT INTO scheduler_audit(entity_type,entity_id,action,actor,detail_json) VALUES('scheduler_follow_up',?,'status_change',?,?)").bind(current.id,actor,JSON.stringify({from:current.status,to:input.status})).run();
   return json({ok:true,id:current.id,status:input.status});
  }
  if(!match)return json({error:'Not found'},404);
  const id=match[1];
  const booking=await env.DB.prepare('SELECT id,requester_name,requester_email,organization,topic,start_utc,end_utc,status,google_meet_url,linked_request_id FROM scheduler_bookings WHERE id=?').bind(id).first();
  if(!booking)return json({error:'Booking not found'},404);
  if(request.method==='GET'){
   const notes=await env.DB.prepare('SELECT id,phase,body,author,created_at FROM scheduler_meeting_notes WHERE booking_id=? ORDER BY created_at,id').bind(id).all();
   const tasks=await env.DB.prepare('SELECT id,title,details,owner,due_at,status,created_by,created_at,completed_at FROM scheduler_follow_up_tasks WHERE booking_id=? ORDER BY due_at IS NULL,due_at,id').bind(id).all();
   return json({booking,notes:notes.results||[],follow_ups:tasks.results||[]});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const input=await request.json().catch(()=>null);
  if(!input||typeof input!=='object')return json({error:'Invalid JSON'},400);
  if(input.type==='note'){
   if(!['preparation','meeting','follow_up'].includes(input.phase)||typeof input.body!=='string'||!input.body.trim()||input.body.length>12000)return json({error:'Invalid note'},400);
   const noteId=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO scheduler_meeting_notes(id,booking_id,phase,body,author) VALUES(?,?,?,?,?)').bind(noteId,id,input.phase,input.body.trim(),actor).run();
   return json({ok:true,id:noteId},201);
  }
  if(input.type==='task'){
   if(typeof input.title!=='string'||!input.title.trim()||input.title.length>240||typeof input.owner!=='string'||!input.owner.trim()||input.owner.length>120||typeof(input.details??'')!=='string'||(input.details??'').length>4000||(input.due_at!=null&&!validDate(input.due_at)))return json({error:'Invalid follow-up task'},400);
   const taskId=crypto.randomUUID();
   await env.DB.prepare('INSERT INTO scheduler_follow_up_tasks(id,booking_id,title,details,owner,due_at,created_by) VALUES(?,?,?,?,?,?,?)').bind(taskId,id,input.title.trim(),input.details??'',input.owner.trim(),input.due_at??null,actor).run();
   return json({ok:true,id:taskId},201);
  }
  return json({error:'Unknown record type'},400);
 }catch{return json({error:'Meeting dossier unavailable; no external actions attempted'},503)}
}
