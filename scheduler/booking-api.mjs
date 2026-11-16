import {DEFAULT_WEEK,evaluateSlot} from './booking-rules.mjs';
import {calendarBusy,calendarConfigured,createMeeting} from './google-calendar-adapter.mjs';
import {mailConfigured,sendBookingMail} from './namecheap-mail-adapter.mjs';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const tz='America/Chicago',fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'});
function local(iso){const parts=Object.fromEntries(fmt.formatToParts(new Date(iso)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute,weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday)};}
function cells(start,end){const a=Math.floor((Date.parse(start)-15*60000)/900000),b=Math.ceil((Date.parse(end)+15*60000)/900000);return Array.from({length:b-a},(_,i)=>new Date((a+i)*900000).toISOString());}
const safe=s=>typeof s==='string'?s.trim():'';
export async function bookingApi(req,env){
 if(!env.DB)return respond({error:'Database unavailable'},503);
 const url=new URL(req.url);
 if(url.pathname==='/api/scheduler/capabilities'&&req.method==='GET')return respond({timezone:tz,calendar_connected:calendarConfigured(env),mail_connected:mailConfigured(env),instant_booking_ready:calendarConfigured(env)&&mailConfigured(env)});
 if(url.pathname!=='/api/scheduler/book'||req.method!=='POST')return respond({error:'Not found'},404);
 if(!(req.headers.get('content-type')||'').startsWith('application/json'))return respond({error:'JSON required'},415);
 let x;try{x=await req.json()}catch{return respond({error:'Invalid JSON'},400)}
 const name=safe(x?.name).slice(0,120),email=safe(x?.email).slice(0,200),org=safe(x?.organization).slice(0,150),topic=safe(x?.topic).slice(0,500);
 const start=Date.parse(x?.start),end=Date.parse(x?.end);
 if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isFinite(start)||!Number.isFinite(end)||end-start!==30*60000||start<Date.now()+3600000||start>Date.now()+90*86400000)return respond({error:'Invalid appointment request'},400);
 const key=safe(req.headers.get('Idempotency-Key'));if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key))return respond({error:'Idempotency-Key required'},400);
 const startIso=new Date(start).toISOString(),endIso=new Date(end).toISOString(),a=local(startIso),b=local(endIso);
 if(a.date!==b.date)return respond({error:'Appointments must stay within one local day'},400);
 try{
  const previous=await env.DB.prepare('SELECT id,status,google_meet_url FROM scheduler_bookings WHERE idempotency_key=?').bind(key).first();
  if(previous)return respond({booking_id:previous.id,status:previous.status,meet_url:previous.google_meet_url||null});
  const setting=await env.DB.prepare("SELECT setting_value FROM scheduler_settings WHERE setting_key='booking_mode'").first();
  const override=await env.DB.prepare('SELECT windows_json FROM scheduler_date_overrides WHERE local_date=?').bind(a.date).first();
  const windows=override?JSON.parse(override.windows_json):null;
  let slot=evaluateSlot({week:DEFAULT_WEEK,weekday:a.weekday,start:a.time,end:b.time,overrides:windows});
  if(slot.status==='unavailable')return respond({error:'Time unavailable',reason:slot.reason||'outside_hours'},409);
  const automatic=setting?.setting_value==='automatic'&&slot.status==='instant_eligible'&&calendarConfigured(env)&&mailConfigured(env);
  // Fail closed if calendar cannot be read. Never offer instant confirmation from stale data.
  if(automatic){
   const busy=await calendarBusy(env,new Date(start-15*60000).toISOString(),new Date(end+15*60000).toISOString());
   if(busy.some(v=>Date.parse(v.start)<end+15*60000&&Date.parse(v.end)>start-15*60000))return respond({error:'Calendar conflict'},409);
  }
  const id=crypto.randomUUID(),status=automatic?'reserved':'approval_pending',mode=slot.mode;
  const insert=env.DB.prepare('INSERT INTO scheduler_bookings(id,idempotency_key,requester_name,requester_email,organization,topic,start_utc,end_utc,mode,status) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,key,name,email,org,topic,startIso,endIso,mode,status);
  // Atomic D1 batch: a concurrent booking that claims any same 15-minute cell fails.
  if(automatic){
   const claims=cells(startIso,endIso).map(t=>env.DB.prepare('INSERT INTO scheduler_slot_claims(cell_start_utc,booking_id) VALUES(?,?)').bind(t,id));
   await env.DB.batch([insert,...claims]);
  }else await insert.run();
  if(!automatic)return respond({booking_id:id,status:'approval_pending',message:'Request received; appointment not yet confirmed'},202);
  try{
   const event=await createMeeting(env,{id,organization:org,topic,requester_email:email,start_utc:startIso,end_utc:endIso});
   const meet=event.hangoutLink||event.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video')?.uri||null;
   await env.DB.prepare("UPDATE scheduler_bookings SET status='calendar_created',google_event_id=?,google_meet_url=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(event.id,meet,id).run();
   try{
    const sent=await sendBookingMail(env,{to:email,subject:'Trinity Continuum appointment confirmation',body:'Your meeting is confirmed for '+a.date+' at '+a.time+' Central. '+(meet?'Google Meet: '+meet:''),idempotencyKey:'booking-'+id});
    await env.DB.prepare("UPDATE scheduler_bookings SET status='confirmation_sent',confirmation_provider_id=? WHERE id=?").bind(String(sent.id||sent.message_id||''),id).run();
    return respond({booking_id:id,status:'confirmed',meet_url:meet},201);
   }catch{return respond({booking_id:id,status:'calendar_created',message:'Calendar event created; email confirmation needs retry'},202)}
  }catch{return respond({booking_id:id,status:'reserved',message:'Booking reserved; calendar creation needs recovery'},202)}
 }catch(e){
  if(String(e.message).includes('UNIQUE')||String(e.message).includes('constraint'))return respond({error:'Slot already reserved; choose another time'},409);
  return respond({error:'Booking temporarily unavailable; no confirmation issued'},503);
 }
}
