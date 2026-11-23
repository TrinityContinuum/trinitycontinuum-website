const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const BASE='http://127.0.0.1:8765';
const root=path.resolve(__dirname,'..');
const publicPages=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
const blocked=/(?:https?:)?\/\/(?:drive|docs)\.google\.com\/|https?:\/\/chatgpt\.com\/library\?/i;

test('no ordinary public HTML page sends visitors to personal archive or permission-restricted Drive links',async()=>{
  const offenders=[];
  for(const file of publicPages){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    if(blocked.test(html))offenders.push(file);
  }
  expect(offenders).toEqual([]);
});

test('catalog records retain their titles but do not expose private archive link IDs',async()=>{
  const records=JSON.parse(fs.readFileSync(path.join(root,'assets','media-catalog.json'),'utf8'));
  expect(records.length).toBeGreaterThan(900);
  expect(records.filter(x=>'url' in x||'related_video' in x)).toEqual([]);
});

test('seven illustrations are clickable and load without visitor credentials',async({page,request})=>{
  await page.goto(BASE+'/public-visuals.html',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Film and engineering illustrations'})).toBeVisible();
  const anchors=page.locator('.public-visual-grid figure a');
  await expect(anchors).toHaveCount(7);
  for(let i=0;i<7;i++){
    const href=await anchors.nth(i).getAttribute('href');
    expect(href).toMatch(/^assets\/[a-z0-9-]+\.svg$/);
    const response=await request.get(BASE+'/'+href);
    expect(response.status(),href).toBe(200);
    const text=await response.text();
    expect(text.length,href).toBeGreaterThan(100);
    expect(text,href).toMatch(/<svg\b/i);
  }
  const loaded=await page.locator('.public-visual-grid img').evaluateAll(images=>images.map(img=>({src:img.getAttribute('src'),complete:img.complete,width:img.naturalWidth})));
  expect(loaded.filter(i=>!i.complete||i.width===0),JSON.stringify(loaded)).toEqual([]);
});

test('five Film presentation reference links open real local images while all four original embeds remain',async({page,request})=>{
  await page.goto(BASE+'/film-presentations.html',{waitUntil:'domcontentloaded'});
  const links=page.locator('a.visual-ref-source');
  await expect(links).toHaveCount(6); // five public SVG links plus existing internal Media Library link
  for(let i=0;i<5;i++){
    const href=await links.nth(i).getAttribute('href');
    expect(href).toMatch(/^assets\/[a-z0-9-]+\.svg$/);
    const response=await request.get(BASE+'/'+href);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  expect(await links.nth(5).getAttribute('href')).toBe('media.html#pictures');
  const ids=[
    '4a280414b961425d12074fc7e20830cc',
    '8feca7a3ab6dab53e7c475de4444b169',
    '6256a17244fcf1f7ea5eb84b335dec47',
    '73c9cdab30dc4e55f92fb2bc5b716711'
  ];
  const srcs=await page.locator('iframe[src^="https://app.heygen.com/embeds/"]').evaluateAll(els=>els.map(x=>x.getAttribute('src')));
  expect(srcs.sort()).toEqual(ids.map(x=>'https://app.heygen.com/embeds/'+x).sort());
});

test('public media catalog routes viewers to public gallery, not private archive',async({page})=>{
  await page.goto(BASE+'/media.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#media-results article').first()).toBeVisible();
  const links=page.locator('#media-results article a.btn');
  expect(await links.count()).toBeGreaterThan(0);
  const hrefs=await links.evaluateAll(els=>els.map(a=>a.getAttribute('href')));
  expect(hrefs.every(x=>x==='public-visuals.html')).toBeTruthy();
});
