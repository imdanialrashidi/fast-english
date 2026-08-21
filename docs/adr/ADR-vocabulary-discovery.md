# ADR: Vocabulary-Aware Discovery + Saved Episode (Plan 037 Spike)

**Status:** Spike — design + minimal prototype behind flag, not merged to main
**Date:** 2026-08-21
**Context:** `library_routes.pb.js:q` is `title ~ {:q}` ≤60 chars substring only, no ranking, no `lesson_vocabulary.normalized_term` search. Learners discover by terms they studied, not title substring. `lesson_vocabulary` already has deterministic `normalized_term` (trim/lowercase, unique `lesson+normalized_term`) indexed `lesson(sort_order)` but never used for discovery. Adding vocabulary-aware ranking + `saved` boolean on `lesson_progress` gives habit anchor without algorithmic personalization ("no smart claims" per `DESIGN.md`).

**Design:**
- Extend `library_routes.pb.js` `q` to also match `lesson_vocabulary.normalized_term` via pre-fetched ID set (keep bulk-query pattern, no N+1):
  ```js
  var vocabLessonIds = {};
  if (q) {
    var vocabHits = $app.findRecordsByFilter("lesson_vocabulary", "normalized_term ~ {:q}", "", 0, 0, {q: q});
    for (var vi=0; vi<vocabHits.length; vi++) vocabLessonIds[String(vocabHits[vi].get("lesson")||"")]=1;
  }
  ```
  Then after building `lessons`/`topics` `visible[]`, filter `"or topicId in vocabTopicIds"` via derived set, or JS filter on bounded `visible[]` if DB join not feasible.
- Ranking: after `visible[]` (Episode-per-Topic canonical, Variant resolved `preferred→recommended→first CEFR`), `score = (titleFa exact?3: title substring?2:0) + (vocab hit?1:0)` before `sort + slice`. Deterministic pagination (`totalItems` after ranking).
- 3 weighted fields only: title/fa > vocab term > transcript preview. No stemming.
- `saved` boolean on `lesson_progress` (default false), filter `GET /library?progress=saved` reuses existing `progress` enum pattern. Migration draft `ALTER` + index `user,saved`, Episode deck `Saved` button (44px, icon+text, RTL correct), client `Fuse.js` ranking fallback for offline before FTS5.
- Keep `private,no-store` media, `token=[REDACTED]`, `planStateHash`, `perPage` deterministic.

**Verification (spike):**
- New vocab scenario: `q` matching only `normalized_term` (e.g., `abandon`) → `totalItems>=1` and correct `episodeId` (spike branch).
- Regression: existing 27 library scenarios (title/fa `q`, `category/level/progress` filters, `sort`, `perPage`, publication gating) still green.

**Open Questions:**
- PB 0.39.9 `normalized_term ~ {:q}` support? If not, keep client-side Fuse fallback only.
- FTS5 extension not in PB's bundled SQLite — defer.

**References:** `normalized_term` deterministic, 3 weighted fields, `saved` boolean draft, no FTS5 migration committed, `q≤60`.
