import { expect, test } from '@playwright/test';
import { promises as fs } from 'node:fs';

// S2 early-mobile proof on the local browser lane (fe_browser DB, real
// service worker, real Cache Storage, real session, real logout — nothing
// mocked). Staging installability and real devices stay BLOCKED/UNPROVEN in
// the exec plan; these specs lock the behavior Chromium will evaluate there.
const APP = '/app';
const READER_A2 = '/app/topics/city-park?level=A2';
const ACCOUNT = '/account';
const SETTINGS = '/app/account/settings';
const LOGIN = '/login';
const OFFLINE_MESSAGE = 'برای ادامه به اینترنت وصل شوید';
const SW_VERSION_FILE = 'storage/app/sw-version';

// One account per login-heavy test: the login throttle is real product
// behavior (5/min per account+IP), so tests never hammer one account.
const A = { email: 'browser-a@example.com', password: 'password' };
const B = { email: 'browser-b@example.com', password: 'password' };
const C = { email: 'browser-c@example.com', password: 'password' };
const D = { email: 'browser-d@example.com', password: 'password' };
const E = { email: 'browser-e@example.com', password: 'password' };

async function login(page, user: { email: string; password: string }) {
  await page.goto(LOGIN);
  await page.getByLabel('ایمیل', { exact: true }).fill(user.email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'ورود' }).click();
  // Fortify redirects a successful login to /account — or to the saved
  // intended URL when an earlier guest visit bounced to login first
  // (paid-only slice: guest hits on /app now bounce). Wait for the POST
  // to complete before any further navigation (no race with goto).
  await page.waitForURL(/\/(app|app\/account|account)$/);
}

async function serviceWorkerReady(page) {
  await page.goto(APP);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}

async function cachedUrls(page): Promise<string[]> {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) {
        urls.push(request.url);
      }
    }
    return urls;
  });
}

test('S2-1 manifest shape is installable with fa/RTL and both icon types', async ({ page }) => {
  await page.goto(APP);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');

  const manifest = await page.evaluate(() =>
    fetch('/manifest.webmanifest').then((r) => {
      if (!r.ok || !r.headers.get('content-type')?.includes('application/manifest+json')) {
        throw new Error(`manifest fetch failed: ${r.status}`);
      }
      return r.json();
    }),
  );

  expect(manifest.name).toContain('Fast English');
  expect(manifest.lang).toBe('fa');
  expect(manifest.dir).toBe('rtl');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/app');

  const purposes = manifest.icons.map((i) => `${i.sizes}|${i.purpose ?? 'any'}`);
  expect(purposes).toContain('192x192|any');
  expect(purposes).toContain('512x512|maskable');

  for (const icon of manifest.icons) {
    const res = await page.request.get(icon.src);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('image/png');
  }

  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});

test('S2-2 Cache Storage holds only allowlisted public entries after login', async ({ page }) => {
  await login(page, C);
  await page.goto(READER_A2);

  // Exercise the sample audio over the network like a learner would.
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);

  await page.goto(ACCOUNT);
  await expect(page.locator('body')).toContainText(C.email);

  const audioSrc: string = await page.evaluate(() => {
    const el = document.querySelector<HTMLAudioElement>('#lesson-audio');
    return el ? el.src : '';
  });

  const urls = await cachedUrls(page);
  expect(urls.length).toBeGreaterThan(0);

  for (const raw of urls) {
    const url = new URL(raw);
    expect(url.origin).toBe(new URL(page.url()).origin);
    const allowed =
      url.pathname.startsWith('/build/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname === '/offline' ||
      url.pathname === '/manifest.webmanifest';
    expect(allowed, `cached entry is not public allowlisted: ${url.pathname}`).toBe(true);
  }

  for (const forbidden of ['/media/', 'livewire', '/admin', '/account', 'receipt', 'progress', 'placement']) {
    expect(urls.some((u) => u.includes(forbidden)), `private entry cached: ${forbidden}`).toBe(false);
  }
  if (audioSrc !== '') {
    expect(urls, 'sample audio must never enter Cache Storage').not.toContain(audioSrc);
  }
});

test('S2-3 offline shows the public page with retry, never premium', async ({ page, context }) => {
  await serviceWorkerReady(page);
  await context.setOffline(true);

  try {
    await page.goto(READER_A2);
    await expect(page.locator('#fe-offline-message')).toContainText(OFFLINE_MESSAGE);
    await expect(page.locator('#fe-offline-retry')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Leila');

    await page.screenshot({ path: 'test-results/browser-shots/s2-offline.png' });
  } finally {
    await context.setOffline(false);
  }

  // Retry with the network back loads the real reader.
  await page.locator('#fe-offline-retry').click();
  await expect(page.locator('article.fe-english-body')).toContainText('On Saturday morning, Sara walks');
});

test('S2-4 a new service worker never reloads during playback or a dirty form', async ({ page }) => {
  await serviceWorkerReady(page);

  await login(page, D);
  await page.goto(READER_A2);
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);

  const before = await page.evaluate(() => caches.keys());

  // Ship a byte-different worker and ask this page to notice it.
  const next = `s2-test-${Date.now()}`;
  await fs.writeFile(SW_VERSION_FILE, next);
  await page.evaluate(() =>
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update()),
  );

  // Brief notice, no reload: playback continues on the same page.
  await expect(page.locator('#pwa-update')).toBeVisible();
  const playing = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused);
  expect(playing).toBe(true);

  // A dirty form also survives: type, navigate, confirm no reload happened.
  // (Public-slice port: display-name editing moved from the retired
    // learner Livewire component to the Inertia settings form.)
  await page.goto(SETTINGS);
  await expect(page.locator('#pwa-update')).toBeVisible();
  await page.locator('#settings-name').fill('Unsaved Draft Name');
  expect(page.url()).toContain(SETTINGS);
  await expect(page.locator('#settings-name')).toHaveValue('Unsaved Draft Name');

  // User-triggered refresh activates the new worker and evicts old caches.
  // Wait for the NEXT navigation: waitForLoadState would resolve instantly
  // on the already-loaded page and race the reload.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.locator('#pwa-refresh').click(),
  ]);
  const after = await page.evaluate(() => caches.keys());
  expect(after).toEqual(expect.arrayContaining([`fe-public-${next}`]));
  for (const key of before) {
    if (key.startsWith('fe-public-')) {
      expect(after, `old cache evicted: ${key}`).not.toContain(key);
    }
  }
  expect(page.url()).toContain(SETTINGS);

  await fs.rm(SW_VERSION_FILE, { force: true });
});

test('S2-5 session survives relaunch in the installed-shape PWA', async ({ page, context }) => {
  await login(page, E);
  await page.goto(ACCOUNT);
  await expect(page.locator('body')).toContainText(E.email);

  // Relaunch: close every page, open a fresh one in the same stored session.
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto(ACCOUNT);
  await expect(fresh.locator('body')).toContainText(E.email);
});

test('S2-3 logout clears the player and back/forward leaks no first-account data', async ({ page }) => {
  await login(page, A);
  await page.goto(READER_A2);
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);

  // Real logout through the account page form.
  await page.goto(ACCOUNT);
  await expect(page.locator('body')).toContainText(A.email);
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await expect(page.locator('#lesson-audio')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(A.email);
  // Drain in-flight requests (e.g. the audio stream) before the next
  // login: a zombie response carrying the invalidated session cookie
  // would otherwise overwrite the fresh login cookie on arrival.
  await page.waitForLoadState('networkidle');

  await login(page, B);
  await page.goto(ACCOUNT);
  await expect(page.locator('body')).toContainText(B.email);

  await page.goBack();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).not.toContainText(A.email);

  await page.goForward().catch(() => undefined);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).not.toContainText(A.email);
  await expect(page.locator('body')).toContainText(B.email, { timeout: 15_000 });
});
