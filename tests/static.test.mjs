import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { read, exists, ROOT } from './helpers.mjs';

const APP_STORE = 'https://apps.apple.com/us/app/catando/id6811043893';
const SITE = 'https://catando.app.kairosaitech.com/';
const html = read('index.html');

const jsonLd = () => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const nodes = () => jsonLd().flatMap((b) => b['@graph'] || [b]);

test('head: language, viewport, title, description, canonical', () => {
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<meta name="viewport"/);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title && title.length >= 20 && title.length <= 70, `title length: ${title}`);
  const desc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(desc && desc.length >= 70 && desc.length <= 250, `description length ${desc?.length}`);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}">`));
});

test('exactly one h1 and every image has an alt attribute', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  assert.ok(imgs.length > 0);
  for (const img of imgs) assert.match(img, /\balt="/, `missing alt: ${img}`);
});

test('structured data parses and has the expected types', () => {
  const types = nodes().map((n) => n['@type']);
  for (const t of ['MobileApplication', 'FAQPage', 'HowTo', 'WebSite']) assert.ok(types.includes(t), `missing ${t}`);
  const app = nodes().find((n) => n['@type'] === 'MobileApplication');
  assert.equal(app.downloadUrl, APP_STORE);
  assert.equal(app.offers.price, '0');
});

test('FAQ structured data matches the visible FAQ', () => {
  const faq = nodes().find((n) => n['@type'] === 'FAQPage').mainEntity.map((q) => q.name);
  const visible = [...html.matchAll(/<summary>([^<]+)</g)].map((m) => m[1].trim().replace(/&#39;|&apos;/g, "'"));
  assert.deepEqual(faq, visible);
});

test('App Store buttons point at the real listing and no placeholder links remain', () => {
  assert.ok((html.match(new RegExp(`href="${APP_STORE.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}"`, 'g')) || []).length >= 4);
  assert.ok(!/href="#"/.test(html), 'placeholder href="#" found');
});

test('local links, scripts and images resolve to files on disk', () => {
  const refs = [...html.matchAll(/\b(?:href|src)="([^"#]+)"/g)].map((m) => m[1])
    .filter((r) => !/^(https?:|mailto:|data:|\/\/)/.test(r));
  assert.ok(refs.length > 0);
  for (const r of refs) {
    const rel = r.endsWith('/') ? `${r}index.html` : r;
    assert.ok(exists(rel), `missing local file: ${r}`);
  }
});

test('in-page anchors point at existing ids', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, a] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(a), `dangling #${a}`);
});

test('sitemap, robots, llms.txt and legal pages are in place', () => {
  assert.ok(read('sitemap.xml').includes(`<loc>${SITE}</loc>`));
  assert.ok(read('robots.txt').includes(`Sitemap: ${SITE}sitemap.xml`));
  assert.match(read('llms.txt'), /^# Catando/);
  for (const page of ['privacy', 'terms']) {
    const h = read(`${page}/index.html`);
    assert.ok(h.includes(`rel="canonical" href="${SITE}${page}/"`), `${page} canonical`);
  }
});

test('the sitemap, JSON-LD and canonical agree on the site URL', () => {
  const site = nodes().find((n) => n['@type'] === 'WebSite');
  assert.equal(site.url, SITE);
});

test('motion script is valid JavaScript and its vendored libraries exist', () => {
  execFileSync(process.execPath, ['--check', join(ROOT, 'js/motion.js')]);
  for (const f of ['gsap.min.js', 'ScrollTrigger.min.js', 'lenis.min.js', 'three.min.js', 'vanta.fog.min.js']) {
    assert.ok(exists(`js/vendor/${f}`), `missing js/vendor/${f}`);
  }
  const motion = read('js/motion.js');
  assert.match(motion, /prefers-reduced-motion/, 'motion must respect reduced-motion');
});

test('referenced image files are non-empty', async () => {
  const { statSync } = await import('node:fs');
  for (const [, src] of html.matchAll(/\bsrc="(images\/[^"]+)"/g)) {
    assert.ok(statSync(join(ROOT, src)).size > 0, src);
  }
  assert.ok(dirname(ROOT));
});
