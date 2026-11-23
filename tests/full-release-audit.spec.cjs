const { test, expect } = require('@playwright/test');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8765';
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const paths = [...sitemap.matchAll(/<loc>https:\/\/trinitycontinuum\.com\/([^<]*)<\/loc>/g)]
  .map(m => m[1] || 'index.html');
test('sitemap contains a nonempty set of unique HTML pages', () => {
  expect(paths.length).toBeGreaterThanOrEqual(32);
  expect(new Set(paths).size).toBe(paths.length);
});
for (const [device, viewport] of Object.entries({desktop:{width:1440,height:900},mobile:{width:390,height:844}})) {
  test.describe(device + ' all sitemap routes', () => {
    test.use({viewport});
    for (const path of paths) {
      test(path + ': structure, viewport and basic semantics', async ({page}) => {
        const failures = [];
        page.on('pageerror', error => failures.push(error.message));
        const res = await page.goto(BASE + '/' + path, {waitUntil:'domcontentloaded'});
        expect(res && res.status(),path).toBe(200);
        await expect(page.locator('main')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveCount(1);
        const result = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          imgMissingAlt: [...document.images].filter(img => !img.hasAttribute('alt')).length,
          linksNoName: [...document.querySelectorAll('a')].filter(a => !((a.innerText||'').trim() || a.getAttribute('aria-label') || a.getAttribute('title') || a.querySelector('img[alt]'))).length,
          duplicateIds: (() => { const ids = [...document.querySelectorAll('[id]')].map(e=>e.id); return ids.length !== new Set(ids).size; })(),
          hasDescription: !!document.querySelector('meta[name="description"]')
        }));
        expect(result,{path,device}).toEqual({overflow:false,imgMissingAlt:0,linksNoName:0,duplicateIds:false,hasDescription:true});
        expect(failures,path + ' javascript exceptions').toEqual([]);
      });
    }
  });
}
test('all sitemap pages use valid internal hyperlinks and same-page or cross-page anchors', async ({request,page}) => {
  const idsByPath = new Map();
  const links = [];
  for (const path of paths) {
    await page.goto(BASE + '/' + path,{waitUntil:'domcontentloaded'});
    const local = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('[id]')].map(el=>el.id),
      links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))
        .filter(Boolean).filter(h=>! /^(mailto:|tel:|javascript:|data:|https?:)/i.test(h))
    }));
    idsByPath.set('/'+path,new Set(local.ids));
    links.push(...local.links.map(h=>({from:path,href:h})));
  }
  const inspected = new Set();
  for (const {from,href} of links) {
    const url = new URL(href, BASE+'/'+from);
    const path = url.pathname === '/'? '/index.html':url.pathname;
    if (!inspected.has(path)) {
      const r=await request.get(BASE+path);
      expect(r.status(),from+' -> '+href).toBe(200);
      inspected.add(path);
    }
    if(url.hash) {
      if (!idsByPath.has(path)) {
        await page.goto(BASE+path,{waitUntil:'domcontentloaded'});
        idsByPath.set(path,new Set(await page.locator('[id]').evaluateAll(els=>els.map(el=>el.id))));
      }
      const id=decodeURIComponent(url.hash.slice(1));
      expect(idsByPath.get(path).has(id),from+' -> '+href+' target anchor').toBe(true);
    }
  }
});
