// Calendar transport adapter. Tokens are supplied by an authorized server-side
// provider; never expose authorization headers or raw provider errors to clients.
const BASE='https://www.googleapis.com/calendar/v3';
export function calendarAdapter({getAccessToken, transport=fetch, calendarId='primary'}){
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
  let validLink=false;try{const u=new URL(link);validLink=u.protocol==='https:'&&u.hostname==='meet.google.com'&&!u.port&&!u.username&&!u.password&&/^[/][a-z-]+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{}
  return {eventId:data.id,meetUrl:validLink?link:null,ready:validLink};
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
