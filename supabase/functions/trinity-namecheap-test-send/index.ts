// Isolated Namecheap SMTP transport. Not deployed and disabled by default.
// Intended for a dedicated Trinity backend only; do not expose this worker publicly.
import nodemailer from 'npm:nodemailer@6.9.16';

const env=(key:string)=>Deno.env.get(key)?.trim()||'';
const address=(v:unknown)=>typeof v==='string' && /^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(v)&&v.length<=254;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const validId=(v:unknown)=>typeof v==='string' && /^[a-zA-Z0-9_-]{12,128}$/.test(v);

Deno.serve(async(req)=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const secret=env('TRINITY_WORKER_SECRET');
  if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return json({error:'Forbidden'},403);
  if(env('TRINITY_SMTP_ENABLED')!=='true')return json({enabled:false,note:'SMTP sending disabled'},503);
  const from=env('TRINITY_SMTP_USERNAME'),password=env('TRINITY_SMTP_PASSWORD');
  if(!address(from)||!password)return json({error:'Mailbox not configured'},503);
  const raw=await req.text();
  if(raw.length>16000)return json({error:'Payload too large'},413);
  let body:Record<string,unknown>;
  try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
  const to=body.to,subject=body.subject,text=body.text,requestId=body.request_id;
  if(!address(to)||typeof subject!=='string'||subject.length>180||!subject.trim()||
     typeof text!=='string'||text.length>10000||!text.trim()||!validId(requestId))
     return json({error:'Invalid message'},400);
  // Only approved test recipients until durable idempotency and a DB-backed approval queue are integrated.
  const allowed=env('TRINITY_SMTP_TEST_RECIPIENTS').split(',').map(x=>x.toLowerCase().trim()).filter(Boolean);
  if(!allowed.includes((to as string).toLowerCase()))return json({error:'Recipient not approved for testing'},403);
  const transport=nodemailer.createTransport({
    host:'mail.privateemail.com',port:465,secure:true,
    auth:{user:from,pass:password},pool:false,
    connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000
  });
  try{
    const result=await transport.sendMail({
      from, to:to as string, replyTo:from, subject:subject as string,text:text as string,
      headers:{'X-TCON-Request-ID':requestId as string}
    });
    return json({accepted:result.accepted.length>0,rejected:result.rejected.length,
      message_id:result.messageId,request_id:requestId});
  }catch(e){
    // Delivery may be ambiguous on network failure; do not automatically retry.
    console.error('SMTP attempt failed',String(e).slice(0,300));
    return json({error:'SMTP attempt failed; check mailbox and delivery logs before retry'},502);
  }finally{transport.close()}
});
