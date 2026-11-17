// STAGED ONLY — DO NOT DEPLOY until Google OAuth, owner-approved hours,
// Cloudflare Turnstile, D1 migrations, and security tests are complete.
// Trinity D1 is the authoritative booking register. Calendar is the invitation
// and conflict-checking transport. Default policy: NO automatic booking.
const ORIGINS=new Set(["https://trinitycontinuum.com","https://www.trinitycontinuum.com"]);
const ZONE="America/Chicago";
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
 const start=minutes(time),end=start+30;if(end>1440||start%30)return false;
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
async function freeBusy(env,token,start,end){
 const r=await fetch("https://www.googleapis.com/calendar/v3/freeBusy",{method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({timeMin:start.toISOString(),timeMax:end.toISOString(),items:[{id:env.GOOGLE_CALENDAR_ID}]})});
 const b=await r.json(),c=b.calendars?.[env.GOOGLE_CALENDAR_ID];
 if(!r.ok||!c||c.errors?.length||!Array.isArray(c.busy))throw Error("Calendar availability unavailable");
 return c.busy.length===0;
}
function basic(req,env){
 if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<24)return false;
 const header=req.headers.get("authorization")||"";
 if(!header.startsWith("Basic "))return false;
 let decoded;try{decoded=atob(header.slice(6))}catch{return false}
 return decoded==="jack:"+env.ADMIN_PASSWORD;
}
async function verifyTurnstile(req,env,token){
 if(!env.TURNSTILE_SECRET||!token)return false;
 const fd=new FormData();fd.set("secret",env.TURNSTILE_SECRET);fd.set("response",token);
 const ip=req.headers.get("CF-Connecting-IP");if(ip)fd.set("remoteip",ip);
 const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:fd});
 const v=await r.json();return !!v.success&&["trinitycontinuum.com","www.trinitycontinuum.com"].includes(v.hostname);
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
 return {eventId,meetLink:b.hangoutLink||"",htmlLink:b.htmlLink||""};
}
async function handleSlots(url,env,origin){
 const p=await policy(env);
 if(!p.enabled||env.DIRECT_BOOKING_ENABLED!=="true")return json({enabled:false,slots:[]},200,origin);
 const day=url.searchParams.get("date")||"";if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return json({error:"Choose a date"},400,origin);
 let tok;try{tok=await googleToken(env)}catch{return json({enabled:false,error:"Business calendar not ready"},503,origin)}
 const slots=[];for(let min=0;min<=1410;min+=30){
  const time=String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0");
  try{
   if(!slotWithin(day,time,p))continue;
   const start=fromLocal(day,time),end=new Date(start.getTime()+1800000);
   if(!inRange(start,p))continue;
   const reserved=await env.DB.prepare("SELECT id FROM appointment_bookings WHERE slot_start=? AND state IN ('processing','confirmed','needs_reconciliation')").bind(start.toISOString()).first();
   if(!reserved&&await freeBusy(env,tok,start,end))slots.push({time,zone:ZONE});
  }catch{/* Skip ambiguous or unavailable slots safely. */}
 }
 return json({enabled:true,date:day,timezone:ZONE,slots},200,origin);
}
async function handleBook(req,env,origin){
 if(env.DIRECT_BOOKING_ENABLED!=="true")return json({error:"Automatic booking not active; request approval"},503,origin);
 let body;try{body=await req.json()}catch{return json({error:"Invalid booking"},400,origin)}
 const id=String(body.id||""),day=String(body.date||""),time=String(body.time||"");
 const name=String(body.name||"").trim(),email=String(body.email||"").trim(),organization=String(body.organization||"").trim(),topic=String(body.topic||"").trim();
 if(!/^[0-9a-f-]{36}$/i.test(id)||name.length<2||name.length>120||organization.length>150||topic.length<3||topic.length>2500||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"Invalid details"},400,origin);
 if(!(await verifyTurnstile(req,env,String(body.turnstileToken||""))))return json({error:"Security verification failed"},403,origin);
 let start,end,p;
 try{p=await policy(env);if(!p.enabled||!slotWithin(day,time,p))return json({error:"This time needs Jack's approval"},409,origin);
 start=fromLocal(day,time);end=new Date(start.getTime()+1800000);
 if(!inRange(start,p))return json({error:"Outside booking window"},409,origin);
 }catch{return json({error:"Invalid or ambiguous time"},400,origin)}
 let token;try{token=await googleToken(env);if(!await freeBusy(env,token,start,end))return json({error:"Time no longer available"},409,origin)}
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
export default {async fetch(req,env){
 const url=new URL(req.url),origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return ORIGINS.has(origin)?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST,PUT,OPTIONS","access-control-allow-headers":"content-type,authorization"}}):new Response(null,{status:403});
 if(!env.DB)return json({error:"Private scheduling register unavailable"},503,origin);
 if(url.pathname==="/api/public/policy"&&req.method==="GET"){
  const p=await policy(env);return json({instantBookingEnabled:p.enabled&&env.DIRECT_BOOKING_ENABLED==="true",timezone:ZONE,minutes:30},200,origin);
 }
 if(url.pathname==="/api/public/slots"&&req.method==="GET"&&ORIGINS.has(origin))return handleSlots(url,env,origin);
 if(url.pathname==="/api/public/book"&&req.method==="POST"){
  if(!ORIGINS.has(origin))return json({error:"Forbidden origin"},403,origin);
  return handleBook(req,env,origin);
 }
 if(url.pathname==="/api/admin/policy"&&["GET","PUT"].includes(req.method)){
  if(!basic(req,env))return new Response("Unauthorized",{status:401,headers:{"www-authenticate":"Basic realm=\"Trinity Scheduling\"","cache-control":"no-store"}});
  if(req.method==="GET")return json(await policy(env));
  let b;try{b=await req.json()}catch{return json({error:"Invalid policy"},400)}
  if(!validWindows(b.windows)||!Number.isInteger(b.minNoticeHours)||b.minNoticeHours<1||b.minNoticeHours>720||!Number.isInteger(b.maxDays)||b.maxDays<1||b.maxDays>365)return json({error:"Invalid hours or notice"},400);
  await env.DB.prepare("INSERT INTO booking_policy (id,enabled,windows_json,min_notice_hours,max_days) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,windows_json=excluded.windows_json,min_notice_hours=excluded.min_notice_hours,max_days=excluded.max_days,updated_at=datetime('now')").bind(b.enabled===true?1:0,JSON.stringify(b.windows),b.minNoticeHours,b.maxDays).run();
  return json({ok:true,automaticBookingRequiresDeploymentFlag:true});
 }
 return json({error:"Not found"},404,origin);
}};
