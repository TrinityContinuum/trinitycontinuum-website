const {test, expect} = require('@playwright/test');
const BASE = 'http://127.0.0.1:8765';
const titles = [
  'Feedwater pretreatment',
  'Primary heating and turbo stage',
  'Pump, expander and generation',
  'Secondary thermal integration',
  'Vacuum distillation and water finishing',
  'Product-water storage',
  'BFS packaging addition',
  'Data-center computing addition'
];
test.beforeEach(async ({page}) => {
  await page.route('https://app.heygen.com/embeds/**', route =>
    route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>External video stub</title>'}));
  await page.goto(BASE + '/film-presentations.html', {waitUntil:'domcontentloaded'});
});

test('preserves all four original video players, the source eight-trailer overview, and eight separate illustrated controls', async ({page}) => {
  await expect(page.locator('#four-visions iframe[src^="https://app.heygen.com/embeds/"]')).toHaveCount(4);
  await expect(page.locator('.film-presentation-viewer')).toHaveCount(4);
  await expect(page.locator('#visual-ref-modal')).toHaveCount(1);
  await expect(page.locator('#eight-trailer-walkthrough a[href="assets/texas-eight-trailer-overview.svg"]')).toHaveCount(1);
  await expect(page.locator('#trailer-walkthrough-grid > li')).toHaveCount(8);
  for (let n=1;n<=8;n++) {
    const name = String(n).padStart(2,'0');
    const card = page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card').nth(n-1);
    await expect(card).toBeAttached();
    await expect(card).toHaveAccessibleName(new RegExp(name+' · '+titles[n-1], 'i'));
    await expect(card.locator('img')).toHaveAttribute('src','assets/trailer-walkthrough-'+name+'.svg');
    const response = await page.request.get(BASE+'/assets/trailer-walkthrough-'+name+'.svg');
    expect(response.status()).toBe(200);
    expect((await response.body()).toString()).toContain('<svg');
  }
  await expect(page.locator('#trailer-walkthrough-dialog')).not.toBeVisible();
});

test('eight direct overview-image hotspots open the correct individual unit and return focus', async ({page}) => {
  const hotspots = page.locator('.trailer-overview-hotspot');
  await expect(hotspots).toHaveCount(8);
  const target = page.getByRole('button',{name:'View 04: Secondary thermal integration trailer details'});
  await target.click();
  const dialog = page.locator('#trailer-walkthrough-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#trailer-detail-title')).toContainText('Trailer 04 · Secondary thermal integration');
  await dialog.getByRole('button',{name:'View next trailer'}).click();
  await expect(dialog.locator('#trailer-detail-title')).toContainText('Trailer 05 · Vacuum distillation');
  await dialog.getByRole('button',{name:/Close walkthrough/}).click();
  await expect(dialog).not.toBeVisible();
  await expect(target).toBeFocused();
});

test('opening trailer 01 shows real function, then Next and Previous preserve the dialog', async ({page}) => {
  const open = page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card').nth(0);
  await open.click();
  const dialog = page.locator('#trailer-walkthrough-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveJSProperty('open',true);
  await expect(dialog.locator('#trailer-detail-title')).toHaveText('Trailer 01 · Feedwater pretreatment');
  await expect(dialog.locator('#trailer-detail-points li')).toHaveCount(3);
  await expect(dialog.locator('#trailer-detail-category')).toHaveText('Integrated utility core');
  await dialog.getByRole('button',{name:'View next trailer'}).click();
  await expect(dialog.locator('#trailer-detail-title')).toContainText('Trailer 02 · Primary heating');
  await expect(dialog.locator('#trailer-detail-counter')).toHaveText('Trailer 2 of 8');
  await dialog.getByRole('button',{name:'View previous trailer'}).click();
  await expect(dialog.locator('#trailer-detail-title')).toContainText('Trailer 01 · Feedwater pretreatment');
  await dialog.getByRole('button',{name:/Close walkthrough/}).click();
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
});

test('each individual function is accessible by direct card, 07 BFS and 08 computing remain separate unverified additions', async ({page}) => {
  for (let n=1;n<=8;n++) {
    const name=String(n).padStart(2,'0');
    await page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card').nth(n-1).click();
    const dialog=page.locator('#trailer-walkthrough-dialog');
    await expect(dialog.locator('#trailer-detail-title')).toContainText(titles[n-1]);
    await expect(dialog.locator('#trailer-detail-image')).toHaveAttribute('src','assets/trailer-walkthrough-'+name+'.svg');
    await expect(dialog.locator('#trailer-detail-status')).not.toBeEmpty();
    if(n>=7) await expect(dialog.locator('#trailer-detail-category')).toHaveText('Separate proposed trailer');
    await dialog.getByRole('button',{name:/Close walkthrough/}).click();
    await expect(dialog).not.toBeVisible();
  }
});

test('arrow keys navigate eight trailers, wrap around, and Escape returns focus to the opener', async ({page}) => {
  const opener=page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card').nth(7);
  await opener.click();
  await expect(page.locator('#trailer-detail-counter')).toHaveText('Trailer 8 of 8');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#trailer-detail-counter')).toHaveText('Trailer 1 of 8');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#trailer-detail-counter')).toHaveText('Trailer 8 of 8');
  await page.keyboard.press('Escape');
  await expect(page.locator('#trailer-walkthrough-dialog')).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('mobile cards and expanded detail stay within the visible viewport', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const cards=page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card');
  await expect(cards).toHaveCount(8);
  const opener=page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card').nth(6);
  await opener.click();
  const dialog=page.locator('#trailer-walkthrough-dialog');
  await expect(dialog).toBeVisible();
  const rect=await dialog.boundingBox();
  expect(rect.width).toBeLessThanOrEqual(390);
  expect(rect.height).toBeLessThanOrEqual(844);
  await expect(dialog.locator('#trailer-detail-image')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'View next trailer'})).toBeVisible();
  await dialog.getByRole('button',{name:'View next trailer'}).click();
  await expect(dialog.locator('#trailer-detail-title')).toContainText('Data-center computing addition');
  await dialog.getByRole('button',{name:/Close walkthrough/}).click();
  await expect(opener).toBeFocused();
});

test('public email deep links open each matching individual trailer automatically', async ({page}) => {
  for (let n = 1; n <= 8; n++) {
    const number = String(n).padStart(2, '0');
    const url = BASE + '/film-presentations.html?trailer=' + number + '#eight-trailer-walkthrough';
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const dialog = page.locator('#trailer-walkthrough-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#trailer-detail-counter')).toHaveText('Trailer ' + n + ' of 8');
    await expect(dialog.locator('#trailer-detail-title')).toContainText(titles[n - 1]);
    await expect(dialog.locator('#trailer-detail-image')).toHaveAttribute('src','assets/trailer-walkthrough-'+number+'.svg');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
});

test('invalid email link parameter never opens a different trailer', async ({page}) => {
  for (const input of ['99','00','0A','01%3Ftest','1','07%2Fother']) {
    await page.goto(BASE + '/film-presentations.html?trailer=' + input + '#eight-trailer-walkthrough', {waitUntil:'domcontentloaded'});
    await expect(page.locator('#trailer-walkthrough-dialog')).not.toBeVisible();
  }
});

test('no fabricated certifications or links to controlled CAD are added by the public explorer', async ({page}) => {
  await page.locator('#trailer-walkthrough-grid .trailer-walkthrough-card').nth(4).click();
  await expect(page.locator('#trailer-detail-status')).toContainText('modeled');
  await expect(page.locator('#trailer-detail-summary')).not.toContainText('certified');
  await expect(page.locator('#trailer-detail-points')).toContainText('30 million gallons');
  await expect(page.locator('#trailer-walkthrough-dialog a')).toHaveAttribute('href','assets/texas-eight-trailer-overview.svg');
});
