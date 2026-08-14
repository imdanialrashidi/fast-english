#!/usr/bin/env node
// scripts/measure-app-perf.mjs
// Fast English Podcast — LAB performance measurement driver.
//
// Runs representative production-like Student journeys in headless
// Chromium with a Slow-4G-ish network profile + mid-tier CPU throttle
// (CDP) and captures, per journey, from real PerformanceObserver data:
//   LCP, CLS, FCP, TBT, long-task count, TTFB, DCL, load,
//   JS/CSS/img/font/other transfer bytes, per-script transfer + parse
//   duration, and the route chunk inventory (which JS files loaded).
// Also measures warm SPA navigation responsiveness (click → settled).
//
// EVIDENCE CLASSIFICATION: lab-only. This is NOT field Web Vitals data.
//
// Usage:
//   node scripts/measure-app-perf.mjs \
//     --app http://127.0.0.1:18122 --pb http://127.0.0.1:18121 \
//     --state .artifacts/perf/seed.json --out .artifacts/perf/run.json \
//     --tag baseline [--unthrottled]
//
// `--state` points at the file written by measure-app-perf-seed.mjs
// (contains the entitled student token + imported lesson ids).

import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}
const APP_URL = arg('app', '').replace(/\/+$/, '');
const PB_URL = arg('pb', '').replace(/\/+$/, '');
const STATE_PATH = arg('state', '');
const OUT_PATH = arg('out', '');
const TAG = arg('tag', 'untagged');
const THROTTLED = !process.argv.includes('--unthrottled');

if (!APP_URL || !PB_URL || !STATE_PATH || !OUT_PATH) {
  console.error(
    'usage: measure-app-perf.mjs --app <url> --pb <url> --state <seed.json> --out <report.json> [--tag t] [--unthrottled]',
  );
  process.exit(2);
}

const state = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(STATE_PATH, 'utf8')));
const { token, phone } = state.student;
const b1Lesson = state.lessons.find((l) => l.level === 'B1');
const episodePath = b1Lesson ? `/lessons/${b1Lesson.id}` : null;

// The mobile-first profile of the primary audience. Slow-4G-ish RTT plus a
// 4x CPU throttle approximates a low-to-mid Android phone on an unstable
// mobile network (Lighthouse-style mid-tier mobile lab profile).
const NETWORK = {
  latency: 150,
  downloadThroughput: 1.6 * 1024 * 1024,
  uploadThroughput: 750 * 1024,
};
const CPU_RATE = 4;

// --- Browser instrumentation -------------------------------------------------

const OBSERVER_INIT = `
(() => {
  window.__fepPerf = {
    lcp: [], cls: 0, clsEntries: 0, tbt: 0, longTasks: 0, fcp: 0,
    markers: [], errors: [],
  };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === 'largest-contentful-paint' && e.size > 0) {
          window.__fepPerf.lcp.push(e.startTime);
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === 'layout-shift' && !e.hadRecentInput) {
          window.__fepPerf.cls += e.value;
          window.__fepPerf.clsEntries += 1;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === 'longtask') {
          window.__fepPerf.tbt += Math.max(0, e.duration - 50);
          window.__fepPerf.longTasks += 1;
        }
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType === 'paint' && e.name === 'first-contentful-paint') {
          window.__fepPerf.fcp = e.startTime;
        }
      }
    }).observe({ type: 'paint', buffered: true });
  } catch {}
  window.addEventListener('error', (e) => {
    window.__fepPerf.errors.push(String(e.message || 'error'));
  });
})();
`;

const AUTH_INIT = (t, phoneValue) => `
(() => {
  try {
    if (location.origin === ${JSON.stringify(APP_URL)}) {
      localStorage.setItem('pocketbase_auth', JSON.stringify({
        token: ${JSON.stringify(t)},
        model: { id: '', phone: ${JSON.stringify(phoneValue)} },
      }));
    }
  } catch {}
})();
`;

// --- Helpers ------------------------------------------------------------------

function settleSelectors(page, selectors, timeoutMs) {
  const waits = selectors.map((sel) =>
    page.waitForSelector(sel, { state: 'attached', timeout: timeoutMs }).catch(() => null),
  );
  return Promise.race(waits);
}

async function readPerf(page) {
  return page.evaluate(() => {
    const perf = window.__fepPerf || {};
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const resources = performance.getEntriesByType('resource');
    const scripts = resources.filter(
      (r) => r.initiatorType === 'script' || /\.js($|\?)/.test(r.name),
    );
    const byType = { js: 0, css: 0, img: 0, font: 0, other: 0 };
    for (const r of resources) {
      const bytes = r.transferSize || r.encodedBodySize || 0;
      const path = r.name.split('?')[0];
      if (/\.js($|\.map$)/.test(path)) byType.js += bytes;
      else if (/\.css($|\?)/.test(path)) byType.css += bytes;
      else if (/\.(png|jpe?g|webp|gif|svg|avif)($|\?)/.test(path)) byType.img += bytes;
      else if (/\.(woff2?|ttf)($|\?)/.test(path)) byType.font += bytes;
      else byType.other += bytes;
    }
    const scriptDetails = scripts.map((r) => ({
      name: r.name.split('/').pop(),
      transfer: r.transferSize || r.encodedBodySize || 0,
      durationMs: Math.round(r.duration),
    }));
    return {
      lcp: perf.lcp.length ? Math.round(perf.lcp[perf.lcp.length - 1]) : null,
      cls: Math.round(perf.cls * 1000) / 1000,
      clsEntries: perf.clsEntries,
      fcp: Math.round(perf.fcp || 0) || null,
      tbt: Math.round(perf.tbt),
      longTasks: perf.longTasks,
      ttfb: Math.round(nav.responseStart || 0) || null,
      dcl: Math.round(nav.domContentLoadedEventEnd || 0) || null,
      load: Math.round(nav.loadEventEnd || 0) || null,
      transfer: byType,
      transferTotal: resources.reduce((s, r) => s + (r.transferSize || 0), 0),
      scripts: scriptDetails,
      pageErrors: perf.errors,
      url: location.pathname,
    };
  });
}

async function measureJourney(browser, journey) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fa-IR',
  });
  const page = await context.newPage();
  if (THROTTLED) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: NETWORK.latency,
      downloadThroughput: NETWORK.downloadThroughput,
      uploadThroughput: NETWORK.uploadThroughput,
      connectionType: 'cellular3g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
  }
  await page.addInitScript(OBSERVER_INIT);
  if (journey.kind === 'student') {
    await page.addInitScript(AUTH_INIT(token, phone));
  }
  const startedAt = Date.now();
  await page.goto(`${APP_URL}${journey.path}`, { waitUntil: 'load', timeout: 120_000 });
  const settled = await settleSelectors(page, journey.settled, 60_000);
  // Let late LCP candidates and layout settle before reading metrics.
  await page.waitForTimeout(journey.settleMs ?? 800);
  const perf = await readPerf(page);
  const journeyMs = Date.now() - startedAt;
  await context.close();
  return { id: journey.id, ...perf, journeyMs, settled: Boolean(settled) };
}

async function measureSpaNavigation(browser, from, to) {
  // Warm SPA navigation: session restored, chunks cached by the browser
  // from the previous (same-context) page load — measures route-render
  // responsiveness after initial load, including any lazy chunk fetch.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fa-IR',
  });
  const page = await context.newPage();
  if (THROTTLED) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: NETWORK.latency,
      downloadThroughput: NETWORK.downloadThroughput,
      uploadThroughput: NETWORK.uploadThroughput,
      connectionType: 'cellular3g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
  }
  await page.addInitScript(OBSERVER_INIT);
  await page.addInitScript(AUTH_INIT(token, phone));
  await page.goto(`${APP_URL}${from.path}`, { waitUntil: 'load', timeout: 120_000 });
  await settleSelectors(page, from.settled, 60_000);
  await page.waitForTimeout(500);

  const t0 = Date.now();
  // MUI BottomNavigation renders BUTTONS (not links); other nav elements
  // are RouterLink anchors. Try anchors first, then the bottom-nav button
  // matching the destination path.
  const labelByPath = { '/library': 'کتابخانه', '/progress': 'پیشرفت', '/account': 'حساب' };
  const anchorClicked = await page.evaluate((path) => {
    const link = [...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === path);
    if (link) {
      link.click();
      return true;
    }
    return false;
  }, to.path);
  if (!anchorClicked) {
    const label = labelByPath[to.path];
    if (label) {
      await page
        .locator('[data-testid="student-bottom-nav"]')
        .getByRole('button', { name: label })
        .click();
    } else {
      await page.evaluate((path) => window.history.pushState({}, '', path), to.path);
    }
  }
  const settled = await settleSelectors(page, to.settled, 60_000);
  const deltaMs = Date.now() - t0;
  await context.close();
  // NOTE: only clickToSettledMs is reported for SPA navigation — the
  // performance observers and resource entries are cumulative over both
  // page loads in this context, so per-navigation LCP/CLS/transfer
  // figures would be misleading.
  return {
    id: `nav:${from.id}->${to.id}`,
    clickToSettledMs: deltaMs,
    settled: Boolean(settled),
  };
}

// --- Runner --------------------------------------------------------------------

const browser = await chromium.launch();

const journeys = [
  { id: 'entry', path: '/', kind: 'guest', settled: ['h1'] },
  {
    id: 'login',
    path: '/login',
    kind: 'guest',
    settled: ['input[placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"]', 'input[type="tel"]', 'form'],
  },
  {
    id: 'home',
    path: '/',
    kind: 'student',
    settled: [
      '[data-testid="progress-card"]',
      '[data-testid="home-continue"]',
      '[data-testid="home-start"]',
      '[data-testid="home-completed"]',
    ],
  },
  {
    id: 'library',
    path: '/library',
    kind: 'student',
    settled: ['[data-testid="library-search"]', '[data-testid="library-count"]'],
  },
  {
    id: 'account',
    path: '/account',
    kind: 'student',
    settled: ['[data-testid="account-subscription-card"]'],
  },
];
if (episodePath) {
  journeys.push({
    id: 'episode',
    path: episodePath,
    kind: 'student',
    settled: ['[data-testid="english-reading"]', '[data-testid="summary-section"]'],
    settleMs: 1200,
  });
}

const results = {
  tag: TAG,
  throttled: THROTTLED,
  profile: THROTTLED ? { ...NETWORK, cpuRate: CPU_RATE } : 'unthrottled',
  journeys: [],
  spaNavigations: [],
  capturedAt: new Date().toISOString(),
};

for (const journey of journeys) {
  try {
    const r = await measureJourney(browser, journey);
    results.journeys.push(r);
    console.log(
      `✓ ${journey.id.padEnd(8)} LCP=${r.lcp}ms CLS=${r.cls} TBT=${r.tbt}ms transfer=${(r.transferTotal / 1024).toFixed(0)}KiB`,
    );
  } catch (err) {
    results.journeys.push({ id: journey.id, error: String(err?.message ?? err) });
    console.error(`✗ ${journey.id}: ${err?.message ?? err}`);
  }
}

// Warm SPA navigation responsiveness (after initial load).
const navRuns = [];
if (journeys.some((j) => j.id === 'home')) {
  navRuns.push({
    from: journeys.find((j) => j.id === 'home'),
    to: journeys.find((j) => j.id === 'library'),
  });
}
if (journeys.some((j) => j.id === 'library') && episodePath) {
  navRuns.push({
    from: journeys.find((j) => j.id === 'library'),
    to: {
      id: 'episode',
      path: episodePath,
      settled: ['[data-testid="english-reading"]', '[data-testid="summary-section"]'],
    },
  });
}
for (const run of navRuns) {
  try {
    const r = await measureSpaNavigation(browser, run.from, run.to);
    results.spaNavigations.push(r);
    console.log(`✓ ${r.id.padEnd(20)} clickToSettled=${r.clickToSettledMs}ms`);
  } catch (err) {
    results.spaNavigations.push({
      id: `nav:${run.from.id}->${run.to.id}`,
      error: String(err?.message ?? err),
    });
    console.error(`✗ nav ${run.from.id}->${run.to.id}: ${err?.message ?? err}`);
  }
}

await browser.close();
writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
console.log(`\nReport written to ${OUT_PATH}`);
