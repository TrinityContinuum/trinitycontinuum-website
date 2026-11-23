/* Trinity Continuum scheduling rules. No network calls or calendar writes.
   All inputs to evaluateSlot must be normalized to the owner's time zone
   (America/Chicago) by the trusted server. Never confirm a booking client-side. */
export const TIME_ZONE = 'America/Chicago';
export const MODES = Object.freeze(['early_approval','instant','late_approval']);
export const DEFAULT_WEEK = Object.freeze(Array.from({length:7},(_,day)=>({
  day, windows: day===0||day===6 ? [] : [
    {mode:'early_approval',start:'06:00',end:'09:00'},
    {mode:'instant',start:'09:00',end:'17:00'},
    {mode:'late_approval',start:'17:00',end:'21:00'}
  ]
})));
const minute = value => {
  if(typeof value!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) throw Error('Invalid local time');
  const [h,m]=value.split(':').map(Number); return h*60+m;
};
export function validateWeek(week) {
  if(!Array.isArray(week)||week.length!==7) throw Error('Seven days required');
  for(let day=0;day<7;day++){
    const item=week[day];
    if(item.day!==day||!Array.isArray(item.windows)) throw Error('Invalid day');
    for(const w of item.windows){
      if(!MODES.includes(w.mode)||minute(w.start)>=minute(w.end)) throw Error('Invalid window');
    }
    const sorted=[...item.windows].sort((a,b)=>minute(a.start)-minute(b.start));
    for(let i=1;i<sorted.length;i++)
      if(minute(sorted[i-1].end)>minute(sorted[i].start)) throw Error('Overlapping windows');
  }
  return true;
}
export function evaluateSlot({week,weekday,start,end,overrides=null,busy=[],bufferMinutes=15,lunchBlocked=true}){
  validateWeek(week);
  if(!Number.isInteger(weekday)||weekday<0||weekday>6) throw Error('Invalid weekday');
  const from=minute(start),to=minute(end);
  if(from>=to||to-from>240) throw Error('Invalid appointment duration');
  if(!Number.isInteger(bufferMinutes)||bufferMinutes<0||bufferMinutes>120) throw Error('Invalid buffer');
  // Explicit [] means a date is closed. Null means use the weekly template.
  const windows=overrides===null?week[weekday].windows:overrides;
  if(!Array.isArray(windows)) throw Error('Invalid date override');
  for(const w of windows){if(!MODES.includes(w.mode)||minute(w.start)>=minute(w.end)) throw Error('Invalid date window');}
  if(lunchBlocked && from<13*60 && to>11*60+30) return {status:'unavailable',reason:'lunch_block'};
  const matching=windows.find(w=>from>=minute(w.start)&&to<=minute(w.end));
  if(!matching) return {status:'unavailable'};
  for(const b of busy){
    if(from<minute(b.end)+bufferMinutes && to>minute(b.start)-bufferMinutes)
      return {status:'unavailable',reason:'calendar_conflict'};
  }
  return {status:matching.mode==='instant'?'instant_eligible':'approval_required',mode:matching.mode};
}
/* The server must additionally verify identity, date overrides, Google Calendar
   free/busy, and atomically reserve a slot before it sends any confirmation.
   Requests and instant bookings must use idempotency keys and durable records. */
