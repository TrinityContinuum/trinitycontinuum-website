// Isolated Cloudflare Worker booking core. NOT routed or deployed.
// Integrator must supply authenticated owner session, calendar free/busy adapter,
// email notification worker and Turnstile verification before enabling public booking.
export const SLOT_MINUTES=30;
export function validateSlot(start,end){
  const a=Date.parse(start),b=Date.parse(end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b-a!==SLOT_MINUTES*60000)throw Error('Invalid slot');
  if(a<Date.now()+15*60000)throw Error('Slot must be in the future');
  // Time-zone-aware availability and lunch exclusion belong to the authoritative
  // availability provider; never infer America/Chicago offset from UTC.
  return {starts_at:new Date(a).toISOString(),ends_at:new Date(b).toISOString()};
}
export function normalizeBooking(input){
  if(!input||typeof input!=='object')throw Error('Missing request');
  const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase(),
    topic=String(input.topic||'').trim();
  if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||!topic||topic.length>2500)throw Error('Invalid contact details');
  const slot=validateSlot(input.starts_at,input.ends_at);
  return {...slot,name,email,topic,organization:String(input.organization||'').trim().slice(0,150)};
}
export async function reserveSlot(db,input,{id,slotKey,calendarFree,turnstileVerified}){
  if(turnstileVerified!==true)throw Error('Security check required');
  const b=normalizeBooking(input);
  if(!id||!slotKey||typeof calendarFree!=='function')throw Error('Booking prerequisites unavailable');
  // Free/busy must be checked again server-side immediately before the insert.
  if(!await calendarFree(b.starts_at,b.ends_at))return {ok:false,reason:'unavailable'};
  try{
    await db.prepare(`INSERT INTO automatic_bookings
      (id,slot_key,visitor_name,visitor_email,visitor_organization,topic,starts_at,ends_at,status)
      VALUES(?,?,?,?,?,?,?,?, 'confirmed')`)
      .bind(id,slotKey,b.name,b.email,b.organization,b.topic,b.starts_at,b.ends_at).run();
  }catch(e){
    // Unique active slot prevents duplicate bookings during concurrent requests.
    if(/unique|constraint/i.test(String(e)))return {ok:false,reason:'already_booked'};
    throw e;
  }
  // This is a D1 reservation only. A booking is NOT ready for customer-facing
  // automatic confirmation until the calendar event and notification outbox are
  // reconciled. Production integration must implement rollback/hold on sync failure.
  return {ok:true,id,status:'calendar_sync_pending'};
}
export async function ownerAction(db,{id,action,actor,details={}}){
  if(actor!=='jack'&&actor!=='authorized_admin')throw Error('Owner authorization required');
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
  // The caller must enqueue visitor notice and calendar update in durable outbox.
  return {ok:true,id,status:rule.to,notification_required:true,calendar_update_required:true};
}
