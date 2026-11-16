// Cloudflare Worker module. Mount only behind the authenticated administrator
// Worker. The caller must enforce MFA/session auth, CSRF protection and rate limits.
const STATUSES = new Set(['interested','awaiting_our_response','awaiting_their_response','scheduling','scheduled','completed','declined','cancelled']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const allowed=(value)=>STATUSES.has(value);
export async function opportunityApi(req,env){
  if(!env.DB) return json({error:'Database unavailable'},503);
  const url=new URL(req.url);
  if(url.pathname==='/api/opportunities'&&req.method==='GET'){
    const status=url.searchParams.get('status');
    if(status&&!allowed(status))return json({error:'Invalid status'},400);
    try{
      const q=status
        ? await env.DB.prepare('SELECT * FROM scheduling_opportunities WHERE status=? ORDER BY next_action_at IS NULL,next_action_at,created_at DESC LIMIT 200').bind(status).all()
        : await env.DB.prepare('SELECT * FROM scheduling_opportunities ORDER BY CASE WHEN status IN (\'interested\',\'awaiting_our_response\',\'scheduling\') THEN 0 ELSE 1 END,next_action_at IS NULL,next_action_at,created_at DESC LIMIT 200').all();
      return json({opportunities:q.results||[]});
    }catch{return json({error:'Queue unavailable'},503)}
  }
  if(url.pathname==='/api/opportunities'&&req.method==='POST'){
    if(!(req.headers.get('content-type')||'').startsWith('application/json'))return json({error:'JSON required'},415);
    let a;try{a=await req.json()}catch{return json({error:'Invalid JSON'},400)}
    const organization=clean(a?.organization,150),contact=clean(a?.contact_name,120),email=clean(a?.contact_email,200);
    const status=clean(a?.status,40)||'interested';
    if(!organization||!allowed(status)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Invalid opportunity'},400);
    const id=crypto.randomUUID();
    try{
      await env.DB.prepare('INSERT INTO scheduling_opportunities(id,organization,contact_name,contact_email,subject,status,next_action,owner,source_reference,notes) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .bind(id,organization,contact,email,clean(a?.subject,250),status,clean(a?.next_action,500),clean(a?.owner,120),clean(a?.source_reference,250),clean(a?.notes,1500)).run();
      return json({ok:true,id},201);
    }catch{return json({error:'Could not save opportunity'},503)}
  }
  const match=/^\/api\/opportunities\/([0-9a-f-]{36})$/.exec(url.pathname);
  if(match&&req.method==='PATCH'){
    if(!(req.headers.get('content-type')||'').startsWith('application/json'))return json({error:'JSON required'},415);
    let a;try{a=await req.json()}catch{return json({error:'Invalid JSON'},400)}
    const status=clean(a?.status,40),nextAction=clean(a?.next_action,500);
    if(!allowed(status))return json({error:'Invalid status'},400);
    try{
      const result=await env.DB.prepare("UPDATE scheduling_opportunities SET status=?,next_action=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(status,nextAction,match[1]).run();
      return result.meta?.changes?json({ok:true}):json({error:'Not found'},404);
    }catch{return json({error:'Could not update opportunity'},503)}
  }
  return json({error:'Not found'},404);
}
