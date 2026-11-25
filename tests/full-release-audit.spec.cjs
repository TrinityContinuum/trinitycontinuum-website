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


// Release gate: visitor-facing supporting routes are linked from the sitemap pages,
// but do not themselves appear in sitemap.xml. They must not evade PR-head checks.
const supportingRoutes = [
  'full-site.html',
  'engineering-overview.html',
  'project-interest.html',
  'gold-request.html'
];
test.describe('supporting visitor routes', () => {
  for (const [device, viewport] of Object.entries({
    desktop: {width:1440,height:900},
    mobile: {width:390,height:844}
  })) {
    test.describe(device, () => {
      test.use({viewport});
      for (const path of supportingRoutes) {
        test(path + ' loads and exposes accessible primary content', async ({page}) => {
          const errors=[];
          page.on('pageerror',e=>errors.push(e.message));
          const res=await page.goto(BASE+'/'+path,{waitUntil:'domcontentloaded'});
          expect(res && res.status(),path).toBe(200);
          await expect(page.locator('main')).toHaveCount(1);
          await expect(page.locator('h1')).toHaveCount(1);
          await expect(page.locator('a.skip[href="#main"]')).toHaveCount(1);
          const structure=await page.evaluate(()=>({
            hasLang: !!document.documentElement.getAttribute('lang'),
            overflow: document.documentElement.scrollWidth>innerWidth+2,
            imageWithoutAlt: [...document.images].filter(img=>!img.hasAttribute('alt')).length,
            unnamedLinks: [...document.querySelectorAll('a')].filter(a=>!((a.innerText||'').trim() || a.getAttribute('aria-label') || a.getAttribute('title') || a.querySelector('img[alt]'))).length,
            duplicateIds: (()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return ids.length!==new Set(ids).size;})()
          }));
          expect(structure,{device,path}).toEqual({hasLang:true,overflow:false,imageWithoutAlt:0,unnamedLinks:0,duplicateIds:false});
          expect(errors,path).toEqual([]);
        });
      }
    });
  }
});
test('mobile supplementary-page navigation operates with keyboard and Escape', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'/project-interest.html',{waitUntil:'domcontentloaded'});
  const menu=page.locator('button.menu');
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded','false');
  await expect(menu).toBeFocused();
});


// Stable presentation assertions prevent reintroducing superseded product claims.
test('public Texas entry points distinguish the eight-trailer deployment from its six-trailer core', async ({page}) => {
  for (const path of ['index.html','full-site.html']) {
    await page.goto(BASE+'/'+path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('main')).toContainText('eight-trailer');
    await expect(page.locator('#platform')).toContainText('six-trailer utility core');
    await expect(page.locator('#platform')).toContainText('BFS');
    await expect(page.locator('#platform')).toContainText('data-center');
    await expect(page.locator('#platform img')).toHaveAttribute('alt',/six modular trailers/i);
  }
});
test('film presentation retains four distinct approved embedded destinations', async ({page}) => {
  await page.goto(BASE+'/film-presentations.html',{waitUntil:'domcontentloaded'});
  const urls=await page.locator('iframe[src*="app.heygen.com/embeds/"]').evaluateAll(els=>els.map(el=>el.getAttribute('src')));
  expect(urls).toHaveLength(4);
  expect(new Set(urls).size).toBe(4);
  await expect(page.locator('#film-02')).toContainText('Historical film title retained');
});
test('superseded four-trailer technical media is clearly identified as historical', async ({page}) => {
  await page.goto(BASE+'/media.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#four-trailer')).toContainText('Historical reference');
  await expect(page.locator('#four-trailer')).toContainText('not the current Texas configuration');
});


// Focused WCAG-oriented release checks (automated subset only, not full certification).
test('Gold and project inquiry controls expose programmatic labels', async ({page}) => {
  for (const path of ['gold-request.html', 'project-interest.html']) {
    await page.goto(BASE+'/'+path,{waitUntil:'domcontentloaded'});
    const unlabeled = await page.locator('main input, main select, main textarea').evaluateAll(els =>
      els.filter(el => el.type !== 'hidden' && !(
        (el.labels && [...el.labels].some(l => l.textContent.trim())) ||
        el.getAttribute('aria-label')?.trim() ||
        (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')))
      )).map(el=>el.outerHTML.slice(0,150))
    );
    expect(unlabeled, path + ' unlabeled form controls').toEqual([]);
  }
});
test('film frames have nonblank distinct accessible titles', async ({page}) => {
  await page.goto(BASE+'/film-presentations.html',{waitUntil:'domcontentloaded'});
  const titles=await page.locator('iframe[src*="app.heygen.com/embeds/"]').evaluateAll(els=>els.map(el=>el.title.trim()));
  expect(titles.length).toBe(4);
  expect(titles.every(Boolean)).toBe(true);
  expect(new Set(titles).size).toBe(4);
  expect(titles).toEqual([
    'Film 01 — Engineered to Endure',
    'Film 02 — Six Trailers. One Continuum.',
    'Film 03 — Pure Water. Protected by Design.',
    'Film 04 — Built to Move. Designed to Last.'
  ]);
});
test('keyboard skip link focuses primary content on supporting and main routes', async ({page}) => {
  for(const path of ['index.html','full-site.html','engineering-overview.html','gold-request.html','project-interest.html']){
    // The normal homepage intentionally starts in a modal introduction that takes
    // initial focus. The ?view=site route explicitly bypasses that film overlay.
    const target=path === 'index.html' ? 'index.html?view=site' : path;
    await page.goto(BASE+'/'+target,{waitUntil:'domcontentloaded'});
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('main#main')).toBeVisible();
  }
});


// Coordination gate with booking PR #43: public manual-request journey must be
// truthful and navigable before independent automatic-booking activation.
// No form is submitted and no external provider is contacted by this test.
test('home to contact to meetings keeps manual request truthful and reachable', async ({page}) => {
  await page.goto(BASE+'/index.html?view=site',{waitUntil:'domcontentloaded'});
  await page.getByRole('link',{name:'Request a meeting'}).click();
  await expect(page).toHaveURL(/\/contact\.html$/);
  await expect(page.locator('main')).toContainText('does not reserve a calendar slot automatically');
  await page.getByRole('link',{name:'Request an appointment'}).click();
  await expect(page).toHaveURL(/\/meetings\.html$/);
  await expect(page.locator('main')).toContainText('not booked until Trinity responds');
  await expect(page.locator('main')).toContainText('meeting');
});
test('privacy notice distinguishes submitted meeting requests from local email forms', async ({page}) => {
  await page.goto(BASE+'/privacy.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('main')).toContainText('Cloudflare');
  await expect(page.locator('main')).toContainText('Web3Forms');
  await expect(page.locator('main')).toContainText('Turnstile');
  await expect(page.locator('main')).toContainText('not a confirmed booking');
});


test('opening film modal retains keyboard focus until visitor exits', async ({page}) => {
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  const modal=page.locator('#trinity-film-intro');
  await expect(modal).toHaveAttribute('aria-modal','true');
  const skip=page.locator('#trinity-intro-skip');
  const visibleControls=modal.locator('button:not([hidden]):not([disabled])');
  await expect(skip).toBeFocused();
  // Autoplay policy may reveal an extra "Play with Sound" control.
  // Test the visible controls, not an assumed fixed button count.
  const first=visibleControls.first();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/film-presentations\.html$/);
});


test('reduced-motion visitor bypasses autoplay intro and reaches the main website', async ({browser}) => {
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});
  try {
    const page=await context.newPage();
    await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('#trinity-film-intro')).toHaveCount(0);
    await expect(page.locator('main#main')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  } finally {
    await context.close();
  }
});

test('visitors returning from Four Films can skip the original intro without re-opening it', async ({page}) => {
  await page.goto(BASE+'/index.html?view=site',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#trinity-film-intro')).toHaveCount(0);
  await expect(page.locator('main#main')).toBeVisible();
});
