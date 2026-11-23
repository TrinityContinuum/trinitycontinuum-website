import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../cloudflare/appointment-queue/direct-booking.js",import.meta.url),"utf8");
const {default:booking,_bookingPolicyTest:p}=await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"));
const origin="https://trinitycontinuum.com";
const date="2026-11-30";
const windows=[1,2,3,4,5].map(weekday=>({weekday,start:"13:30",end:"16:30"}));
const realNow=Date.now;
Date.now=()=>Date.UTC(2026,10,22,18,0,0);

function harness({businessCalendarReady=true,googleBusy=false,googleEventFailure=false,otherCalendarBusy=false,otherCalendarUnavailable=false,meetMissing=false}={}){
  const bookings=[], calls=[];
  const db={prepare(sql){
    let params=[];
    return {bind(...p){params=p;return this;},
      async first(){
        if(sql.startsWith("SELECT enabled, windows_json"))return{enabled:1,windows_json:JSON.stringify(windows),min_notice_hours:24,max_days:60};
        if(sql.startsWith("SELECT id FROM appointment_bookings WHERE")){
          const [end,start]=params;return bookings.find(x=>x.state!=="cancelled"&&x.start<end&&x.end>start)||null;
        }
        if(sql.startsWith("SELECT id FROM appointment_external"))return null;
        throw Error("Unexpected DB read:"+sql);
      },
      async run(){
        if(sql.startsWith("INSERT INTO appointment_bookings")){
          const [id,start,end,name,email,org,topic]=params;
          if(bookings.some(x=>x.start===start&&x.state!=="cancelled"))throw Error("duplicate slot");
          bookings.push({id,start,end,name,email,org,topic,state:"processing"});
          return{meta:{changes:1}};
        }
        if(sql.startsWith("UPDATE appointment_bookings SET state='confirmed'")){
          const [eventId,meetUrl,id]=params;const b=bookings.find(x=>x.id===id);
          if(!b)throw Error("Missing booking");Object.assign(b,{state:"confirmed",eventId,meetUrl});
          return{meta:{changes:1}};
        }
        if(sql.startsWith("UPDATE appointment_bookings SET state='needs_reconciliation'")){
          const b=bookings.find(x=>x.id===params[0]);if(b)b.state="needs_reconciliation";
          return{meta:{changes:1}};
        }
        throw Error("Unexpected DB write:"+sql);
      }
    };
  }};
  const env={DB:db,DIRECT_BOOKING_ENABLED:"true",GOOGLE_CLIENT_ID:"synthetic",GOOGLE_CLIENT_SECRET:"synthetic",
    GOOGLE_REFRESH_TOKEN:"synthetic",GOOGLE_CALENDAR_ID:"trinity-business@example.invalid",
    GOOGLE_BUSY_CALENDAR_IDS_JSON:JSON.stringify(["existing-jack-events@example.invalid"]),
    TURNSTILE_SECRET:"synthetic"};
  const previousFetch=globalThis.fetch;
  const fakeFetch=async(url,opts)=>{
    const u=String(url);calls.push({url:u,method:opts?.method,body:opts?.body});
    const response=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json"}});
    if(u.includes("oauth2.googleapis.com/token"))
      return businessCalendarReady?response({access_token:"synthetic-token"}):response({error:"unauthorized_client"},401);
    if(u.includes("www.googleapis.com/calendar/v3/freeBusy")){
      const request=JSON.parse(opts.body);
      const ids=request.items.map(i=>i.id);
      const calendars={};
      const event={start:"2026-11-30T21:00:00Z",end:"2026-11-30T21:30:00Z"};
      const eventOverlaps=event.start<request.timeMax&&event.end>request.timeMin;
      for(const id of ids){
        if(otherCalendarUnavailable&&id==="existing-jack-events@example.invalid")continue;
        const active=(id==="trinity-business@example.invalid"&&googleBusy)||(id==="existing-jack-events@example.invalid"&&otherCalendarBusy);
        calendars[id]={busy:active&&eventOverlaps?[event]:[]};
      }
      return response({calendars});
    }
    if(u.includes("challenges.cloudflare.com/turnstile/v0/siteverify"))
      return response({success:true,hostname:"trinitycontinuum.com"});
    if(u.includes("www.googleapis.com/calendar/v3/calendars/")){
      if(googleEventFailure)return response({error:"unavailable"},503);
      const posted=JSON.parse(opts.body);
      return response({id:posted.id,hangoutLink:meetMissing?"":"https://meet.google.com/synthetic-test",htmlLink:"https://calendar.google.com/synthetic-test"});
    }
    throw Error("Unexpected network call:"+u);
  };
  return {env,calls,bookings,use(){globalThis.fetch=fakeFetch;},reset(){globalThis.fetch=previousFetch}};
}
function get(path,env,from=origin){
 return booking.fetch(new Request(origin+path,{headers:{Origin:from}}),env);
}
function post(day,time,env,{from=origin,id="11111111-1111-4111-8111-111111111111"}={}){
 return booking.fetch(new Request(origin+"/api/public/book",{method:"POST",headers:{Origin:from,"content-type":"application/json"},
 body:JSON.stringify({id,date:day,time,name:"Synthetic Viewer",email:"synthetic@example.invalid",organization:"Test",topic:"Technical review",turnstileToken:"synthetic-token"})}),env);
}
test("public slots only reflect live Google free/busy and do not reveal holiday or weekend appointments",async()=>{
 const h=harness();h.use();
 try{
  let r=await get("/api/public/slots?date="+date,h.env);
  assert.equal(r.status,200);let b=await r.json();
  assert.equal(b.enabled,true);console.log("diagnostic",JSON.stringify({startAllowed:p.slotWithin(date,"13:30",windows),endAllowed:p.slotWithin(date,"16:00",windows),holiday:p.isFederalHoliday(date),slots:b.slots,calls:h.calls.length}));assert.deepEqual(b.slots.map(x=>x.time),["13:30","14:00","14:30","15:00","15:30","16:00"]);
  assert.equal(h.calls.filter(x=>x.url.includes("/freeBusy")).length,6);
  r=await get("/api/public/slots?date=2026-11-26",h.env);
  assert.equal(r.status,200);b=await r.json();assert.equal(b.slots.length,0,"Thanksgiving closed");
  r=await get("/api/public/slots?date=2026-11-28",h.env);
  assert.equal(r.status,200);b=await r.json();assert.equal(b.slots.length,0,"Saturday closed");
 }finally{h.reset();}
});
test("server books the 4 PM Central start, creates an invite and rejects a simultaneous duplicate",async()=>{
 const h=harness();h.use();
 try{
  let r=await post(date,"16:00",h.env);assert.equal(r.status,201,"Response: "+await r.clone().text());
  let result=await r.json();assert.equal(result.status,"confirmed");assert.equal(result.time,"16:00");
  assert.equal(h.bookings.length,1);assert.equal(h.bookings[0].start,"2026-11-30T22:00:00.000Z");
  assert.equal(h.bookings[0].end,"2026-11-30T22:30:00.000Z");
  assert.equal(h.bookings[0].state,"confirmed");
  const event=h.calls.find(x=>x.url.includes("/events?"));assert(event,"Google event sent");
  const payload=JSON.parse(event.body);
  assert.equal(payload.start.dateTime,"2026-11-30T22:00:00.000Z");
  assert.equal(payload.end.dateTime,"2026-11-30T22:30:00.000Z");
  assert.equal(payload.attendees[0].email,"synthetic@example.invalid");
  assert.equal(event.url.includes("sendUpdates=all"),true);
  r=await post(date,"16:00",h.env,{id:"22222222-2222-4222-8222-222222222222"});
  assert.equal(r.status,409);
  assert.equal(h.bookings.length,1);
  assert.equal(h.calls.filter(x=>x.url.includes("/events?")).length,1,"No duplicate invitation");
 }finally{h.reset();}
});
test("off-hours, holiday, weekend and bad-origin submissions are rejected without invitations",async()=>{
 const h=harness();h.use();
 try{
  for(const [day,time,status] of [[date,"13:00",409],["2026-11-26","14:00",409],["2026-11-28","14:00",409]]){
   const r=await post(day,time,h.env);assert.equal(r.status,status,day+" "+time);
  }
  let r=await post(date,"14:00",h.env,{from:"https://attacker.invalid"});
  assert.equal(r.status,403);
  assert.equal(h.bookings.length,0);
  assert.equal(h.calls.filter(x=>x.url.includes("/events?")).length,0);
 }finally{h.reset();}
});
test("Google auth failure blocks both advertised availability and booking",async()=>{
 const h=harness({businessCalendarReady:false});h.use();
 try{
  let r=await get("/api/public/slots?date="+date,h.env);
  assert.equal(r.status,503);
  r=await post(date,"14:00",h.env);
  assert.equal(r.status,503);
  assert.equal(h.bookings.length,0);
 }finally{h.reset();}
});
test("uncertain Google event creation is held for human reconciliation and not reoffered",async()=>{
 const h=harness({googleEventFailure:true});h.use();
 try{
  let r=await post(date,"13:30",h.env);
  assert.equal(r.status,503);
  const message=await r.json();assert.equal(message.reference,"11111111-1111-4111-8111-111111111111");
  assert.equal(h.bookings.length,1);assert.equal(h.bookings[0].state,"needs_reconciliation");
  r=await get("/api/public/slots?date="+date,h.env);
  assert.equal(r.status,200);const b=await r.json();
  assert.equal(b.slots.some(x=>x.time==="13:30"),false);
  assert.equal(b.slots.some(x=>x.time==="14:00"),false,"15-minute buffer blocks adjacent times");
 }finally{h.reset();}
});
test.after(()=>{Date.now=realNow});

test("all authorized Jack busy calendars are checked, including existing commitments",async()=>{
 const h=harness({otherCalendarBusy:true});h.env.GOOGLE_BUSY_CALENDAR_IDS_JSON=JSON.stringify(["existing-jack-events@example.invalid"]);h.use();
 try{
  const r=await get("/api/public/slots?date="+date,h.env);
  assert.equal(r.status,200);
  const response=await r.json();
  // The secondary calendar has an event at 15:00 UTC-equivalent, and the
  // 15-minute buffer excludes adjacent meeting starts around that event.
  const times=response.slots.map(x=>x.time);
  assert.deepEqual(times,["13:30","14:00","16:00"],"All slots overlapping the existing event or 15-minute buffer must be excluded");
  const calls=h.calls.filter(x=>x.url.includes("/freeBusy"));
  assert(calls.length>0);
  assert(calls.every(x=>JSON.parse(x.body).items.some(z=>z.id==="existing-jack-events@example.invalid")));
 }finally{h.reset();}
});
test("a missing authorized busy calendar fails closed instead of advertising free slots",async()=>{
 const h=harness({otherCalendarUnavailable:true});h.env.GOOGLE_BUSY_CALENDAR_IDS_JSON=JSON.stringify(["existing-jack-events@example.invalid"]);h.use();
 try{
  const r=await get("/api/public/slots?date="+date,h.env);
  assert.equal(r.status,200);
  const data=await r.json();assert.deepEqual(data.slots,[]);
  const b=await post(date,"14:00",h.env);
  assert.equal(b.status,503);
  assert.equal(h.bookings.length,0);
 }finally{h.reset();}
});
test("a Google event without confirmed Google Meet link is held, not falsely booked",async()=>{
 const h=harness({meetMissing:true});h.use();
 try{
  const r=await post(date,"16:00",h.env);
  assert.equal(r.status,503);
  assert.equal(h.bookings.length,1);
  assert.equal(h.bookings[0].state,"needs_reconciliation");
  const check=await get("/api/public/slots?date="+date,h.env);
  assert.equal(check.status,200);
  const slots=(await check.json()).slots.map(x=>x.time);
  assert.equal(slots.includes("16:00"),false);
 }finally{h.reset();}
});

test("instant booking fails closed if the separate personal busy source is absent or empty",async()=>{
 for(const calendarConfig of [undefined,"", "[]"]){
  const h=harness();
  if(calendarConfig===undefined)delete h.env.GOOGLE_BUSY_CALENDAR_IDS_JSON;
  else h.env.GOOGLE_BUSY_CALENDAR_IDS_JSON=calendarConfig;
  h.use();
  try{
   const available=await get("/api/public/slots?date="+date,h.env);
   assert.equal(available.status,200);
   assert.deepEqual((await available.json()).slots,[],"no free slots may appear without secondary busy source");
   const submission=await post(date,"14:30",h.env);
   assert.equal(submission.status,503);
   assert.equal(h.bookings.length,0);
   assert.equal(h.calls.some(x=>x.url.includes("/events?")),false);
  }finally{h.reset()}
 }
});
