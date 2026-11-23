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
