// Outbound email adapter for Trinity's approved Namecheap-backed gateway.
// Requires an HTTPS endpoint and secret set as Cloudflare Worker secrets.
// Never routes mail through a Gmail account or stores passwords in Git.
export function mailConfigured(env){return Boolean(env.TRINITY_MAIL_GATEWAY_URL&&env.TRINITY_MAIL_GATEWAY_TOKEN);}
export async function sendBookingMail(env,{to,subject,body,idempotencyKey}){
 if(!mailConfigured(env))throw Error('mail_not_configured');
 const url=new URL(env.TRINITY_MAIL_GATEWAY_URL);
 if(url.protocol!=='https:')throw Error('mail_gateway_must_use_https');
 const response=await fetch(url.toString(),{method:'POST',headers:{
  'authorization':'Bearer '+env.TRINITY_MAIL_GATEWAY_TOKEN,
  'content-type':'application/json','idempotency-key':idempotencyKey
 },body:JSON.stringify({from:'jack@trinitycontinuum.com',to,subject,text:body,idempotency_key:idempotencyKey})});
 if(!response.ok)throw Error('mail_http_'+response.status);
 return response.json();
}
