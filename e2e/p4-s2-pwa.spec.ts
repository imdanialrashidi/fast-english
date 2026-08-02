// e2e/p4-s2-pwa.spec.ts
// P4-S2 — real-browser checks for the Product App PWA:
//   1. manifest is reachable
//   2. required icons exist (real PNGs, correct sizes)
//   3. manifest values are correct
//   4. Service Worker registers on Web
//   5. Service Worker does NOT register in simulated Native (Capacitor) mode
//   6. protected API responses are not cached
//   7. tokenized audio URLs are not cached
//   8. payment and Placement traffic are not cached
//   9. offline navigation shows the honest cached App shell
//  10. online recovery works
//  11. update prompt appears for a new Service Worker version
//  12. no forced reload occurs before explicit confirmation
//
// No screenshots. No production customer data (disposable PB + preview).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { APP_URL_E2E } from '../playwright.config';

const APP_URL = APP_URL_E2E;

const MANIFEST_URL = '/manifest.webmanifest';

// Honest user-facing copy from app/src/pwa/PwaManager.tsx.
const OFFLINE_READY_MESSAGE = 'پوستهٔ برنامه برای استفادهٔ آفلاین آماده است';
const OFFLINE_HONESTY = 'برای حساب، پرداخت، تعیین سطح، درس‌ها، صوت و پیشرفت به اینترنت نیاز است';
const UPDATE_MESSAGE = 'نسخهٔ جدیدی از برنامه آماده است.';
const UPDATE_NOW = 'هم‌اکنون به‌روزرسانی کن';
const UPDATE_LATER = 'بعداً';

test.use({ baseURL: APP_URL });

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // clients.claim() in the worker should control this page quickly.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function cacheEntries(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const out: string[] = [];
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) out.push(request.url);
    }
    return out;
  });
}

test('manifest is reachable and served as JSON', async ({ page }) => {
  const response = await page.request.get(MANIFEST_URL);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type'] ?? '').toContain('json');
  const manifest = (await response.json()) as Record<string, unknown>;
  expect(manifest.icons).toBeTruthy();
});

test('required PWA icons exist and are real images of the right size', async ({ page }) => {
  await page.goto('/');
  const sizes = await page.evaluate(async () => {
    const result: Record<string, { w: number; h: number; ok: boolean }> = {};
    for (const icon of ['pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png']) {
      const url = new URL(icon, location.href).href;
      const res = await fetch(url);
      result[icon] = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, ok: res.ok });
        img.onerror = () => resolve({ w: 0, h: 0, ok: false });
        img.src = url;
      });
    }
    return result;
  });
  expect(sizes['pwa-192x192.png']).toEqual({ w: 192, h: 192, ok: true });
  expect(sizes['pwa-512x512.png']).toEqual({ w: 512, h: 512, ok: true });
  expect(sizes['pwa-maskable-512x512.png']).toEqual({ w: 512, h: 512, ok: true });
});

test('manifest values are correct', async ({ page }) => {
  const manifest = (await (await page.request.get(MANIFEST_URL)).json()) as {
    name?: string;
    short_name?: string;
    description?: string;
    start_url?: string;
    scope?: string;
    display?: string;
    orientation?: string;
    theme_color?: string;
    background_color?: string;
    lang?: string;
    dir?: string;
    id?: string;
    icons?: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    shortcuts?: Array<{ name: string; url: string }>;
  };
  expect(manifest.name).toBe('Fast English Podcast');
  expect(manifest.short_name).toBe('Fast English');
  expect(manifest.description?.length).toBeGreaterThan(10);
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('any');
  expect(manifest.theme_color).toBe('#e9f1f4');
  expect(manifest.background_color).toBe('#f5f9fa');
  expect(manifest.lang).toBe('fa');
  expect(manifest.dir).toBe('rtl');
  expect(manifest.id).toBe('/');

  const iconSizes = (manifest.icons ?? []).map((i) => i.sizes).sort();
  expect(iconSizes).toContain('192x192');
  expect(iconSizes).toContain('512x512');
  expect(manifest.icons?.some((i) => i.purpose === 'maskable')).toBe(true);

  // Shortcuts only for real Product routes.
  const shortcutUrls = (manifest.shortcuts ?? []).map((s) => s.url).sort();
  expect(shortcutUrls).toEqual(['/dashboard', '/lessons']);
});

test('Service Worker registers on the Web and precaches the App shell', async ({ page }) => {
  await waitForServiceWorker(page);

  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      active: reg?.active?.scriptURL ?? null,
      scope: reg?.scope ?? null,
    };
  });
  expect(state.active).toContain('/sw.js');
  expect(new URL(state.scope as string).pathname).toBe('/');

  // The precache must contain the HTML shell, JS/CSS and the self-hosted font.
  const entries = await cacheEntries(page);
  const joined = entries.join('\n');
  expect(joined).toContain('/index.html');
  expect(joined).toContain('/assets/');
  expect(joined).toContain('Vazirmatn');
});

test('Service Worker does NOT register in simulated Native (Capacitor) mode', async ({
  context,
  page,
}) => {
  // Simulate the Capacitor Android WebView the same way apiOrigin.ts does.
  await context.addInitScript(() => {
    (window as unknown as { __FEP_NATIVE__?: boolean }).__FEP_NATIVE__ = true;
  });
  await page.goto('/');
  // The App shell must still render.
  await expect(
    page.getByRole('heading', { name: 'انگلیسی را دقیقاً در سطح خودت یاد بگیر' }),
  ).toBeVisible();

  // Give any (incorrect) registration attempt time to appear, then prove
  // there is none and no Service Worker controls the page.
  await page.waitForTimeout(1500);
  const registration = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return { count: regs.length, controller: navigator.serviceWorker.controller };
  });
  expect(registration.count).toBe(0);
  expect(registration.controller).toBeNull();
});

test('protected API responses are never cached', async ({ page }) => {
  await waitForServiceWorker(page);

  // Fire a representative set of protected requests through the controlled
  // page: health, auth-required reads, and file-serving shapes.
  const statuses = await page.evaluate(async () => {
    const out: Record<string, number> = {};
    const hit = async (url: string, init?: RequestInit) => {
      try {
        const r = await fetch(url, init);
        out[url.split('?')[0]] = r.status;
      } catch {
        out[url.split('?')[0]] = -1;
      }
    };
    await hit('/api/health');
    await hit('/api/fast-english/payment-requests/current');
    await hit('/api/fast-english/placement/attempts/start', { method: 'POST' });
    await hit('/api/fast-english/payment-requests', { method: 'POST' });
    await hit('/api/files/collection-id/record-id/file.png');
    return out;
  });
  // The requests reached the real network (the preview proxy / disposable PB),
  // not a cache.
  expect(statuses['/api/health']).toBe(200);
  expect(statuses['/api/files/collection-id/record-id/file.png']).toBeGreaterThanOrEqual(400);

  const entries = await cacheEntries(page);
  const joined = entries.join('\n');
  expect(joined).not.toContain('/api/');
  expect(joined).not.toContain('/files/');
  expect(joined).not.toContain('token');
});

test('tokenized audio URLs are never cached', async ({ page }) => {
  await waitForServiceWorker(page);

  const status = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/fast-english/lessons/lesson-id/audio?token=fake-token-123');
      return r.status;
    } catch {
      return -1;
    }
  });
  // Must have hit the network (401/404 from the disposable backend), never a cache.
  expect(status).toBeGreaterThanOrEqual(400);

  const entries = await cacheEntries(page);
  expect(entries.some((u) => u.includes('token'))).toBe(false);
  expect(entries.some((u) => u.includes('/lessons/'))).toBe(false);
});

test('payment and Placement traffic are not cached (GET + POST)', async ({ page }) => {
  await waitForServiceWorker(page);

  const statuses = await page.evaluate(async () => {
    const out: Record<string, number> = {};
    const paths = [
      '/api/fast-english/payment-requests/current',
      '/api/fast-english/payment-requests',
      '/api/fast-english/placement/attempts/start',
      '/api/fast-english/placement/attempts/attempt-id/answer',
      '/api/fast-english/progress/lesson-id',
      '/api/fast-english/lessons',
      '/api/fast-english/lessons/lesson-id/audio',
    ];
    for (const path of paths) {
      try {
        const r = await fetch(path, path.includes('answer') ? { method: 'PUT' } : undefined);
        out[path] = r.status;
      } catch {
        out[path] = -1;
      }
    }
    return out;
  });
  for (const [path, code] of Object.entries(statuses)) {
    // Every one of these must come from the network (4xx/401 on the
    // disposable backend), proving no cache serves or stores them.
    expect(code, path).toBeGreaterThanOrEqual(400);
  }

  const entries = await cacheEntries(page);
  const joined = entries.join('\n');
  expect(joined).not.toContain('/api/fast-english/');
  expect(joined).not.toContain('payment');
  expect(joined).not.toContain('placement');
  expect(joined).not.toContain('progress');
});

test('offline navigation renders the honest cached App shell', async ({ context, page }) => {
  // Fresh context so the first activation shows the offline-ready notice.
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The honest offline-ready message must mention the cached shell AND that
  // account data, payment, placement, lessons, audio and progress need
  // internet — no offline lesson/audio claims.
  await expect(page.getByText(OFFLINE_READY_MESSAGE)).toBeVisible();
  await expect(page.getByText(OFFLINE_HONESTY)).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  // The cached App shell renders (deterministic entry screen).
  await expect(
    page.getByRole('heading', { name: 'انگلیسی را دقیقاً در سطح خودت یاد بگیر' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'ورود' })).toBeVisible();
});

test('online recovery restores network access', async ({ context, page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'انگلیسی را دقیقاً در سطح خودت یاد بگیر' }),
  ).toBeVisible();

  await context.setOffline(false);
  await page.reload();
  const health = await page.evaluate(() => fetch('/api/health').then((r) => r.status));
  expect(health).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'انگلیسی را دقیقاً در سطح خودت یاد بگیر' }),
  ).toBeVisible();
});

test('update prompt appears for a new Service Worker version; no forced reload before confirmation', async ({
  page,
}) => {
  await waitForServiceWorker(page);

  // The test machine hosts the preview server, so a deployed update is
  // simulated by rewriting dist-app/sw.js on disk (the browser's Service
  // Worker update check fetches the real bytes and detects the difference).
  const swPath = resolve(process.cwd(), 'dist-app', 'sw.js');
  const originalSw = readFileSync(swPath, 'utf8');

  let loadEvents = 0;
  page.on('load', () => {
    loadEvents += 1;
  });
  const loadsBefore = loadEvents;

  const triggerUpdate = async () => {
    await page.evaluate(async () => {
      const reg = (await navigator.serviceWorker.getRegistrations())[0];
      await reg.update();
    });
  };

  try {
    // A new version is deployed: the prompt appears and the user postpones.
    // No reload happens anywhere in this phase.
    writeFileSync(swPath, `${originalSw}\n// P4-S2 deployed v2\n`);
    await triggerUpdate();
    await expect(page.getByText(UPDATE_MESSAGE)).toBeVisible();
    expect(loadEvents).toBe(loadsBefore); // no forced reload yet

    await page.getByRole('button', { name: UPDATE_LATER }).click();
    await expect(page.getByText(UPDATE_MESSAGE)).not.toBeVisible();
    expect(loadEvents).toBe(loadsBefore); // postpone did not reload

    // An even newer version ships while the first one is postponed. The
    // user's next visit (fresh page load) must detect it and prompt again —
    // still without any forced reload.
    writeFileSync(swPath, `${originalSw}\n// P4-S2 deployed v3\n`);
    await page.reload();
    await expect(page.getByText(UPDATE_MESSAGE)).toBeVisible();

    // Marker survives until the confirmed reload wipes it.
    await page.evaluate(() => {
      (window as unknown as { __pwaBeforeReload?: boolean }).__pwaBeforeReload = true;
    });
    const loadsAfterNextVisit = loadEvents;
    await page.getByRole('button', { name: UPDATE_NOW }).click();
    await page.waitForFunction(
      () => (window as unknown as { __pwaBeforeReload?: boolean }).__pwaBeforeReload === undefined,
      undefined,
      { timeout: 20_000 },
    );
    // waitForLoadState guarantees the load event has fired before counting.
    await page.waitForLoadState('load');
    // Only the user-confirmed reload happened after the prompt appeared.
    expect(loadEvents).toBe(loadsAfterNextVisit + 1);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: 'انگلیسی را دقیقاً در سطح خودت یاد بگیر' }),
    ).toBeVisible();
    await expect(page.getByText(UPDATE_MESSAGE)).not.toBeVisible();
  } finally {
    // Restore the original worker for subsequent tests / rebuilds.
    writeFileSync(swPath, originalSw);
  }
});

test('App shell renders on first visit with no uncaught errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'انگلیسی را دقیقاً در سطح خودت یاد بگیر' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('public sample requests are absolute URLs on the app origin', async ({ page }) => {
  // Native-build origin guard: the lesson feature must resolve every
  // `/api/...` path against the SDK origin. On Android release there is
  // no shared browser origin, so a root-relative request would hit the
  // Capacitor WebView origin and fail. This test pins the invariant in a
  // real browser: the public sample request must target the app origin.
  // (The DOM-level <source src> form is asserted in p3-s1.spec.ts where a
  // published sample lesson with audio exists; here the JSON request fires
  // regardless of whether a sample is published.)
  const sampleRequestUrls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/fast-english/public/sample')) {
      sampleRequestUrls.push(req.url());
    }
  });

  await page.goto('/sample');
  await expect.poll(() => sampleRequestUrls.length).toBeGreaterThan(0);

  for (const url of sampleRequestUrls) {
    expect(url.startsWith('http')).toBe(true);
    expect(new URL(url).origin).toBe(new URL(APP_URL).origin);
  }
});
