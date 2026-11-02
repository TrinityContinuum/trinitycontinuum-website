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
