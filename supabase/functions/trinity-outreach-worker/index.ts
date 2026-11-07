// Trinity outbound outreach worker. NOT DEPLOYED.
// Requires private worker secret and explicit BROTHERCHAT_OUTREACH_ENABLED=true.
// Service-role credentials and provider API keys must never be placed in browser code.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(async req=>{
 if(req.method!=='POST'||!Deno.env.get('TRINITY_WORKER_SECRET')||
    req.headers.get('authorization')!=='Bearer '+Deno.env.get('TRINITY_WORKER_SECRET'))
   return new Response('Forbidden',{status:403});
 const enabled=Deno.env.get('BROTHERCHAT_OUTREACH_ENABLED')==='true';
 const providerKey=Deno.env.get('RESEND_API_KEY');
 const sender=Deno.env.get('TRINITY_OUTREACH_FROM');
 const address=Deno.env.get('TRINITY_BUSINESS_POSTAL_ADDRESS');
 const unsubscribeBase=Deno.env.get('TRINITY_UNSUBSCRIBE_BASE_URL');
 if(!enabled||!providerKey||!sender||!address||!unsubscribeBase)
   return Response.json({enabled:false,claimed:0,sent:0,note:'Outbound outreach is disabled or not configured'});
 // Do not claim any rows unless all required launch configuration is present.
 const {data:claimed,error}=await db.rpc('trinity_claim_outbox',{p_limit:5});
 if(error)return Response.json({error:'Claim failed'},{status:503});
 let sent=0,failed=0;
 for(const item of claimed||[]){
   const {data:contact}=await db.from('trinity_contacts').select('*').eq('id',item.contact_id).single();
   const {data:campaign}=await db.from('trinity_campaigns').select('*').eq('id',item.campaign_id).single();
   if(!contact||!campaign||!campaign.enabled||!contact.eligibility_confirmed){
     await db.from('trinity_outbox').update({status:'needs_review',error:'Eligibility or campaign changed'}).eq('id',item.id).eq('status','sending');
     continue;
   }
   const {data:suppression}=await db.from('trinity_suppressions').select('email').eq('email',contact.email).maybeSingle();
   if(suppression){await db.from('trinity_outbox').update({status:'cancelled'}).eq('id',item.id).eq('status','sending');continue;}
   // Provider integration must be approved for the intended commercial outreach.
   // Unsubscribe tokens should be signed and verified by an independent HTTPS endpoint.
   const unsubscribeUrl=unsubscribeBase.replace(/\/$/,'')+'?token='+encodeURIComponent(item.id);
   const body=item.body+'\n\nTrinity Continuum\n'+address+'\nOpt out: '+unsubscribeUrl;
   try{
     const response=await fetch('https://api.resend.com/emails',{method:'POST',
       headers:{Authorization:'Bearer '+providerKey,'Content-Type':'application/json','Idempotency-Key':item.id},
       body:JSON.stringify({from:sender,to:[contact.email],reply_to:sender,
         subject:item.subject,text:body,
         headers:{'List-Unsubscribe':'<'+unsubscribeUrl+'>'}})});
     const result=await response.json().catch(()=>({}));
     if(response.ok){
       await db.from('trinity_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_message_id:result.id||null,error:null}).eq('id',item.id).eq('status','sending');
       await db.from('trinity_contacts').update({status:'contacted',last_contacted_at:new Date().toISOString()}).eq('id',contact.id);
       sent++;
     }else{
       await db.from('trinity_outbox').update({status:'failed',error:'Provider status '+response.status}).eq('id',item.id).eq('status','sending');
       failed++;
     }
   }catch{
     // Ambiguous provider outcome: hold for review; never blindly retry.
     await db.from('trinity_outbox').update({status:'needs_review',error:'Ambiguous delivery result; reconcile with provider'}).eq('id',item.id).eq('status','sending');
     failed++;
   }
 }
 return Response.json({enabled:true,claimed:(claimed||[]).length,sent,failed});
});
