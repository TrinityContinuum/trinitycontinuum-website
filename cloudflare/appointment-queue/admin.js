
const PAGE=String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trinity — Private Appointment Queue</title>
<style nonce="trinity-approvals-v1">
body{background:#07111e;color:white;font:16px/1.5 system-ui;margin:0}main{max-width:920px;margin:auto;padding:25px}h1{color:#e4c37f}
article{border:1px solid #536d87;border-radius:10px;background:#17283c;margin:18px 0;padding:20px}
button{background:#e4c37f;border:0;border-radius:6px;padding:12px 18px;margin:10px 10px 0 0;font-weight:bold;cursor:pointer}
select{background:#07111e;color:white;padding:10px;width:100%;border:1px solid #536d87}small{color:#c4cdd7}pre{white-space:pre-wrap;background:#07111e;border-radius:8px;padding:12px}
</style>
<main><h1>Trinity — Private Appointment Queue</h1>
<p>Only holders of Jack's administrator login can see these submissions. Select a decision and prepare a reply to the visitor. Reply drafts and calendar events can be prefilled. Automatic delivery appears only after verified email and calendar credentials are activated.</p>
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
 const autoResponse=await fetch('/api/automation-status',{credentials:'same-origin',cache:'no-store'});
 const auto=autoResponse.ok?await autoResponse.json():{enabled:false};
 status.textContent=(data.requests||[]).length+' appointment request(s) found. '+(auto.enabled?'Automatic approval and sending available.':'Automatic sending is not yet connected; manual controls remain available.');
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
  card.append(record);
  if(auto.enabled&&!/DIAGNOSTIC|SYSTEM TEST|DO NOT BOOK/i.test(a.name+' '+a.topic)){
    const send=document.createElement('button');
    send.textContent='Approve and deliver automatically';
    send.onclick=async()=>{
      const choice=select.value;
      const action=(choice==='first'||choice==='second')?'create a Google Calendar event, email the invitation, and send a separate corporate confirmation':'send a corporate email about the selected decision';
      if(!confirm('This will '+action+' to '+a.email+'. Proceed?'))return;
      send.disabled=true;send.textContent='Processing delivery...';
      try{
        const r=await fetch('/api/approve-and-send',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:a.id,choice})});
        const j=await r.json();
        if(!r.ok)throw Error(j.error||'Delivery failed');
        send.textContent='Delivered — check calendar and email log';
        record.disabled=true;select.disabled=true;
      }catch(e){send.textContent='Delivery needs manual review';alert(e.message+' Do not retry unless delivery records are reconciled.')}
    };
    card.append(send);
  }
  host.append(card);
 }
}catch(e){status.textContent='Could not load appointment records. Confirm your private Worker credentials and database binding.'}
})();
</script></html>`;
// Staging: independent HTTP Basic Authentication over HTTPS.
// Cloudflare Worker secret ADMIN_PASSWORD must be long and randomly generated.
// This is a small-team interim alternative to Cloudflare Access, not SSO/MFA.
// Automated appointment completion core. STAGING ONLY until audited and deployed.
// Called from authenticated admin Worker, never from public intake. No secrets embedded.
// Requires migration 003_automation.sql and verification of two external integrations.
const tzMap={
 "America/Chicago (Central)":"America/Chicago",
 "America/New_York (Eastern)":"America/New_York",
 "America/Denver (Mountain)":"America/Denver",
 "America/Los_Angeles (Pacific)":"America/Los_Angeles",
 "UTC":"UTC"
};
const emailFormat=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function parts(date,zone){
 const all=new Intl.DateTimeFormat("en-US",{timeZone:zone,hour12:false,
  year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
  hourCycle:"h23"}).formatToParts(date);
 return Object.fromEntries(all.map(x=>[x.type,x.value]));
}
function utcWindow(date,time,zone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error("Invalid appointment date or time");
 const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
 const base=Date.UTC(year,month-1,day,hour,minute);
 const matches=[];
 for(let offset=-14*60;offset<=14*60;offset+=15){
  const candidate=new Date(base-offset*60000),p=parts(candidate,zone);
  if(+p.year===year&&+p.month===month&&+p.day===day&&+p.hour===hour&&+p.minute===minute)matches.push(candidate);
 }
 if(matches.length!==1)throw Error("Ambiguous or nonexistent local time; manual review required");
 const start=matches[0],end=new Date(start.getTime()+30*60000);
 if(start.getTime()<Date.now())throw Error("Cannot book an appointment in the past");
 const p0=parts(start,"America/Chicago"),p1=parts(end,"America/Chicago");
 const sameDay=p0.year===p1.year&&p0.month===p1.month&&p0.day===p1.day;
 if(sameDay){
  const m0=+p0.hour*60 + +p0.minute,m1=+p1.hour*60 + +p1.minute;
  if(m0<780&&m1>690)throw Error("Protected Central lunch interval: 11:30 AM–1:00 PM");
 }
 return {start:start.toISOString(),end:end.toISOString()};
}
function missing(env){
 const required=["DB","RESEND_API_KEY","RESEND_FROM","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","GOOGLE_REFRESH_TOKEN","GOOGLE_CALENDAR_ID"];
 return required.filter(k=>!env[k]);
}
async function calendarToken(env){
 const body=new URLSearchParams({
  client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,
  refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:"refresh_token"
 });
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body,headers:{"content-type":"application/x-www-form-urlencoded"}});
 const json=await response.json().catch(()=>({}));
 if(!response.ok||!json.access_token)throw Error("Google calendar authorization failed");
 return json.access_token;
}
async function calendarFree(env,token,window){
 const response=await fetch("https://www.googleapis.com/calendar/v3/freeBusy",{
  method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},
  body:JSON.stringify({timeMin:window.start,timeMax:window.end,items:[{id:env.GOOGLE_CALENDAR_ID}]})
 });
 const value=await response.json().catch(()=>({}));
 const c=value.calendars?.[env.GOOGLE_CALENDAR_ID];
 if(!response.ok||!c||c.errors?.length||!Array.isArray(c.busy))throw Error("Calendar availability could not be verified");
 if(c.busy.length)throw Error("Calendar reports a conflicting appointment");
}
async function createCalendar(env,token,request,window){
 const id="tc"+request.id.toLowerCase().replaceAll("-","");
 const endpoint="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(env.GOOGLE_CALENDAR_ID)+"/events?sendUpdates=all&conferenceDataVersion=1";
 const payload={
  id,summary:"Trinity Continuum — "+request.name,
  description:"Approved meeting request: "+request.id+"\nTopic: "+request.topic+"\nContact: "+request.email,
  start:{dateTime:window.start,timeZone:"UTC"},
  end:{dateTime:window.end,timeZone:"UTC"},
  attendees:[{email:request.email}],
  conferenceData:{createRequest:{requestId:"meet"+id,conferenceSolutionKey:{type:"hangoutsMeet"}}},
  reminders:{useDefault:false,overrides:[{method:"popup",minutes:30},{method:"email",minutes:10}]}
 };
 const response=await fetch(endpoint,{method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(payload)});
 if(response.status===409)throw Error("An event with this appointment ID already exists; manual reconciliation required");
 const obj=await response.json().catch(()=>({}));
 if(!response.ok||obj.id!==id)throw Error("Google Calendar did not confirm the event creation");
 return {eventId:id,link:obj.hangoutLink||obj.conferenceData?.entryPoints?.find(x=>x.entryPointType==="video")?.uri||"",conferenceStatus:obj.conferenceData?.createRequest?.status?.statusCode||"pending"};
}
async function sendMail(env,request,choice,window,meet){
 const accepted=choice==="first"||choice==="second";
 const subject=accepted?"Trinity Continuum — Confirmed Meeting":"Trinity Continuum — Meeting Request Update";
 let body="Hello "+request.name+",\n\n";
 if(accepted){
  body+="We have confirmed your requested meeting for "+(choice==="first"?request.date1+" "+request.time1:request.date2+" "+request.time2)+" ("+request.timezone+"), lasting 30 minutes.\n";
  body+="Calendar invitation: Google Calendar has issued an invitation to "+request.email+".\n";
  body+=meet?.link?"Google Meet: "+meet.link+"\n":"Google Meet details will appear in the calendar invitation once created.\n";
  body+="\nIf you cannot access Google Meet, reply to arrange a telephone call.\n\n";
 } else if(choice==="alternate")body+="Neither requested time is available. Please reply with two alternative times and your time zone.\n\n";
 else body+="Thank you for your interest. Unfortunately, we cannot accommodate this appointment request at this time.\n\n";
 body+="Respectfully,\nJack Coates\nTrinity Continuum\njack@trinitycontinuum.com\nwww.trinitycontinuum.com";
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"authorization":"Bearer "+env.RESEND_API_KEY,
   "content-type":"application/json","Idempotency-Key":"trinity-appointment-"+request.id},
  body:JSON.stringify({from:env.RESEND_FROM,to:[request.email],reply_to:"jack@trinitycontinuum.com",subject,text:body})
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok||!json.id)throw Error("Outbound corporate email was not confirmed");
 return json.id;
}
function allowedAutomation(env){return env.APPROVAL_AUTOMATION_ENABLED==="true"&&missing(env).length===0}
function msg(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})}
async function runApproval(req,env,approver){
 if(!allowedAutomation(env))return msg({error:"Automatic confirmation is not configured; no messages were sent.",missing:missing(env)},503);
 if(!/^application\/json/i.test(req.headers.get("content-type")||""))return msg({error:"Expected JSON"},415);
 const payload=await req.json().catch(()=>null);
 const id=String(payload?.id||""),choice=String(payload?.choice||"");
 if(!/^[0-9a-f-]{36}$/i.test(id)||!["first","second","alternate","decline"].includes(choice))return msg({error:"Invalid approval"},400);
 let request;
 try{request=await env.DB.prepare("SELECT id,name,email,date1,time1,date2,time2,timezone,topic FROM appointments WHERE id=?").bind(id).first();}
 catch{return msg({error:"Appointment data could not be read"},503)}
 if(!request||!emailFormat.test(request.email)||request.email.endsWith(".invalid")||/DIAGNOSTIC|SYSTEM TEST|DO NOT BOOK/i.test(request.name+" "+request.topic))return msg({error:"Unknown or diagnostic request; cannot send"},400);
 const accepted=choice==="first"||choice==="second";
 let window=null,token=null;
 try{
  if(accepted){
   const zone=tzMap[request.timezone];if(!zone)throw Error("Time zone must be reviewed manually");
   const date=choice==="first"?request.date1:request.date2,time=choice==="first"?request.time1:request.time2;
   window=utcWindow(date,time,zone);
   token=await calendarToken(env);
   await calendarFree(env,token,window);
  }
 }catch(e){return msg({error:String(e.message||"Preflight failed")+"; nothing sent"},409)}
 // A previous attempt may already have emailed or invited the visitor.
 // Never automatically retry ambiguous partial deliveries.
 const existing=await env.DB.prepare("SELECT state,choice,calendar_event_id,email_provider_id FROM appointment_delivery WHERE request_id=?").bind(id).first().catch(()=>null);
 if(existing)return msg({error:"This request was already attempted. Reconcile manually before trying again.",delivery:existing},409);
 const prior=await env.DB.prepare("SELECT choice FROM appointment_decisions WHERE request_id=?").bind(id).first().catch(()=>null);
 if(prior&&prior.choice!==choice)return msg({error:"A different decision is already recorded"},409);
 const claim=await env.DB.prepare("INSERT OR IGNORE INTO appointment_delivery (request_id,choice,state) VALUES (?,?,'processing')").bind(id,choice).run().catch(()=>null);
 if(!claim?.meta?.changes)return msg({error:"Another process may already be handling this appointment"},409);
 let stage="calendar",event=null,emailId="";
 try{
  if(accepted){
   event=await createCalendar(env,token,request,window);
   await env.DB.prepare("UPDATE appointment_delivery SET calendar_event_id=?,updated_at=datetime('now') WHERE request_id=?").bind(event.eventId,id).run();
  }
  stage="email";emailId=await sendMail(env,request,choice,window,event);
  await env.DB.prepare("UPDATE appointment_delivery SET state='sent', email_provider_id=?, updated_at=datetime('now') WHERE request_id=?").bind(emailId,id).run();
  await env.DB.prepare("INSERT OR IGNORE INTO appointment_decisions (request_id,choice,approved_by,notification_state) VALUES (?,?,?,'sent')").bind(id,choice,approver).run();
  await env.DB.prepare("UPDATE appointment_decisions SET notification_state='sent' WHERE request_id=? AND choice=?").bind(id,choice).run();
  return msg({ok:true,state:"sent",calendarEventId:event?.eventId||null,emailId});
 }catch(e){
  await env.DB.prepare("UPDATE appointment_delivery SET state='partial', error_stage=?, updated_at=datetime('now') WHERE request_id=?").bind(stage,id).run().catch(()=>null);
  return msg({error:"Delivery was not fully confirmed; do NOT retry without reconciliation",stage,calendarEventId:event?.eventId||null},502);
 }
}
function automationStatus(env){
 return {enabled:allowedAutomation(env),missing:missing(env),activationRequired:env.APPROVAL_AUTOMATION_ENABLED!=="true"};
}

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
 if(req.method==="GET"&&new URL(req.url).pathname==="/api/automation-status")return answer(automationStatus(env));
 if(req.method==="POST"&&new URL(req.url).pathname==="/api/approve-and-send")return runApproval(req,env,approver);
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
