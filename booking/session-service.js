import {calendarAdapter} from './calendar-adapter.js';
import {googleTokenProvider} from './google-token-provider.js';
const formats=['one_on_one','private_group','open_group'];
export function bookingOptions(input,env){
 const format=input.meeting_format||input.format||'open_group';
 const seats=Number(input.seats??1);
 const limit=Number(env.MEET_CONNECTION_LIMIT);
 const hosts=Number(env.MEET_HOST_CONNECTIONS||1);
 // No guessed capacity: a verified provider limit must be configured.
 if(!Number.isInteger(limit)||limit<2||limit>500||!Number.isInteger(hosts)||hosts<1||hosts>=limit)throw Error('Meeting capacity not verified');
 if(!formats.includes(format)||!Number.isInteger(seats)||seats<1||seats>limit-hosts||(format==='one_on_one'&&seats!==1))throw Error('Invalid meeting format or capacity');
 return {format,seats,capacity:limit-hosts};
}
export function calendarFor(env){
 return calendarAdapter({getAccessToken:googleTokenProvider(env),calendarId:'jack@trinitycontinuum.com'});
}
export async function sessionAt(env,slot){
 return env.DB.prepare(`SELECT s.*,h.status,h.calendar_sync_status,h.calendar_event_id,v.meeting_url,
 COALESCE((SELECT SUM(seats) FROM booking_session_members_v2 WHERE slot_start=s.slot_start),0) AS seats_used
 FROM booking_sessions_v2 s JOIN automatic_bookings h ON h.id=s.host_booking_id
 LEFT JOIN booking_video_links v ON v.booking_id=h.id WHERE s.slot_start=?`).bind(slot.starts_at).first();
}
export function mayJoin(s,slot,opts){
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
export async function finishBooking(env,row,meeting){
 if(!meeting.ready||!meeting.meetUrl)return false;
 const db=env.DB;
 await db.batch([
 db.prepare("UPDATE automatic_bookings SET status='confirmed',calendar_sync_status='synced',calendar_event_id=? WHERE id=? AND status='pending_calendar'").bind(meeting.eventId,row.id),
 db.prepare('INSERT INTO booking_video_links(booking_id,meeting_url) VALUES(?,?) ON CONFLICT(booking_id) DO NOTHING').bind(row.id,meeting.meetUrl),
 db.prepare("INSERT INTO booking_notifications(id,booking_id,kind,recipient) VALUES(?,?,'confirmation',?) ON CONFLICT(booking_id,kind,recipient) DO NOTHING").bind(uuid(),row.id,row.visitor_email)
 ]);
 return true;
}
export async function scheduleSession(env,b,slot,opts,calendar=calendarFor(env)){
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
export async function reconcileSessions(env){
 const calendar=calendarFor(env);
 const rows=await env.DB.prepare("SELECT b.id,b.visitor_email FROM automatic_bookings b JOIN booking_sessions_v2 s ON s.host_booking_id=b.id WHERE b.status='pending_calendar' ORDER BY b.created_at LIMIT 10").all();
 let completed=0;
 for(const row of rows.results||[]){try{if(await finishBooking(env,row,await calendar.getMeeting(row.id)))completed++;}catch{}}
 return {completed};
}
