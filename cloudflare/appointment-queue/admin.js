
const PAGE=String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trinity — Private Appointment Queue</title>
<style nonce="trinity-approvals-v1">
body{background:#07111e;color:white;font:16px/1.5 system-ui;margin:0}main{max-width:920px;margin:auto;padding:25px}h1{color:#e4c37f}
article{border:1px solid #536d87;border-radius:10px;background:#17283c;margin:18px 0;padding:20px}
button{background:#e4c37f;border:0;border-radius:6px;padding:12px 18px;margin:10px 10px 0 0;font-weight:bold;cursor:pointer}
select{background:#07111e;color:white;padding:10px;width:100%;border:1px solid #536d87}small{color:#c4cdd7}pre{white-space:pre-wrap;background:#07111e;border-radius:8px;padding:12px}
</style>
<main><h1>Trinity — Private Appointment Queue</h1>
<p>Only holders of Jack's administrator login can see these submissions. Select a decision and prepare a reply to the visitor. Reply drafts and calendar events can now be prefilled in one click. They still require final review, sending, and adding Google Meet.</p>
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
  // No external mail service credential is configured. Pre-fill the visitor's message
  // in the local email client instead of pretending that email was sent.
  const compose=document.createElement('button');compose.textContent='Open addressed email draft';
  compose.disabled=String(a.email||'').endsWith('.invalid');
  compose.onclick=()=>{
    const d=create();
    if(!confirm('Open a draft addressed to '+d.email+'? Review it before sending. No email has been sent yet.'))return;
    window.location.href='mailto:'+encodeURIComponent(d.email)+'?subject='+encodeURIComponent(d.subject)+'&body='+encodeURIComponent(d.body);
  };
  card.append(compose);
  // The calendar event is an editable template, never automatically booked;
  // the administrator must review availability and add Google Meet.
  const calendar=document.createElement('button');calendar.textContent='Open Google Calendar event';
  const zoneNames={'America/Chicago (Central)':'America/Chicago','America/New_York (Eastern)':'America/New_York','America/Denver (Mountain)':'America/Denver','America/Los_Angeles (Pacific)':'America/Los_Angeles','UTC':'UTC'};
  calendar.disabled=String(a.email||'').endsWith('.invalid');
  calendar.onclick=()=>{
    const choice=select.value;
    if(choice!=='first'&&choice!=='second'){alert('Select a proposed time first.');return}
    const day=choice==='first'?a.date1:a.date2,time=choice==='first'?a.time1:a.time2;
    const tz=zoneNames[a.timezone];
    if(!tz){alert('Time zone needs manual confirmation before adding to a calendar.');return}
    const [h,m]=String(time).split(':').map(Number);
    const start=String(day).replace(/-/g,'')+'T'+String(h).padStart(2,'0')+String(m).padStart(2,'0')+'00';
    const minutes=h*60+m+30;
    if(minutes>=1440){alert('Meeting crosses midnight; create event manually.');return}
    const end=String(day).replace(/-/g,'')+'T'+String(Math.floor(minutes/60)).padStart(2,'0')+String(minutes%60).padStart(2,'0')+'00';
    const url=new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action','TEMPLATE');
    url.searchParams.set('text','Trinity Continuum — '+a.name);
    url.searchParams.set('dates',start+'/'+end);
    url.searchParams.set('ctz',tz);
    url.searchParams.set('details','Tentative meeting request. Check availability before saving. Contact: '+a.email+'. Topic: '+a.topic+'. Request ID: '+a.id+'. Add a unique Google Meet link before inviting the visitor.');
    url.searchParams.set('add',a.email);
    window.open(url.toString(),'_blank','noopener,noreferrer');
  };
  card.append(calendar);
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
}catch(e){status.textContent='Could not load appointment records. Confirm your private Worker credentials and database binding.'}
})();
</script></html>`;
// Staging: independent HTTP Basic Authentication over HTTPS.
// Cloudflare Worker secret ADMIN_PASSWORD must be long and randomly generated.
// This is a small-team interim alternative to Cloudflare Access, not SSO/MFA.
const answer=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",...extra}});
const realm='Basic realm="Trinity Private Appointments", charset="UTF-8"';
const encoder=new TextEncoder();
async function sameSecret(x,y){
 const values=await Promise.all([crypto.subtle.digest("SHA-256",encoder.encode(x)),crypto.subtle.digest("SHA-256",encoder.encode(y))]);
 let diff=0;const a=new Uint8Array(values[0]),b=new Uint8Array(values[1]);
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
async function authorized(req,env){
 if(typeof env.ADMIN_PASSWORD!=="string"||env.ADMIN_PASSWORD.length<24)return false;
 const header=req.headers.get("Authorization")||"";
 if(!header.startsWith("Basic ")||header.length>2048)return false;
 let decoded;try{decoded=atob(header.slice(6))}catch{return false}
 const colon=decoded.indexOf(":");if(colon<1)return false;
 const username=decoded.slice(0,colon),password=decoded.slice(colon+1);
 if(username!=="jack"||!password)return false;
 return await sameSecret(password,env.ADMIN_PASSWORD);
}
export default {async fetch(req,env){
 if(!(await authorized(req,env)))return answer({error:"Authentication required"},401,{"www-authenticate":realm});
 const approver=(env.APPROVER_EMAILS||"").toLowerCase().trim();
 if(approver!=="jack@trinitycontinuum.com")return answer({error:"Approver configuration missing"},503);
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
     const update=await env.DB.prepare("INSERT OR IGNORE INTO appointment_decisions (request_id,choice,approved_by,notification_state) VALUES (?,?,?,'not_sent')").bind(id,choice,approver).run();
     const saved=await env.DB.prepare("SELECT choice,approved_by,decided_at,notification_state FROM appointment_decisions WHERE request_id=?").bind(id).first();
     if(saved.choice!==choice)return answer({error:"A different decision was already recorded. Review with Jack before changing it."},409);
     return answer({ok:true,decision:saved,message:"Decision recorded internally. No email sent and no meeting booked."});
   }catch{return answer({error:"Could not record decision (check 002_decisions.sql migration)"},503)}
 }
 if(req.method!=="GET"||new URL(req.url).pathname!=="/api/requests")return answer({error:"Not found"},404);
 try{const q=await env.DB.prepare("SELECT a.id,a.name,a.email,a.organization,a.date1,a.time1,a.date2,a.time2,a.timezone,a.topic,a.notification_status,a.created_at,d.choice AS recorded_choice,d.approved_by AS decision_by,d.notification_state AS response_state FROM appointments a LEFT JOIN appointment_decisions d ON d.request_id=a.id ORDER BY a.created_at DESC LIMIT 100").all();return answer({requests:q.results})}
 catch{return answer({error:"Database unavailable"},503)}
}};
