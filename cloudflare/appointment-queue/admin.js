// STAGING ONLY: separate admin Worker must be protected by Cloudflare Access.
// Hard deny when Access is missing or identity is not explicitly allowlisted.
const answer=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export default {async fetch(req,env,ctx){
 if(!ctx.access)return answer({error:"Authentication required"},403);
 let identity;try{identity=await ctx.access.getIdentity()}catch{return answer({error:"Identity unavailable"},403)}
 const allowed=(env.APPROVER_EMAILS||"").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
 if(!identity?.email||!allowed.includes(identity.email.toLowerCase()))return answer({error:"Not authorized"},403);
 if(!env.DB)return answer({error:"Missing database binding"},503);
 if(req.method!=="GET"||new URL(req.url).pathname!=="/api/requests")return answer({error:"Not found"},404);
 try{const q=await env.DB.prepare("SELECT id,name,email,organization,date1,time1,date2,time2,timezone,topic,notification_status,created_at FROM appointments ORDER BY created_at DESC LIMIT 100").all();return answer({requests:q.results})}
 catch{return answer({error:"Database unavailable"},503)}
}};
