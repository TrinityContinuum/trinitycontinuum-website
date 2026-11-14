// Trinity appointment intake — isolated from trinity-email-gateway.
// Required: D1 DB, Cloudflare Turnstile secret, SEND_EMAIL binding, verified destination.
// Do not deploy or enable public form until all production checks pass.
const ORIGINS = new Set(["https://trinitycontinuum.com","https://www.trinitycontinuum.com"]);
const json = (body,status=200,origin="")=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...(ORIGINS.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}});
const clean=(v,max=2500)=>typeof v==="string"?v.trim().slice(0,max):"";
const dateOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
const timeOk=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const zones=new Set(["America/Chicago (Central)","America/New_York (Eastern)","America/Denver (Mountain)","America/Los_Angeles (Pacific)","UTC","Other (specify in message)"]);
export default {
 async fetch(request,env){
  const origin=request.headers.get("Origin")||"";
  const url=new URL(request.url);
  if(url.pathname==="/health"&&request.method==="GET")return json({service:"trinity-appointments",ready:Boolean(env.DB&&env.SEND_EMAIL&&env.TURNSTILE_SECRET&&env.EMAIL_FROM)},200,origin);
  if(request.method==="OPTIONS"){
    if(!ORIGINS.has(origin))return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type","access-control-max-age":"600","vary":"Origin"}});
  }
  if(url.pathname!=="/api/appointments"||request.method!=="POST")return json({error:"Not found"},404,origin);
  if(!ORIGINS.has(origin))return json({error:"Origin is not allowed"},403);
  if(!env.DB||!env.SEND_EMAIL||!env.TURNSTILE_SECRET||!env.EMAIL_FROM)return json({error:"Appointment service is not configured"},503,origin);
  if(!/^application\/json\b/i.test(request.headers.get("content-type")||""))return json({error:"Expected JSON"},415,origin);
  const length=Number(request.headers.get("content-length")||0);
  if(length>12000)return json({error:"Request too large"},413,origin);
  let a;
  try {a=await request.json()}catch{return json({error:"Invalid JSON"},400,origin)}
  if(!a||typeof a!=="object")return json({error:"Invalid request"},400,origin);
  const name=clean(a.name,120),email=clean(a.email,200),organization=clean(a.organization,150),topic=clean(a.topic,2500);
  const date1=clean(a.date1,10),time1=clean(a.time1,5),date2=clean(a.date2,10),time2=clean(a.time2,5),timezone=clean(a.timezone,80);
  if(!name||!topic||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!dateOk(date1)||!dateOk(date2)||!timeOk(time1)||!timeOk(time2)||!zones.has(timezone))
    return json({error:"Complete all required fields with valid values"},400,origin);
  if(date1===date2&&time1===time2)return json({error:"Provide two different appointment options"},400,origin);
  const now=new Date().toISOString().slice(0,10);
  if(date1<now||date2<now)return json({error:"Choose dates that are today or later"},400,origin);
  const token=clean(a.turnstileToken,4096);
  if(!token)return json({error:"Complete the security check"},400,origin);
  let verified=false;
  try{
    const payload=new FormData();payload.set("secret",env.TURNSTILE_SECRET);payload.set("response",token);
    const ip=request.headers.get("CF-Connecting-IP");if(ip)payload.set("remoteip",ip);
    const res=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:payload});
    const result=await res.json();verified=Boolean(result.success&&(!result.hostname||["trinitycontinuum.com","www.trinitycontinuum.com"].includes(result.hostname)));
  }catch{}
  if(!verified)return json({error:"Security verification failed. Please retry."},403,origin);
  const id=crypto.randomUUID();
  try{
    await env.DB.prepare("INSERT INTO appointments (id,name,email,organization,date1,time1,date2,time2,timezone,topic,notification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,name,email,organization,date1,time1,date2,time2,timezone,topic,"pending").run();
  }catch{return json({error:"Could not save request. Please try again."},503,origin)}
  const lines=["New Trinity Continuum appointment request","Reference: "+id,"Not a confirmed booking","Name: "+name,"Email: "+email,"Organization: "+organization,"First choice: "+date1+" "+time1,"Second choice: "+date2+" "+time2,"Time zone: "+timezone,"Topic: "+topic,"Reply to visitor's email address above."];
  try{
    await env.SEND_EMAIL.send({to:"jack@trinitycontinuum.com",from:env.EMAIL_FROM,subject:"Trinity meeting request "+id.slice(0,8),text:lines.join("\n")});
    await env.DB.prepare("UPDATE appointments SET notification_status='sent' WHERE id=?").bind(id).run();
    return json({ok:true,reference:id,message:"Your request was submitted to Trinity. Your appointment is not confirmed until Trinity replies."},200,origin);
  }catch{
    try{await env.DB.prepare("UPDATE appointments SET notification_status='failed' WHERE id=?").bind(id).run()}catch{}
    // Request persists in D1 for recovery; never promise inbox delivery.
    return json({ok:false,reference:id,error:"Your request was saved, but the email notification could not be confirmed. Please contact Trinity directly and include this reference; do not submit duplicate requests."},503,origin);
  }
 }
};