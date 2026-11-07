// Provider-neutral signed event adapter. NOT DEPLOYED.
// An authorized provider bridge must normalize inbound/delivery events and sign
// the exact JSON bytes using HMAC-SHA256 (hex) in x-trinity-signature.
// Do not expose TRINITY_EVENT_SECRET in browser or public provider configuration.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cut=(v:unknown,n=300)=>typeof v==='string'?v.trim().slice(0,n):'';
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('TRINITY_EVENT_SECRET');
 if(!secret)return new Response('Not configured',{status:503});
 const body=await req.text();if(body.length>50000)return new Response('Too large',{status:413});
 const sig=req.headers.get('x-trinity-signature')||'';
 if(!/^[a-f0-9]{64}$/.test(sig))return new Response('Unauthorized',{status:401});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'HMAC',false,['verify']);
 const bytes=Uint8Array.from(sig.match(/../g)!.map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body)))return new Response('Unauthorized',{status:401});
 let d:any;try{d=JSON.parse(body)}catch{return new Response('Invalid JSON',{status:400})}
 const event= cut(d.type,40),eventId=cut(d.event_id,200),messageId=cut(d.message_id,200);
 if(!eventId||!messageId||!['delivered','bounced','complained','inbound'].includes(event))return new Response('Invalid event',{status:400});
 const {data:exists}=await db.from('trinity_mail_events').select('id').eq('provider_event_id',eventId).maybeSingle();
 if(exists)return Response.json({ok:true,duplicate:true});
 const {data:outbox}=await db.from('trinity_outbox').select('id,contact_id').eq('provider_message_id',messageId).maybeSingle();
 const contactEmail=cut(d.from_email,200).toLowerCase();
 const {data:contact}=outbox?{data:null}:await db.from('trinity_contacts').select('id').eq('email',contactEmail).maybeSingle();
 const contactId=outbox?.contact_id||contact?.id||null;
 const {error}=await db.from('trinity_mail_events').insert({outbox_id:outbox?.id||null,contact_id:contactId,event_type:event,provider_event_id:eventId,detail:{message_id:messageId}});
 if(error)return Response.json({error:'Event persistence failed'},{status:503});
 if(event==='bounced'||event==='complained'){
   const {data:c}=await db.from('trinity_contacts').select('email').eq('id',contactId).maybeSingle();
   if(c){
    await db.from('trinity_suppressions').upsert({email:c.email,reason:event},{onConflict:'email'});
    await db.from('trinity_contacts').update({status:event==='bounced'?'bounced':'suppressed',eligibility_confirmed:false}).eq('id',contactId);
   }
 }
 if(event==='inbound'){
   const subject=cut(d.subject,250),text=cut(d.text,12000),replyTo=cut(d.in_reply_to,200);
   const {error:threadError}=await db.from('trinity_mail_threads').insert({contact_id:contactId,message_id:messageId,in_reply_to:replyTo,direction:'inbound',subject,body:text});
   if(threadError)return Response.json({error:'Thread persistence failed'},{status:503});
   if(contactId)await db.from('trinity_contacts').update({status:'replied'}).eq('id',contactId);
 }
 return Response.json({ok:true});
});