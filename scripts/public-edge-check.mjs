// Read-only public edge, redirect and initial performance-resource audit.
// No form submission, Analytics calls or private console access.
import fs from "node:fs";
const urls=[
 "https://trinitycontinuum.com/",
 "https://www.trinitycontinuum.com/",
 "http://trinitycontinuum.com/",
 "http://www.trinitycontinuum.com/",
 "https://trinitycontinuum.com/contact.html",
 "https://trinitycontinuum.com/meetings.html",
 "https://trinitycontinuum.com/film-presentations.html"
];
const check=async (url,method="GET")=>{
 const a=AbortSignal.timeout(20000);const t=Date.now();
 try{
  const r=await fetch(url,{method,redirect:"follow",signal:a,headers:{"User-Agent":"Trinity-Public-Edge-ReadOnly/2026-11","Cache-Control":"no-cache"}});
  const size=method==="GET"?(await r.text()).length:0;
  return {url,status:r.status,finalUrl:r.url,elapsedMs:Date.now()-t,contentType:r.headers.get("content-type"),cache:r.headers.get("cache-control"),bytesRead:size};
 }catch(e){return{url,error:String(e).slice(0,250),elapsedMs:Date.now()-t}}
};
const results=[];
for(const u of urls){results.push(await check(u))}
const weights=[];
for(const p of ["assets/trinity-intro-captioned.mp4","assets/gallery-deployment.svg","assets/gallery-factory-layout.svg","assets/gallery-manufacturing-blueprint.svg","assets/gallery-manufacturing-overview.svg","assets/gallery-six-trailer-storyboard.svg","assets/media-catalog.json"]){
 let record={path:p};
 try{
  const r=await fetch("https://trinitycontinuum.com/"+p,{method:"HEAD",signal:AbortSignal.timeout(18000),redirect:"follow"});
  record={path:p,http:r.status,contentLength:r.headers.get("content-length"),contentType:r.headers.get("content-type"),cacheControl:r.headers.get("cache-control")};
 }catch(e){record.error=String(e).slice(0,200)}
 weights.push(record);
}
fs.mkdirSync("audit-output",{recursive:true});
fs.writeFileSync("audit-output/public-edge-check.json",JSON.stringify({at:new Date().toISOString(),results,weights},null,2));
console.log("EDGE CHECK",JSON.stringify(results,null,2));
console.log("ASSET HEADERS",JSON.stringify(weights,null,2));
const apex=results.find(x=>x.url==="https://trinitycontinuum.com/");
const www=results.find(x=>x.url==="https://www.trinitycontinuum.com/");
if(apex?.status!==200)console.log("FAIL: apex root not HTTPS 200");
if(www?.status!==200||new URL(www.finalUrl||www.url).hostname!=="trinitycontinuum.com")console.log("NOT VERIFIED: www does not resolve and canonicalize to the apex HTTPS host");
console.log("NOTE: elapsedMs is a CI runner network wall-clock check, NOT Lighthouse/LCP/Core Web Vitals.");
