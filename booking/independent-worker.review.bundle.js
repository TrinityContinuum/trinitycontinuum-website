// TRINITY CONTINUUM | single-module REVIEW BUILD | 2026-11-24
// NOT FOR PRODUCTION: automatic booking deliberately disabled pending acceptance.
// No credentials are embedded. Source modules are recorded below.

// SOURCE: booking-policy.js | blob 227bd0088d6f435d970b29785d22d4d5d8c225a2
// Booking policy for Trinity. Development only: no live schedule enabled by default.
// Store editable approved hours in D1; manual approval applies to every other time.
// The authoritative calendar free/busy check is separately required before booking.
const TIME_ZONE='America/Chicago';
const DEFAULT_POLICY={automatic_enabled:false,slot_minutes:30,min_notice_minutes:60,max_days_ahead:60,weekdays:{},blackouts:[]};
function minutes(hhmm){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))throw Error('Invalid clock time');
 const [h,m]=hhmm.split(':').map(Number);return h*60+m;
}
function validPolicy(p){
 if(!p||typeof p!=='object'||typeof p.automatic_enabled!=='boolean')throw Error('Invalid policy');
 if(p.slot_minutes!==30||!Number.isInteger(p.min_notice_minutes)||p.min_notice_minutes<15||p.min_notice_minutes>10080||!Number.isInteger(p.max_days_ahead)||p.max_days_ahead<1||p.max_days_ahead>365)throw Error('Invalid scheduling limits');
 if(!p.weekdays||typeof p.weekdays!=='object'||!Array.isArray(p.blackouts))throw Error('Invalid schedule');
 for(let day=0;day<7;day++){
  const periods=p.weekdays[String(day)]||[];
  if(!Array.isArray(periods)||periods.length>8)throw Error('Invalid day periods');
  let previous=0;
  for(const period of periods){
   if(!Array.isArray(period)||period.length!==2)throw Error('Invalid period');
   const a=minutes(period[0]),b=minutes(period[1]);
   if(a>=b||a<previous)throw Error('Overlapping or reversed hours');
   previous=b;
  }
 }
 for(const day of p.blackouts)if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Invalid blackout');
 return p;
}
function localParts(instant){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
 return Object.fromEntries(parts.map(x=>[x.type,x.value]));
}
function classifySlot(startIso,endIso,policy,now=Date.now()){
 const p=validPolicy(policy);
 const a=Date.parse(startIso),b=Date.parse(endIso);
 if(!Number.isFinite(a)||!Number.isFinite(b)||![30,60].includes((b-a)/60000))return 'invalid';
 if(a<now+p.min_notice_minutes*60000||a>now+p.max_days_ahead*86400000)return 'manual_approval';
 const s=localParts(a),e=localParts(b-1);
 const day=s.year+'-'+s.month+'-'+s.day;
 if(day!==e.year+'-'+e.month+'-'+e.day||p.blackouts.includes(day))return 'manual_approval';
 const weekday={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[s.weekday];
 const start=Number(s.hour)*60+Number(s.minute);
 const end=start+(b-a)/60000;
 if(start<13*60&&end>11*60+30)return 'manual_approval';
 if(!p.automatic_enabled)return 'manual_approval';
 return (p.weekdays[String(weekday)]||[]).some(([from,to])=>start>=minutes(from)&&end<=minutes(to))?'automatic_candidate':'manual_approval';
}
// IMPORTANT: 'automatic_candidate' is not a confirmation. Server must verify
// authoritative calendar free/busy and atomically reserve the slot first.


// SOURCE: initial-policy.js | blob 364588e56ebdd6e6f246e9252cfb7778b9092f43

// Jack's initial approved hours, effective only after live calendar integration
// and an authenticated administrator explicitly enables automatic booking.
const INITIAL_POLICY=validPolicy({
 ...DEFAULT_POLICY,
 automatic_enabled:false,
 weekdays:{
  "0":[],"1":[["13:30","16:30"]],"2":[["13:30","16:30"]],
  "3":[["13:30","16:30"]],"4":[["13:30","16:30"]],
  "5":[["13:30","16:30"]],"6":[]
 },
 blackouts:[]
});

// Outside these windows, route to existing approval-request flow.
// Never interpret the configured windows as confirmation of calendar availability.


// SOURCE: booking-core.js | blob 4441757dc04bf086b6ff5903f7800e61eefe11c8
// Isolated Cloudflare Worker booking core. NOT routed or deployed.
// Integrator must supply authenticated owner session, calendar free/busy adapter,
// email notification worker and Turnstile verification before enabling public booking.
const SLOT_MINUTES=30;
function validateSlot(start,end){
  const a=Date.parse(start),b=Date.parse(end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||![30,60].includes((b-a)/60000))throw Error('Invalid slot');
  if(a<Date.now()+15*60000)throw Error('Slot must be in the future');
  // Time-zone-aware availability and lunch exclusion belong to the authoritative
  // availability provider; never infer America/Chicago offset from UTC.
  return {starts_at:new Date(a).toISOString(),ends_at:new Date(b).toISOString()};
}
function normalizeBooking(input){
  if(!input||typeof input!=='object')throw Error('Missing request');
  const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase(),
    topic=String(input.topic||'').trim();
  if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||!topic||topic.length>2500)throw Error('Invalid contact details');
  const slot=validateSlot(input.starts_at,input.ends_at);
  return {...slot,name,email,topic,organization:String(input.organization||'').trim().slice(0,150)};
}
async function reserveSlot(db,input,{id,slotKey,calendarFree,turnstileVerified}){
  if(turnstileVerified!==true)throw Error('Security check required');
  const b=normalizeBooking(input);
  if(!id||!slotKey||typeof calendarFree!=='function')throw Error('Booking prerequisites unavailable');
  // Free/busy must be checked again server-side immediately before the insert.
  if(!await calendarFree(b.starts_at,b.ends_at))return {ok:false,reason:'unavailable'};
  // Reserve every occupied 30-minute segment in the same D1 transaction.
  // A 60-minute booking locks two segments, blocking overlapping 30-minute bookings.
  const segments=[];
  for(let t=Date.parse(b.starts_at);t<Date.parse(b.ends_at);t+=SLOT_MINUTES*60000)segments.push(new Date(t).toISOString());
  try{
    const statements=[db.prepare(`INSERT INTO automatic_bookings
      (id,slot_key,visitor_name,visitor_email,visitor_organization,topic,starts_at,ends_at,status)
      VALUES(?,?,?,?,?,?,?,?, 'pending_calendar')`)
      .bind(id,slotKey,b.name,b.email,b.organization,b.topic,b.starts_at,b.ends_at),
      ...segments.map(t=>db.prepare('INSERT INTO automatic_booking_slot_locks(slot_start,booking_id) VALUES(?,?)').bind(t,id))];
    await db.batch(statements);
  }catch(e){
    // The unique slot locks prevent overlapping reservations across durations.
    if(/unique|constraint/i.test(String(e)))return {ok:false,reason:'already_booked'};
    throw e;
  }
  // This is a D1 reservation only. A booking is NOT ready for customer-facing
  // automatic confirmation until the calendar event and notification outbox are
  // reconciled. Production integration must implement rollback/hold on sync failure.
  return {ok:true,id,status:'pending_calendar',confirmation_allowed:false};
}
async function ownerAction(db,{id,action,details={}},authenticatedPrincipal){
  // Authenticated principal must come from server-verified session middleware,
  // never from the caller's JSON body. Reject absent/unauthenticated sessions.
  if(authenticatedPrincipal?.verified!==true ||
     !['jack','authorized_admin'].includes(authenticatedPrincipal.role))
    throw Error('Owner authorization required');
  const transitions={
    cancel:{from:['confirmed','reschedule_proposed'],to:'cancelled'},
    propose:{from:['confirmed'],to:'reschedule_proposed'},
    mark_rescheduled:{from:['reschedule_proposed'],to:'rescheduled'}
  };
  const rule=transitions[action];
  if(!rule)throw Error('Unsupported owner action');
  const result=await db.prepare(`UPDATE automatic_bookings SET status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id=? AND status IN (${rule.from.map(()=>'?').join(',')})`)
    .bind(rule.to,id,...rule.from).run();
  if(result.meta?.changes!==1)return {ok:false,reason:'state_changed_or_missing'};
  // The caller must reconcile calendar changes, release slot locks only after
  // confirmed cancellation, and enqueue visitor notice in durable outbox.
  return {ok:true,id,status:rule.to,notification_required:true,calendar_update_required:true};
}


// SOURCE: calendar-adapter.js | blob ebb65577eff4a301cfe36de23757230ecff9b886
// Calendar transport adapter. Tokens are supplied by an authorized server-side
// provider; never expose authorization headers or raw provider errors to clients.
const BASE='https://www.googleapis.com/calendar/v3';
function calendarAdapter({getAccessToken, transport=fetch, calendarId='primary'}){
 if(typeof getAccessToken!=='function')throw Error('Authorized token provider required');
 const events='/calendars/'+encodeURIComponent(calendarId)+'/events';
 async function call(path,{method='GET',body}={}){
  const token=await getAccessToken();
  if(typeof token!=='string'||!token)throw Error('Calendar authorization unavailable');
  const response=await transport(BASE+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {status:response.status,data:null};
  return {status:response.status,data:response.status===204?null:await response.json()};
 }
 async function isFree(start,end){
  if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))throw Error('Invalid time interval');
  const {status,data}=await call('/freeBusy',{method:'POST',body:{timeMin:start,timeMax:end,items:[{id:calendarId}]}});
  const calendar=data?.calendars?.[calendarId];
  if(status!==200||!calendar||calendar.errors?.length||!Array.isArray(calendar.busy))throw Error('Calendar availability unavailable');
  return calendar.busy.length===0;
 }
 async function createMeeting({bookingId,start,end,email}){
  const eventId=String(bookingId).replaceAll('-','').toLowerCase();
  if(!/^[0-9a-v]{5,1024}$/.test(eventId)||!email)throw Error('Invalid booking identity');
  const body={id:eventId,summary:'Trinity Continuum appointment',start:{dateTime:start,timeZone:'America/Chicago'},end:{dateTime:end,timeZone:'America/Chicago'},attendees:[{email}],guestsCanInviteOthers:false,guestsCanSeeOtherGuests:false,conferenceData:{createRequest:{requestId:eventId,conferenceSolutionKey:{type:'hangoutsMeet'}}},extendedProperties:{private:{trinityBookingId:bookingId}}};
  let {status,data}=await call(events+'?conferenceDataVersion=1&sendUpdates=none',{method:'POST',body});
  if(status===409)({status,data}=await call(events+'/'+eventId));
  if(![200,201].includes(status)||data?.id!==eventId||data.extendedProperties?.private?.trinityBookingId!==bookingId)throw Error('Calendar event not verified');
  return verifiedMeeting(data);
 }
 function verifiedMeeting(data){
  const link=data.hangoutLink||data.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video')?.uri;
  const validLink=typeof link==='string'&&/^https:[/][/]meet[.]google[.]com[/][a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(link);
  return {eventId:data.id,meetUrl:validLink?link:null,ready:validLink&&data.status!=='cancelled',start:data.start?.dateTime,end:data.end?.dateTime};
 }
 async function getMeeting(bookingId){
  const eventId=String(bookingId).replaceAll('-','').toLowerCase();
  if(!/^[0-9a-v]{5,1024}$/.test(eventId))throw Error('Invalid booking identity');
  const {status,data}=await call(events+'/'+eventId);
  if(status!==200||data?.id!==eventId||data.extendedProperties?.private?.trinityBookingId!==bookingId||data.status==='cancelled')throw Error('Calendar event not verified');
  return verifiedMeeting(data);
 }
 return {isFree,createMeeting,getMeeting};
}


// SOURCE: google-token-provider.js | blob 4f40d51be500fa7f6664f29bf9e85c7c2c2e42fd
// Production token acquisition stays inside the Worker. Never log token responses.
function googleTokenProvider(env, transport=fetch){
 let cached=null, expiry=0, pending=null;
 return async function getAccessToken(){
  if(cached&&Date.now()<expiry)return cached;
  if(pending)return pending;
  pending=(async()=>{
   if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN)throw Error('Calendar authorization not configured');
   const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'});
   const response=await transport('https://oauth2.googleapis.com/token',{method:'POST',body,signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Calendar authorization unavailable');
   const data=await response.json();
   if(typeof data.access_token!=='string'||!data.access_token)throw Error('Calendar authorization unavailable');
   cached=data.access_token;
   expiry=Date.now()+Math.max(0,(Number(data.expires_in)||0)-60)*1000;
   return cached;
  })();
  try{return await pending;}finally{pending=null;}
 };
}


// SOURCE: session-service.js | blob 25b8a62543c5f94602f0d67c68c66e3bea64f42c


const formats=['one_on_one','private_group','open_group'];
function bookingOptions(input,env){
 const format=input.meeting_format||input.format||'open_group';
 const seats=Number(input.seats??1);
 const limit=Number(env.MEET_CONNECTION_LIMIT);
 const hosts=Number(env.MEET_HOST_CONNECTIONS||1);
 // No guessed capacity: a verified provider limit must be configured.
 if(!Number.isInteger(limit)||limit<2||limit>500||!Number.isInteger(hosts)||hosts<1||hosts>=limit)throw Error('Meeting capacity not verified');
 if(!formats.includes(format)||!Number.isInteger(seats)||seats<1||seats>limit-hosts||(format==='one_on_one'&&seats!==1))throw Error('Invalid meeting format or capacity');
 return {format,seats,capacity:limit-hosts};
}
function calendarFor(env){
 return calendarAdapter({getAccessToken:googleTokenProvider(env),calendarId:'jack@trinitycontinuum.com'});
}
async function sessionAt(env,slot){
 return env.DB.prepare(`SELECT s.*,h.status,h.calendar_sync_status,h.calendar_event_id,v.meeting_url,
 COALESCE((SELECT SUM(seats) FROM booking_session_members_v2 WHERE slot_start=s.slot_start),0) AS seats_used
 FROM booking_sessions_v2 s JOIN automatic_bookings h ON h.id=s.host_booking_id
 LEFT JOIN booking_video_links v ON v.booking_id=h.id WHERE s.slot_start=?`).bind(slot.starts_at).first();
}
function mayJoin(s,slot,opts){
 return !!s&&s.format==='open_group'&&opts.format==='open_group'&&s.slot_end===slot.ends_at&&s.status==='confirmed'&&s.calendar_sync_status==='synced'&&!!s.meeting_url&&Number(s.seats_used)+opts.seats<=Math.min(s.guest_capacity,opts.capacity);
}
const uuid=()=>crypto.randomUUID();
const insert=(db,b,slot,id,status,sync,eventId=null)=>db.prepare(`INSERT INTO automatic_bookings(id,slot_key,visitor_name,visitor_email,visitor_organization,topic,starts_at,ends_at,status,calendar_sync_status,calendar_event_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,slot.starts_at,b.name,b.email,b.organization,b.topic,slot.starts_at,slot.ends_at,status,sync,eventId);
const member=(db,id,slot,b,opts)=>db.prepare('INSERT INTO booking_session_members_v2(booking_id,slot_start,email,seats) VALUES(?,?,?,?)').bind(id,slot.starts_at,b.email,opts.seats);
const notifications=(db,id,b,link)=>[
 db.prepare('INSERT INTO booking_video_links(booking_id,meeting_url) VALUES(?,?)').bind(id,link),
 db.prepare("INSERT INTO booking_actions(id,booking_id,actor,action) VALUES(?,?,'visitor','booked')").bind(uuid(),id),
 db.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'confirmation',?)").bind(uuid(),id,b.email)
];
async function finishBooking(env,row,meeting){
 if(!meeting.ready||!meeting.meetUrl)return false;
 const db=env.DB;
 await db.batch([
 db.prepare("UPDATE automatic_bookings SET status='confirmed',calendar_sync_status='synced',calendar_event_id=? WHERE id=? AND status='pending_calendar'").bind(meeting.eventId,row.id),
 db.prepare('INSERT INTO booking_video_links(booking_id,meeting_url) VALUES(?,?) ON CONFLICT(booking_id) DO NOTHING').bind(row.id,meeting.meetUrl),
 db.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'confirmation',?) ON CONFLICT(booking_id,kind,recipient) DO NOTHING").bind(uuid(),row.id,row.visitor_email)
 ]);
 return true;
}
async function scheduleSession(env,b,slot,opts,calendar=calendarFor(env)){
 const db=env.DB;
 const s=await sessionAt(env,slot);
 const bookingId=uuid();
 if(s){
  if(!mayJoin(s,slot,opts))return {conflict:true};
  const live=await calendar.getMeeting(s.host_booking_id);
  if(!live.ready||live.meetUrl!==s.meeting_url||live.eventId!==s.calendar_event_id)return {conflict:true};
  await db.batch([insert(db,b,slot,bookingId,'confirmed','synced',live.eventId),member(db,bookingId,slot,b,opts),...notifications(db,bookingId,b,live.meetUrl)]);
  return {confirmed:true,booking_id:bookingId,meeting_url:live.meetUrl};
 }
 if(!await calendar.isFree(slot.starts_at,slot.ends_at))return {conflict:true};
 const locks=[];for(let t=slot.a;t<slot.b;t+=1800000)locks.push(db.prepare('INSERT INTO automatic_booking_slot_locks(slot_start,booking_id) VALUES(?,?)').bind(new Date(t).toISOString(),bookingId));
 await db.batch([insert(db,b,slot,bookingId,'pending_calendar','pending'),...locks,
 db.prepare('INSERT INTO booking_sessions_v2(slot_start,slot_end,host_booking_id,format,guest_capacity) VALUES(?,?,?,?,?)').bind(slot.starts_at,slot.ends_at,bookingId,opts.format,opts.capacity),
 member(db,bookingId,slot,b,opts)]);
 // The durable reservation survives provider failure. No false confirmation.
 try{
  if(!await calendar.isFree(slot.starts_at,slot.ends_at)){
   await db.batch([db.prepare("UPDATE automatic_bookings SET status='cancelled' WHERE id=? AND status='pending_calendar'").bind(bookingId),db.prepare('DELETE FROM booking_session_members_v2 WHERE booking_id=?').bind(bookingId),db.prepare('DELETE FROM booking_sessions_v2 WHERE host_booking_id=?').bind(bookingId),db.prepare('DELETE FROM automatic_booking_slot_locks WHERE booking_id=?').bind(bookingId)]);
   return {conflict:true};
  }
  const meeting=await calendar.createMeeting({bookingId,start:slot.starts_at,end:slot.ends_at,email:b.email});
  if(await finishBooking(env,{id:bookingId,visitor_email:b.email},meeting))return {confirmed:true,booking_id:bookingId,meeting_url:meeting.meetUrl};
 }catch{}
 return {confirmed:false,pending:true,booking_id:bookingId};
}
async function reconcileSessions(env){
 const calendar=calendarFor(env);
 const rows=await env.DB.prepare("SELECT b.id,b.visitor_email FROM automatic_bookings b JOIN booking_sessions_v2 s ON s.host_booking_id=b.id WHERE b.status='pending_calendar' ORDER BY b.created_at LIMIT 10").all();
 let completed=0;
 for(const row of rows.results||[]){try{if(await finishBooking(env,row,await calendar.getMeeting(row.id)))completed++;}catch{}}
 return {completed};
}


// SOURCE: notification-dispatcher.js | blob 661d1ea8a4edeba17922ff5fbc0175923419b096
// Durable Trinity booking notification dispatcher.
// Expects a separately authenticated corporate email gateway accepting POST JSON
// {to,subject,text,idempotency_key} and returning {message_id} after confirmed send.
// This does not assume Gmail or claim Namecheap access without gateway credentials.
const templates={
 confirmation:b=>({subject:'Trinity Continuum appointment confirmed',text:`Your appointment with Trinity Continuum is confirmed.\nReference: ${b.id}\nStart (UTC): ${b.starts_at}\nEnd (UTC): ${b.ends_at}\nTime zone: America/Chicago (Central)\nDiscussion: ${b.topic}\n${b.meeting_url ? 'Join video meeting: '+b.meeting_url : 'A video meeting link will be supplied separately.'}\nFor questions, contact jack@trinitycontinuum.com.`}),
 cancellation:b=>({subject:'Trinity Continuum appointment cancelled',text:`Your Trinity Continuum appointment has been cancelled.\nReference: ${b.id}\nContact jack@trinitycontinuum.com if you need another appointment.`}),
 video_link:b=>({subject:'Your Trinity Continuum video meeting link',text:`Your Trinity Continuum video appointment details:\nReference: ${b.id}\nStart (UTC): ${b.starts_at}\nJoin video meeting: ${b.meeting_url}\n${b.instructions||''}\nPlease keep this link private. Contact jack@trinitycontinuum.com with questions.`}),
 reschedule:b=>({subject:'Trinity Continuum appointment rescheduled',text:`Your Trinity Continuum appointment has been rescheduled.\nReference: ${b.id}\nNew start (UTC): ${b.starts_at}\nNew end (UTC): ${b.ends_at}\nTime zone: America/Chicago (Central)\nContact jack@trinitycontinuum.com with any questions.`})
};
async function dispatchNotifications(env,{limit=10}={}){
 if(!env.MAIL_GATEWAY_URL||!env.MAIL_GATEWAY_TOKEN)return {configured:false,processed:0};
 const rows=await env.DB.prepare(`SELECT n.id,n.kind,n.recipient,n.attempts,b.id AS booking_id,b.starts_at,b.ends_at,b.topic,v.meeting_url,v.instructions
 FROM booking_notifications n JOIN automatic_bookings b ON b.id=n.booking_id LEFT JOIN booking_video_links v ON v.booking_id=b.id
 WHERE n.status IN ('pending','failed') AND n.attempts<5 AND (n.kind<>'confirmation' OR (b.status='confirmed' AND (NOT EXISTS(SELECT 1 FROM booking_session_members_v2 m WHERE m.booking_id=b.id) OR (b.calendar_sync_status='synced' AND v.meeting_url IS NOT NULL)))) ORDER BY n.created_at LIMIT ?`).bind(Math.min(20,Math.max(1,limit))).all();
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


// SOURCE: independent-worker.js | blob 878ef685aedb05b4815116e5e3517b8cb4e36746


// Trinity-owned appointment engine. Deploy as a NEW isolated Worker after migration.
// No Google Calendar, Google booking page, or third-party scheduling dependency.
// Required bindings: DB (D1), TURNSTILE_SECRET, TURNSTILE_SITEKEY, ADMIN_TOKEN.
// Booking confirmations are recorded immediately in Trinity D1; outbound email
// delivery is separate and must be configured before advertising email confirmations.


const json=(data,status=200,origin='')=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}});
const validOrigin=(req,env)=>{const origin=req.headers.get('origin');return origin==='https://trinitycontinuum.com' || origin==='https://www.trinitycontinuum.com';};
const dayMinutes=30*60000;
const segments=(a,b)=>{const out=[];for(let t=a;t<b;t+=dayMinutes)out.push(new Date(t).toISOString());return out;};
const id=()=>crypto.randomUUID();
async function policy(env){const row=await env.DB.prepare("SELECT value FROM appointment_settings WHERE key='policy'").first();return row?JSON.parse(row.value):INITIAL_POLICY;}
async function blocked(db,starts,ends){
 const row=await db.prepare("SELECT COUNT(*) AS n FROM automatic_booking_slot_locks WHERE slot_start>=? AND slot_start<?").bind(starts,ends).first();
 return Number(row?.n||0)>0;
}
function parseSlot(input){
 const a=Date.parse(input?.starts_at),b=Date.parse(input?.ends_at);
 if(!Number.isFinite(a)||!Number.isFinite(b)||![30,60].includes((b-a)/60000)||a%(30*60000)!==0)throw Error('Invalid 30-minute boundary or duration');
 return {starts_at:new Date(a).toISOString(),ends_at:new Date(b).toISOString(),a,b};
}
async function verifyTurnstile(req,env,token){
 if(typeof token!=='string'||!token||!env.TURNSTILE_SECRET)return false;
 const form=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token});
 const ip=req.headers.get('CF-Connecting-IP');if(ip)form.set('remoteip',ip);
 const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});
 return result.ok&&(await result.json()).success===true;
}
function configured(env){return false;}
function requiredBindingsPresent(env){return !!(env.TURNSTILE_SECRET&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.GOOGLE_REFRESH_TOKEN&&env.MAIL_GATEWAY_URL&&env.MAIL_GATEWAY_TOKEN&&env.ADMIN_TOKEN&&env.MEET_CONNECTION_LIMIT);}
async function available(env,input){
 const slot=parseSlot(input),p=await policy(env);
 if(!configured(env)||classifySlot(slot.starts_at,slot.ends_at,p)!=='automatic_candidate'||slot.b-slot.a!==1800000)return {slot,eligible:false};
 const opts=bookingOptions(input,env);
 const s=await sessionAt(env,slot);
 return {slot,eligible:s?mayJoin(s,slot,opts):!await blocked(env.DB,slot.starts_at,slot.ends_at)&&await calendarFor(env).isFree(slot.starts_at,slot.ends_at)};
}
async function book(req,env){
 if(!validOrigin(req,env))return json({error:'Origin not allowed'},403);
 if(!configured(env)||!(await policy(env)).automatic_enabled)return json({error:'Automatic booking unavailable; please request an appointment manually'},503);
 let input,b,slot,opts;
 try{input=await req.json();b=normalizeBooking(input);slot=parseSlot(input);opts=bookingOptions(input,env);}catch{return json({error:'Invalid booking details'},400);}
 if(!await verifyTurnstile(req,env,input.turnstile_token))return json({error:'Security verification failed'},403);
 if(slot.b-slot.a!==1800000||classifySlot(slot.starts_at,slot.ends_at,await policy(env))!=='automatic_candidate')return json({error:'Outside automatic hours; request manual approval'},409);
 let result;
 try{result=await scheduleSession(env,b,slot,opts);}catch(e){if(/unique|constraint|capacity exceeded/i.test(String(e)))return json({error:'Slot unavailable or already booked'},409);throw e;}
 if(result.conflict)return json({error:'Slot unavailable'},409);
 return json({...result,starts_at:slot.starts_at,ends_at:slot.ends_at,time_zone:TIME_ZONE,notification_status:result.confirmed?'pending':'not_confirmed'},result.confirmed?201:202);
}
async function owner(req,env,url){
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
 if(!env.ADMIN_TOKEN||!token||token.length!==env.ADMIN_TOKEN.length)return json({error:'Unauthorized'},401);
 const a=new TextEncoder().encode(token),b=new TextEncoder().encode(env.ADMIN_TOKEN);
 let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];if(difference!==0)return json({error:'Unauthorized'},401);
 if(req.method==='GET'&&url.pathname.endsWith('/policy'))return json({policy:await policy(env)});
 if(req.method==='POST'&&url.pathname.endsWith('/dispatch-notifications'))return json(await dispatchNotifications(env));
 if(req.method==='GET'&&url.pathname.endsWith('/bookings')){
  const data=await env.DB.prepare('SELECT b.id,b.visitor_name,b.visitor_email,b.visitor_organization,b.topic,b.starts_at,b.ends_at,b.status,v.meeting_url,v.instructions FROM automatic_bookings b LEFT JOIN booking_video_links v ON v.booking_id=b.id ORDER BY b.starts_at DESC LIMIT 100').all();
  return json({bookings:data.results});
 }
 if(req.method==='POST'&&url.pathname.endsWith('/video-link')){
  let body;try{body=await req.json();}catch{return json({error:'Invalid request'},400);}
  const bookingId=String(body.booking_id||'');
  let meetingUrl;try{meetingUrl=new URL(String(body.meeting_url||''));}catch{return json({error:'Enter a valid HTTPS video meeting link'},400);}
  if(meetingUrl.protocol!=='https:'||meetingUrl.username||meetingUrl.password||meetingUrl.href.length>2048)return json({error:'A secure HTTPS meeting link is required'},400);
  const instructions=String(body.instructions||'').trim();if(instructions.length>2000)return json({error:'Instructions too long'},400);
  const booking=await env.DB.prepare('SELECT id,status,visitor_email FROM automatic_bookings WHERE id=?').bind(bookingId).first();
  if(!booking)return json({error:'Booking not found'},404);
  if(await env.DB.prepare('SELECT booking_id FROM booking_session_members_v2 WHERE booking_id=?').bind(bookingId).first())return json({error:'Calendar-linked video URL cannot be manually replaced'},409);
  if(booking.status!=='confirmed')return json({error:'Only confirmed appointments can receive a video link'},409);
  const statements=[env.DB.prepare("INSERT INTO booking_video_links(booking_id,meeting_url,instructions) VALUES(?,?,?) ON CONFLICT(booking_id) DO UPDATE SET meeting_url=excluded.meeting_url,instructions=excluded.instructions,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(bookingId,meetingUrl.href,instructions),
   env.DB.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'video_link',?) ON CONFLICT(booking_id,kind,recipient) DO UPDATE SET status='pending',attempts=0,provider_message_id=NULL").bind(id(),bookingId,booking.visitor_email),
   env.DB.prepare("INSERT INTO booking_actions(id,booking_id,actor,action,details_json) VALUES(?,?,'owner','rebook_invited',?)").bind(id(),bookingId,JSON.stringify({host:meetingUrl.hostname}))];
  await env.DB.batch(statements);
  return json({saved:true,meeting_url:meetingUrl.href,notification_status:'pending'});
 }
 if(req.method==='POST'&&url.pathname.endsWith('/cancel')){
  let body;try{body=await req.json();}catch{return json({error:'Invalid request'},400);}
  if(typeof body.booking_id!=='string'||!body.booking_id)return json({error:'Booking ID required'},400);
  const existing=await env.DB.prepare("SELECT id,status FROM automatic_bookings WHERE id=?").bind(body.booking_id).first();
  if(!existing)return json({error:'Booking not found'},404);
  if(await env.DB.prepare('SELECT booking_id FROM booking_session_members_v2 WHERE booking_id=?').bind(body.booking_id).first())return json({error:'Calendar-linked cancellation requires coordinated administrator action'},409);
  if(existing.status==='cancelled')return json({cancelled:true,already_cancelled:true});
  if(existing.status!=='confirmed')return json({error:'Booking is not cancellable'},409);
  const actions=[env.DB.prepare("UPDATE automatic_bookings SET status='cancelled',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='confirmed'").bind(body.booking_id),
   env.DB.prepare('DELETE FROM automatic_booking_slot_locks WHERE booking_id=?').bind(body.booking_id),
   env.DB.prepare("INSERT INTO booking_actions(id,booking_id,actor,action) VALUES(?,?,'owner','cancelled')").bind(id(),body.booking_id),
   env.DB.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) SELECT ?,id,'cancellation',visitor_email FROM automatic_bookings WHERE id=?").bind(id(),body.booking_id)];
  try{await env.DB.batch(actions);}catch{return json({error:'Cancellation failed'},500);}
  return json({cancelled:true,notification_status:'pending'});
 }
 if(req.method==='POST'&&url.pathname.endsWith('/reschedule')){
  let body,slot;try{body=await req.json();slot=parseSlot(body);}catch{return json({error:'Invalid rescheduling request'},400);}
  if(typeof body.booking_id!=='string'||!body.booking_id)return json({error:'Booking ID required'},400);
  const current=await env.DB.prepare('SELECT * FROM automatic_bookings WHERE id=?').bind(body.booking_id).first();
  if(!current)return json({error:'Booking not found'},404);
  if(await env.DB.prepare('SELECT booking_id FROM booking_session_members_v2 WHERE booking_id=?').bind(body.booking_id).first())return json({error:'Calendar-linked rescheduling requires coordinated administrator action'},409);
  if(current.status!=='confirmed')return json({error:'Only confirmed appointments can be moved'},409);
  if(classifySlot(slot.starts_at,slot.ends_at,await policy(env))!=='automatic_candidate')return json({error:'New time is outside automatic hours'},409);
  const conflict=await env.DB.prepare('SELECT COUNT(*) AS n FROM automatic_booking_slot_locks WHERE slot_start>=? AND slot_start<? AND booking_id<>?').bind(slot.starts_at,slot.ends_at,current.id).first();
  if(Number(conflict?.n||0)>0)return json({error:'New time is not available'},409);
  const oldStarts=current.starts_at,oldEnds=current.ends_at;
  if(slot.starts_at===oldStarts&&slot.ends_at===oldEnds)return json({rescheduled:true,unchanged:true});
  const newLocks=segments(slot.a,slot.b),oldLocks=segments(Date.parse(oldStarts),Date.parse(oldEnds));
  const statements=[...newLocks.filter(t=>!oldLocks.includes(t)).map(t=>env.DB.prepare('INSERT INTO automatic_booking_slot_locks(slot_start,booking_id) VALUES(?,?)').bind(t,current.id)),
   env.DB.prepare("UPDATE automatic_bookings SET starts_at=?,ends_at=?,slot_key=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='confirmed' AND starts_at=? AND ends_at=?").bind(slot.starts_at,slot.ends_at,slot.starts_at,current.id,oldStarts,oldEnds),
   ...oldLocks.filter(t=>!newLocks.includes(t)).map(t=>env.DB.prepare('DELETE FROM automatic_booking_slot_locks WHERE slot_start=? AND booking_id=?').bind(t,current.id)),
   env.DB.prepare("INSERT INTO booking_actions(id,booking_id,actor,action,details_json) VALUES(?,?,'owner','rescheduled',?)").bind(id(),current.id,JSON.stringify({from:oldStarts,to:slot.starts_at})),
   env.DB.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'reschedule',?) ON CONFLICT(booking_id,kind,recipient) DO UPDATE SET status='pending',attempts=0,provider_message_id=NULL").bind(id(),current.id,current.visitor_email)];
  try{await env.DB.batch(statements);}catch(e){if(/unique|constraint/i.test(String(e)))return json({error:'New time is no longer available'},409);return json({error:'Rescheduling failed'},500);}
  return json({rescheduled:true,starts_at:slot.starts_at,ends_at:slot.ends_at,notification_status:'pending'});
 }
 if(req.method==='PUT'&&url.pathname.endsWith('/policy')){
  let p;try{p=await req.json();p=validPolicy(p);}catch{return json({error:'Invalid policy'},400);}
  await env.DB.prepare("INSERT INTO appointment_settings(key,value) VALUES('policy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(p)).run();
  return json({updated:true,policy:p});
 }
 return json({error:'Unknown owner action'},404);
}
export default {async scheduled(_event,env,ctx){ctx.waitUntil((async()=>{if(configured(env))await reconcileSessions(env);await dispatchNotifications(env);})());},async fetch(req,env){
 const response=await handle(req,env);
 if(validOrigin(req,env)){const headers=new Headers(response.headers);headers.set('access-control-allow-origin',req.headers.get('origin'));headers.set('vary','Origin');return new Response(response.body,{status:response.status,headers});}
 return response;
}};
async function handle(req,env){
 try{
  const origin=req.headers.get('origin')||'';
  if(req.method==='OPTIONS')return validOrigin(req,env)?new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, PUT','access-control-allow-headers':'content-type, authorization','access-control-max-age':'600','vary':'Origin'}}):new Response(null,{status:403});
  const url=new URL(req.url);
  if(url.pathname==='/api/health'&&req.method==='GET')return json({service:'trinity-independent-booking',status:'integration_review',automatic_enabled:configured(env)&&(await policy(env)).automatic_enabled});
  if(url.pathname.startsWith('/api/owner/'))return owner(req,env,url);
  if(url.pathname==='/api/policy'&&req.method==='GET'){const p=await policy(env);return json({time_zone:TIME_ZONE,automatic_enabled:configured(env)&&p.automatic_enabled,weekdays:p.weekdays,durations:[30],meeting_formats:['one_on_one','private_group','open_group']});}
  if(url.pathname==='/api/availability'&&req.method==='POST'){
   if(!validOrigin(req,env))return json({error:'Origin not allowed'},403);
   const input=await req.json();const result=await available(env,input);
   return json({available:result.eligible,time_zone:TIME_ZONE});
  }
  if(url.pathname==='/api/book'&&req.method==='POST')return book(req,env);
  return json({error:'Not found'},404);
 }catch(e){return json({error:'Request could not be completed'},500);}
}