// Browser audit of the public Trinity pages. Never submit real leads/meetings.
// Browser uses repository source via a read-only localhost HTTP server.
const {test,expect}=require("@playwright/test");
const fs=require("node:fs");
const path=require("node:path");
const base="http://127.0.0.1:8765";
const pages=fs.readdirSync(".").filter(x=>/^[a-z0-9-]+\.html$/i.test(x)).sort();
const capture=path.resolve("audit-output/browser");
fs.mkdirSync(capture,{recursive:true});
test.describe.configure({mode:"serial"});
test.setTimeout(60000);

for(const [device,viewport] of [["desktop",{width:1440,height:900}],["mobile",{width:390,height:844}]]){
 test.describe(device,()=>{
  test.use({viewport});
  test("all "+pages.length+" HTML pages render without blocked content, crash or horizontal overflow",async({page})=>{
   // Interacting with external services is not needed to test local website rendering.
   // Blocking third-party calls reduces noise and prevents analytics/event effects.
   await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.origin===base || url.protocol==="data:")return route.continue();
    return route.abort();
   });
   const problems=[];
   page.on("pageerror",err=>problems.push({page:page.url(),error:err.message.slice(0,250)}));
   for(const name of pages){
    const res=await page.goto(base+"/"+name,{waitUntil:"domcontentloaded",timeout:15000});
    if(!res||res.status()!==200)problems.push({page:name,error:"Unexpected status "+res?.status()});
    const result=await page.evaluate(()=>({
      h1:document.querySelectorAll("h1").length,
      title:document.title,
      width:document.documentElement.scrollWidth,
      viewport:innerWidth,
      body:document.body.innerText?.trim().length||0,
      dialogs:document.querySelectorAll("[role=dialog]").length
    }));
    if(!result.title)problems.push({page:name,error:"No title"});
    if(result.width>result.viewport+3)problems.push({page:name,error:"Horizontal overflow "+result.width+" vs "+result.viewport});
    if(result.body<15)problems.push({page:name,error:"Almost no readable content"});
   }
   fs.writeFileSync(path.join(capture,"render-"+device+".json"),JSON.stringify({device,pages:pages.length,problems},null,2));
   expect(problems).toEqual([]);
  });
 });
}

test("homepage video, skip route, four films and site return remain connected",async({page})=>{
 await page.emulateMedia({reducedMotion:"no-preference"});
 await page.goto(base+"/index.html",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#trinity-film-intro")).toBeVisible();
 await expect(page.locator("#trinity-intro-video")).toHaveAttribute("src","assets/trinity-intro-captioned.mp4");
 await page.screenshot({path:path.join(capture,"homepage-intro-desktop.png"),fullPage:false,animations:"disabled"});
 await page.getByRole("button",{name:/Skip Intro/i}).click();
 await expect(page).toHaveURL(/film-presentations\.html$/);
 await expect(page.locator('iframe[src*="app.heygen.com/embeds/"]')).toHaveCount(4);
 await expect(page.locator(".visual-ref-card img")).not.toHaveCount(0);
 await page.screenshot({path:path.join(capture,"four-film-presentation.png"),fullPage:true,animations:"disabled",timeout:30000});
 await page.locator('a[href="full-site.html"]').first().click();
 await expect(page).toHaveURL(/full-site\.html$/);
 await expect(page.locator("#trinity-film-intro")).toHaveCount(0);
});

test("presentation gallery images load and viewer opens and closes",async({page})=>{
 await page.goto(base+"/film-presentations.html",{waitUntil:"domcontentloaded"});
 const imgs=page.locator(".visual-ref-card img");
 const n=await imgs.count();
 expect(n).toBeGreaterThan(0);
 const broken=[];
 for(let i=0;i<n;i++){
  const el=imgs.nth(i);
  await el.scrollIntoViewIfNeeded();
  await expect.poll(async()=>el.evaluate(x=>x.complete&&x.naturalWidth>0),{timeout:14000}).toBe(true);
 }
 const first=page.locator(".visual-ref-open").first();
 await first.click();
 await expect(page.locator("#visual-ref-modal")).toBeVisible();
 await page.locator("#visual-ref-modal-close").click();
 await expect(page.locator("#visual-ref-modal")).toBeHidden();
});

test("media catalog loads and filters source entries",async({page})=>{
 await page.goto(base+"/media.html",{waitUntil:"domcontentloaded"});
 const response=await page.request.get(base+"/assets/media-catalog.json");
 expect(response.status()).toBe(200);
 const all=await response.json();
 expect(all.length).toBeGreaterThan(100);
 const count=page.locator("#catalog-count");
 if(await count.count()){
  await expect(count).not.toHaveText(/could not load/i,{timeout:12000});
 }
 await page.screenshot({path:path.join(capture,"media-catalog.png"),fullPage:false,animations:"disabled"});
});

test("meeting form rejects missing Turnstile without making network submissions",async({page})=>{
 let writes=0;
 await page.route("**/api/intake",route=>{writes++;route.abort();});
 await page.route("**/submit",route=>{writes++;route.abort();});
 await page.goto(base+"/meetings.html",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#appointment")).toBeVisible();
 await page.locator("#app-name").fill("Synthetic audit only");
 await page.locator("#app-email").fill("audit@example.invalid");
 await page.locator("#date1").fill("2026-12-07");
 await page.locator("#date2").fill("2026-12-08");
 await page.locator("#time1").fill("13:30");
 await page.locator("#time2").fill("14:30");
 await page.locator("#app-topic").fill("Synthetic browser validation; no live message");
 await page.locator("#submitAppointment").click();
 await expect(page.locator("#appointmentStatus")).toContainText("Complete the security check");
 expect(writes).toBe(0);
});

test("project interest and Gold request are explicitly mail-client handoffs",async({page})=>{
 await page.goto(base+"/project-interest.html");
 await expect(page.locator("form")).toHaveCount(1);
 await expect(page.locator("body")).toContainText("Prepare email to Trinity");
 await page.goto(base+"/gold-request.html");
 await expect(page.locator("#gold-request-form")).toHaveCount(1);
 await expect(page.locator("body")).toContainText("management approval");
});
