/* S2 PWA shell: allowlist-only service worker (scope §18.1).
 *
 * Precaches ONLY the public allowlist injected below (fingerprinted Vite
 * assets, icons, Vazirmatn, the offline page, the manifest). Everything
 * else — HTML navigations, auth, component updates, admin, payment files,
 * saved state, exams, audio/video bytes including the sample audio — is
 * network-only and is NEVER written to any cache. Runtime caching is
 * intentionally absent.
 *
 * Updates never force-reload: the new worker waits until the page (which
 * shows a notice) sends FE_SKIP_WAITING after an explicit user refresh.
 * Playback and form submissions are therefore never interrupted.
 */
const FE_CACHE = 'fe-public-{{ $version }}';
const FE_PRECACHE = {!! json_encode($precache) !!};
const FE_OFFLINE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(FE_CACHE).then((cache) =>
      // Public assets only: omit credentials so a precache fetch can never
      // carry a session cookie or persist a Set-Cookie across logout.
      cache.addAll(FE_PRECACHE.map((url) => new Request(url, { credentials: 'omit' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('fe-') && key !== FE_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'FE_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (FE_PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(FE_OFFLINE))
    );
    return;
  }

  // Network-only default: everything not on the allowlist bypasses all
  // caches. Non-allowlisted requests MUST never enter FE_PRECACHE —
  // pinning them would cache private bytes. Locked by the precache test.
  event.respondWith(fetch(request));
});
