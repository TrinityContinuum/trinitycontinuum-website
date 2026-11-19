// Booking policy for Trinity. Development only: no live schedule enabled by default.
// Store editable approved hours in D1; manual approval applies to every other time.
// The authoritative calendar free/busy check is separately required before booking.
export const TIME_ZONE='America/Chicago';
export const DEFAULT_POLICY={automatic_enabled:false,slot_minutes:30,min_notice_minutes:60,max_days_ahead:60,weekdays:{},blackouts:[]};
export function minutes(hhmm){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))throw Error('Invalid clock time');
 const [h,m]=hhmm.split(':').map(Number);return h*60+m;
}
export function validPolicy(p){
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
export function localParts(instant){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
 return Object.fromEntries(parts.map(x=>[x.type,x.value]));
}
export function classifySlot(startIso,endIso,policy,now=Date.now()){
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
