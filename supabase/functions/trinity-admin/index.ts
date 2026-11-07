// Admin-only API. Configure TRINITY_ADMIN_USER_IDS (comma-separated Supabase Auth user UUIDs).
// Keep this function private; verify_jwt=true; never place service role key in browser.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,service);
const cors={'Access-Control-Allow-Origin':'https://trinitycontinuum.com','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Vary':'Origin'};
const clean=(v:unknown,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
const email=(v:unknown)=>clean(v,200).toLowerCase();
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors});
 if(req.headers.get('origin')!=='https://trinitycontinuum.com')return new Response('Forbidden',{status:403,headers:cors});
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
 if(!token)return Response.json({error:'Sign-in required'},{status:401,headers:cors});
 const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!);
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user)return Response.json({error:'Unauthorized'},{status:401,headers:cors});
 const admins=(Deno.env.get('TRINITY_ADMIN_USER_IDS')||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!admins.includes(user.id))return Response.json({error:'Not authorized'},{status:403,headers:cors});
 const body=await req.text();
 if(body.length>250000)return Response.json({error:'Payload too large'},{status:413,headers:cors});
 let d:any;try{d=JSON.parse(body)}catch{return Response.json({error:'Invalid JSON'},{status:400,headers:cors})}
 const action=clean(d.action,40);
 const log=async(details:Record<string,unknown>)=>db.from('trinity_outreach_audit').insert({actor:user.id,action,details});
 if(action==='summary'){
   const tables=['trinity_contacts','trinity_campaigns','trinity_outbox','trinity_inquiries','trinity_suppressions'];
   const counts:Record<string,number|null>={};
   for(const t of tables){const {count}=await db.from(t).select('id',{count:'exact',head:true});counts[t]=count;}
   return Response.json({counts},{headers:cors});
 }
 if(action==='contacts'){
   const {data,error}=await db.from('trinity_contacts').select('id,email,name,organization,industry,region,status,eligibility_confirmed,source,last_contacted_at').order('created_at',{ascending:false}).limit(100);
   return Response.json(error?{error:'Unable to load contacts'}:{contacts:data},{status:error?503:200,headers:cors});
 }
 if(action==='import'){
   if(!Array.isArray(d.contacts)||d.contacts.length>100)return Response.json({error:'Maximum 100 contacts per batch'},{status:400,headers:cors});
   let added=0,skipped=0;
   for(const row of d.contacts){
     const e=email(row.email);
     if(!validEmail(e)){skipped++;continue;}
     const {data:blocked}=await db.from('trinity_suppressions').select('email').eq('email',e).maybeSingle();
     if(blocked){skipped++;continue;}
     const {error}=await db.from('trinity_contacts').insert({
       email:e,name:clean(row.name,120),organization:clean(row.organization,150),
       industry:clean(row.industry,120),region:clean(row.region,150),
       source:clean(row.source,150),source_details:clean(row.source_details,300),
       eligibility_confirmed:false,status:'new'
     });
     if(error){skipped++;continue;}added++;
   }
   await log({added,skipped,eligibility:'unconfirmed'});
   return Response.json({added,skipped,note:'Imported contacts are ineligible until individually reviewed.'},{headers:cors});
 }
 if(action==='eligibility'){
   const id=clean(d.id,40),approved=d.approved===true;
   if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'Invalid contact ID'},{status:400,headers:cors});
   const {data:contact}=await db.from('trinity_contacts').select('email,status,source').eq('id',id).single();
   if(!contact||!contact.source)return Response.json({error:'Document contact source first'},{status:400,headers:cors});
   const {data:blocked}=await db.from('trinity_suppressions').select('email').eq('email',contact.email).maybeSingle();
   if(blocked)return Response.json({error:'Suppressed contact cannot be approved'},{status:409,headers:cors});
   const {error}=await db.from('trinity_contacts').update({eligibility_confirmed:approved,eligible_at:approved?new Date().toISOString():null,status:approved?'eligible':'new'}).eq('id',id);
   if(!error)await log({id,approved});
   return Response.json(error?{error:'Update failed'}:{ok:true},{status:error?503:200,headers:cors});
 }
 if(action==='suppress'){
   const e=email(d.email);if(!validEmail(e))return Response.json({error:'Invalid email'},{status:400,headers:cors});
   const {error}=await db.from('trinity_suppressions').upsert({email:e,reason:clean(d.reason,120)||'admin'},{onConflict:'email'});
   if(!error){await db.from('trinity_contacts').update({status:'suppressed',eligibility_confirmed:false}).eq('email',e);await log({email:e});}
   return Response.json(error?{error:'Suppression failed'}:{ok:true},{status:error?503:200,headers:cors});
 }
 if(action==='campaigns'){
   const {data,error}=await db.from('trinity_campaigns').select('id,code,title,sender_name,sender_email,daily_limit,hourly_limit,enabled,approved_at').order('created_at',{ascending:false}).limit(100);
   return Response.json(error?{error:'Unable to load campaigns'}:{campaigns:data},{status:error?503:200,headers:cors});
 }
 if(action==='create_campaign'){
   const code=clean(d.code,64),title=clean(d.title,150);
   if(!/^[a-zA-Z0-9_-]{2,64}$/.test(code)||!title)return Response.json({error:'Invalid campaign details'},{status:400,headers:cors});
   const {error}=await db.from('trinity_campaigns').insert({code,title,sender_name:clean(d.sender_name,120)||'Trinity AI Correspondent',daily_limit:0,hourly_limit:0,enabled:false});
   if(!error)await log({code});
   return Response.json(error?{error:'Unable to create campaign'}:{ok:true},{status:error?409:200,headers:cors});
 }
 if(action==='outbox'){
   const {data,error}=await db.from('trinity_outbox').select('id,contact_id,campaign_id,subject,body,status,due_at,sent_at,error').order('created_at',{ascending:false}).limit(100);
   return Response.json(error?{error:'Unable to load outbox'}:{outbox:data},{status:error?503:200,headers:cors});
 }
 if(action==='draft'){
   const contact_id=clean(d.contact_id,40),campaign_id=clean(d.campaign_id,40),subject=clean(d.subject,180),text=clean(d.body,10000);
   if(!subject||!text||!contact_id||!campaign_id)return Response.json({error:'Missing draft fields'},{status:400,headers:cors});
   const {error}=await db.from('trinity_outbox').insert({contact_id,campaign_id,subject,body:text,status:'draft'});
   if(!error)await log({contact_id,campaign_id});
   return Response.json(error?{error:'Unable to create draft'}:{ok:true},{status:error?409:200,headers:cors});
 }
 if(action==='review_draft'){
   const id=clean(d.id,40),approved=d.approved===true;
   const {data:row}=await db.from('trinity_outbox').select('id,status').eq('id',id).single();
   if(!row||!['draft','needs_review'].includes(row.status))return Response.json({error:'Draft not reviewable'},{status:409,headers:cors});
   const {error}=await db.from('trinity_outbox').update({status:approved?'approved':'cancelled',due_at:approved?new Date(Date.now()+3600000).toISOString():null}).eq('id',id).eq('status',row.status);
   if(!error)await log({id,approved});
   return Response.json(error?{error:'Review failed'}:{ok:true},{status:error?503:200,headers:cors});
 }
 return Response.json({error:'Unknown action'},{status:400,headers:cors});
});