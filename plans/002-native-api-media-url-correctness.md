# 002 — Native API and media URL correctness (Android)

- **Written against:** commit `4b7caba` (branch `main`, clean tree)
- **Status:** DRAFT
- **Effort:** S · **Fix risk:** Medium · **Finding:** #2 (MAJOR — Android release media/sample requests hit the wrong origin)

## Why this matters

The Android release APK bundles the built app and has **no shared browser
origin**: `window.location.origin` is the Capacitor WebView origin
(`https://localhost` on device), not the production API host. The architecture
document mandates an explicit API origin for native builds. The SDK client is
already configured with the correct origin, but the lesson feature bypasses it
with root-relative URLs, so on a real device:

- `getPublicSample()` fetches `/api/fast-english/public/sample` against `https://localhost` → fails.
- The public sample audio `<source src="/api/fast-english/public/sample/audio">` → fails.
- `buildProtectedAudioUrl()` returns `${audioUrl}?token=${fileToken}` with a root-relative path → the `<audio>` element resolves it against the WebView origin → fails.

Browser/PWA builds are unaffected (same-origin proxy), which is why the current
test suite is green while the shipped APK would be broken. The physical-device
gate is documented as NOT RUN (`docs/ANDROID_RELEASE.md:89-95`), so this must be
fixed before any real-device acceptance.

## Current state (evidence)

- `docs/ARCHITECTURE.md` (lines 21–25): browser/PWA is same-origin; **Android release: API base = explicit `https://app.fastenglishpodcast.com` (NOT `window.location.origin` — bundled APK has no shared browser origin)**.
- `app/src/lib/pocketbase.ts` (lines 9–16): the singleton client is built from `resolveApiOrigin().origin`, which returns `https://app.fastenglishpodcast.com` for native production builds (`app/src/lib/apiOrigin.ts:62-65`). The SDK's `buildURL(path)` therefore already produces the correct absolute URL.
- `app/src/features/lessons/api.ts` (lines 28–34):
  ```ts
  export async function getPublicSample(): Promise<PublicSampleResponse> {
    const raw = await fetch(`${API_BASE}/public/sample`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    return (await raw.json()) as PublicSampleResponse;
  }
  ```
  where `API_BASE = '/api/fast-english'` (line 7). `fetch` with a relative URL resolves against `window.location.origin` (or the Capacitor scheme on native).
- `app/src/features/lessons/api.ts` (lines 42–45):
  ```ts
  export async function buildProtectedAudioUrl(audioUrl: string): Promise<string> {
    const pbClient = pb();
    const fileToken = await pbClient.files.getToken();
    return `${audioUrl}?token=${fileToken}`;
  }
  ```
  The server sends root-relative paths: `server/pb_hooks/lesson_routes.pb.js` line 425 (`url: "/api/fast-english/lessons/" + id + "/audio"`) and line 550 (`url: "/api/fast-english/public/sample/audio"`).
- `app/src/features/lessons/routes/SampleRoute.tsx` (lines 41–42): `setAudioUrl(data.lesson.audio.url)` — the root-relative path is handed straight to `<audio>`.
- `app/src/features/lessons/routes/LessonDetailRoute.tsx` (lines 55–63): `buildProtectedAudioUrl(data.audio.url)` is called with the server's root-relative path, then passed to `AudioPlayer`.
- Existing exemplar for the correct pattern: `app/src/features/payment/api.ts` `fetchReceiptBlob` (lines 245–262) uses `pb.buildURL(receiptDownloadPath(recordId))` and is unit-tested in `app/src/features/payment/api.test.ts` (lines 356–360).

## Repo conventions to follow

- Feature API wrappers live in `app/src/features/<feature>/api.ts` and use the `pb()` accessor from `getPocketBase()`.
- Unit tests mock `../../lib/pocketbase` with a `pbMock` object (see `app/src/features/payment/api.test.ts` lines 23–55) — follow that exact shape.
- Never log or persist the file token; the current code already complies and the change must preserve that.
- TypeScript strict + Biome: run `pnpm typecheck` and `pnpm check` (no auto-fix).

## Scope

**In scope:**

- `app/src/features/lessons/api.ts`
- `app/src/features/lessons/routes/SampleRoute.tsx`
- New unit test file `app/src/features/lessons/api.test.ts`
- Optional browser-test additions in `e2e/p4-s2-pwa.spec.ts` (the established real-browser pattern)

**Out of scope:**

- Server route authorization/entitlement behavior (`server/pb_hooks/lesson_routes.pb.js`)
- The server's root-relative URL contract (deliberately kept relative; the client resolves it)
- Capacitor native HTTP plugins (`docs/ARCHITECTURE.md:31` explicitly rejects them unless device evidence demands it)
- Changing `app/src/lib/apiOrigin.ts` or `app/src/lib/pocketbase.ts`
- Any change to the PWA Service Worker

## Steps (ordered)

1. In `app/src/features/lessons/api.ts`, add a small resolver used by every network sink in this module:
   ```ts
   function resolveApiUrl(path: string): string {
     return pb().buildURL(path);
   }
   ```
   Only call it with paths you expect to start with `/api/` — do not pass arbitrary external URLs through it.

2. Change `getPublicSample()` to fetch the resolved absolute URL instead of the relative `API_BASE` string. Keep the `accept: application/json` header and error behavior (current code does not check `res.ok`; do not silently add failure handling that changes UI states — but you MAY add a minimal `if (!raw.ok) throw ...` if it maps cleanly through the existing `SampleRoute` catch → `error` phase; keep the change minimal and note it).

3. Change `buildProtectedAudioUrl(audioUrl: string)`:
   - Resolve the server-relative path through `resolveApiUrl(audioUrl)`.
   - Append the token with `new URL(...)` + `url.searchParams.set('token', fileToken)` so any reserved characters in the token are encoded and an existing query string is preserved.
   - Return the absolute URL string.
   - Do not log the URL or the token.

4. In `SampleRoute.tsx`, the server-returned `data.lesson.audio.url` is root-relative. Resolve it before `setAudioUrl(...)` using the same boundary. Prefer a small exported helper in `api.ts` (e.g. `resolveMediaUrl(path)`) so the route does not import `pocketbase.ts` directly — keep the module boundary consistent with the other routes. (Do NOT pass it through `buildProtectedAudioUrl`, which would mint a file token for a public URL.)

5. Preserve browser behavior: in the browser, `pb.buildURL('/api/...')` returns the same-origin absolute URL (identical semantics to today). Verify with the unit tests.

6. Do not touch the server; the relative contract stays.

## Test plan

**New unit tests** — `app/src/features/lessons/api.test.ts`, modeled on `app/src/features/payment/api.test.ts` (mock `../../lib/pocketbase`, expose `buildURL` on the mock, `vi.restoreAllMocks()` in `afterEach`):

- `getPublicSample()` calls `fetch()` with a URL whose origin is the mock `buildURL` base (assert `fetch` was called with `http://test.local/api/fast-english/public/sample`, or with whatever the mock's `buildURL` produces).
- `buildProtectedAudioUrl('/api/fast-english/lessons/<id>/audio')`:
  - returns an absolute URL starting with the mock base;
  - contains the file token from `pbMock.files.getToken`;
  - round-trips a token containing reserved characters (e.g. `a+b&c=d/e`) through `URL.searchParams.get('token')`;
  - produces exactly one `?` (no `?token=...?` concatenation bug) when the input has no query string, and preserves an existing query string when one exists.
- The sample audio resolver returns `pb.buildURL('/api/fast-english/public/sample/audio')` without calling `files.getToken`.

**Browser test (optional but recommended):** extend `e2e/p4-s2-pwa.spec.ts` with a test that asserts the public sample request URL and the premium audio URL are absolute and same-origin with the app under test (the E2E app origin already proxies `/api`). If flaky, keep only the unit tests and note it.

**Acceptance (machine-checkable):**

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm build:app
pnpm test:e2e -- e2e/p4-s2-pwa.spec.ts
```

**Real-device gate (only if a device is available):**

```bash
pnpm android:sync
pnpm android:build:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Manual checks: signup/login, public sample page loads text AND audio, premium lesson audio plays and seeks. If no device is available, report the device gate as NOT RUN — do not claim it.

## Maintenance note

- Every future server-returned media/API path must cross the same origin boundary before reaching `fetch`, `<audio>`, `<img>`, or `<source>`. The Server contract stays relative; the client owns resolution.
- Watch in review: a PR that reintroduces a relative `fetch(`${API_BASE}...`)` in lessons (or any native-reachable surface) regresses this fix; the unit test asserting the resolved origin is the regression guard.
- `buildProtectedAudioUrl` is the only place a file token may be attached; never move token appending into components.

## Escape hatches

- If `pb.buildURL()` behavior for paths differs from the payment-module exemplar (e.g. the installed SDK version 0.27.0 mangles paths), STOP and verify the actual SDK method signature/source before choosing another resolver; do not hand-roll origin concatenation.
- If the E2E browser test proves flaky in the shared single-worker setup (`workers: 1` in `playwright.config.ts`), drop the browser test, keep the unit tests, and note the limitation. Do not add a new test dependency.

## Done criteria

- [ ] `getPublicSample` and `buildProtectedAudioUrl` produce absolute URLs via the SDK origin
- [ ] SampleRoute resolves the public audio URL through the same boundary
- [ ] New unit tests pass; reserved-character token round-trip covered
- [ ] `pnpm typecheck && pnpm check && pnpm test && pnpm build:app` green
- [ ] No server change; no new dependency; no token logging
