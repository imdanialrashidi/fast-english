# Plan 026: Parallelize Episode detail fetches (remove waterfall)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- app/src/features/lessons/routes/LessonDetailRoute.tsx app/src/features/lessons/api.ts app/src/features/progress/api.ts app/src/features/podcast/api.ts e2e/podcast-episode.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf (client read-path latency)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`LessonDetailRoute` fetches after `getLessonDetail` in sequence: `getLessonProgress`, then `getLessonVocabulary`, then `buildProtectedAudioUrl` — three sequential RTTs plus a PB file-token fetch before the Deck timeline renders. Lab LCP for Episode is ~3.7s after route splitting; the waterfall adds ~300–600ms on Slow-4G. `home/api.ts` already proves `Promise.all` works with the same endpoints; the Episode surface can parallelize progress+vocab+token after the lesson payload, keeping `seqRef` staleness guards but rendering each region when ready (skeletons preserved).

## Current state

- **File `app/src/features/lessons/routes/LessonDetailRoute.tsx` (handler `loadLesson`, ~155–210):**
```tsx
const data = await api.getLessonDetail(targetId);
const prog = await progressApi.getLessonProgress(targetId); // non-fatal, sequential
const vocab = await api.getLessonVocabulary(targetId);
const url = await api.buildProtectedAudioUrl(data.audio.url);
// each: await, then setState for phase, sequential set
```
  Each API wrapper is a `fetch`/`pb.send` + `pb.files.getToken()` for audio. They are independent after `data` resolves (detail provides `audio.url` for token, but progress/vocab do not need detail).

- **File `app/src/features/lessons/api.ts` / `app/src/features/progress/api.ts` / `app/src/features/podcast/api.ts`:** thin `load*` helpers calling `GET /api/fast-english/lessons/{id}`, `/progress`, `/vocabulary`, `/lessons/{id}/audio` (proxy). Each has per-`seqRef` guard discarding stale responses (pattern `let seq = ++seqRef.current; ... if (seq !== seqRef.current) return;`).

- **Plan 013** added `useMemo` for `buildEditionRail`/`splitParagraphs` but did not reorder fetches; the waterfall remains.

- **Conventions:** React hooks rules: all `useMemo` before early returns (plan 013 lesson). `biome.json` enforces no raw durations; motion tokens only. `vitest` includes `app/**/*.test.ts`. Browser lane `e2e/podcast-episode.spec.ts` pins CTA labels per state, edition switch atomicity, resume seek.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Unit | `npx vitest run app/src/features/lessons/routes app/src/features/episode` | pass |
| Browser (fast) | `pnpm test:e2e:fast e2e/podcast-episode.spec.ts` | 21 tests pass (or ≥19 if flaky single) |
| Playwright full | `pnpm test:e2e:full -- e2e/podcast-episode.spec.ts` (optional) | pass |

## Scope

**In scope** (the only files you should modify):
- `app/src/features/lessons/routes/LessonDetailRoute.tsx`
- `app/src/features/lessons/api.ts` (only if helper signatures needed — prefer no change)
- `app/src/features/progress/api.ts` (same — prefer no change)

**Out of scope** (do NOT touch, even though they look related):
- `app/src/features/player/PlayerProvider.tsx` / `lifecycle.ts` / `VariantDeck.tsx` — player session, MiniPlayer interplay unchanged.
- `server/pb_hooks/*` — backend pagination/audio streaming are separate plans (025/032).
- `app/src/features/episode/**` — composition, Edition Rail, jacket — no changes.
- `e2e/**` — do not weaken the episode spec to hide a regression.

## Git workflow

- Branch: `advisor/026-episode-waterfall-parallel`
- Commit: `perf(episode): parallelize progress, vocab and audio token fetches`
- Do NOT push unless instructed.

## Steps

### Step 1: Refactor `loadLesson` to fire progress+vocab+token in parallel after detail

Edit `app/src/features/lessons/routes/LessonDetailRoute.tsx`:

1. Keep `const data = await api.getLessonDetail(targetId);` sequential (it is required for `audio.url` and for early 404).
2. Immediately after `data` resolves, fire three promises **in parallel** with independent catch (preserve existing non-fatal semantics — progress/vocab failures show skeletons, audio token failure shows retry, none abort the others):
```tsx
const seqAtStart = seqRef.current;
const progressP = progressApi.getLessonProgress(targetId).catch(() => null);
const vocabP = api.getLessonVocabulary(targetId).catch(() => null);
const audioUrlP = api.buildProtectedAudioUrl(data.audio.url).catch(() => null);
const [prog, vocabRes, url] = await Promise.all([progressP, vocabP, audioUrlP]);
if (seqAtStart !== seqRef.current) return; // stale load discarded
// then setState for each region as today (phase, lesson, progress, vocab, audioUrl)
```
   - Preserve the existing `seqRef` guard per fetch if individual helpers already have it; the outer `seqAtStart` check is sufficient. Do not remove per-helper guards.
   - Keep the existing `phase` state machine: `phase === 'switching'` skeleton for variant-dependent regions only; jacket stays rendered. Do not change skeleton layout.

3. Ensure the `useEffect` dependencies remain `[targetId]`-like; no new `eslint-disable` needed.

**Verify**: `pnpm verify:fast` exits 0; `npx vitest run app/src/features/lessons/routes` passes (hooks order still valid — memos before early returns).

### Step 2: Preserve error/retry semantics per region

- Progress 4xx (403 entitlement) → route-level permission `StatePanel` (already today).
- Vocab 404/403 → vocabulary empty state (`برای این اپیزود واژه‌ای ثبت نشده است.`) or error line — keep today's copy.
- Audio token failure → Deck error line + `تلاش مجدد` disabled while (re)load in flight (today's CTA disabled flag). No change.

No new copy; just keep the three `catch` branches as they exist (each region already had its own `try/catch` today — now they are parallel but error mapping stays per-promise).

**Verify**: `pnpm test:e2e:fast e2e/podcast-episode.spec.ts` — the retry + entitlement scenarios still pass. If a single test flakes, rerun with `--repeat-each 2` locally once before concluding.

### Step 3: Manual timing sanity (no benchmark required)

Confirm no regressions in non-Episode routes: run `pnpm verify:fast` (which includes `EpisodeJacket`, `VariantDeck`, `logic.test.ts`). No additional perf harness needed — the plan is correctness-preserving with a latency win, not a measured budget gate.

**Verify**: `pnpm verify:fast` green; no `biome check` errors.

## Test plan

- **Existing coverage:** `e2e/podcast-episode.spec.ts` 21 tests (CTA per state, resume seek, edition switch atomic, pronunciation exclusive) — must stay green. Unit `app/src/features/episode/logic.test.ts` + `app/src/features/lessons/routes/LessonDetailRoute` shallow if exists.
- **No new unit needed:** the change is fetch ordering; correctness is exercised by e2e. Optionally add a cheap vitest for `LessonDetailRoute` load ordering (mock `api` and assert `Promise.all` call count 3) — only if you can add it in <20 lines; otherwise omit.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "Promise.all" app/src/features/lessons/routes/LessonDetailRoute.tsx` hits and `await api.getLessonProgress` / `await api.getLessonVocabulary` sequential `await`s no longer appear before the `Promise.all`
- [ ] `pnpm verify:fast` exits 0 (`typecheck` + `biome` + `vitest`)
- [ ] `pnpm test:e2e:fast e2e/podcast-episode.spec.ts` exits 0 (or reports only known-flaky 1/21 with retry passing)
- [ ] No file outside Scope modified (`git status`)
- [ ] `plans/README.md` row updated

## STOP conditions

Stop and report back if:

- The excerpt in "Current state" does not match live code (work waterfall already parallelized, or `buildProtectedAudioUrl` needs `data.id` not `data.audio.url` — report mismatch).
- `getLessonProgress`/`getLessonVocabulary` actually depend on each other (e.g. vocab needs progress position) — then parallelization is unsafe; report.
- `seqRef` staleness guard is per-region and removing sequential `await` ordering causes a later stale response to overwrite an earlier fresh one — report if per-helper guards are missing.
- You need to change any hook file or `podcast_domain.pb.js`.

## Maintenance notes

- Future Episode fields (e.g. pronunciation audio URL) should be added to the same `Promise.all` block if they are independent after `data`. Do not re-introduce sequential awaits for independent regions.
- The Episode LCP is `artwork` (eager, `EpisodeArtwork` public-cacheable). Progress/vocab/audio are below-the-fold during load — `Promise.all` keeps first-paint while populating them when ready.
- Reviewers: the win is latency only, not payload size. Token rebuild retry (plan 021 context `?_r` nonce) still sequence-guarded.

