/* Trinity-owned scheduler. Existing manual form remains available at all times.
   Automatic form is revealed only after the independent Worker reports enabled. */
(()=>{
'use strict';
const API='https://trinity-independent-booking.jackspurewater.workers.dev';
const root=document.getElementById('instant-booking');
if(!root)return;
const by=id=>document.getElementById(id);
const zone='America/Chicago';
const localParts=date=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
const dateString=p=>p.year+'-'+p.month+'-'+p.day;
const timeString=p=>p.hour+':'+p.minute;
const duration=()=>Number(by('instantDuration').value);
const show=message=>{by('instantStatus').textContent=message;};
async function post(path,body){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{const res=await fetch(API+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
 const data=await res.json();return {ok:res.ok,...data};}finally{clearTimeout(timer);}
}
async function refresh(){
 const date=by('instantDate').value,select=by('instantSlot');
 select.replaceChildren(new Option('Checking available times…',''));
 if(!date)return;
 const choices=[];
 // Generate local 13:30–16:00 starts, converted through Intl so DST is respected.
 const targetTimes=duration()===60?['13:30','14:00','14:30','15:00']:['13:30','14:00','14:30','15:00','15:30'];
 const anchor=Date.parse(date+'T00:00:00Z');
 for(let t=anchor-12*3600000;t<anchor+36*3600000;t+=30*60000){
  const p=localParts(new Date(t));
  if(dateString(p)===date&&targetTimes.includes(timeString(p)))choices.push({starts_at:new Date(t).toISOString(),ends_at:new Date(t+duration()*60000).toISOString(),time:timeString(p)});
 }
 const results=await Promise.all(choices.map(async c=>{try{return {...c,...await post('/api/availability',c)};}catch{return {...c,available:false};}}));
 select.replaceChildren(new Option('Choose an available time',''));
 for(const slot of results.filter(x=>x.ok&&x.available))select.add(new Option(slot.time+' Central',JSON.stringify({starts_at:slot.starts_at,ends_at:slot.ends_at})));
 if(select.options.length===1)show('No automatically bookable times are available on this date. You can use the appointment request form below.');else show('Choose an available start time and complete the security check.');
}
async function init(){
 try{
  const res=await fetch(API+'/api/policy',{signal:AbortSignal.timeout(8000)});
  if(!res.ok)return;
  const policy=await res.json();
  if(policy.automatic_enabled!==true)return;
  root.hidden=false;
  const today=localParts(new Date());by('instantDate').min=dateString(today);
  by('instantDate').addEventListener('change',()=>refresh().catch(()=>show('Availability could not be checked. Please use the request form below.')));
  by('instantDuration').addEventListener('change',()=>refresh().catch(()=>show('Availability could not be checked. Please use the request form below.')));
  by('instantForm').addEventListener('submit',async event=>{
   event.preventDefault();const button=by('instantSubmit');
   if(button.disabled)return;
   let slot;try{slot=JSON.parse(by('instantSlot').value);}catch{show('Select an available time first.');return;}
   const token=root.querySelector('[name="cf-turnstile-response"]')?.value;
   if(!token){show('Complete the security check first.');return;}
   button.disabled=true;show('Reserving your appointment…');
   try{
    const result=await post('/api/book',{...slot,name:by('instantName').value,email:by('instantEmail').value,organization:by('instantOrg').value,topic:by('instantTopic').value,turnstile_token:token});
    if(result.ok&&result.confirmed){show('Appointment confirmed in Trinity. Reference: '+result.booking_id+'. Please retain this reference. Email delivery may be pending.');button.textContent='Appointment Confirmed';return;}
    show(result.error||'This time is no longer available. Please choose another.');await refresh();
   }catch{show('The result is uncertain. Please contact Trinity before retrying to avoid duplicate reservations.');}
   finally{if(button.textContent!=='Appointment Confirmed')button.disabled=false;}
  });
 }catch{/* Preserve existing manual form if independent Worker is unavailable. */}
}
init();
})();