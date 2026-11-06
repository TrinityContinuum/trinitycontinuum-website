import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import pg from 'pg';

const url=process.env.INTEGRATION_DATABASE_URL;
const integration=url?test:test.skip;
integration('HTTP submission persists inquiry and both notification jobs atomically',async()=>{
 const db=new pg.Pool({connectionString:url});
 let server;
 try{
  await db.query(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  server=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',DATABASE_URL:url,ADMIN_TOKEN:'integration-test-admin-token-at-least-32-chars',PORT:'19077',PUBLIC_ORIGIN:'https://trinitycontinuum.com'},stdio:'pipe'});
  let ready=false;
  for(let n=0;n<60;n++){
   if(server.exitCode!==null)throw Error('API process exited before readiness');
   try{const response=await fetch('http://127.0.0.1:19077/ready');if(response.ok){ready=true;break}}catch{}
   await new Promise(resolve=>setTimeout(resolve,150));
  }
  assert.ok(ready,'API should reach database readiness');
  const body={category:'C',name:'CI Sample',organization:'CI Test Organization',email:'ci-example@example.com',role:'Testing',project_title:'Automated Test',city:'Houston',state:'Texas',contact_method:'email',description:'CI only test inquiry. Not a real customer.',consent:true,trucker_interest:true,trucker_region:'Texas',trucker_use:'Mobile water use',trucker_model:'Owner operator'};
  const post=await fetch('http://127.0.0.1:19077/api/inquiries',{method:'POST',headers:{'content-type':'application/json',origin:'https://trinitycontinuum.com'},body:JSON.stringify(body)});
  const responseText=await post.text();assert.equal(post.status,202,responseText);const result=JSON.parse(responseText);
  assert.match(result.id,/^[0-9a-f-]{36}$/);
  const inquiry=await db.query('SELECT category,payload FROM inquiries WHERE id=$1',[result.id]);
  assert.equal(inquiry.rowCount,1);assert.equal(inquiry.rows[0].category,'C');assert.equal(inquiry.rows[0].payload.trucker_interest,true);
  const jobs=await db.query('SELECT kind,recipient,state FROM inquiry_mail_jobs WHERE inquiry_id=$1 ORDER BY kind',[result.id]);
  assert.deepEqual(jobs.rows.map(row=>row.kind),['ack','notify']);
  assert.equal(jobs.rows.find(row=>row.kind==='notify').recipient,'jack@trinitycontinuum.com');
  assert.equal(jobs.rows.find(row=>row.kind==='ack').recipient,'ci-example@example.com');
  assert.ok(jobs.rows.every(row=>row.state==='pending'));
  // Verify every public inquiry category uses the same durable transaction path.
  for(const category of ['A','B','D','E','F','G']){
   const categoryBody={...body,category,trucker_interest:false};
   delete categoryBody.trucker_region;delete categoryBody.trucker_use;delete categoryBody.trucker_model;
   const response=await fetch('http://127.0.0.1:19077/api/inquiries',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(categoryBody)});
   const text=await response.text();assert.equal(response.status,202,'Category '+category+': '+text);
   const accepted=JSON.parse(text);
   const saved=await db.query('SELECT category FROM inquiries WHERE id=$1',[accepted.id]);
   assert.equal(saved.rows[0]?.category,category);
   const outbox=await db.query('SELECT kind FROM inquiry_mail_jobs WHERE inquiry_id=$1 ORDER BY kind',[accepted.id]);
   assert.deepEqual(outbox.rows.map(x=>x.kind),['ack','notify']);
  }
  const invalid=await fetch('http://127.0.0.1:19077/api/inquiries',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,contact_method:'callback',phone:''})});
  assert.equal(invalid.status,400);
  const count=await db.query('SELECT count(*)::int AS n FROM inquiries WHERE payload->>\'email\'=$1',['ci-example@example.com']);
  assert.equal(count.rows[0].n,7,'invalid inquiry must not persist');
  // A failed SMTP connection must preserve the job and schedule a retry, not mark it sent.
  const worker=spawn(process.execPath,['mail-worker.js'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url,SMTP_HOST:'127.0.0.1',SMTP_PORT:'19999',SMTP_USER:'ci',SMTP_PASS:'ci',MAIL_FROM:'ci@example.com',MAIL_WORKER_ONCE:'true'},stdio:'pipe'});
  const workerExit=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{worker.kill();reject(Error('mail worker timed out'))},12000);worker.once('error',reject);worker.once('exit',code=>{clearTimeout(timeout);resolve(code)})});
  assert.equal(workerExit,0,'worker should handle SMTP delivery failures without crashing');
  const retry=await db.query("SELECT attempts,state,last_error,next_attempt_at>now() AS scheduled FROM inquiry_mail_jobs WHERE attempts>0 LIMIT 1");
  assert.equal(retry.rowCount,1);
  assert.equal(retry.rows[0].attempts,1);
  assert.equal(retry.rows[0].state,'pending');
  assert.ok(retry.rows[0].last_error);
  assert.equal(retry.rows[0].scheduled,true);
  const unauth=await fetch('http://127.0.0.1:19077/api/admin/inquiries');
  assert.equal(unauth.status,401);
  const auth=await fetch('http://127.0.0.1:19077/api/admin/inquiries',{headers:{authorization:'Bearer integration-test-admin-token-at-least-32-chars'}});
  assert.equal(auth.status,200);
  assert.ok((await auth.json()).inquiries.some(i=>i.id===result.id));
 }finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,2000)})}
  await db.end();
 }
});
