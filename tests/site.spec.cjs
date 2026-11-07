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
          await expect(page.getByRole('dialog', { name: /Trinity Continuum introduction film/i })).toBeHidden();
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


// Whole-site navigation audit. Keep this on the existing browser-test workflow so
// a page cannot silently ship with a broken internal link or missing local asset.
test('all HTML pages have working local links, assets and fragment targets', async ({ page, request }) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const pages = fs.readdirSync('.').filter(name => name.endsWith('.html')).sort();
  const checked = new Map();
  for (const source of pages) {
    const response = await page.goto(base + '/' + source);
    expect(response.status(), 'page ' + source).toBe(200);
    const targets = await page.locator('[href], [src]').evaluateAll(elements =>
      elements.map(el => el.getAttribute('href') || el.getAttribute('src'))
        .filter(Boolean).filter(url => !/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url))
    );
    for (const target of targets) {
      const parsed = new URL(target, base + '/' + source);
      if (parsed.origin !== new URL(base).origin) continue;
      const pathname = decodeURIComponent(parsed.pathname);
      // Root-relative and relative paths both resolve through the local server.
      if (!checked.has(pathname)) {
        const result = await request.get(parsed.origin + parsed.pathname);
        checked.set(pathname, result.status());
      }
      expect(checked.get(pathname), source + ' -> ' + target).toBe(200);
      if (parsed.hash && (pathname.endsWith('.html') || pathname === '/')) {
        const fragment = decodeURIComponent(parsed.hash.slice(1));
        if (!fragment) continue;
        if (pathname === '/' + source) {
          const found = await page.evaluate(id => !!document.getElementById(id) ||
            !!document.querySelector('[name="' + CSS.escape(id) + '"]'), fragment);
          expect(found, source + ' -> ' + target).toBe(true);
        } else {
          const html = await (await request.get(parsed.origin + pathname)).text();
          const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          expect(new RegExp('(?:id|name)=["\\\']' + escaped + '["\\\']').test(html),
            source + ' -> ' + target + ' (fragment)').toBe(true);
        }
      }
    }
  }
});
