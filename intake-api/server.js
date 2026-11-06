import express from 'express';
import helmet from 'helmet';
import pg from 'pg';
import nodemailer from 'nodemailer';
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
const required=['DATABASE_URL','ADMIN_TOKEN','SMTP_HOST','SMTP_USER','SMTP_PASS','MAIL_FROM'];
for(const key of required)if(!process.env[key])console.error('Missing required configuration: '+key);
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:undefined});
const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:Number(process.env.SMTP_PORT||465)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
function admin(req,res,next){const token=process.env.ADMIN_TOKEN;if(!token||token.length<32)return res.sendStatus(503);const received=(req.headers.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(token),b=Buffer.from(received);if(a.length!==b.length||!timingSafeEqual(a,b))return res.sendStatus(401);next()}
async function sendMail(row){const d=row.payload,subject='Trinity inquiry '+row.id+' · '+row.category;
 const tasks=[{to:'jack@trinitycontinuum.com',subject,replyTo:d.email,text:'New Trinity inquiry '+row.id+'\nCategory: '+row.category+'\nName: '+d.name+'\nOrganization: '+d.organization+'\nEmail: '+d.email+'\nProject: '+d.project_title+'\nDescription: '+d.description+'\nRetrieve full record from restricted administrator interface.'},
 {to:d.email,subject:'Trinity Continuum inquiry received · '+row.id,text:'Thank you for contacting Trinity Continuum. Your inquiry reference is '+row.id+'. Trinity will review your request. Please do not send confidential engineering documents in reply unless Trinity arranges a secure channel.'}];
 for(const t of tasks)await transport.sendMail({from:process.env.MAIL_FROM,...t});
 await db.query("UPDATE inquiries SET email_state='sent',notified_at=now(),acknowledged_at=now(),last_mail_error=NULL,mail_attempts=mail_attempts+1 WHERE id=$1",[row.id]);
}
app.get('/health',(req,res)=>res.json({status:'up'}));
app.post('/api/inquiries',rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res)=>{
 const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid inquiry',fields:parsed.error.flatten().fieldErrors});
 const d=parsed.data;const id=randomUUID();try{
 await db.query('INSERT INTO inquiries(id,category,payload) VALUES($1,$2,$3)',[id,d.category,JSON.stringify({...d,email:d.email.toLowerCase(),submitted_at:new Date().toISOString()})]);
 res.status(202).json({id,status:'received'});
 // Deliberately async after durable save: errors remain visible for operator retries.
 const row={id,category:d.category,payload:d};try{await sendMail(row)}catch(e){console.error('mail delivery failed for inquiry',id);await db.query("UPDATE inquiries SET email_state='failed',mail_attempts=mail_attempts+1,last_mail_error=$2 WHERE id=$1",[id,String(e.message).slice(0,300)])}
 }catch(e){console.error('database write failed');if(!res.headersSent)res.status(503).json({error:'Submission unavailable. Please use Trinity contact email.'})}
});
app.get('/api/admin/inquiries',admin,async(req,res)=>{try{const {rows}=await db.query('SELECT id,created_at,category,status,owner,next_follow_up,email_state,mail_attempts,notified_at,acknowledged_at,payload FROM inquiries ORDER BY created_at DESC LIMIT 500');res.setHeader('Cache-Control','no-store');res.json({inquiries:rows})}catch{res.sendStatus(503)}});
app.post('/api/admin/inquiries/:id/retry',admin,async(req,res)=>{try{const {rows}=await db.query("SELECT * FROM inquiries WHERE id=$1 AND email_state!='sent'",[req.params.id]);if(!rows.length)return res.sendStatus(404);await sendMail(rows[0]);res.json({status:'sent'})}catch(e){console.error('retry failed');res.status(502).json({error:'Mail retry failed'})}});
app.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('Trinity inquiry service started'));
