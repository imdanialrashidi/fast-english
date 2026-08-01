#!/usr/bin/env node
// scripts/check-landing-output.mjs
//
// P4-S1 — validates the BUILT landing output (`dist-landing`) after
// `vite build` + `scripts/prerender-landing.mjs`:
//   - all public routes exist as complete, crawlable HTML
//   - unique titles, descriptions, canonicals, H1s, Persian/RTL metadata
//   - sitemap.xml matches the canonical URL set (no app/auth URLs)
//   - robots.txt is safe and non-blocking
//   - JSON-LD parses (WebSite + Organization only, no unsupported types)
//   - no MUI/Emotion in any landing bundle
//   - no debug APK link, no local paths
//   - external links carry safe attributes, internal links resolve
//   - legal placeholders remain detectable
//   - default build: honest "Android coming soon" state
//   - `--apk-dir <dir>` mode: configured APK link + version rendered
//
// Usage:
//   node scripts/check-landing-output.mjs [--apk-dir <build-dir>]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apkArg = process.argv.indexOf('--apk-dir');
const buildDir = resolve(rootDir, apkArg >= 0 ? process.argv[apkArg + 1] : 'dist-landing');

const SITE = 'https://fastenglishpodcast.com';
const EXPECTED_APK_URL = process.env.VITE_ANDROID_APK_URL ?? null;
const EXPECTED_APK_VERSION = process.env.VITE_ANDROID_APK_VERSION ?? null;

const PAGES = [
  { file: 'index.html', canonical: `${SITE}/` },
  { file: 'about.html', canonical: `${SITE}/about` },
  { file: 'how-it-works.html', canonical: `${SITE}/how-it-works` },
  { file: 'install.html', canonical: `${SITE}/install` },
  { file: 'collaboration.html', canonical: `${SITE}/collaboration` },
  { file: 'contact.html', canonical: `${SITE}/contact` },
  { file: 'privacy.html', canonical: `${SITE}/privacy` },
  { file: 'terms.html', canonical: `${SITE}/terms` },
  { file: 'sample.html', canonical: `${SITE}/sample` },
];

const APK_MODE = apkArg >= 0;
const errors = [];
const ok = (msg) => console.log(`  ok  ${msg}`);
const fail = (msg) => errors.push(msg);

function read(file) {
  const path = resolve(buildDir, file);
  if (!existsSync(path)) fail(`missing built file: ${file}`);
  return readFileSync(path, 'utf8');
}

console.log(`Checking landing build output in ${buildDir} (apk mode: ${APK_MODE})`);

// --- 1. Routes exist and are pre-rendered ---------------------------------
const htmls = {};
for (const page of PAGES) {
  const html = read(page.file);
  htmls[page.file] = html;
  if (!html.includes('<main id="main-content">')) {
    fail(`${page.file}: pre-rendered body content missing (no <main id="main-content">)`);
  }
  if (!html.includes('application/ld+json')) {
    fail(`${page.file}: JSON-LD missing`);
  }
}
ok('all 9 routes exist and contain pre-rendered body + JSON-LD');

// --- 2. Per-page metadata ---------------------------------------------------
const titles = [];
for (const page of PAGES) {
  const html = htmls[page.file];
  const grab = (re) => {
    const m = html.match(re);
    return m ? m[1] : null;
  };
  const title = grab(/<title>([^<]+)<\/title>/);
  const description = grab(/<meta\s+name="description"\s+content="([^"]+)"/);
  const canonical = grab(/<link\s+rel="canonical"\s+href="([^"]+)"/);
  const h1Count = (html.match(/<h1/g) ?? []).length;
  if (!title) fail(`${page.file}: missing title`);
  else titles.push(title);
  if (!description) fail(`${page.file}: missing meta description`);
  if (canonical !== page.canonical)
    fail(`${page.file}: canonical ${canonical} != ${page.canonical}`);
  if (h1Count !== 1) fail(`${page.file}: expected exactly 1 H1, found ${h1Count}`);
  if (!html.includes('<html lang="fa" dir="rtl">')) fail(`${page.file}: missing lang=fa dir=rtl`);
  if (!grab(/property="og:title"\s+content="([^"]+)"/)) fail(`${page.file}: missing og:title`);
  if (!grab(/property="og:description"\s+content="([^"]+)"/))
    fail(`${page.file}: missing og:description`);
  if (!grab(/property="og:url"\s+content="([^"]+)"/)) fail(`${page.file}: missing og:url`);
  if (!html.includes('name="twitter:card" content="summary"'))
    fail(`${page.file}: missing twitter:card`);
  if (!html.includes('data-surface="landing"') && !html.includes('landing-surface')) {
    // keep: marker must survive the build (already covered by project-verify; informational)
  }
}
if (new Set(titles).size !== titles.length) fail('titles are not unique across pages');
ok('all pages: unique title, description, canonical, 1 H1, fa/rtl, OG + Twitter metadata');

// --- 3. JSON-LD -------------------------------------------------------------
for (const page of PAGES) {
  const html = htmls[page.file];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      fail(`${page.file}: JSON-LD is not valid JSON`);
      continue;
    }
    const types = (parsed['@graph'] ?? [parsed]).map((n) => n['@type']);
    if (!types.includes('WebSite')) fail(`${page.file}: JSON-LD lacks WebSite`);
    if (!types.includes('Organization')) fail(`${page.file}: JSON-LD lacks Organization`);
    const unsupported = ['Review', 'Course', 'Product', 'FAQPage', 'SoftwareApplication'];
    for (const t of unsupported) {
      if (types.includes(t)) fail(`${page.file}: unsupported structured data ${t}`);
    }
  }
}
ok('JSON-LD: valid syntax, WebSite + Organization only');

// --- 4. Sitemap -------------------------------------------------------------
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const expectedLocs = PAGES.map((p) => p.canonical);
if (locs.length !== expectedLocs.length)
  fail(`sitemap has ${locs.length} URLs, expected ${expectedLocs.length}`);
for (const loc of expectedLocs) {
  if (!locs.includes(loc)) fail(`sitemap missing ${loc}`);
}
for (const forbidden of [
  '/api/',
  'app.fastenglishpodcast.com',
  '/login',
  '/signup',
  '/payment',
  '/dashboard',
  '/placement',
  '/lessons',
  '/account',
  '/operator',
  'index.html',
  '.apk',
]) {
  if (sitemap.includes(forbidden)) fail(`sitemap contains forbidden token: ${forbidden}`);
}
ok('sitemap: only the 9 canonical landing URLs, no app/auth routes');

// --- 5. robots.txt -----------------------------------------------------------
const robots = read('robots.txt');
if (!/User-agent:\s*\*/.test(robots)) fail('robots.txt missing User-agent');
if (!/Allow:\s*\/\s*/.test(robots)) fail('robots.txt does not allow the landing');
if (/^Disallow:/m.test(robots)) fail('robots.txt must not Disallow anything');
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt missing Sitemap line');
ok('robots.txt: allows the landing, references sitemap, no Disallow');

// --- 6. No MUI/Emotion in bundles -------------------------------------------
let muiFound = false;
const assetsDir = resolve(buildDir, 'assets');
if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    if (!/\.(js|css)$/.test(file)) continue;
    const content = readFileSync(resolve(assetsDir, file), 'utf8');
    if (/@mui\/|@emotion\/|Mui[A-Z]/.test(content)) {
      muiFound = true;
      fail(`MUI/Emotion reference found in bundle: assets/${file}`);
    }
  }
}
if (!muiFound) ok('no MUI/Emotion in any landing bundle');

// --- 7. APK behavior ---------------------------------------------------------
const allHtml = Object.values(htmls).join('\n');
const apkLinks = [...allHtml.matchAll(/<a[^>]+href="([^"]*\.apk[^"]*)"[^>]*>/g)].map((m) => m[1]);
if (APK_MODE) {
  if (!EXPECTED_APK_URL) fail('--apk-dir mode requires VITE_ANDROID_APK_URL env');
  if (EXPECTED_APK_URL && EXPECTED_APK_URL.includes('debug'))
    fail(`configured APK URL must not be a debug build: ${EXPECTED_APK_URL}`);
  for (const file of ['index.html', 'install.html']) {
    const html = htmls[file];
    if (!html.includes(`href="${EXPECTED_APK_URL}"`)) {
      fail(`${file}: expected configured APK link ${EXPECTED_APK_URL}`);
    }
    if (EXPECTED_APK_VERSION && !html.includes(`نسخهٔ ${EXPECTED_APK_VERSION}`)) {
      fail(`${file}: expected APK version ${EXPECTED_APK_VERSION} in download label`);
    }
  }
  if (apkLinks.some((href) => href !== EXPECTED_APK_URL)) {
    fail(`unexpected APK links: ${apkLinks.join(', ')}`);
  }
  ok('APK configured build: download link + version rendered, no other APK links');
} else {
  if (apkLinks.length > 0) fail(`APK link present without configuration: ${apkLinks.join(', ')}`);
  for (const file of ['index.html', 'install.html']) {
    if (!htmls[file].includes('نسخهٔ اندروید به‌زودی منتشر می‌شود')) {
      fail(`${file}: missing honest Android unavailable state`);
    }
  }
  ok('APK unconfigured build: honest "coming soon" state, no fabricated links');
}

// --- 8. Link safety ----------------------------------------------------------
const linkRe = /<a\s+([^>]*)href="([^"]+)"([^>]*)>/g;
for (const page of PAGES) {
  const html = htmls[page.file];
  for (const match of html.matchAll(linkRe)) {
    const attrs = `${match[1]} ${match[3]}`;
    const href = match[2];
    if (href.startsWith('http')) {
      if (href.startsWith('http://')) fail(`${page.file}: insecure http link ${href}`);
      if (!/\brel="[^"]*noopener/.test(attrs))
        fail(`${page.file}: external link without rel=noopener: ${href}`);
      if (/target="_blank"/.test(attrs) && !/\brel="[^"]*noreferrer/.test(attrs)) {
        fail(`${page.file}: target=_blank link without rel=noreferrer: ${href}`);
      }
    } else if (href.startsWith('/')) {
      const path = href.split(/[?#]/)[0];
      const target = path === '/' ? 'index.html' : `${path.replace(/^\//, '')}.html`;
      if (!existsSync(resolve(buildDir, target)))
        fail(`${page.file}: broken internal link ${href}`);
    } else if (href.startsWith('#') || href.startsWith('mailto:')) {
      // in-page anchors and mailto links are allowed
    } else {
      fail(`${page.file}: unsupported link target ${href}`);
    }
  }
}
ok('links: external links safe (https + noopener), internal links resolve');

// --- 9. No local paths / debug artifacts -------------------------------------
for (const page of PAGES) {
  const html = htmls[page.file];
  for (const token of [
    'file://',
    '/home/',
    'C:\\',
    '127.0.0.1',
    'localhost:',
    'android:debuggable',
  ]) {
    if (html.includes(token)) fail(`${page.file}: local path/debug token ${token}`);
  }
}
ok('no local paths or debug tokens in built HTML');

// --- 10. Legal placeholders detectable --------------------------------------
for (const file of ['privacy.html', 'terms.html']) {
  const html = htmls[file];
  if (!html.includes('data-legal-status="needs-review"')) {
    fail(`${file}: legal review marker missing`);
  }
  if (!html.includes('نیاز به تأیید مالک/حقوقی پیش از انتشار')) {
    fail(`${file}: legal review warning text missing`);
  }
}
ok('legal pages: review placeholders still detectable');

// --- 11. Sample integration ---------------------------------------------------
const sampleHtml = htmls['sample.html'];
if (!sampleHtml.includes('https://app.fastenglishpodcast.com/sample')) {
  fail('sample.html: missing link to the public sample route in the web app');
}
ok('sample page links to the public sample route (no premium APIs)');

// --- 12. Forbidden claims ------------------------------------------------------
// Only *positive* claims are forbidden: guaranteed fluency/certification/
// results, or official store availability. Honest negations must pass.
const claims = [
  { phrase: 'تضمین', negation: 'نمی' },
  { phrase: 'گواهی رسمی', negation: 'نمی' },
  { phrase: 'مدرک رسمی', negation: 'نمی' },
  { phrase: 'Google Play', negation: 'در دسترس نیست' },
];
for (const page of PAGES) {
  const html = htmls[page.file];
  for (const { phrase, negation } of claims) {
    const idx = html.indexOf(phrase);
    if (idx !== -1 && !html.slice(idx, idx + 100).includes(negation)) {
      fail(`${page.file}: unsupported claim present: ${phrase}`);
    }
  }
}
ok('no unsupported fluency/certification/store claims');

if (errors.length > 0) {
  console.error('\nLanding output checks FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('All landing output checks passed.');
