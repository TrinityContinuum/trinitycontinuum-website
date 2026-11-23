import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const code=readFileSync(new URL("../cloudflare/appointment-queue/admin.js",import.meta.url),"utf8");
const {default:admin}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const secret="TEST-ONLY-NEVER-DEPLOY-TRINITY-PRIVATE-ADMIN-SECRET-2026";
const encoded="Basic "+Buffer.from("jack:"+secret).toString("base64");
const exampleId="11111111-1111-4111-8111-111111111111";
function mockEnvironment(){
 const record={id:exampleId,name:"Synthetic Test",email:"synthetic@example.invalid",organization:"Test",
    date1:"2026-12-02",time1:"13:30",date2:"2026-12-03",time2:"14:00",timezone:"America/Chicago (Central)",
    topic:"Internal-only source test",notification_status:"pending",created_at:"2026-11-22T00:00:00Z"};
 const decisions=new Map();
 const env={
  ADMIN_PASSWORD:secret,APPROVER_EMAILS:"jack@trinitycontinuum.com",
  DB:{prepare(sql){
   let args=[];
   return {
    bind(...values){args=values;return this},
    async first(){
     if(sql.startsWith("SELECT id,date1,time1"))return args[0]===exampleId?record:null;
     if(sql.startsWith("SELECT choice,approved_by,decided_at,notification_state"))return decisions.get(args[0])||null;
     throw Error("Unexpected database first query: "+sql.slice(0,100));
    },
    async all(){
     if(!sql.startsWith("SELECT a.id,a.name,a.email"))throw Error("Unexpected database all query");
     const saved=decisions.get(exampleId);
     return {results:[{...record,recorded_choice:saved?.choice??null,
        decision_by:saved?.approved_by??null,response_state:saved?.notification_state??null}]};
    },
    async run(){
     if(!sql.startsWith("INSERT OR IGNORE INTO appointment_decisions"))throw Error("Unexpected DB mutation");
     if(!decisions.has(args[0]))decisions.set(args[0],{
       choice:args[1],approved_by:args[2],decided_at:"2026-11-22 19:00:00",notification_state:"not_sent"});
     return {meta:{changes:1}};
    }
   };
  }}
 };
 return {env,decisions};
}
function request(path,{headers={},method="GET",body}={}){
 return new Request("https://trinity-private-admin.example.invalid"+path,{
  method,headers, ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
}
test("No admin password or an incorrect password never permits reading the queue",async()=>{
 const {env}=mockEnvironment();
 for(const pathname of ["/","/api/requests","/api/decisions","/api/automation-status","/api/approve-and-send"]){
  let r=await admin.fetch(request(pathname),env);
  assert.equal(r.status,401,pathname+" must require authentication");
  assert.match(r.headers.get("www-authenticate")||"",/Trinity Private Appointments/);
 }
 assert.equal((await admin.fetch(request("/api/requests",{headers:{Authorization:"Basic "+Buffer.from("jack:wrong").toString("base64")}}),env)).status,401);
 env.ADMIN_PASSWORD="";
 assert.equal((await admin.fetch(request("/"),env)).status,401);
});
test("Authorized Jack can open only private dashboard with manual action controls",async()=>{
 const {env}=mockEnvironment();
 const r=await admin.fetch(request("/",{headers:{Authorization:encoded}}),env);
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-type")||"",/text\/html/);
 assert.equal(r.headers.get("cache-control"),"no-store");
 const html=await r.text();
 for(const phrase of ["Private Appointment Queue","Copy reply text","Open addressed email draft","Open Google Calendar event","Record Jack"])
  assert.ok(html.includes(phrase),"missing private manual control: "+phrase);
 assert.ok(!html.includes("paste into Namecheap Reply"),"outdated mail client reference remains");
 assert.ok(html.includes("corporate Gmail Reply"));
});
test("Authorized private queue returns only the authenticated synthetic example",async()=>{
 const {env}=mockEnvironment();
 const r=await admin.fetch(request("/api/requests",{headers:{Authorization:encoded}}),env);
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
 const data=await r.json();
 assert.equal(data.requests.length,1);
 assert.equal(data.requests[0].id,exampleId);
 assert.equal(data.requests[0].name,"Synthetic Test");
});
test("Jack can record exactly one manual decision without sending an email or booking a meeting",async()=>{
 const {env,decisions}=mockEnvironment();
 const headers={Authorization:encoded,"Content-Type":"application/json"};
 const body={id:exampleId,choice:"first"};
 let r=await admin.fetch(request("/api/decisions",{headers,method:"POST",body}),env);
 assert.equal(r.status,200);let v=await r.json();
 assert.equal(v.decision.notification_state,"not_sent");
 assert.equal(decisions.size,1);
 assert.match(v.message,/No email sent and no meeting booked/);
 r=await admin.fetch(request("/api/decisions",{headers,method:"POST",body:{id:exampleId,choice:"second"}}),env);
 assert.equal(r.status,409,"conflicting decision cannot overwrite Jack's earlier choice");
 assert.equal(decisions.get(exampleId).choice,"first");
});
test("Automation stays off without calendar and sending-provider credentials",async()=>{
 const {env}=mockEnvironment();
 const headers={Authorization:encoded};
 let r=await admin.fetch(request("/api/automation-status",{headers}),env);
 assert.equal(r.status,200);const v=await r.json();
 assert.equal(v.enabled,false);
 r=await admin.fetch(request("/api/approve-and-send",{
  method:"POST",headers:{...headers,"Content-Type":"application/json"},body:{id:exampleId,choice:"first"}}),env);
 assert.equal(r.status,503);
});
test("Missing approver identity or DB binding fails closed after authentication",async()=>{
 const {env}=mockEnvironment();
 env.APPROVER_EMAILS="somebody-else@example.invalid";
 let r=await admin.fetch(request("/api/requests",{headers:{Authorization:encoded}}),env);
 assert.equal(r.status,503);
 env.APPROVER_EMAILS="jack@trinitycontinuum.com";delete env.DB;
 r=await admin.fetch(request("/api/requests",{headers:{Authorization:encoded}}),env);
 assert.equal(r.status,503);
});
