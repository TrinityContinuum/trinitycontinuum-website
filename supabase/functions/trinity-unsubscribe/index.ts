// Public unsubscribe handler; deploy only after DNS, policy and consent review.
// Token is base64url(email).hex(HMAC-SHA256(secret,base64url(email))).
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const page=(msg:string)=>new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Trinity email preferences</title><main style="max-width:38rem;margin:5rem auto;font:1.2rem system-ui"><h1>Email preferences</h1><p>'+msg+'</p></main></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(!['GET','POST'].includes(req.method))return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('TRINITY_UNSUBSCRIBE_SECRET');
 if(!secret)return new Response('Unavailable',{status:503});
 const token=new URL(req.url).searchParams.get('token')||'';
 const [payload,sig,extra]=token.split('.');
 if(extra||!payload||!sig||!/^[a-f0-9]{64}$/.test(sig)||payload.length>600)return page('This link is invalid. Please contact Trinity directly.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'HMAC',false,['verify']);
 const signature=Uint8Array.from(sig.match(/../g)!.map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(payload)))return page('This link is invalid. Please contact Trinity directly.');
 let email='';
 try{email=atob(payload.replace(/-/g,'+').replace(/_/g,'/')).toLowerCase()}catch{return page('This link is invalid.')}
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>200)return page('This link is invalid.');
 if(req.method==='GET')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Trinity email preferences</title><main style="max-width:38rem;margin:5rem auto;font:1.2rem system-ui"><h1>Stop Trinity outreach emails</h1><p>Confirm that you no longer wish to receive Trinity Continuum outreach emails.</p><form method="post"><button type="submit">Unsubscribe</button></form></main></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {error}=await db.from('trinity_suppressions').upsert({email,reason:'recipient_unsubscribe'},{onConflict:'email'});
 if(error)return page('We could not process your request. Please contact Trinity directly.');
 await db.from('trinity_contacts').update({status:'suppressed'}).eq('email',email);
 return page('Your email address has been removed from future outreach. Thank you.');
});