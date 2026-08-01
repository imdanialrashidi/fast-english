// app/src/pwa/sw.ts
// Product App Service Worker (P4-S2) — injected via vite-plugin-pwa
// (strategies: 'injectManifest').
//
// Cache policy:
//   PRECACHE ONLY — the app shell: versioned JS/CSS, the HTML shell,
//   self-hosted fonts, app icons and static images. All entries come from
//   `sw.__WB_MANIFEST`, which the plugin fills at build time from
//   dist-app/ (revisioned assets are safe to cache forever).
//
//   NEVER cached / always NetworkOnly:
//   - /api/** (auth, payment, Placement, receipt, lessons, progress,
//     premium audio and public sample audio proxies all live under /api/)
//   - /files/** (PocketBase file serving)
//   - any URL containing `token` (file-token responses, authorized audio)
//   - any non-GET request (payment uploads, Placement answers, progress)
//
// Offline behavior is honest: the cached shell renders, but account data,
// payment, Placement, lessons, audio and progress always require the
// network. There is no offline lesson/audio support.
//
// This file is compiled by vite-plugin-pwa's own esbuild step; the minimal
// `self` typing below keeps it type-safe under the project's DOM lib
// without pulling in the WebWorker lib.

interface ManifestEntry {
  url: string;
  revision?: string | null;
}

// The service-worker global. `self` is already declared by the DOM lib, so
// the worker scope is accessed through this alias (types are erased by the
// plugin's esbuild step; this is only for the project typecheck).
interface SwGlobal {
  location: { origin: string };
  __WB_MANIFEST?: ManifestEntry[];
  skipWaiting(): void;
  clients: { claim(): Promise<void> };
  addEventListener(
    type: 'install' | 'activate' | 'message',
    listener: (event: SwEvent) => void,
  ): void;
  addEventListener(type: 'fetch', listener: (event: SwFetchEvent) => void): void;
}

const sw = self as unknown as SwGlobal;

interface SwEvent {
  waitUntil(promise: Promise<unknown>): void;
  data?: { type?: unknown } | null;
}

interface SwFetchEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

const PRECACHE_NAME = 'fep-app-shell-v1';
const OFFLINE_SHELL = '/index.html';

// Dedupe by URL: the plugin injects the manifest's own icon entries twice
// (once via glob, once because they are referenced by the manifest).
//
// NOTE: the compiled output must contain the literal token `self.__WB_MANIFEST`
// exactly once — workbox-build's injectManifest replaces precisely this
// expression with the precache manifest at build time.
function manifestEntries(): ManifestEntry[] {
  const injected = (self as unknown as SwGlobal).__WB_MANIFEST ?? [];
  const seen = new Set<string>();
  const entries: ManifestEntry[] = [];
  for (const entry of injected) {
    if (!seen.has(entry.url)) {
      seen.add(entry.url);
      entries.push(entry);
    }
  }
  return entries;
}

const PRECACHE_URLS = new Set(
  manifestEntries().map((entry) => new URL(entry.url, sw.location.origin).toString()),
);

// Protected/private traffic: never intercepted, never cached, never served
// from cache. Also covers URLs containing `token` (case-insensitive).
function isProtectedUrl(url: URL): boolean {
  const path = url.pathname;
  if (path.startsWith('/api/')) return true;
  if (path.startsWith('/files/')) return true;
  return /token=/i.test(url.search);
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_NAME);
      await Promise.all(
        manifestEntries().map(async (entry) => {
          const url = new URL(entry.url, sw.location.origin);
          if (isProtectedUrl(url)) return; // defense-in-depth: never precache protected URLs
          const response = await fetch(url.toString(), { credentials: 'same-origin' });
          if (!response.ok) {
            throw new Error(`Precache failed for ${entry.url} (${response.status})`);
          }
          await cache.put(url.toString(), response);
        }),
      );
    })(),
  );
  // No skipWaiting here: activation is controlled by the explicit update
  // prompt (SKIP_WAITING message) so pages are never force-reloaded.
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const stale = (await caches.keys()).filter((name) => name !== PRECACHE_NAME);
      await Promise.all(stale.map((name) => caches.delete(name)));
      await sw.clients.claim();
    })(),
  );
});

// Explicit update confirmation: registerSW.js posts SKIP_WAITING when the
// user chooses to update; reload happens after activation (prompt flow).
sw.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void sw.skipWaiting();
  }
});

// Cache-first for precached static assets; navigation gets a network-first
// handler with a cached-shell fallback. Everything else (including all
// protected traffic) falls through to the browser default (network only).
sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  if (isProtectedUrl(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (PRECACHE_URLS.has(url.toString())) {
    event.respondWith(cacheFirst(url.toString()));
  }
});

async function cacheFirst(url: string): Promise<Response> {
  const cache = await caches.open(PRECACHE_NAME);
  const hit = await cache.match(url);
  if (hit) return hit;
  // Not (yet) precached: fetch from the network, but do NOT add the
  // response to any cache (only build-time revisions are cached).
  return fetch(url);
}

async function navigationHandler(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    // Offline: serve the cached app shell. The shell itself renders honest
    // network-required states for every data-dependent screen.
    const cache = await caches.open(PRECACHE_NAME);
    const shell = await cache.match(OFFLINE_SHELL);
    if (shell) return shell;
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
