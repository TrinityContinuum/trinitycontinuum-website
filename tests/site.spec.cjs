const { test, expect, devices } = require('@playwright/test');
const base = 'http://127.0.0.1:8765';
for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  test.describe(name, () => {
    test.use({ viewport });
    for (const path of ['index.html', 'publications.html']) {
      test(path + ' loads without horizontal overflow', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const response = await page.goto(base + '/' + path);
        expect(response.status()).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main')).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        expect(overflow).toBe(false);
        expect(errors).toEqual([]);
      });
      if (name === 'mobile') test(path + ' mobile navigation works', async ({ page }) => {
        await page.goto(base + '/' + path);
        const introSkip = page.getByRole('button', { name: /Skip Intro/i });
        if (await introSkip.isVisible().catch(() => false)) {
          await introSkip.click();
          await expect(page).toHaveURL(/film-presentations\.html$/, { timeout: 10000 });
          await page.goto(base + '/full-site.html');
        }
        const button = page.locator('button.menu');
        const nav = page.locator('nav.links');
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await button.click();
        await expect(nav).toBeVisible();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(nav).toBeHidden();
        await button.click({ timeout: 5000 });
        await expect(nav).toBeVisible({ timeout: 5000 });
        await nav.locator('a[href="publications.html"]').click({ timeout: 5000 });
        await expect(page).toHaveURL(/publications\.html$/, { timeout: 5000 });
      });
    }
  });
}
test('publication section anchors resolve', async ({ page }) => {
  await page.goto(base + '/publications.html');
  const bad = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.hash.slice(1)).filter(id => id && !document.getElementById(decodeURIComponent(id))));
  expect(bad).toEqual([]);
});

test('homepage and publications local links and assets resolve', async ({ request, page }) => {
  for (const path of ['index.html', 'publications.html']) {
    await page.goto(base + '/' + path);
    const targets = await page.evaluate(() => [...document.querySelectorAll('[href], [src]')]
      .map(el => el.getAttribute('href') || el.getAttribute('src'))
      .filter(Boolean)
      .filter(url => !/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(url))
      .map(url => new URL(url, location.href).pathname));
    for (const target of new Set(targets)) {
      const response = await request.get(base + target);
      expect(response.status(), path + ' -> ' + target).toBe(200);
    }
  }
});

test('Jack opening film displays on home and continues to the full four-film presentation', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const videoResponse = await request.get(base + '/assets/trinity-intro-captioned.mp4');
  expect(videoResponse.status(), 'original captioned intro film must remain published').toBe(200);
  expect((await videoResponse.body()).length).toBeGreaterThan(100000);
  await page.goto(base + '/index.html');
  const modal = page.getByRole('dialog', { name: /Trinity Continuum introduction film/i });
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#trinity-intro-video')).toHaveAttribute('src', 'assets/trinity-intro-captioned.mp4');
  await page.locator('#trinity-intro-video').evaluate(video => video.dispatchEvent(new Event('ended')));
  await expect(page).toHaveURL(/film-presentations\.html$/, { timeout: 10000 });
  await expect(page.locator('iframe[src*="app.heygen.com/embeds/"]')).toHaveCount(4);
  await expect(page.getByRole('link', { name: /Home/i }).first()).toHaveAttribute('href','full-site.html');
});

test('Skip Intro follows presentation; full-site destination bypasses cinematic overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(base + '/');
  await page.getByRole('button',{name:/Skip Intro/i}).click();
  await expect(page).toHaveURL(/film-presentations\.html$/, { timeout:10000 });
  await page.goto(base + '/full-site.html');
  await expect(page.locator('#trinity-film-intro')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveCount(1);
});


// Broader public-facing acceptance. This deliberately reads public routes only:
// no form submissions, no prospect email, no calendar writes or private materials.
const fs = require('node:fs');
const auditRoutes = [...fs.readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(match => new URL(match[1]).pathname);

test('every sitemap route is live on the public domain', async ({ request }) => {
  test.setTimeout(300000);
  const failures = [];
  for (const route of auditRoutes) {
    try {
      const response = await request.get('https://trinitycontinuum.com' + route + '?audit=' + (process.env.GITHUB_SHA || 'manual').slice(0, 9), { timeout: 15000 });
      if (response.status() !== 200) failures.push(route + ': HTTP ' + response.status());
      else if (!(await response.text()).toLowerCase().includes('<html')) failures.push(route + ': not an HTML document');
    } catch (error) {
      failures.push(route + ': ' + String(error.message || error).slice(0, 160));
    }
  }
  expect(failures, 'Public URL errors: ' + failures.join(' | ')).toEqual([]);
});

test('every sitemap route renders on mobile without horizontal page overflow', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  // Bypass optional cinematic introduction so underlying homepage is exercised.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const failures = [];
  let current = '';
  page.on('pageerror', error => failures.push(current + ': JS ' + error.message.slice(0, 160)));
  for (const route of auditRoutes) {
    current = route;
    try {
      const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!response || response.status() !== 200) { failures.push(route + ': not HTTP 200'); continue; }
      const structure = await page.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        main: document.querySelectorAll('main').length,
        overflow: document.documentElement.scrollWidth > innerWidth + 2
      }));
      if (structure.h1 !== 1) failures.push(route + ': main heading count ' + structure.h1);
      if (structure.main !== 1) failures.push(route + ': main landmark count ' + structure.main);
      if (structure.overflow) failures.push(route + ': horizontal page overflow');
    } catch (error) {
      failures.push(route + ': ' + String(error.message || error).slice(0, 160));
    }
  }
  expect(failures, 'Public mobile issues: ' + failures.join(' | ')).toEqual([]);
});
