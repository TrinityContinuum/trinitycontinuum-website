// Private admin configuration API; mounted only behind the admin authentication gate.
// Does not by itself activate booking, which remains disabled until calendar and mail integrations pass.
export async function settingsApi(request,env){
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(!env.DB)return json({error:'Database unavailable'},503);
 const sql="SELECT setting_value FROM scheduler_settings WHERE setting_key='booking_mode'";
 if(request.method==='GET'){
  try{const row=await env.DB.prepare(sql).first();return json({mode:row?.setting_value==='automatic'?'automatic':'approval',instant_booking_live:false})}
  catch{return json({error:'Settings unavailable'},503)}
 }
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'JSON required'},415);
 let body;try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
 if(!['automatic','approval'].includes(body?.mode))return json({error:'Invalid booking mode'},400);
 try{
  await env.DB.prepare("INSERT INTO scheduler_settings(setting_key,setting_value,updated_by) VALUES('booking_mode',?,'administrator') ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by='administrator',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(body.mode).run();
  await env.DB.prepare("INSERT INTO scheduler_audit(entity_type,entity_id,action,actor,detail_json) VALUES('scheduler_settings','booking_mode','update','administrator',?)").bind(JSON.stringify({mode:body.mode})).run();
  return json({ok:true,mode:body.mode,instant_booking_live:false});
 }catch{return json({error:'Unable to save setting'},503)}
}
