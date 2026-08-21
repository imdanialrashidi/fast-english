# Plan 034: Home SWR cache + library pagination batching + bundle manualChunks probe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- app/src/features/home/api.ts app/src/features/home/routes/HomeRoute.tsx app/src/features/library/routes/LibraryRoute.tsx vite.app.config.ts vite.landing.config.ts vite.admin.config.ts scripts/measure-app-perf.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (cache is additive; manualChunks conditional on measured win)
- **Depends on**: 026 (Episode waterfall — same surface-owner pattern, do in parallel not sequence)
- **Category**: perf (client caching + pagination + bundle)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

- **Home refetches 4 endpoints on every mount** (`loadHomeData = Promise.all([getLessonList, getContinueLearning, getProgressSummary, getHomeSubscription])`) with no SWR: second visit in same session pays 4 RTTs again (lab 3.6s LCP). `recommendedLevel` is stable, lessons rarely change.
- **Library pagination is sequential** (`for page=loaded+1..query.page await getLibrary({page})` accumulates pages serially). Jumping 1→3 pays 2 sequential RTTs; mobile unstable doubles latency.
- **Bundle has no vendor chunking or image sizing evidence:** 3 vite configs have no `manualChunks`; entry carries MUI 898KB source + Emotion + React 19 + Router 8.3 in one `~210KiB gzip` chunk; cache invalidation busts vendor. No `srcset`/thumb param for `EpisodeArtwork` — full artwork on 360px phones.

Each is S effort; the probe for manualChunks must be measured before keeping.

## Current state

- **`app/src/features/home/api.ts:78-110`:** `loadHomeData(uid) => Promise.all([...])` on every `HomeRoute` mount (`useCallback load()` + `useEffect` no memo/SWR). Backend sends `private,no-store` so HTTP cache also bypassed.
- **`app/src/features/library/routes/LibraryRoute.tsx:170-205`:** `for (let page=...; page<=query.page; page++) await getLibrary({page})` serial, `artworkLoading={index<3?'eager':'lazy'}` already phased.
- **`vite.app.config.ts` / `vite.landing.config.ts` / `vite.admin.config.ts`:** no `build.rollupOptions.output.manualChunks`, no `vite-plugin-image-optimizer`, no `rollup-plugin-visualizer`; `generate-og-image.mjs` only. Entry JS 288→208KiB after plan 013 split but vendor not cached separately.
- **`scripts/measure-app-perf.mjs` + `measure-app-perf-seed.mjs` + `scripts/measure-app-perf.sh`:** lab harness Slow-4G+4x CPU exists (`.artifacts/perf/final-run1.json` 984KB raw/285KB gzip entry).

- **Conventions:** `biome.json` excludes no `app/**`; `vitest` covers `app/**/*.test`. Library state URL-backed (`/library?q&category&level&progress&sort&page`). Home uses `seqRef` per fetch (stale discard).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Unit | `npx vitest run app/src/features/home app/src/features/library` | pass |
| Perf lab | `bash scripts/measure-app-perf.sh` (or `node scripts/measure-app-perf.mjs`) | prints LCP/TBT/transfer.js; exit 0 regardless of budget |
| Build | `pnpm build:app && pnpm build:landing` | deterministic `dist-*` |
| Browser (fast) | `pnpm test:e2e:fast e2e/podcast-library.spec.ts` | library browsing still green |

## Scope

**In scope** (the only files you should modify):
- `app/src/features/home/api.ts` / `app/src/features/home/routes/HomeRoute.tsx` — add SWR/memo throttle
- `app/src/features/library/routes/LibraryRoute.tsx` — batch missing pages via `Promise.all`
- `vite.app.config.ts` (and optionally `vite.landing.config.ts`/`vite.admin.config.ts` only if the probe generalizes) — experimental `manualChunks` guarded by measurement
- `scripts/measure-app-perf.mjs` — optional thumb param note; do not change harness unless needed

**Out of scope** (do NOT touch, even though they look related):
- `server/pb_hooks/**` — backend pagination/audio are plans 025/032.
- `app/src/pwa/sw.ts` — do not change SW precache boundary in this perf tweak.
- `app/src/features/episode/**` — episode waterfall is plan 026.

## Git workflow

- Branch: `advisor/034-bundle-cache-pagination`
- Commits: 1) home SWR 2) library batching 3) manualChunks probe (revert if no win) — or one commit if each is trivial.
- Do NOT push unless instructed.

## Steps

### Step 1: Add SWR/memo to Home (60s stale, stale-while-revalidate)

Edit `app/src/features/home/api.ts` or `HomeRoute.tsx`:

Option A (client SWR, preferred): Keep `loadHomeData` as is, but in `HomeRoute.tsx` add a throttle:

```tsx
const lastLoadRef = useRef(0);
const cacheRef = useRef<HomeData | null>(null);
const load = useCallback(async (force=false) => {
  const now = Date.now();
  if (!force && cacheRef.current && now - lastLoadRef.current < 60_000) {
    setData(cacheRef.current); return; // serve stale, optionally revalidate in background
  }
  const data = await loadHomeData(uid);
  cacheRef.current = data; lastLoadRef.current = now;
  setData(data);
}, [uid]);
```

Option B (server `Cache-Control`): if home endpoints can tolerate 60s staleness, change `progress_routes` summary/continue and `lesson_routes` list to `Cache-Control: private, max-age=60, stale-while-revalidate=60` instead of `no-store`. Progress may be stale 60s — acceptable per `docs/ARCHITECTURE.md: Progress stays independent across levels`. Choose A first (no server change) and report if B is needed for HTTP caching.

Keep `seqRef` staleness guard. The second visit within 60s must not hit the network; after 60s it refetches.

**Verify**: manual `pnpm dev:app` → open Home, navigate away and back within 10s — network tab shows no second `loadHomeData` batch (or shows 304/bypass). `npx vitest run app/src/features/home/home.test.ts` still pass.

### Step 2: Batch missing library pages via `Promise.all`

Edit `app/src/features/library/routes/LibraryRoute.tsx` `loadedPagesRef` loop:

Replace:
```ts
for (let page=loaded+1; page<=query.page; page++) await getLibrary({page})
```
With bounded parallel:
```ts
const missing = [];
for (let p=loaded+1; p<=query.page; p++) missing.push(p);
const results = await Promise.all(missing.map(p => getLibrary({page:p})));
 // assemble in order: results sorted by page
```

- Keep existing `itemsRef` accumulation optimization for back nav (already today).
- Preserve error handling per-page (if one page 403, others still render; map with `.catch` per entry as Episode plan does).

**Verify**: `pnpm test:e2e:fast e2e/podcast-library.spec.ts` → library paging still deterministic; `npx vitest run app/src/features/library/queryState.test.ts` pass.

### Step 3: Probe `manualChunks` with measured win (keep only if measured)

Edit `vite.app.config.ts` (and only `vite.app.config.ts` initially):

```ts
export default defineConfig({
  build: {
    outDir: '../dist-app',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react','react-dom','react-router'],
          mui: ['@mui/material','@mui/icons-material','@emotion/react','@emotion/styled'],
        }
      }
    }
  }
});
```

- Run before/after measurement:
```bash
pnpm build:app
node scripts/measure-app-perf.mjs --json > /tmp/before.json # or bash scripts/measure-app-perf.sh
# then apply manualChunks, rebuild, re-measure > /tmp/after.json
```

- Keep manualChunks **only if** `after.transfer.js` gzip is lower or cacheability improves (entry chunk smaller) **and** LCP/TBT not regressed. Prior experiments reverted manualChunks with no gain per `docs/exec-plans/active/2026-08-app-perf-observability.md`. If no win, revert the config change and note in commit message "manualChunks probe: no measured win, reverted".

- Do not add `vite-plugin-image-optimizer` in this plan — just probe `manualChunks`. Image thumb param (`?thumb=360`) needs PB PB-side support; only add a comment in `EpisodeArtwork` if PB supports it per `docs/PODCAST_DOMAIN.md`.

**Verify**: `pnpm build:app` succeeds with and without chunks; `scripts/check-bundle-boundaries.mjs` still passes.

### Step 4: Regression

Run `pnpm verify:fast` + `pnpm build:landing && pnpm build:admin` (if touched) + `pnpm test:e2e:fast e2e/podcast-library.spec.ts`.

**Verify**: all green; no `git status` outside Scope.

## Test plan

- **Home SWR**: vitest for `loadHomeData` throttle or manual network check (no double fetch within 60s).
- **Library batching**: vitest `queryState.test.ts` + e2e `podcast-library` pending/completed filter + sort `suggested|latest` + pagination `perPage` clamp — all still pass via parallel batch.
- **Bundle probe**: `measure-app-perf` before/after JSON compared locally (not asserted in CI); manualChunks only kept if `after.transfer.js` ≤ `before`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "Promise.all.*getLibrary\|Promise.all.*missing" app/src/features/library/routes/LibraryRoute.tsx` hits (sequential loop gone)
- [ ] `grep -n "lastLoadRef\|stale.*60\|max-age" app/src/features/home/` hits (SWR/throttle present)
- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm build:app` exits 0; if manualChunks kept then `dist-app/assets` contains `vendor-*.js`/`mui-*.js` chunks (check `ls dist-app/assets`); if reverted then `vite.app.config.ts` has no `manualChunks` string
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- Home `loadHomeData` is already SWR'd (plan 026 or another branch did it) — report actual code and skip.
- Library `query.page` jump >5 (would parallelize 6 concurrent `getLibrary` calls, risking PB burst) — then cap `Promise.all` to `Math.min(missing.length, 3)` concurrent and report.
- `manualChunks` breaks `rolldown` hoisting on Vite 8.1.5 (`@rolldown/binding-1.1.5`) with chunk-not-found runtime error — revert and report.
- You need to change any hook file or SW precache boundary — out of scope.

## Maintenance notes

- Home cache is 60s client-side only — not persisted across reloads. If `progress/summary` later gets server `Cache-Control`, the client cache can be removed or tuned to `max-age` alignment.
- Library `Promise.all` batch is still bounded by PB `perPage`/`limit` — after plan 025's server pagination lands, the batch cost shrinks (each page is a DB slice not a full catalog).
- ManualChunks decision must be re-measured after every MUI major bump (9.2.0 → later) — a previously neutral split can become a win when dependency graph changes.

