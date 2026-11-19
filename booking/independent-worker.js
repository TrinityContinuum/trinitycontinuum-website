import {dispatchNotifications} from './notification-dispatcher.js';
// Trinity-owned appointment engine. Deploy as a NEW isolated Worker after migration.
// No Google Calendar, Google booking page, or third-party scheduling dependency.
// Required bindings: DB (D1), TURNSTILE_SECRET, TURNSTILE_SITEKEY, ADMIN_TOKEN.
// Booking confirmations are recorded immediately in Trinity D1; outbound email
// delivery is separate and must be configured before advertising email confirmations.
import { INITIAL_POLICY, classifySlot, TIME_ZONE } from './initial-policy.js';
import { normalizeBooking } from './booking-core.js';
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
async function available(env,input){
 const slot=parseSlot(input),p=await policy(env);
 return {slot,eligible:classifySlot(slot.starts_at,slot.ends_at,p)==='automatic_candidate'&&!await blocked(env.DB,slot.starts_at,slot.ends_at)};
}
async function book(req,env){
 if(!validOrigin(req,env))return json({error:'Origin not allowed'},403);
 if(!env.TURNSTILE_SECRET)return json({error:'Booking unavailable'},503);
 if(!(await policy(env)).automatic_enabled)return json({error:'Automatic booking is not enabled'},503);
 let input;try{input=await req.json();}catch{return json({error:'Invalid request'},400);}
 if(!await verifyTurnstile(req,env,input.turnstile_token))return json({error:'Security verification failed'},403);
 let b,slot;try{b=normalizeBooking(input);slot=parseSlot(input);}catch{return json({error:'Invalid booking details'},400);}
 if(b.starts_at!==slot.starts_at||b.ends_at!==slot.ends_at)return json({error:'Invalid slot'},400);
 if(!(await available(env,input)).eligible)return json({error:'Slot unavailable; please request an alternate time'},409);
 const bookingId=id(),parts=segments(slot.a,slot.b);
 const statements=[env.DB.prepare(`INSERT INTO automatic_bookings(id,slot_key,visitor_name,visitor_email,visitor_organization,topic,starts_at,ends_at,status,calendar_sync_status) VALUES(?,?,?,?,?,?,?,?, 'confirmed','pending')`).bind(bookingId,slot.starts_at,b.name,b.email,b.organization,b.topic,b.starts_at,b.ends_at),
 ...parts.map(t=>env.DB.prepare('INSERT INTO automatic_booking_slot_locks(slot_start,booking_id) VALUES(?,?)').bind(t,bookingId)),
 env.DB.prepare("INSERT INTO booking_actions(id,booking_id,actor,action) VALUES(?,?,'visitor','booked')").bind(id(),bookingId),
 env.DB.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'confirmation',?)").bind(id(),bookingId,b.email)];
 try{await env.DB.batch(statements);}catch(e){if(/unique|constraint/i.test(String(e)))return json({error:'Slot just booked; please choose another'},409);throw e;}
 return json({confirmed:true,booking_id:bookingId,starts_at:b.starts_at,ends_at:b.ends_at,time_zone:TIME_ZONE,notification_status:'pending'},201);
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
  if(booking.status!=='confirmed')return json({error:'Only confirmed appointments can receive a video link'},409);
  const statements=[env.DB.prepare("INSERT INTO booking_video_links(booking_id,meeting_url,instructions) VALUES(?,?,?) ON CONFLICT(booking_id) DO UPDATE SET meeting_url=excluded.meeting_url,instructions=excluded.instructions,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(bookingId,meetingUrl.href,instructions),
   env.DB.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'video_link',?) ON CONFLICT(booking_id,kind,recipient) DO UPDATE SET status='pending',attempts=0,provider_message_id=NULL").bind(id(),bookingId,booking.visitor_email),
   env.DB.prepare("INSERT INTO booking_actions(id,booking_id,actor,action,details_json) VALUES(?,?,'owner','video_link_updated',?)").bind(id(),bookingId,JSON.stringify({host:meetingUrl.hostname}))];
  await env.DB.batch(statements);
  return json({saved:true,meeting_url:meetingUrl.href,notification_status:'pending'});
 }
 if(req.method==='POST'&&url.pathname.endsWith('/cancel')){
  let body;try{body=await req.json();}catch{return json({error:'Invalid request'},400);}
  if(typeof body.booking_id!=='string'||!body.booking_id)return json({error:'Booking ID required'},400);
  const existing=await env.DB.prepare("SELECT id,status FROM automatic_bookings WHERE id=?").bind(body.booking_id).first();
  if(!existing)return json({error:'Booking not found'},404);
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
  let p;try{p=await req.json();const mod=await import('./booking-policy.js');p=mod.validPolicy(p);}catch{return json({error:'Invalid policy'},400);}
  await env.DB.prepare("INSERT INTO appointment_settings(key,value) VALUES('policy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(p)).run();
  return json({updated:true,policy:p});
 }
 return json({error:'Unknown owner action'},404);
}
export default {async scheduled(_event,env,ctx){ctx.waitUntil(dispatchNotifications(env));},async fetch(req,env){
 const response=await handle(req,env);
 if(validOrigin(req,env)){const headers=new Headers(response.headers);headers.set('access-control-allow-origin',req.headers.get('origin'));headers.set('vary','Origin');return new Response(response.body,{status:response.status,headers});}
 return response;
}};
async function handle(req,env){
 try{
  const origin=req.headers.get('origin')||'';
  if(req.method==='OPTIONS')return validOrigin(req,env)?new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, PUT','access-control-allow-headers':'content-type, authorization','access-control-max-age':'600','vary':'Origin'}}):new Response(null,{status:403});
  const url=new URL(req.url);
  if(url.pathname==='/api/health'&&req.method==='GET')return json({service:'trinity-independent-booking',status:'staged',automatic_enabled:(await policy(env)).automatic_enabled});
  if(url.pathname.startsWith('/api/owner/'))return owner(req,env,url);
  if(url.pathname==='/api/policy'&&req.method==='GET'){const p=await policy(env);return json({time_zone:TIME_ZONE,automatic_enabled:p.automatic_enabled,weekdays:p.weekdays,durations:[30,60]});}
  if(url.pathname==='/api/availability'&&req.method==='POST'){
   if(!validOrigin(req,env))return json({error:'Origin not allowed'},403);
   const input=await req.json();const result=await available(env,input);
   return json({available:result.eligible,time_zone:TIME_ZONE});
  }
  if(url.pathname==='/api/book'&&req.method==='POST')return book(req,env);
  return json({error:'Not found'},404);
 }catch(e){return json({error:'Request could not be completed'},500);}
}