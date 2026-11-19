// Durable Trinity booking notification dispatcher.
// Expects a separately authenticated corporate email gateway accepting POST JSON
// {to,subject,text,idempotency_key} and returning {message_id} after confirmed send.
// This does not assume Gmail or claim Namecheap access without gateway credentials.
const templates={
 confirmation:b=>({subject:'Trinity Continuum appointment confirmed',text:`Your appointment with Trinity Continuum is confirmed.\nReference: ${b.id}\nStart (UTC): ${b.starts_at}\nEnd (UTC): ${b.ends_at}\nTime zone: America/Chicago (Central)\nDiscussion: ${b.topic}\nA video meeting link will be supplied separately.\nFor questions, contact jack@trinitycontinuum.com.`}),
 cancellation:b=>({subject:'Trinity Continuum appointment cancelled',text:`Your Trinity Continuum appointment has been cancelled.\nReference: ${b.id}\nContact jack@trinitycontinuum.com if you need another appointment.`}),
 video_link:b=>({subject:'Your Trinity Continuum video meeting link',text:`Your Trinity Continuum video appointment details:\nReference: ${b.id}\nStart (UTC): ${b.starts_at}\nJoin video meeting: ${b.meeting_url}\n${b.instructions||''}\nPlease keep this link private. Contact jack@trinitycontinuum.com with questions.`}),
 reschedule:b=>({subject:'Trinity Continuum appointment rescheduled',text:`Your Trinity Continuum appointment has been rescheduled.\nReference: ${b.id}\nNew start (UTC): ${b.starts_at}\nNew end (UTC): ${b.ends_at}\nTime zone: America/Chicago (Central)\nContact jack@trinitycontinuum.com with any questions.`})
};
export async function dispatchNotifications(env,{limit=10}={}){
 if(!env.MAIL_GATEWAY_URL||!env.MAIL_GATEWAY_TOKEN)return {configured:false,processed:0};
 const rows=await env.DB.prepare(`SELECT n.id,n.kind,n.recipient,n.attempts,b.id AS booking_id,b.starts_at,b.ends_at,b.topic,v.meeting_url,v.instructions
 FROM booking_notifications n JOIN automatic_bookings b ON b.id=n.booking_id LEFT JOIN booking_video_links v ON v.booking_id=b.id
 WHERE n.status IN ('pending','failed') AND n.attempts<5 ORDER BY n.created_at LIMIT ?`).bind(Math.min(20,Math.max(1,limit))).all();
 let sent=0,failed=0;
 for(const n of rows.results||[]){
  const template=templates[n.kind];
  if(!template||n.kind==='video_link'&&!n.meeting_url)continue;
  const message=template({id:n.booking_id,starts_at:n.starts_at,ends_at:n.ends_at,topic:n.topic,meeting_url:n.meeting_url,instructions:n.instructions});
  try{
   const response=await fetch(env.MAIL_GATEWAY_URL,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+env.MAIL_GATEWAY_TOKEN,'idempotency-key':n.id},body:JSON.stringify({to:n.recipient,...message,idempotency_key:n.id}),signal:AbortSignal.timeout(15000)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||typeof result.message_id!=='string'||!result.message_id)throw Error('Gateway did not acknowledge delivery');
   await env.DB.prepare("UPDATE booking_notifications SET status='sent',attempts=attempts+1,provider_message_id=? WHERE id=? AND status<>'sent'").bind(result.message_id,n.id).run();
   sent++;
  }catch{
   await env.DB.prepare("UPDATE booking_notifications SET status='failed',attempts=attempts+1 WHERE id=? AND status<>'sent'").bind(n.id).run();
   failed++;
  }
 }
 return {configured:true,processed:sent+failed,sent,failed};
}
