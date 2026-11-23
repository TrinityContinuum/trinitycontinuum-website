// Public-facing Trinity site audit: read-only GET/HEAD + local source inventory.
// Does not submit forms, call admin endpoints, create bookings, or send mail.
import fs from "node:fs";
import path from "node:path";

const ORIGIN="https://trinitycontinuum.com";
const all=fs.readdirSync(".").filter(n=>/^[a-z0-9-]+\.html$/i.test(n)).sort();
const findings=[],pages=[],publicChecks=[];
const known=new Set([...all,...fs.readdirSync("assets").map(x=>"assets/"+x),...fs.readdirSync("tools").map(x=>"tools/"+x),"sitemap.xml","robots.txt","CNAME"]);
const check=(level,code,page,detail)=>findings.push({level,code,page,detail});
function attrs(tag){
 const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))out[m[1].toLowerCase()]=m[2]??m[3]??m[4]??"";
 return out;
}
function isLocal(x){
 return x&&!/^(?:https?:|\/\/|mailto:|tel:|data:|javascript:|#|about:)/i.test(x);
}
function clean(s){try{return decodeURIComponent(s.split(/[?#]/)[0])}catch{return s.split(/[?#]/)[0]}}
const idsByPage=new Map();
for(const filename of all){
 const html=fs.readFileSync(filename,"utf8");const idCounts=new Map();
 for(const tag of html.match(/<[^>]+>/g)||[]){
  const a=attrs(tag);
  if(a.id)idCounts.set(a.id,(idCounts.get(a.id)||0)+1);
 }
 idsByPage.set(filename,idCounts);
}
for(const filename of all){
 const html=fs.readFileSync(filename,"utf8");const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"";
 const tags=[...html.matchAll(/<(?:a|link|script|img|source|iframe|video|form)\b[^>]*>/gi)];
 const local=[],broken=[],external=[],pictures=[],forms=[],anchors=[];
 for(const m of tags){
  const tag=m[0],kind=(tag.match(/^<([\w-]+)/)||[])[1].toLowerCase(),a=attrs(tag);
  if(kind==="img"){pictures.push({src:a.src||"",alt:a.alt||""});if(!a.alt?.trim())check("warn","missing_image_alt",filename,a.src||"unnamed image");}
  if(kind==="iframe" && !(a.title||"").trim())check("warn","unlabeled_iframe",filename,a.src||"");
  if(kind==="form")forms.push({id:a.id||"",action:a.action||"",method:a.method||"get"});
  for(const prop of ["href","src","poster"]){
   if(!a[prop])continue;const u=a[prop];
   if(/^(http:)/i.test(u))check("warn","insecure_link",filename,u);
   if(/^https?:/i.test(u)){external.push(u);continue}
   if(u.startsWith("#")){anchors.push({target:filename,hash:u.slice(1),source:u});continue}
   if(!isLocal(u))continue;
   const raw=clean(u);
   const target=raw.startsWith("/")?raw.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(filename),raw));
   const targetFile=target.endsWith("/")?target+"index.html":target;
   local.push({kind,ref:u,target:targetFile});
   if(!known.has(targetFile)&&!fs.existsSync(targetFile)){
    check("error","missing_local_target",filename,kind+": "+u+" => "+targetFile);
    broken.push(u);
   }
   const hash=u.includes("#")?u.split("#")[1].split("?")[0]:null;
   if(hash)anchors.push({target:targetFile,hash,source:u});
  }
 }
 for(const {target,hash,source} of anchors){
  if(!hash||!idsByPage.has(target))continue;
  if(!idsByPage.get(target).has(hash))check("warn","broken_internal_anchor",filename,source);
 }
 for(const [id,n] of idsByPage.get(filename))if(n>1)check("warn","duplicate_dom_id",filename,id+" x "+n);
 if(!title.trim())check("warn","missing_title",filename,"title missing");
 const h1s=(html.match(/<h1\b/gi)||[]).length;
 if(h1s!==1)check("warn","heading_count",filename,"h1 count="+h1s);
 const nav=(html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i)||[])[0]||"";
 if(!nav.includes("index.html")&&!filename.startsWith("404"))check("warn","nav_no_home",filename,"No homepage navigation");
 pages.push({page:filename,title:title.trim(),h1s,images:pictures.length,forms,localRefs:local.length,externalRefs:external.length,brokenLocal:broken});
}
async function http(url,method="GET"){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),18000);
 try{
  const res=await fetch(url,{method,redirect:"follow",signal:ctrl.signal,headers:{"User-Agent":"TrinityPublicSiteAudit-ReadOnly/1.0","Cache-Control":"no-cache"}});
  let length=0;
  if(method==="GET"){const body=await res.text();length=body.length;}
  return {code:res.status,final:res.url,contentType:res.headers.get("content-type")||"",length};
 }catch(e){return {error:e?.name||String(e)}}
 finally{clearTimeout(timeout)}
}
// Check every existing HTML page actually responds; 6 at a time to respect host.
for(let i=0;i<all.length;i+=6){
 const batch=await Promise.all(all.slice(i,i+6).map(async p=>({page:p,result:await http(ORIGIN+"/"+p+"?audit=20261122")})));
 for(const x of batch){
  publicChecks.push(x);
  if(x.result.error||x.result.code!==200)check("error","public_html_failure",x.page,JSON.stringify(x.result));
  else if(!/html/i.test(x.result.contentType))check("warn","wrong_html_mime",x.page,x.result.contentType);
 }
}
for(const p of ["assets/trinity-intro.js","assets/trinity-intro-captioned.mp4","assets/style.css","assets/gallery-six-trailer-storyboard.svg","assets/gallery-factory-layout.svg","assets/gallery-manufacturing-blueprint.svg","assets/gallery-manufacturing-overview.svg","assets/gallery-deployment.svg","assets/sh685-control.png","sitemap.xml","robots.txt"]){
 const res=await http(ORIGIN+"/"+p,"HEAD");
 publicChecks.push({page:p,method:"HEAD",result:res});
 if(res.error||res.code!==200)check("error","public_asset_failure",p,JSON.stringify(res));
}
const index=fs.readFileSync("index.html","utf8");
const films=fs.readFileSync("film-presentations.html","utf8");
if(!index.includes('src="assets/trinity-intro.js"'))check("error","intro_not_loaded","index.html","Original intro script not linked");
if(!fs.readFileSync("assets/trinity-intro.js","utf8").includes("window.location.assign('film-presentations.html')"))check("error","intro_route_missing","assets/trinity-intro.js","Expected on-ended route absent");
const embeds=[...films.matchAll(/<iframe\b[^>]*src="(https:\/\/app\.heygen\.com\/embeds\/[^"]+)"/g)].map(z=>z[1]);
if(embeds.length!==4)check("error","four_film_count","film-presentations.html","Present embeds="+embeds.length);
const report={
 timestamp:new Date().toISOString(),origin:ORIGIN,
 summary:{htmlPages:all.length,publicHtmlPass:publicChecks.filter(x=>x.page.endsWith(".html")&&x.result.code===200).length,publicAssetsPass:publicChecks.filter(x=>x.method==="HEAD"&&x.result.code===200).length,embedCount:embeds.length,errors:findings.filter(x=>x.level==="error").length,warnings:findings.filter(x=>x.level==="warn").length},
 pages,publicChecks,findings,
 scope:"GET/HEAD public routes only; does NOT verify submission/notification, private Drive permissions, speaker intelligibility, CRM or actual owner calendar bookings."
};
fs.mkdirSync("audit-output",{recursive:true});
fs.writeFileSync("audit-output/public-site-audit.json",JSON.stringify(report,null,2));
console.log("AUDIT SUMMARY",JSON.stringify(report.summary));
for(const x of findings)console.log(x.level.toUpperCase(),x.code,x.page,x.detail);
if(report.summary.errors)process.exitCode=1;
