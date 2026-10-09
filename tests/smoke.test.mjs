import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from './helpers.mjs';

let server, url, browser;
before(async () => {
  ({ server, url } = await serve());
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
});
after(async () => { await browser?.close(); server?.close(); });

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

// Fonts come from Google Fonts, which CI may block; ignore only those.
const real = (errs) => errs.filter((e) => !/fonts\.(googleapis|gstatic)\.com|ERR_(NAME|INTERNET|CONNECTION|BLOCKED|TUNNEL)/.test(e));

test('page loads with no errors and the hero renders', async () => {
  const { ctx, page, errors } = await open();
  assert.deepEqual(real(errors), []);
  assert.match(await page.locator('.hero h1').innerText(), /Equal cats\.\s*Equal dogs\.\s*Total calm\./);
  assert.ok((await page.locator('.board .tile').count()) > 10);
  await ctx.close();
});

test('motion layer initialises (Lenis, progress bar, split headline)', async () => {
  const { ctx, page } = await open();
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('lenis')));
  assert.equal(await page.locator('.split-line').count(), 3);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1200);
  const scale = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.scroll-progress')).transform).a);
  assert.ok(scale > 0.05, `progress bar did not advance (${scale})`);
  await ctx.close();
});

test('reduced motion: no smooth scroll, content still visible', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis')), false);
  assert.match(await page.locator('.hero h1').innerText(), /Total calm/);
  await ctx.close();
});

test('mobile viewport: no horizontal overflow and CTA is visible', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);
  assert.ok(await page.locator('.btn-hero').isVisible());
  await ctx.close();
});

test('FAQ items expand and every App Store button links to the listing', async () => {
  const { ctx, page } = await open();
  const first = page.locator('.faq-item').first();
  await first.locator('summary').click();
  assert.equal(await first.evaluate((e) => e.open), true);
  const hrefs = await page.locator('a.btn-primary').evaluateAll((els) => els.map((e) => e.href));
  assert.ok(hrefs.length >= 4);
  for (const h of hrefs) assert.equal(h, 'https://apps.apple.com/us/app/catando/id6811043893');
  await ctx.close();
});

test('legal pages load', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const [path, title] of [['/privacy/', /Privacy Policy/], ['/terms/', /Terms of Use/]]) {
    const res = await page.goto(url + path);
    assert.equal(res.status(), 200);
    assert.match(await page.title(), title);
  }
  await ctx.close();
});
