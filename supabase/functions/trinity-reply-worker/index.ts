// Run on a scheduler (e.g. Supabase cron) after configuring secrets.
// Does NOT send automatically unless BROTHERCHAT_SEND_ENABLED=true and RESEND_API_KEY set.
// Keep outbound mail off until the verified sender domain is approved.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const approved='Trinity Continuum is developing an integrated modular water, power and thermal infrastructure platform. Actual system capabilities, engineering specifications, site suitability, delivery, pricing and performance require written confirmation from Trinity management.';
Deno.serve(async req=>{
 if(req.method!=='POST'||req.headers.get('authorization')!=='Bearer '+Deno.env.get('TRINITY_WORKER_SECRET'))return new Response('Forbidden',{status:403});
 const {data, error}=await db.from('trinity_inquiries').select('*').eq('status','queued').lte('reply_due_at',new Date().toISOString()).order('reply_due_at').limit(10);
 if(error)return new Response('Queue unavailable',{status:503});
 let drafted=0, sent=0;
 for(const lead of data||[]){
  const sensitive=['Costs / commercial terms','Engineering specifications / validation','Procurement / availability','Site suitability / permitting'].includes(lead.question_category);
  let answer=`Hello ${lead.name},\n\nThank you for contacting Trinity Continuum about ${lead.applications.join(', ')||lead.reason}. We have recorded your interest in ${lead.city||lead.state||lead.country||'your proposed location'} and your questions concerning ${lead.question_category||'the platform'}.\n\n${approved}\n\nYour project description and questions have been recorded for review by Trinity. We welcome further details about your desired water, electrical and thermal requirements.\n\nBest regards,\nBrotherchat\nTrinity Continuum AI Correspondent\nThis is an automated response; project-specific commitments require confirmation by Trinity management.`;
  const key=Deno.env.get('OPENAI_API_KEY');
  if(key){
   try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:Deno.env.get('TRINITY_AI_MODEL')||'gpt-4.1-mini',max_output_tokens:650,instructions:'You are Brotherchat, clearly identified as an AI correspondent for Trinity Continuum. Only use these approved facts: '+approved+' Never invent technical specifications, pricing, environmental certification, commercial availability or guaranteed outputs. Never make contractual commitments. Refer technical, procurement, cost and engineering questions to Jack. Be helpful, concise, personalized and professional. No links unless supplied. End with a disclosure that this is AI-generated.',input:JSON.stringify({name:lead.name,industry:lead.industry,location:[lead.city,lead.state,lead.country].filter(Boolean).join(', '),applications:lead.applications,question_category:lead.question_category,questions:lead.questions,project:lead.project})})});
    if(response.ok){const j=await response.json();const generated=(j.output||[]).flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text').map((x:any)=>x.text).join('\n').trim();if(generated)answer=generated;}
   }catch(e){console.error('AI generation unavailable',String(e));}
  }
  const subject='Re: Your Trinity Continuum project inquiry';
  // Fail closed: sensitive categories always require human review.
  const enabled=Deno.env.get('BROTHERCHAT_SEND_ENABLED')==='true'&&!sensitive;
  const mailKey=Deno.env.get('RESEND_API_KEY');
  if(enabled&&mailKey){
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+mailKey,'Content-Type':'application/json'},body:JSON.stringify({from:'Trinity Continuum AI <brotherchat@trinitycontinuum.com>',to:[lead.email],reply_to:'jack@trinitycontinuum.com',subject,text:answer})});
   if(response.ok){await db.from('trinity_inquiries').update({status:'sent',draft_subject:subject,draft_body:answer,sent_at:new Date().toISOString()}).eq('id',lead.id).eq('status','queued');sent++;continue;}
   console.error('Mail provider error',response.status);
  }
  const {error:saveError}=await db.from('trinity_inquiries').update({status:sensitive?'needs_review':'draft_ready',draft_subject:subject,draft_body:answer}).eq('id',lead.id).eq('status','queued');
  if(!saveError)drafted++;
 }
 return new Response(JSON.stringify({processed:(data||[]).length,drafted,sent}),{headers:{'Content-Type':'application/json'}});
});