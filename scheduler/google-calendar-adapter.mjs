// Trinity scheduling calendar adapter. No credentials are stored in source control.
// GOOGLE_CALENDAR_ACCESS_TOKEN is a short-lived token, suitable for staging only.
// Production should replace token retrieval with secure refresh-token management.
const calendarId = env => encodeURIComponent(env.GOOGLE_CALENDAR_ID || 'primary');
const token = env => env.GOOGLE_CALENDAR_ACCESS_TOKEN;
export function calendarConfigured(env){return Boolean(token(env));}
async function google(env,path,options={}){
 if(!calendarConfigured(env))throw Error('calendar_not_configured');
 const response=await fetch('https://www.googleapis.com/calendar/v3/calendars/'+calendarId(env)+path,{
  ...options,headers:{authorization:'Bearer '+token(env),'content-type':'application/json',...(options.headers||{})}
 });
 if(!response.ok)throw Error('calendar_http_'+response.status);
 return response.status===204?{}:response.json();
}
export async function calendarBusy(env,start,end){
 const data=await google(env,'/events?singleEvents=true&orderBy=startTime&timeMin='+encodeURIComponent(start)+'&timeMax='+encodeURIComponent(end)+'&maxResults=250');
 if(data.nextPageToken)throw Error('calendar_pagination_requires_review');
 return (data.items||[]).filter(x=>x.status!=='cancelled'&&x.transparency!=='transparent').map(x=>({
  start:x.start?.dateTime||x.start?.date,end:x.end?.dateTime||x.end?.date
 })).filter(x=>x.start&&x.end);
}
export async function createMeeting(env,booking){
 // Deterministic Google event ID makes retries idempotent.
 const eventId='tc'+booking.id.replace(/[^a-z0-9]/gi,'').toLowerCase();
 const body={
  id:eventId,summary:'Trinity Continuum | '+(booking.organization||'Introductory meeting'),
  description:'Topic: '+(booking.topic||'Introduction')+'\\nBooking reference: '+booking.id,
  start:{dateTime:booking.start_utc,timeZone:'America/Chicago'},
  end:{dateTime:booking.end_utc,timeZone:'America/Chicago'},
  attendees:[{email:booking.requester_email}],
  conferenceData:{createRequest:{requestId:eventId,conferenceSolutionKey:{type:'hangoutsMeet'}}}
 };
 try{
  return await google(env,'/events?conferenceDataVersion=1&sendUpdates=all',{method:'POST',body:JSON.stringify(body)});
 }catch(e){
  if(String(e.message)==='calendar_http_409')return google(env,'/events/'+eventId);
  throw e;
 }
}

export async function cancelMeeting(env,eventId){
 if(!/^[a-z0-9_]{5,1024}$/.test(eventId))throw Error('invalid_google_event_id');
 try { await google(env,'/events/'+encodeURIComponent(eventId)+'?sendUpdates=all',{method:'DELETE'}); return {cancelled:true}; }
 catch(e){ if(['calendar_http_404','calendar_http_410'].includes(String(e.message)))return {cancelled:true,already_absent:true}; throw e; }
}

/** Read-only event inspection for reconciliation. A 404/410 is an observed absence,
 * not proof that an attendee received a cancellation notification. */
export async function inspectMeeting(env,eventId){
 if(!/^[a-z0-9_]{5,1024}$/.test(eventId))throw Error('invalid_google_event_id');
 try{
  const event=await google(env,'/events/'+encodeURIComponent(eventId));
  if(event.id!==eventId)throw Error('calendar_event_identity_mismatch');
  return {state:event.status==='cancelled'?'cancelled':'present',event_id:eventId,
   start:event.start?.dateTime||event.start?.date||null,
   end:event.end?.dateTime||event.end?.date||null,
   notification_verified:false};
 }catch(e){
  if(['calendar_http_404','calendar_http_410'].includes(String(e.message)))
   return {state:'absent',event_id:eventId,notification_verified:false};
  throw e;
 }
}
