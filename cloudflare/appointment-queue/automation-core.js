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
export async function runApproval(req,env,approver){
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
export function automationStatus(env){
 return {enabled:allowedAutomation(env),missing:missing(env),activationRequired:env.APPROVAL_AUTOMATION_ENABLED!=="true"};
}
