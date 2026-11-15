// STAGING ONLY. Separate Cloudflare Worker; don't modify the working public form yet.
const origins=new Set(["https://trinitycontinuum.com","https://www.trinitycontinuum.com"]);
function response(data,status=200,origin=""){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...(origins.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}})}
export default {async fetch(req,env){
 const origin=req.headers.get("Origin")||"";
 if(req.method==="OPTIONS")return origins.has(origin)?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"content-type"}}):new Response(null,{status:403});
 if(new URL(req.url).pathname!=="/api/intake"||req.method!=="POST")return response({error:"Not found"},404,origin);
 if(!origins.has(origin))return response({error:"Not allowed"},403);
 if(!env.DB||!env.TURNSTILE_SECRET)return response({error:"Not configured"},503,origin);
 let raw;try{raw=await req.text();if(raw.length>12000)throw Error();raw=JSON.parse(raw)}catch{return response({error:"Invalid payload"},400,origin)}
 const get=(k,n=2500)=>typeof raw[k]==="string"?raw[k].trim().slice(0,n):"";
 const a={id:get("id",80),name:get("name",120),email:get("email",200),organization:get("organization",150),date1:get("date1",10),time1:get("time1",5),date2:get("date2",10),time2:get("time2",5),timezone:get("timezone",80),topic:get("topic",2500)};
 const d=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"));const t=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
 const zones=new Set(["America/Chicago (Central)","America/New_York (Eastern)","America/Denver (Mountain)","America/Los_Angeles (Pacific)","UTC","Other (specify in message)"]);
 if(!/^[0-9a-f-]{36}$/i.test(a.id)||!a.name||!a.topic||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)||!d(a.date1)||!d(a.date2)||!t(a.time1)||!t(a.time2)||!zones.has(a.timezone)||a.date1===a.date2&&a.time1===a.time2)return response({error:"Invalid form details"},400,origin);
 const token=get("turnstileToken",4096);if(!token)return response({error:"Complete security check"},403,origin);
 let verified;try{const body=new FormData();body.set("secret",env.TURNSTILE_SECRET);body.set("response",token);const cfip=req.headers.get("CF-Connecting-IP");if(cfip)body.set("remoteip",cfip);verified=await(await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body})).json()}catch{return response({error:"Security verification unavailable"},503,origin)}
 if(!verified?.success||!["trinitycontinuum.com","www.trinitycontinuum.com"].includes(verified.hostname))return response({error:"Security verification failed"},403,origin);
 try{await env.DB.prepare("INSERT OR IGNORE INTO appointments (id,name,email,organization,date1,time1,date2,time2,timezone,topic,notification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(a.id,a.name,a.email,a.organization,a.date1,a.time1,a.date2,a.time2,a.timezone,a.topic,"pending").run();return response({ok:true,reference:a.id},200,origin)}
 catch{return response({error:"Database write failed"},503,origin)}
}};
