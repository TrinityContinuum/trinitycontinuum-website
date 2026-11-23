// Private Jack-controlled availability. Mount only behind admin authentication + CSRF checks.
const reply=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function openSlotsApi(req,env){
 if(!env.DB)return reply({error:'Database unavailable'},503);
 const u=new URL(req.url);
 if(req.method==='GET'){
  try{const r=await env.DB.prepare("SELECT * FROM scheduler_open_slots WHERE end_utc >= ? ORDER BY start_utc LIMIT 200").bind(new Date().toISOString()).all();return reply({slots:r.results||[]})}catch{return reply({error:'Slots unavailable'},503)}
 }
 if(req.method==='POST'){
  let x;try{x=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  const start=Date.parse(x?.start),end=Date.parse(x?.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>12*3600000||start<Date.now()||start>Date.now()+90*86400000)return reply({error:'Invalid availability window'},400);
  const id=crypto.randomUUID();
  try{await env.DB.prepare('INSERT INTO scheduler_open_slots(id,start_utc,end_utc,created_by) VALUES(?,?,?,?)').bind(id,new Date(start).toISOString(),new Date(end).toISOString(),'Jack administrator').run();return reply({ok:true,id},201)}catch{return reply({error:'Unable to open availability'},503)}
 }
 const m=/^\/api\/scheduler\/open-slots\/([0-9a-f-]{36})$/.exec(u.pathname);
 if(m&&req.method==='DELETE'){
  try{const r=await env.DB.prepare('UPDATE scheduler_open_slots SET enabled=0 WHERE id=?').bind(m[1]).run();return r.meta?.changes?reply({ok:true}):reply({error:'Not found'},404)}catch{return reply({error:'Unable to close availability'},503)}
 }
 return reply({error:'Method not allowed'},405);
}
