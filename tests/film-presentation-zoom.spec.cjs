const {test, expect} = require('@playwright/test');
const BASE = 'http://127.0.0.1:8765';
const knownFilms = [
  'https://app.heygen.com/embeds/4a280414b961425d12074fc7e20830cc',
  'https://app.heygen.com/embeds/8feca7a3ab6dab53e7c475de4444b169',
  'https://app.heygen.com/embeds/6256a17244fcf1f7ea5eb84b335dec47',
  'https://app.heygen.com/embeds/73c9cdab30dc4e55f92fb2bc5b716711'
];

test.beforeEach(async ({page}) => {
  // Video contents are third-party; test our own accessible controls with a
  // harmless stub rather than playing or contacting HeyGen in CI.
  await page.route('https://app.heygen.com/embeds/**', route =>
    route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Stub external film</title>'}));
});

test('all four original film embeds remain intact with independent full-page controls', async ({page}) => {
  await page.goto(BASE + '/film-presentations.html', {waitUntil:'domcontentloaded'});
  const frames = page.locator('#four-visions .brief-verified-embed iframe');
  await expect(frames).toHaveCount(4);
  expect(await frames.evaluateAll(els => els.map(el => el.getAttribute('src')))).toEqual(knownFilms);
  await expect(page.locator('.film-presentation-viewer')).toHaveCount(4);
  await expect(page.locator('#four-visions .film-presentation-enter')).toHaveCount(4);
  await expect(page.locator('.film-presentation-zoom-group:visible')).toHaveCount(0);
  for (const id of ['film-01','film-02','film-03','film-04']) {
    const viewer = page.locator('#'+id+' .film-presentation-viewer');
    await expect(viewer.locator('iframe')).toHaveCount(1);
    await expect(viewer.locator('.film-presentation-enter')).toBeVisible();
  }
});

test('fallback full-page mode supports 100–200% zoom, Fit, and keyboard Escape', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {configurable:true,value:undefined});
  });
  await page.goto(BASE + '/film-presentations.html', {waitUntil:'domcontentloaded'});
  const viewer = page.locator('#film-01 .film-presentation-viewer');
  const frame = viewer.locator('iframe');
  await page.evaluate(() => {
    window.originalFilmNode = document.querySelector('#film-01 .film-presentation-viewer iframe');
  });
  const expand = viewer.locator('.film-presentation-enter');
  await expand.click();
  await expect(viewer).toHaveClass(/film-presentation-fallback/);
  await expect(viewer).toHaveCSS('position','fixed');
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('100%');
  await expect(viewer.locator('.film-presentation-minus')).toBeDisabled();
  await expect(viewer.locator('.film-presentation-plus')).toBeEnabled();
  const initialWidth = (await frame.boundingBox()).width;

  await viewer.locator('.film-presentation-plus').click();
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('125%');
  const enlargedWidth = (await frame.boundingBox()).width;
  expect(enlargedWidth).toBeGreaterThan(initialWidth);
  await viewer.locator('.film-presentation-plus').click({clickCount:3});
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('200%');
  await expect(viewer.locator('.film-presentation-plus')).toBeDisabled();
  await viewer.locator('.film-presentation-minus').click();
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('175%');
  await viewer.locator('.film-presentation-fit').click();
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('100%');

  await page.keyboard.press('Escape');
  await expect(viewer).not.toHaveClass(/film-presentation-expanded/);
  await expect(expand).toBeFocused();
  expect(await page.evaluate(() =>
    window.originalFilmNode === document.querySelector('#film-01 .film-presentation-viewer iframe'))).toBe(true);
  expect(await frame.getAttribute('src')).toBe(knownFilms[0]);
});

test('mobile viewer fits screen with visible close and zoom controls', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'requestFullscreen', {configurable:true,value:undefined});
  });
  await page.goto(BASE + '/film-presentations.html', {waitUntil:'domcontentloaded'});
  const viewer = page.locator('#film-04 .film-presentation-viewer');
  await viewer.locator('.film-presentation-enter').click();
  await expect(viewer.locator('.film-presentation-exit')).toBeVisible();
  const frame = viewer.locator('iframe');
  const rect = await frame.boundingBox();
  expect(rect.width).toBeLessThanOrEqual(390);
  expect(rect.height).toBeLessThanOrEqual(844);
  await viewer.locator('.film-presentation-plus').click();
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('125%');
  await viewer.locator('.film-presentation-fit').click();
  await expect(viewer.locator('.film-presentation-percent')).toHaveText('100%');
  await viewer.locator('.film-presentation-exit').click();
  await expect(viewer).not.toHaveClass(/film-presentation-expanded/);
  await expect(page.locator('#film-01 .film-presentation-enter')).toBeVisible();
});

test('native browser fullscreen or standards-based fallback can open and exit', async ({page}) => {
  await page.goto(BASE + '/film-presentations.html', {waitUntil:'domcontentloaded'});
  const viewer = page.locator('#film-02 .film-presentation-viewer');
  await viewer.locator('.film-presentation-enter').click();
  await expect(viewer).toHaveClass(/film-presentation-expanded/);
  await expect(viewer.locator('.film-presentation-exit')).toBeVisible();
  await viewer.locator('.film-presentation-exit').click();
  await expect(viewer).not.toHaveClass(/film-presentation-expanded/);
});
