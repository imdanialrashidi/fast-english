# Plan 037: Vocabulary-aware discovery + saved episode (adjacent on existing indexes)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/library_routes.pb.js app/src/features/library/ shared/podcast/domain.ts docs/PODCAST_DOMAIN.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (spike — design + prototype, not full migration)
- **Risk**: LOW (read-only extension, existing entitlement/pagination invariants preserved)
- **Depends on**: 025 (library full-scan fix — extend the optimized filter, not the old full-load), 036 (export — more episodes → discovery value)
- **Category**: direction (discovery)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`library_routes.pb.js:q` is `title ~ {:q}` ≤60 chars, substring only, no ranking, no `lesson_vocabulary.normalized_term` search. Learners discover by terms they studied, not by Episode title substring. `lesson_vocabulary` already has deterministic `normalized_term` (trim/lowercase, unique `lesson+normalized_term` via validation) and `meaningFa`, indexed `lesson(sort_order)` and designed for lookup — but never used for discovery. Adding vocabulary-aware ranking plus a `saved` boolean on `lesson_progress` gives a habit anchor without algorithmic personalization ("no smart claims" per `DESIGN.md`).

## Current state

- **Library query `server/pb_hooks/library_routes.pb.js:q`:**
```js
var topicFilter = "status = 'published'";
if (q) { topicFilter += " && (title ~ {:q} || title_fa ~ {:q} || description_fa ~ {:q})"; }
var topics = $app.findRecordsByFilter(TOPICS_C, topicFilter, "", 0, 0, {q: q});
// q length bounded at 60, no stemming, no vocabulary join, publication-before-pagination
```
  Sorts `suggested|latest` only (no duration, no relevance), `continueListening` capped 3, no bookmark/saved state beyond per-Variant `furthest_seconds`.

- **Vocabulary `PODCAST_DOMAIN.md` + `server/pb_hooks/content_import_core.pb.js`:** `lesson_vocabulary(lesson, normalized_term unique, sort_order, meaningFa, pronunciation_audio)` with `lesson_vocabulary(lesson, sort_order)` implicit and `normalized_term` via `checksums/versioning`. Client `LibraryRoute.tsx` URL-backed (`/library?q&category&level&progress&sort&page`).

- **Plan constraints:** keep `private,no-store` media, `token=[REDACTED]` log filter, `planStateHash` staleness, `perPage` deterministic pagination — do not break them.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Library smoke | `bash scripts/smoke-library.sh node scripts/smoke-library.mjs` | 27 scenarios green + new vocab alias scenario |
| Unit | `npx vitest run app/src/features/library` | pass |

## Scope

**In scope** (spike — design + minimal prototype behind flag):
- `server/pb_hooks/library_routes.pb.js` — extend `q` to also match `lesson_vocabulary.normalized_term` via pre-fetched ID set (keep bulk-query pattern, no N+1)
- `app/src/features/library/routes/LibraryRoute.tsx` — `saved` filter UI + `Fuse.js` client fallback ranking (optional)
- `docs/adr/ADR-vocabulary-discovery.md` (new) + prototype `shared/lib/search-rank.ts` draft if trivial

**Out of scope** (do NOT ship as full feature):
- SQLite FTS5/Typesense migration — defer (probe only).
- PB schema migration `saved` boolean on `lesson_progress` — design only (no committed migration).
- No ranking model beyond 3 weighted fields (title/fa > vocab term > transcript preview).

## Git workflow

- Branch: `spike/dir-vocabulary-discovery`
- Commits: doc + prototype behind `VITE_CATALOG` or feature flag, do NOT merge to `main`.

## Steps

### Step 1: Spike — vocabulary extension via ID join (keep bulk pattern)

Extend `library_routes.pb.js`:

1. After existing `if(q)` topicFilter build, add vocab ID phase (only when `q` present):
```js
var vocabLessonIds = {};
if (q) {
  try {
    var vocabHits = $app.findRecordsByFilter("lesson_vocabulary", "normalized_term ~ {:q}", "", 0, 0, {q: q});
    for (var vi=0; vi<vocabHits.length; vi++) {
      var lid = String(vocabHits[vi].get("lesson")||"");
      if (lid) vocabLessonIds[lid]=1;
    }
  } catch (_) {}
}
```
   Then extend `topicFilter` derivation: for vocab hits, resolve `lessons` → `topics` IDs. Simpler: after building `lessons`/`topics` `visible[]`, add `"or topicId in vocabTopicIds"` via derived set. Keep it as JS filter on the bounded `visible[]` if DB join not feasible — do not introduce N+1 `findRecordById` per vocab hit.

2. Ranking: after building `visible[]` (Episode-per-Topic canonical, Variant resolved `preferred→recommended→first CEFR`), rank by `score = (titleFa exact?3: title substring?2:0) + (vocab hit?1:0)` before `sort + slice`. Keep deterministic pagination (`totalItems` after ranking).

Deliverable: 1-page `ADR-vocabulary-discovery.md` with field weights and query plan.

**Verify**: `bash scripts/smoke-library.sh node scripts/smoke-library.mjs` — add a scenario `q=vocabTerm` returns the Episode that contains that term (assert `totalItems >=1` and first `episodeId` equals planted vocab lesson's topic). Existing 27 scenarios still green (title `q` not regressed).

### Step 2: `saved` toggle design (no migration committed)

Design `saved` boolean on `lesson_progress` (default false), filter `GET /library?progress=saved` already validated pattern in `library_routes` (`progress` filter enum). Document: migration draft `ALTER` + index `user,saved`, Episode deck `Saved` button (reuses `PlayerProvider` session, no autoplay, 44px target), client `Fuse.js` ranking fallback for offline rank before FTS5.

**Verify**: doc exists; no migration committed in this spike (keep `pnpm verify:fast` green).

## Test plan (spike)

- **New vocab scenario:** `q` that matches only `normalized_term` (e.g. seed `lesson_vocabulary` term `abandon`) → `totalItems>=1` and correct `episodeId`.
- **Regression:** existing 27 library scenarios (title/fa `q`, `category/level/progress` filters, `sort`, `perPage`, publication gating).

## Done criteria (spike)

- [ ] `test -f docs/adr/ADR-vocabulary-discovery.md` citing `normalized_term` deterministic, 3 weighted fields, `saved` boolean draft, no FTS5 migration committed
- [ ] `bash scripts/smoke-library.sh node scripts/smoke-library.mjs` exits 0 with new vocab-id scenario as passing (or doc-only if server change omitted)
- [ ] `pnpm verify:fast` exits 0

## STOP conditions

Stop and report back if:

- `lesson_vocabulary` `normalized_term` query `~ {:q}` not supported in PB 0.39.9 (then report and keep client-side Fuse fallback only).
- Vocab join would need FTS5 extension not in PB's bundled SQLite — report deferral.
- Adding `saved` would break deterministic pagination (`progress=saved` + `q` + `category` interaction) — report.

## Maintenance notes

- Keep `q` ≤60 bound; `progress=saved` reuse existing `progress` enum pattern — do not invent `bookmarks` collection.
- Reviewers: honest copy only per `DESIGN.md` — no "smart/personalized" labels; ranking is `relevance` not `recommended`.

