// STAGED ONLY — DO NOT DEPLOY until Google OAuth, owner-approved hours,
// Cloudflare Turnstile, D1 migrations, and security tests are complete.
// Trinity D1 is the authoritative booking register. Calendar is the invitation
// and conflict-checking transport. Default policy: NO automatic booking.
const ORIGINS=new Set(["https://trinitycontinuum.com","https://www.trinitycontinuum.com"]);
const ZONE="America/Chicago";

const BUFFER_MINUTES=15;
// Exclude U.S. federal holidays, including adjacent observed dates. Business
// calendar busy events can block additional owner-approved company holidays.
const iso=(y,m,d)=>new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10);
function nthWeekday(y,m,weekday,n){
 const first=new Date(Date.UTC(y,m-1,1)).getUTCDay();
 return iso(y,m,1+(weekday-first+7)%7+7*(n-1));
}
function lastWeekday(y,m,weekday){
 const end=new Date(Date.UTC(y,m,0)),day=end.getUTCDay();
 return iso(y,m,end.getUTCDate()-(day-weekday+7)%7);
}
function observed(day){
 const [y,m,d]=day.split("-").map(Number),w=new Date(Date.UTC(y,m-1,d)).getUTCDay();
 if(w===6)return iso(y,m,d-1);if(w===0)return iso(y,m,d+1);
 return day;
}
function federalHolidays(year){
 const raw=[
  iso(year,1,1),nthWeekday(year,1,1,3),nthWeekday(year,2,1,3),
  lastWeekday(year,5,1),iso(year,6,19),iso(year,7,4),
  nthWeekday(year,9,1,1),nthWeekday(year,10,1,2),iso(year,11,11),
  nthWeekday(year,11,4,4),iso(year,12,25)
 ];
 return raw.map(observed);
}
function isFederalHoliday(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return true;
 const year=Number(day.slice(0,4));
 return [year-1,year,year+1].some(y=>federalHolidays(y).includes(day));
}
const bufferStart=d=>new Date(d.getTime()-BUFFER_MINUTES*60000);
const bufferEnd=d=>new Date(d.getTime()+BUFFER_MINUTES*60000);

const H=Object.freeze({"content-type":"application/json","cache-control":"no-store"});
function json(obj,status=200,origin=""){return new Response(JSON.stringify(obj),{status,headers:{...H,...(ORIGINS.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}})}
function dateParts(date,zone=ZONE){
 const f=new Intl.DateTimeFormat("en-US",{timeZone:zone,hour12:false,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",weekday:"short"});
 return Object.fromEntries(f.formatToParts(date).map(p=>[p.type,p.value]));
}
function fromLocal(day,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))throw Error("Invalid date/time");
 const [y,m,d]=day.split("-").map(Number),[h,mi]=time.split(":").map(Number);
 if(h>23||mi>59||new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==day)throw Error("Invalid calendar date");
 const base=Date.UTC(y,m-1,d,h,mi),found=[];
 for(let delta=-14*60;delta<=14*60;delta+=15){
  const candidate=new Date(base-delta*60000),p=dateParts(candidate);
  if(+p.year===y&&+p.month===m&&+p.day===d&&+p.hour===h&&+p.minute===mi)found.push(candidate);
 }
 if(found.length!==1)throw Error("Invalid or ambiguous daylight-saving time");
 return found[0];
}
const minutes=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
function weekday(day){const p=dateParts(fromLocal(day,"12:00"));return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday)}
function validWindows(w){
 if(!Array.isArray(w)||w.length>28)return false;
 return w.every(x=>Number.isInteger(x.weekday)&&x.weekday>=0&&x.weekday<=6&&/^\d\d:\d\d$/.test(x.start)&&/^\d\d:\d\d$/.test(x.end)&&minutes(x.start)>=0&&minutes(x.end)<=1440&&minutes(x.end)-minutes(x.start)>=30&&minutes(x.start)%30===0&&minutes(x.end)%30===0);
}
function slotWithin(day,time,windows){
 if(!validWindows(windows)||!windows.length)return false;
 const start=minutes(time),end=start+30;if(end>1440||start%30||isFederalHoliday(day))return false;
 // Central lunch is a hard block regardless of configured availability.
 if(start<780&&end>690)return false;
 return windows.some(w=>w.weekday===weekday(day)&&start>=minutes(w.start)&&end<=minutes(w.end));
}
async function policy(env){
 const row=await env.DB.prepare("SELECT enabled, windows_json, min_notice_hours, max_days FROM booking_policy WHERE id=1").first();
 if(!row)return {enabled:false,windows:[],minNoticeHours:24,maxDays:60};
 let windows=[];try{windows=JSON.parse(row.windows_json)}catch{}
 return {enabled:row.enabled===1&&validWindows(windows),windows:validWindows(windows)?windows:[],minNoticeHours:row.min_notice_hours,maxDays:row.max_days};
}
function inRange(date,p){
 const now=Date.now(),diff=date.getTime()-now;
 return diff>=p.minNoticeHours*3600000&&diff<=p.maxDays*86400000;
}
async function googleToken(env){
 if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN||!env.GOOGLE_CALENDAR_ID)throw Error("Business calendar not configured");
 const form=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:"refresh_token"});
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:form});
 const b=await r.json();if(!r.ok||!b.access_token)throw Error("Calendar authorization failed");
 return b.access_token;
}
function requiredBusyCalendars(env){
 const primary=String(env.GOOGLE_CALENDAR_ID||"").trim();
 if(!primary)throw Error("Business calendar not configured");
 // A corporate-calendar-only query could double-book Jack. Require the
 // authorized independent personal busy source before advertising any slot.
 if(!String(env.GOOGLE_BUSY_CALENDAR_IDS_JSON||"").trim())throw Error("Jack's secondary busy calendars are not configured");
 let extras=[];
 if(env.GOOGLE_BUSY_CALENDAR_IDS_JSON){
  try{extras=JSON.parse(env.GOOGLE_BUSY_CALENDAR_IDS_JSON)}catch{throw Error("Busy-calendar configuration invalid")}
  if(!Array.isArray(extras)||extras.length===0||extras.length>12||extras.some(x=>typeof x!=="string"||!x.trim()||x.length>256))
   throw Error("Busy-calendar configuration invalid");
 }
 return [...new Set([primary,...extras.map(x=>x.trim())])];
}
async function freeBusy(env,token,start,end){
 const ids=requiredBusyCalendars(env);
 const r=await fetch("https://www.googleapis.com/calendar/v3/freeBusy",{method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({timeMin:start.toISOString(),timeMax:end.toISOString(),items:ids.map(id=>({id}))})});
 const b=await r.json();
 if(!r.ok||!b.calendars)throw Error("Calendar availability unavailable");
 for(const id of ids){
  const c=b.calendars[id];
  // A permission error on ANY relevant calendar is a hard block, not "free."
  if(!c||c.errors?.length||!Array.isArray(c.busy))throw Error("Busy-calendar availability unavailable");
  if(c.busy.length)return false;
 }
 return true;
}
function basic(req,env){
 if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<24)return false;
 const header=req.headers.get("authorization")||"";
 if(!header.startsWith("Basic "))return false;
 let decoded;try{decoded=atob(header.slice(6))}catch{return false}
 return decoded==="jack:"+env.ADMIN_PASSWORD;
}
// Require Cloudflare Access at the edge; ctx.access is supplied by the Workers
// runtime for a configured Access application, not a caller-controlled header.
// This is an additional staff gate, not a replacement for the existing secret.
async function accessStaff(ctx,env){
 const emails=String(env.ADMIN_APPROVER_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 // Cloudflare Access supplies an authenticated runtime API, not ctx.access.email.
 // Never accept a client-supplied email header as a replacement.
 if(!emails.length||typeof ctx?.access?.getIdentity!=="function")return false;
 try{
  const identity=await ctx.access.getIdentity();
  const principal=typeof identity?.email==="string"?identity.email.trim().toLowerCase():"";
  return !!principal&&emails.includes(principal);
 }catch{return false}
}
async function adminAuthorized(req,env,ctx){
 if(!basic(req,env))return false;
 return accessStaff(ctx,env);
}
async function verifyTurnstile(req,env,token){
 // No token, secret, trusted hostname or successful Cloudflare response = NO booking.
 // Never downgrade to client-side verification or treat an outage as approval.
 if(!env.TURNSTILE_SECRET||typeof token!=="string"||!token.trim()||token.length>2048)return false;
 const fd=new FormData();fd.set("secret",env.TURNSTILE_SECRET);fd.set("response",token);
 const ip=req.headers.get("CF-Connecting-IP");if(ip)fd.set("remoteip",ip);
 try{
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",body:fd,signal:AbortSignal.timeout(8000)
  });
  if(!r.ok)return false;
  const v=await r.json();
  return v?.success===true&&["trinitycontinuum.com","www.trinitycontinuum.com"].includes(v.hostname);
 }catch{return false}
}
async function createInvitation(env,token,id,request,start,end){
 const api="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(env.GOOGLE_CALENDAR_ID)+"/events?sendUpdates=all&conferenceDataVersion=1";
 // Google event id must consist of base32hex; derive from UUID hex, with prefix.
 const eventId="tc"+id.replaceAll("-","").toLowerCase();
 const data={
  id:eventId,summary:"Trinity Continuum — "+request.name,
  description:"Trinity appointment ID: "+id+"\nContact: "+request.email+"\nOrganization: "+(request.organization||"")+"\nTopic: "+request.topic,
  start:{dateTime:start.toISOString(),timeZone:"UTC"},end:{dateTime:end.toISOString(),timeZone:"UTC"},
  attendees:[{email:request.email}],
  conferenceData:{createRequest:{requestId:"meet"+eventId,conferenceSolutionKey:{type:"hangoutsMeet"}}},
  reminders:{useDefault:false,overrides:[{method:"email",minutes:60}]}
 };
 const r=await fetch(api,{method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(data)});
 const b=await r.json().catch(()=>({}));
 if(!r.ok||b.id!==eventId)throw Error("Calendar event not confirmed; manual reconciliation required");
 const meetLink=b.hangoutLink||b.conferenceData?.entryPoints?.find(p=>p.entryPointType==="video")?.uri||"";
 if(!/^https:\/\/meet\.google\.com\/[a-z0-9-]+(?:[/?#].*)?$/i.test(meetLink))throw Error("Meet link not ready; reconcile event before confirming");
 return {eventId,meetLink,htmlLink:b.htmlLink||""};
}
// Cloudflare's native Rate Limiting binding is deliberately required before
// any expensive public slot discovery or booking action. Enforcement is
// approximate per Cloudflare location, and does not replace Turnstile or D1.
async function publicRateGuard(req,env,origin,route){
 const ip=String(req.headers.get("CF-Connecting-IP")||"").trim();
 if(!ip||ip.length>64||typeof env.BOOKING_RATE_LIMITER?.limit!=="function")
  return json({error:"Booking request protection is unavailable; use the manual appointment form"},503,origin);
 let result;
 try{result=await env.BOOKING_RATE_LIMITER.limit({key:route+":"+ip})}
 catch{return json({error:"Booking request protection is unavailable; use the manual appointment form"},503,origin)}
 if(result?.success===false)return json({error:"Too many appointment requests; please use the manual form or try later"},429,origin);
 if(result?.success!==true)return json({error:"Booking request protection is unavailable; use the manual appointment form"},503,origin);
 return null;
}
async function handleSlots(req,url,env,origin){
 const guard=await publicRateGuard(req,env,origin,"slots");
 if(guard)return guard;
 const p=await policy(env);
 if(!p.enabled||env.DIRECT_BOOKING_ENABLED!=="true")return json({enabled:false,slots:[]},200,origin);
 const day=url.searchParams.get("date")||"";if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return json({error:"Choose a date"},400,origin);
 let tok;try{tok=await googleToken(env)}catch{return json({enabled:false,error:"Business calendar not ready"},503,origin)}
 const slots=[];for(let min=0;min<=1410;min+=30){
  const time=String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0");
  try{
   if(!slotWithin(day,time,p.windows))continue;
   const start=fromLocal(day,time),end=new Date(start.getTime()+1800000);
   if(!inRange(start,p))continue;
   const reserved=await env.DB.prepare("SELECT id FROM appointment_bookings WHERE slot_start < ? AND slot_end > ? AND state IN ('processing','confirmed','needs_reconciliation') LIMIT 1").bind(bufferEnd(end).toISOString(),bufferStart(start).toISOString()).first();
   const legacy=await env.DB.prepare("SELECT id FROM appointment_external WHERE start_utc < ? AND end_utc > ? AND status IN ('invited','accepted','completed','tentative') LIMIT 1").bind(bufferEnd(end).toISOString(),bufferStart(start).toISOString()).first();
   if(!reserved&&!legacy&&await freeBusy(env,tok,bufferStart(start),bufferEnd(end)))slots.push({time,zone:ZONE});
  }catch{/* Skip ambiguous or unavailable slots safely. */}
 }
 return json({enabled:true,date:day,timezone:ZONE,slots},200,origin);
}
async function handleBook(req,env,origin){
 if(env.DIRECT_BOOKING_ENABLED!=="true")return json({error:"Automatic booking not active; request approval"},503,origin);
 let body;try{body=await req.json()}catch{return json({error:"Invalid booking"},400,origin)}
 if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Invalid booking"},400,origin);
 const id=String(body.id||""),day=String(body.date||""),time=String(body.time||"");
 const name=String(body.name||"").trim(),email=String(body.email||"").trim(),organization=String(body.organization||"").trim(),topic=String(body.topic||"").trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||name.length<2||name.length>120||organization.length>150||topic.length<3||topic.length>2500||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"Invalid details"},400,origin);
 const guard=await publicRateGuard(req,env,origin,"book");
 if(guard)return guard;
 if(!(await verifyTurnstile(req,env,String(body.turnstileToken||""))))return json({error:"Security verification failed"},403,origin);
 let start,end,p;
 try{p=await policy(env);if(!p.enabled||!slotWithin(day,time,p.windows))return json({error:"This time needs Jack's approval"},409,origin);
 start=fromLocal(day,time);end=new Date(start.getTime()+1800000);
 if(!inRange(start,p))return json({error:"Outside booking window"},409,origin);
 }catch{return json({error:"Invalid or ambiguous time"},400,origin)}
 let token;try{token=await googleToken(env);
  const previous=await env.DB.prepare("SELECT id FROM appointment_external WHERE start_utc < ? AND end_utc > ? AND status IN ('invited','accepted','completed','tentative') LIMIT 1").bind(bufferEnd(end).toISOString(),bufferStart(start).toISOString()).first();
  if(previous)return json({error:"Existing Trinity meeting conflicts with selected time"},409,origin);
  if(!await freeBusy(env,token,bufferStart(start),bufferEnd(end)))return json({error:"Time no longer available"},409,origin)}
 catch{return json({error:"Could not verify business calendar; no booking made"},503,origin)}
 // D1 unique index on slot_start serializes simultaneous submissions.
 try{
  await env.DB.prepare("INSERT INTO appointment_bookings (id,slot_start,slot_end,name,email,organization,topic,state) VALUES (?,?,?,?,?,?,?,'processing')").bind(id,start.toISOString(),end.toISOString(),name,email,organization,topic).run();
 }catch{return json({error:"Slot reserved or duplicate request; check with Trinity before retrying"},409,origin)}
 try{
  const inv=await createInvitation(env,token,id,{name,email,organization,topic},start,end);
  await env.DB.prepare("UPDATE appointment_bookings SET state='confirmed',calendar_event_id=?,meet_url=?,updated_at=datetime('now') WHERE id=?").bind(inv.eventId,inv.meetLink,id).run();
  return json({ok:true,reference:id,status:"confirmed",date:day,time,timezone:ZONE,meetUrl:inv.meetLink,calendarUrl:inv.htmlLink},201,origin);
 }catch{
  // Do not free slot automatically: Google may have created event before response failure.
  await env.DB.prepare("UPDATE appointment_bookings SET state='needs_reconciliation',updated_at=datetime('now') WHERE id=?").bind(id).run().catch(()=>{});
  return json({error:"Calendar confirmation uncertain; Trinity will reconcile. Do not retry.",reference:id},503,origin);
 }
}

const ADMIN_HTML=String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trinity — Scheduling Policy</title>
<style>body{margin:0;background:#07111e;color:#e9f0f6;font:16px/1.5 system-ui}main{max-width:940px;margin:auto;padding:28px}h1{color:#dfc17d}fieldset{border:1px solid #6a7a8b;border-radius:10px;padding:16px;margin:18px 0}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #43576d;text-align:left;padding:10px}input{font:inherit;padding:7px}input[type=time]{width:115px;background:#10253a;color:white}button{background:#dfc17d;color:#07111e;border:0;padding:12px 18px;border-radius:7px;font-weight:700;cursor:pointer}p{max-width:780px}.muted{color:#bbcbd8}#message{padding:14px;border:1px solid #43576d;border-radius:6px}a{color:#dfc17d}@media(max-width:600px){table{font-size:13px}input[type=time]{width:85px}}</style>
<main><h1>Trinity · Central Scheduling Controls</h1><p>Jack chooses the hours available for direct booking. The staged weekday rule permits starts from 1:30 PM to 4:00 PM Central, inclusive, with the 4:00 PM meeting finishing at 4:30 PM. Outside these hours, visitors request approval. <strong>Hours are in America/Chicago (Central), including DST.</strong></p>
<p class="muted">The appointment register remains Trinity's authority. No direct booking is active unless the policy is enabled AND the separate server deployment switch and verified business calendar are available. New direct bookings are 30 minutes with a 15-minute buffer. U.S. federal observed holidays are automatically blocked; business-calendar busy events block other closures. 11:30 AM–1 PM Central is always blocked.</p>
<form id="policy"><fieldset><legend>Automatic confirmation policy</legend><label><input id="enabled" type="checkbox"> Allow automatic booking during the selected hours</label><table><thead><tr><th>Day</th><th>On</th><th>Start (Central)</th><th>End (Central)</th></tr></thead><tbody id="days"></tbody></table>
<label>Minimum lead time (hours) <input id="lead" type="number" min="1" max="720" value="24"></label> <label>Booking horizon (days) <input id="horizon" type="number" min="1" max="365" value="60"></label>
</fieldset><button type="submit">Save Jack's booking hours</button></form><p id="message" role="status">Loading private schedule...</p><h2>Confirmed or reconciliation-needed direct bookings</h2><div id="bookings">Loading records...</div></main>
<script>
const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const host=document.getElementById('days'),msg=document.getElementById('message');
for(let i=0;i<7;i++){const tr=document.createElement('tr');tr.innerHTML='<td>'+names[i]+'</td><td><input type="checkbox" data-day="'+i+'"></td><td><input type="time" data-start="'+i+'" value="09:00" step="1800"></td><td><input type="time" data-end="'+i+'" value="17:00" step="1800"></td>';host.append(tr)}
const elm=(type,day)=>document.querySelector('[data-'+type+'="'+day+'"]');
async function load(){
 const [r,b]=await Promise.all([fetch('/api/admin/policy'),fetch('/api/admin/bookings')]);if(!r.ok||!b.ok)throw Error('Unable to read private schedule');
 const p=await r.json(),book=await b.json();document.getElementById('enabled').checked=p.enabled;document.getElementById('lead').value=p.minNoticeHours;document.getElementById('horizon').value=p.maxDays;
 for(const w of p.windows){elm('day',w.weekday).checked=true;elm('start',w.weekday).value=w.start;elm('end',w.weekday).value=w.end}
 const area=document.getElementById('bookings');area.replaceChildren();
 for(const x of book.bookings){const row=document.createElement('p');row.textContent=x.slot_start+' Central-converted in your view · '+x.name+' · '+x.email+' · '+x.state+' · '+x.id;area.append(row)}
 if(!book.bookings.length)area.textContent='No direct-booking records yet.';
 msg.textContent=p.enabled?'Policy enabled; production still requires DIRECT_BOOKING_ENABLED=true and verified calendar integration.':'No automatic bookings are authorized by the policy.';
}
document.getElementById('policy').addEventListener('submit',async e=>{
 e.preventDefault();const windows=[];
 for(let i=0;i<7;i++)if(elm('day',i).checked)windows.push({weekday:i,start:elm('start',i).value,end:elm('end',i).value});
 const body={enabled:document.getElementById('enabled').checked,windows,minNoticeHours:Number(document.getElementById('lead').value),maxDays:Number(document.getElementById('horizon').value)};
 if(body.enabled&&!windows.length){msg.textContent='Choose at least one allowed day first.';return}
 if(!confirm('Save Jack’s automatic-booking hours? Direct booking requires separate deployment approval.'))return;
 const r=await fetch('/api/admin/policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();
 msg.textContent=r.ok?'Hours saved in Trinity policy; no invitations sent.':(j.error||'Could not save');});
load().catch(e=>msg.textContent=e.message);
</script></html>`;

export const _bookingPolicyTest={isFederalHoliday,slotWithin,validWindows,fromLocal};

export default {async fetch(req,env,ctx){
 const url=new URL(req.url),origin=req.headers.get("Origin")||"";
 // Independent deployment bootstraps with no booking schema or credentials.
 // This server-level switch is deliberately checked BEFORE every D1 query,
 // preventing any public booking, slot advertisement, or Google/Turnstile call
 // while the live service is being securely provisioned.
 if(env.DIRECT_BOOKING_ENABLED!=="true"){
  if(req.method==="GET"&&url.pathname==="/api/public/policy")
   return json({instantBookingEnabled:false,timezone:ZONE,minutes:30},200,origin);
  if(req.method==="GET"&&url.pathname==="/api/public/slots")
   return json({enabled:false,slots:[],timezone:ZONE},200,origin);
  if(req.method==="POST"&&url.pathname==="/api/public/book")
   return json({error:"Direct booking is disabled; please request an appointment for approval."},503,origin);
 }
 if(req.method==="OPTIONS")return ORIGINS.has(origin)?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST,PUT,OPTIONS","access-control-allow-headers":"content-type,authorization"}}):new Response(null,{status:403});
 if(!env.DB)return json({error:"Private scheduling register unavailable"},503,origin);
 if(url.pathname==="/api/public/policy"&&req.method==="GET"){
  const p=await policy(env);return json({instantBookingEnabled:p.enabled&&env.DIRECT_BOOKING_ENABLED==="true",timezone:ZONE,minutes:30},200,origin);
 }
 if(url.pathname==="/api/public/slots"&&req.method==="GET"&&ORIGINS.has(origin))return handleSlots(req,url,env,origin);
 if(url.pathname==="/api/public/book"&&req.method==="POST"){
  if(!ORIGINS.has(origin))return json({error:"Forbidden origin"},403,origin);
  return handleBook(req,env,origin);
 }
 if(url.pathname==="/admin"&&req.method==="GET"){
  if(!(await adminAuthorized(req,env,ctx)))return new Response("Unauthorized",{status:401,headers:{"www-authenticate":"Basic realm=\"Trinity Scheduling\"","cache-control":"no-store"}});
  return new Response(ADMIN_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
 }
 if(url.pathname==="/api/admin/master"&&req.method==="GET"){
  if(!(await adminAuthorized(req,env,ctx)))return json({error:"Unauthorized"},401);
  const direct=await env.DB.prepare("SELECT id,slot_start AS start_utc,slot_end AS end_utc,name,email,organization,topic,state,calendar_event_id FROM appointment_bookings ORDER BY slot_start DESC LIMIT 250").all();
  const pending=await env.DB.prepare("SELECT a.id,a.name,a.email,a.organization,a.topic,a.date1,a.time1,a.date2,a.time2,a.timezone,d.choice,d.notification_state FROM appointments a LEFT JOIN appointment_decisions d ON d.request_id=a.id ORDER BY a.created_at DESC LIMIT 250").all();
  const entries=[...(direct.results||[]).map(x=>({...x,source:"direct",verification:x.state==="confirmed"?"calendar_event_created":"reconcile_required"})),...(pending.results||[]).map(x=>({...x,source:"request_queue",verification:x.choice==="first"||x.choice==="second"?"decision_recorded_invitation_unverified":"approval_pending"}))];
  return json({entries,notice:"Historic personal-calendar events require separate authorized import and reconciliation before this can be called complete."});
 }
 if(url.pathname==="/api/admin/import-external"&&req.method==="POST"){
  if(!(await adminAuthorized(req,env,ctx)))return json({error:"Unauthorized"},401);
  if(req.headers.get("Origin")!==url.origin)return json({error:"Invalid administrator origin"},403);
  let payload;try{payload=await req.json()}catch{return json({error:"Invalid import document"},400)}
  if(!Array.isArray(payload?.appointments)||payload.appointments.length>100)return json({error:"Maximum 100 validated records per import"},400);
  const statuses=new Set(["invited","accepted","completed","cancelled","tentative"]);
  let inserted=0,unchanged=0;
  for(const a of payload.appointments){
   if(typeof a?.id!=="string"||!/^[A-Z0-9-]{10,100}$/.test(a.id)||typeof a?.source_key!=="string"||a.source_key.length<5||a.source_key.length>250||!statuses.has(a.status)||typeof a.title!=="string"||a.title.length>200||typeof a.start_utc!=="string"||typeof a.end_utc!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(a.start_utc)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(a.end_utc)||!Number.isFinite(Date.parse(a.start_utc))||Date.parse(a.end_utc)<=Date.parse(a.start_utc))return json({error:"Import contains invalid data; no further rows imported",inserted},400);
   const existing=await env.DB.prepare("SELECT id FROM appointment_external WHERE source_key=? OR id=? LIMIT 1").bind(a.source_key,a.id).first();
   if(existing){unchanged++;continue}
   try{
    await env.DB.prepare("INSERT INTO appointment_external(id,title,start_utc,end_utc,timezone,status,platform,join_url,attendees,organizer,source_key,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(a.id,a.title,a.start_utc,a.end_utc,"America/Chicago",a.status,String(a.platform||"").slice(0,120),String(a.join_url||"").slice(0,1000),String(a.attendees||"").slice(0,1500),String(a.organizer||"").slice(0,150),a.source_key,String(a.notes||"").slice(0,2000)).run();inserted++;
   }catch{return json({error:"Database import stopped; compare existing rows before retry",inserted,unchanged},409)}
  }
  return json({ok:true,inserted,unchanged,note:"Imported into Trinity private register only; no calendar invitations or emails sent."});
 }
 if(url.pathname==="/api/admin/bookings"&&req.method==="GET"){
  if(!(await adminAuthorized(req,env,ctx)))return json({error:"Unauthorized"},401);
  const b=await env.DB.prepare("SELECT id,slot_start,slot_end,name,email,state,calendar_event_id FROM appointment_bookings ORDER BY slot_start DESC LIMIT 150").all();return json({bookings:b.results||[]});
 }
 if(url.pathname==="/api/admin/policy"&&["GET","PUT"].includes(req.method)){
  if(!(await adminAuthorized(req,env,ctx)))return new Response("Unauthorized",{status:401,headers:{"www-authenticate":"Basic realm=\"Trinity Scheduling\"","cache-control":"no-store"}});
  if(req.method==="GET")return json(await policy(env));
  if(req.headers.get("Origin")!==url.origin)return json({error:"Invalid administrator origin"},403);
  let b;try{b=await req.json()}catch{return json({error:"Invalid policy"},400)}
  if(!b||typeof b!=="object"||Array.isArray(b)||!validWindows(b.windows)||!Number.isInteger(b.minNoticeHours)||b.minNoticeHours<1||b.minNoticeHours>720||!Number.isInteger(b.maxDays)||b.maxDays<1||b.maxDays>365)return json({error:"Invalid hours or notice"},400);
  await env.DB.prepare("INSERT INTO booking_policy (id,enabled,windows_json,min_notice_hours,max_days) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,windows_json=excluded.windows_json,min_notice_hours=excluded.min_notice_hours,max_days=excluded.max_days,updated_at=datetime('now')").bind(b.enabled===true?1:0,JSON.stringify(b.windows),b.minNoticeHours,b.maxDays).run();
  return json({ok:true,automaticBookingRequiresDeploymentFlag:true});
 }
 return json({error:"Not found"},404,origin);
}};
