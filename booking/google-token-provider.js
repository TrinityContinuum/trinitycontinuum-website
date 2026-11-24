// Production token acquisition stays inside the Worker. Never log token responses.
export function googleTokenProvider(env, transport=fetch){
 let cached=null, expiry=0, pending=null;
 return async function getAccessToken(){
  if(cached&&Date.now()<expiry)return cached;
  if(pending)return pending;
  pending=(async()=>{
   if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN)throw Error('Calendar authorization not configured');
   const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'});
   const response=await transport('https://oauth2.googleapis.com/token',{method:'POST',body,signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Calendar authorization unavailable');
   const data=await response.json();
   if(typeof data.access_token!=='string'||!data.access_token)throw Error('Calendar authorization unavailable');
   cached=data.access_token;
   expiry=Date.now()+Math.max(0,(Number(data.expires_in)||0)-60)*1000;
   return cached;
  })();
  try{return await pending;}finally{pending=null;}
 };
}
