// Deploy as a Supabase Edge Function with verify_jwt=false.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Public POST only.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const ORIGIN='https://trinitycontinuum.com';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type','Vary':'Origin','Content-Type':'application/json'};
const allowed=(v:string, choices:string[])=>choices.includes(v);
const cut=(v:unknown,n:number)=>typeof v==='string'?v.trim().slice(0,n):'';
const reasons=['Potential installation or purchase','Technical evaluation','Engineering or manufacturing partnership','Procurement or RFP','Research or other inquiry'];
const categories=['General evaluation','Water quality / feedwater','Water production / capacity','Power output / electrical integration','Thermal recovery / cooling','Engineering specifications / validation','Site suitability / permitting','Costs / commercial terms','Procurement / availability','Partnership / manufacturing','Other'];
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 if(req.headers.get('origin')!==ORIGIN)return new Response('Forbidden',{status:403,headers});
 if(Number(req.headers.get('content-length')||0)>20000)return new Response('Too large',{status:413,headers});
 try{
  const raw=await req.text();if(raw.length>20000)return new Response('Too large',{status:413,headers});
  const d=JSON.parse(raw);
  if(d.website)return new Response(JSON.stringify({ok:true}),{status:202,headers}); // bot trap
  const name=cut(d.name,120),email=cut(d.email,200).toLowerCase(),project=cut(d.project,5000),reason=cut(d.reason,100);
  if(!name||!project||!allowed(reason,reasons)||!/^\S+@\S+\.\S+$/.test(email))return new Response(JSON.stringify({error:'Please check required fields.'}),{status:400,headers});
  const question_category=cut(d.question_category,100);
  if(question_category&&!allowed(question_category,categories))return new Response(JSON.stringify({error:'Invalid question category.'}),{status:400,headers});
  const applications=Array.isArray(d.applications)?d.applications.slice(0,12).map((v:unknown)=>cut(v,100)):[];
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email+'|'+project+'|'+new Date().toISOString().slice(0,13)));
  const dedupe_key=Array.from(new Uint8Array(fingerprint)).map(v=>v.toString(16).padStart(2,'0')).join('');
  const record={name,email,project,reason,question_category,applications,dedupe_key,
   organization:cut(d.organization,150),industry:cut(d.industry,120),source:cut(d.source,120),campaign:cut(d.campaign,120),
   city:cut(d.city,150),state:cut(d.state,100),country:cut(d.country,100),questions:cut(d.questions,4000),
   timeline:cut(d.timeline,80),reply_method:cut(d.reply_method,80)};
  const {data:saved,error}=await supabase.from('trinity_inquiries').insert(record).select('id').single();
  if(error&&error.code!=='23505'){console.error('Inquiry save failed',error.code);return new Response(JSON.stringify({error:'Submission unavailable. Please email Trinity directly.'}),{status:503,headers});}
  if(saved?.id && Deno.env.get('TRINITY_WORKER_SECRET')){
    try{
      const prep=await fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/trinity-reply-worker',{
        method:'POST',headers:{'Authorization':'Bearer '+Deno.env.get('TRINITY_WORKER_SECRET'),'Content-Type':'application/json'},
        body:JSON.stringify({prepare_id:saved.id})});
      if(!prep.ok)console.error('Immediate draft preparation unavailable',prep.status);
    }catch(e){console.error('Immediate draft preparation error',String(e));}
  }
  return new Response(JSON.stringify({ok:true,message:'Inquiry received.'}),{status:202,headers});
 }catch{return new Response(JSON.stringify({error:'Invalid request.'}),{status:400,headers});}
});