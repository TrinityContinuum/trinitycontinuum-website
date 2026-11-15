
const PAGE=String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trinity — Private Appointment Queue</title>
<style nonce="trinity-approvals-v1">
body{background:#07111e;color:white;font:16px/1.5 system-ui;margin:0}main{max-width:920px;margin:auto;padding:25px}h1{color:#e4c37f}
article{border:1px solid #536d87;border-radius:10px;background:#17283c;margin:18px 0;padding:20px}
button{background:#e4c37f;border:0;border-radius:6px;padding:12px 18px;margin:10px 10px 0 0;font-weight:bold;cursor:pointer}
select{background:#07111e;color:white;padding:10px;width:100%;border:1px solid #536d87}small{color:#c4cdd7}pre{white-space:pre-wrap;background:#07111e;border-radius:8px;padding:12px}
</style>
<main><h1>Trinity — Private Appointment Queue</h1>
<p>Only authorized Trinity personnel can see these submissions. Select a decision and prepare a reply to the visitor. Jack must still send it from corporate email and separately arrange Google Meet.</p>
<p id="message">Loading appointment requests...</p><div id="requests"></div>
</main>
<script nonce="trinity-approvals-v1">
(async()=>{
'use strict';
const host=document.getElementById('requests'),status=document.getElementById('message');
try{
 const response=await fetch('/api/requests',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw Error('Access denied or queue unavailable');
 const data=await response.json();
 status.textContent=(data.requests||[]).length+' appointment request(s) found. Review before confirming.';
 for(const a of data.requests||[]){
  const card=document.createElement('article');const title=document.createElement('h2');
  title.textContent=a.name+' — '+a.created_at;card.append(title);
  const info=document.createElement('p');info.textContent=a.email+' | First: '+a.date1+' '+a.time1+' | Second: '+a.date2+' '+a.time2+' | '+a.timezone;card.append(info);
  const topic=document.createElement('small');topic.textContent=a.topic;card.append(topic);
  const label=document.createElement('label');label.textContent=' Jack’s decision: ';const select=document.createElement('select');
  for(const [value,text] of [['first','Accept first time'],['second','Accept second time'],['alternate','Request alternative times'],['decline','Decline']]){const op=document.createElement('option');op.value=value;op.textContent=text;select.append(op)}
  label.append(select);card.append(label);if(a.recorded_choice){select.value=a.recorded_choice;select.disabled=true;const recorded=document.createElement('p');recorded.textContent='Decision recorded by '+a.decision_by+': '+a.recorded_choice+'. Response status: '+a.response_state+'.';card.append(recorded);}
  const preview=document.createElement('pre');card.append(preview);
  const create=()=>{
   const choice=select.value,dt=choice==='first'?a.date1+' '+a.time1:a.date2+' '+a.time2;
   const subject=choice==='first'||choice==='second'?'Trinity Continuum — Meeting Confirmation':'Trinity Continuum — Meeting Request';
   let body='Hello '+a.name+',\n\n';
   if(choice==='first'||choice==='second')body+='Trinity Continuum confirms your '+(choice==='first'?'first':'second')+' proposed time: '+dt+' ('+a.timezone+').\n\nA private Google Meet invitation will follow.\n\n';
   else if(choice==='alternate')body+='Neither requested time is available. Please reply with two alternatives and your time zone.\n\n';
   else body+='Thank you for your interest. We are unable to accommodate this appointment request at this time.\n\n';
   body+='Sincerely,\nJack Ray Coates\nTrinity Continuum\njack@trinitycontinuum.com';
   preview.textContent='To: '+a.email+'\nSubject: '+subject+'\n\n'+body;
   return {email:a.email,subject,body};
  };
  select.addEventListener('change',create);create();
  const copy=document.createElement('button');copy.textContent='Copy reply text';copy.onclick=async()=>{const d=create();try{await navigator.clipboard.writeText(d.body);copy.textContent='Copied — paste into Namecheap Reply';}catch{copy.textContent='Copy failed; select text above';}};
  card.append(copy);
  const record=document.createElement('button');record.textContent=a.recorded_choice?'Decision already recorded':'Record Jack’s decision (no email sent)';record.disabled=Boolean(a.recorded_choice);
  record.onclick=async()=>{
    if(!confirm('Record this decision internally? This does NOT send an email or book a meeting.'))return;
    record.disabled=true;
    try{
      const response=await fetch('/api/decisions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:a.id,choice:select.value})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Could not save');
      record.textContent='Decision recorded — response not sent';
      select.disabled=true;
    }catch(e){record.disabled=false;record.textContent='Record decision (retry)';alert(e.message)}
  };
  card.append(record);host.append(card);
 }
}catch(e){status.textContent='Could not load appointment records. Confirm the private Cloudflare Access login and database binding.'}
})();
</script></html>`;
// STAGING ONLY: separate admin Worker must be protected by Cloudflare Access.
// Hard deny when Access is missing or identity is not explicitly allowlisted.
const answer=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export default {async fetch(req,env,ctx){
 if(!ctx.access)return answer({error:"Authentication required"},403);
 let identity;try{identity=await ctx.access.getIdentity()}catch{return answer({error:"Identity unavailable"},403)}
 const allowed=(env.APPROVER_EMAILS||"").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
 if(!identity?.email||!allowed.includes(identity.email.toLowerCase()))return answer({error:"Not authorized"},403);
 if(!env.DB)return answer({error:"Missing database binding"},503);
 if(req.method==="GET"&&new URL(req.url).pathname==="/"){
  return new Response(PAGE,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; script-src 'nonce-trinity-approvals-v1'; style-src 'nonce-trinity-approvals-v1'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"}});
 }
 if(req.method==="POST"&&new URL(req.url).pathname==="/api/decisions"){
   if(!/^application\/json/.test(req.headers.get("content-type")||""))return answer({error:"Expected JSON"},415);
   let value;try{value=await req.json()}catch{return answer({error:"Invalid JSON"},400)}
   const id=String(value?.id||""),choice=String(value?.choice||"");
   if(!/^[0-9a-f-]{36}$/i.test(id)||!["first","second","alternate","decline"].includes(choice))return answer({error:"Invalid decision"},400);
   try{
     const item=await env.DB.prepare("SELECT id,date1,time1,date2,time2,timezone FROM appointments WHERE id=?").bind(id).first();
     if(!item)return answer({error:"Appointment not found"},404);
     // Do not assert conflict-free availability without a connected calendar.
     const update=await env.DB.prepare("INSERT OR IGNORE INTO appointment_decisions (request_id,choice,approved_by,notification_state) VALUES (?,?,?,'not_sent')").bind(id,choice,identity.email.toLowerCase()).run();
     const saved=await env.DB.prepare("SELECT choice,approved_by,decided_at,notification_state FROM appointment_decisions WHERE request_id=?").bind(id).first();
     if(saved.choice!==choice)return answer({error:"A different decision was already recorded. Review with Jack before changing it."},409);
     return answer({ok:true,decision:saved,message:"Decision recorded internally. No email sent and no meeting booked."});
   }catch{return answer({error:"Could not record decision (check 002_decisions.sql migration)"},503)}
 }
 if(req.method!=="GET"||new URL(req.url).pathname!=="/api/requests")return answer({error:"Not found"},404);
 try{const q=await env.DB.prepare("SELECT a.id,a.name,a.email,a.organization,a.date1,a.time1,a.date2,a.time2,a.timezone,a.topic,a.notification_status,a.created_at,d.choice AS recorded_choice,d.approved_by AS decision_by,d.notification_state AS response_state FROM appointments a LEFT JOIN appointment_decisions d ON d.request_id=a.id ORDER BY a.created_at DESC LIMIT 100").all();return answer({requests:q.results})}
 catch{return answer({error:"Database unavailable"},503)}
}};
