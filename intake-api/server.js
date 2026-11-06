import express from 'express';
import helmet from 'helmet';
import pg from 'pg';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {randomUUID,timingSafeEqual} from 'node:crypto';
const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({limit:'24kb'}));
const allowedOrigin=process.env.PUBLIC_ORIGIN||'https://trinitycontinuum.com';
app.use((req,res,next)=>{res.setHeader('Vary','Origin');if(req.headers.origin===allowedOrigin){res.setHeader('Access-Control-Allow-Origin',allowedOrigin);res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS,PATCH')}if(req.method==='OPTIONS')return res.sendStatus(req.headers.origin===allowedOrigin?204:403);next()});
const reqText=(max=200)=>z.string().trim().min(1).max(max);
const optional=(max=1000)=>z.string().trim().max(max).optional().default('');
const schema=z.object({
 category:z.enum(['A','B','C','D','E','F','G']),name:reqText(120),organization:reqText(160),
 email:z.string().trim().email().max(200),role:reqText(120),project_title:reqText(180),
 city:reqText(160),state:reqText(120),contact_method:z.enum(['email','callback']),
 phone:optional(60),website:optional(300),referral:optional(200),description:reqText(5000),
 consent:z.literal(true),trucker_interest:z.boolean().optional().default(false),
 water_volume:optional(120),feedwater:optional(250),water_details:optional(1000),
 power_capacity:optional(120),power_details:optional(1000),thermal_details:optional(1000),
 site_details:optional(1000),timeline:optional(250),budget:optional(120),
 factory_location:optional(200),land_status:optional(200),construction_scope:optional(1500),
 equipment:optional(1500),bid_details:optional(1500),trucker_region:optional(200),
 trucker_use:optional(1000),trucker_model:optional(1000),website_source:optional(150),
 honeypot:z.string().max(0).optional().default('')
}).strict().superRefine((v,ctx)=>{if(v.contact_method==='callback'&&!v.phone)ctx.addIssue({code:'custom',path:['phone'],message:'Phone is required for callback'});if(v.trucker_interest&&v.category!=='C')ctx.addIssue({code:'custom',path:['trucker_interest'],message:'Trucker interest requires category C'})});
const required=['DATABASE_URL','ADMIN_TOKEN'];
for(const key of required)if(!process.env[key])throw new Error('Missing required configuration: '+key);
if(process.env.ADMIN_TOKEN.length<32)throw new Error('ADMIN_TOKEN must contain at least 32 characters');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:undefined});

function admin(req,res,next){const token=process.env.ADMIN_TOKEN;if(!token||token.length<32)return res.sendStatus(503);const received=(req.headers.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(token),b=Buffer.from(received);if(a.length!==b.length||!timingSafeEqual(a,b))return res.sendStatus(401);next()}
app.get('/health',(req,res)=>res.json({status:'up'}));
app.get('/ready',async(req,res)=>{try{await db.query('SELECT 1');res.json({status:'ready'})}catch{res.status(503).json({status:'unavailable'})}});
app.post('/api/inquiries',rateLimit({windowMs:15*60*1000,limit:process.env.NODE_ENV==='test'?100:5,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res)=>{
 const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid inquiry',fields:parsed.error.flatten().fieldErrors});
 const d=parsed.data;const id=randomUUID();
 let client;try{client=await db.connect()}catch{ return res.status(503).json({error:'Submission unavailable. Please use Trinity contact email.'}) }
try{await client.query('BEGIN');await client.query('INSERT INTO inquiries(id,category,payload) VALUES($1,$2,$3)',[id,d.category,JSON.stringify({...d,email:d.email.toLowerCase(),submitted_at:new Date().toISOString()})]);await client.query("INSERT INTO inquiry_mail_jobs(inquiry_id,kind,recipient) VALUES($1,'notify',$2),($1,'ack',$3)",[id,'jack@trinitycontinuum.com',d.email.toLowerCase()]);await client.query('COMMIT');res.status(202).json({id,status:'received'});}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('inquiry transaction failed');res.status(503).json({error:'Submission unavailable. Please use Trinity contact email.'})}finally{client.release()}

});
app.get('/api/admin/inquiries',admin,async(req,res)=>{try{const {rows}=await db.query(`SELECT i.id,i.created_at,i.category,i.status,i.owner,i.next_follow_up,i.notified_at,i.acknowledged_at,i.payload,coalesce(jsonb_agg(jsonb_build_object('kind',j.kind,'state',j.state,'attempts',j.attempts,'last_error',j.last_error,'sent_at',j.sent_at)) FILTER (WHERE j.id IS NOT NULL),'[]'::jsonb) AS deliveries FROM inquiries i LEFT JOIN inquiry_mail_jobs j ON j.inquiry_id=i.id GROUP BY i.id ORDER BY i.created_at DESC LIMIT 500`);res.setHeader('Cache-Control','no-store');res.json({inquiries:rows})}catch{res.sendStatus(503)}});
app.get('/api/admin/operations',admin,async(req,res)=>{
 try{
  const [queue,followups]=await Promise.all([
   db.query(`SELECT state,count(*)::int AS count FROM inquiry_mail_jobs GROUP BY state`),
   db.query(`SELECT count(*)::int AS overdue FROM inquiries WHERE next_follow_up < now() AND status <> 'closed'`)
  ]);
  const counts={pending:0,processing:0,sent:0,failed:0};
  for(const row of queue.rows)counts[row.state]=row.count;
  const stuck=await db.query("SELECT count(*)::int AS count FROM inquiry_mail_jobs WHERE state='processing' AND locked_at < now()-interval '15 minutes'");
  const due=await db.query("SELECT count(*)::int AS count FROM inquiry_mail_jobs WHERE state='pending' AND next_attempt_at <= now()");
  res.setHeader('Cache-Control','no-store');
  res.json({queue:counts,due:due.rows[0].count,stuck:stuck.rows[0].count,overdue_followups:followups.rows[0].overdue,generated_at:new Date().toISOString()});
 }catch{res.sendStatus(503)}
});
const adminUpdateSchema=z.object({status:z.enum(['new','reviewing','awaiting_customer','closed']),owner:z.string().trim().max(120).nullable().optional(),next_follow_up:z.string().datetime({offset:true}).nullable().optional()}).strict();
app.patch('/api/admin/inquiries/:id',admin,async(req,res)=>{
 const parsed=adminUpdateSchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:'Invalid administrative update'});
 if(!Object.keys(parsed.data).length)return res.status(400).json({error:'No changes supplied'});
 try{
  const fields=[],values=[];
  for(const [key,value] of Object.entries(parsed.data)){
   values.push(value);
   fields.push(key+'=$'+values.length);
  }
  values.push(req.params.id);
  const result=await db.query('UPDATE inquiries SET '+fields.join(',')+' WHERE id=$'+values.length+' RETURNING id,status,owner,next_follow_up',values);
  if(!result.rowCount)return res.sendStatus(404);
  res.setHeader('Cache-Control','no-store');
  res.json({inquiry:result.rows[0]});
 }catch{res.sendStatus(503)}
});
app.post('/api/admin/inquiries/:id/retry',admin,async(req,res)=>{try{const {rowCount}=await db.query("UPDATE inquiry_mail_jobs SET state='pending',next_attempt_at=now(),last_error=NULL WHERE inquiry_id=$1 AND state='failed'",[req.params.id]);res.json({jobs_requeued:rowCount})}catch{res.sendStatus(503)}});
app.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Trinity inquiry service started'));
