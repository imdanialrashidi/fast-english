# Plan 024: Remove `level` from lessons `viewRule` defense-in-depth (align with cross-level entitlement)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_migrations/1700000014_create_lessons.js server/pb_hooks/lesson_routes.pb.js server/pb_hooks/podcast_domain.pb.js server/pb_hooks/progress_routes.pb.js scripts/smoke-lessons.mjs scripts/smoke-podcast-domain.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness/security drift (enforcement vs documented ADR)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

Since Library Slice 6 the product ADR is: "level is not an authorization boundary — an entitled Student may access any Published Variant A1–C2". The custom proxy routes (`lesson_routes` list/detail/audio, `progress_routes`, `library_routes`) correctly removed the `level === selected_level` check and are covered by smokes. But the DB defense-in-depth `viewRule` on `lessons` still enforces `level = @request.auth.selected_level`. Direct PB file-token downloads (`/api/files/lessons/<id>/<file>?token=...`) would incorrectly 403 legitimate cross-level access while the proxy allows it — two truth sources disagree. A future maintainer reading the migration as source of truth may re-introduce the restriction as a regression. Align the migration rule with the ADR.

## Current state

- **Decision (docs):** `docs/ARCHITECTURE.md:Level browsing is read-only ... level is not an authorization boundary`; `docs/PODCAST_DOMAIN.md:Level browsing never changes ... level is not an authz boundary`.
- **Enforcement — proxy (correct, post-S6):** `server/pb_hooks/lesson_routes.pb.js` handlers for `GET /api/fast-english/lessons` (list), `GET /api/fast-english/lessons/{lessonId}` (detail), `GET /api/fast-english/lessons/{lessonId}/audio` (audio proxy) — comments at list `:210` and detail `:620` and audio `:1080` say `Cross-level access: the level equality check is removed — an entitled Student may open any Published Variant, A1–C2`. No `level === selected_level` check remains in any proxy; there is only `status='published' && topic.status='published' && category published` plus entitlement (active sub, placement_completed, not suspended).
- **Enforcement — viewRule (drift, stale):** `server/pb_migrations/1700000014_create_lessons.js` `viewRule`:
```js
viewRule:
  "@request.context = 'protectedFile' && " +
  "@request.auth.id != null && " +
  "@request.auth.role = 'student' && " +
  "@request.auth.account_status = 'active' && " +
  "@request.auth.placement_completed = true && " +
  "level = @request.auth.selected_level && " +
  "status = 'published' && " +
  "topic.status = 'published'",
```
  The `level = @request.auth.selected_level` clause is the drift. The `topic.status` check is intentionally narrow (no category check — category archival is enforced only at the proxy layer where `requirePublishedCategory` is available; PB rule cannot join categories).

- **Migrations not reversible:** `docs/ARCHITECTURE.md` notes migrations are NOT automatically reversible; rollback is `current` symlink flip, `pb_data` outside releases. A new additive migration must update the collection.

- **Conventions:** Migrations are ES5 `migrate((app)=>{...}, (app)=>{ try{app.delete(collection)}catch{}})`; `server/VERSION` pins PB 0.39.9; hooks excluded from Biome; smoke suites are authoritative (`scripts/smoke-lessons.mjs` premium allow/deny incl. cross-level, `smoke-podcast-domain.mjs` cross-level entitlement).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Lessons smokes | `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` | 60+ scenarios pass, incl. cross-level allow |
| Podcast domain | `bash scripts/smoke-podcast-domain.sh node scripts/smoke-podcast-domain.mjs` | all pass |
| Progress | `bash scripts/smoke-progress.sh node scripts/smoke-progress.mjs` | pass |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `server/pb_migrations/1700000031_fix_lessons_viewrule_cross_level.js` (new)
- `scripts/smoke-lessons.mjs` (add/extend one cross-level file-token scenario if feasible; if not feasible via smoke harness, add a structural test or document infeasibility — see Steps)

**Out of scope** (do NOT touch, even though they look related):
- `server/pb_hooks/lesson_routes.pb.js` / `progress_routes.pb.js` / `library_routes.pb.js` — proxy logic is already correct; no hook changes.
- `server/pb_hooks/podcast_domain.pb.js` — category archival semantics unchanged.
- `server/pb_migrations/1700000014_create_lessons.js` — committed history; never edit.
- Any `viewRule` broadening beyond removing `level` (e.g. removing `account_status` or `placement_completed`) — out of scope.
- Caddy / deploy config.

## Git workflow

- Branch: `advisor/024-lesson-viewrule-drift`
- Commit: `fix(migration): remove level gating from lessons viewRule`
- Do NOT push unless instructed.

## Steps

### Step 1: Add migration `1700000031_fix_lessons_viewrule_cross_level.js`

Create `server/pb_migrations/1700000031_fix_lessons_viewrule_cross_level.js` following the repo's migration style (see `1700000030_destination_auth_read.js` for most recent pattern):

```js
// 1700000031 — Fix lessons viewRule drift: level is not an authz boundary (S6).
// Removes `level = @request.auth.selected_level` from the protected-file viewRule
// so direct PB file-token downloads align with the proxy entitlement (which
// permits any Published Variant A1–C2 for an entitled Student).
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("lessons");
    collection.viewRule =
      "@request.context = 'protectedFile' && " +
      "@request.auth.id != null && " +
      "@request.auth.role = 'student' && " +
      "@request.auth.account_status = 'active' && " +
      "@request.auth.placement_completed = true && " +
      "status = 'published' && " +
      "topic.status = 'published'";
    app.save(collection);
  },
  (app) => {
    // Reverse: restore the stale level-gated rule (best-effort).
    try {
      const collection = app.findCollectionByNameOrId("lessons");
      collection.viewRule =
        "@request.context = 'protectedFile' && " +
        "@request.auth.id != null && " +
        "@request.auth.role = 'student' && " +
        "@request.auth.account_status = 'active' && " +
        "@request.auth.placement_completed = true && " +
        "level = @request.auth.selected_level && " +
        "status = 'published' && " +
        "topic.status = 'published'";
      app.save(collection);
    } catch (_) {}
  }
);
```

- Preserve every other conjunct exactly (including the leading `@request.context = 'protectedFile'` which scopes the rule to file downloads).
- Do NOT add a category join — PB 0.39 rule cannot join categories; that enforcement stays proxy-only (documented in migration comment).
- Ensure the migration number `1700000031` is the next monotonic after `1700000030` (check `ls server/pb_migrations` — if a newer migration appeared since `1062bb0`, use the next free number and note it).

**Verify**: `pnpm verify:fast` still exits 0 (typecheck does not cover migrations, Biome ignores `server/pb_migrations`). Run the new migration against a disposable PB: `bash scripts/smoke-lessons.sh node -e "/* quick sanity: start PB, list collections, print viewRule */"` is optional; the authoritative proof is the smoke suites which spin a fresh PB with all migrations.

### Step 2: Prove cross-level entitlement still holds (and viewRule now aligns)

Two proofs, one required:

1. **Smoke extension (preferred):** Extend `scripts/smoke-lessons.mjs` with a cross-level file-token scenario if the harness can test it: create student with `selected_level=A1`, install published Variant `A1` and `C2` for same Episode (same `topic`, two `lessons` rows). Authenticate, fetch a PB file token for the `C2` audio via `pb.files.getToken()` or the proxy's token mechanism, then `GET /api/files/lessons/<c2Id>/<file>?token=...` (the native PB file endpoint). Assert 200 (not 403) for the `C2` variant despite `selected_level=A1`. If the harness cannot mint a native file token in smoke (PB 0.39 `fileToken` may be short-lived), instead add a proxy-level cross-level scenario: `GET /api/fast-english/lessons/<c2Id>` and `GET /api/fast-english/lessons/<c2Id>/audio` (via Bearer or file token) while `selected_level=A1` — assert 200. The latter already exists partially — just extend to explicitly assert `level !== selected_level` and still 200, with a comment citing this drift fix.

2. **If native file-token test is infeasible** (PB file-token semantics or smoke-auth helper limitations), add a structural assertion in `tests/migration-viewrule.test.mjs` or similar (read `1700000031` and assert `viewRule` string does not contain `level = @request.auth.selected_level` and does contain `status = 'published'`). Prefer the smoke path if possible — it is behavioral.

Choose one; do not add both unless cheap. The key invariant: after migration, `grep -rn "level = @request.auth.selected_level" server/pb_migrations/` returns no hit for `lessons` viewRule.

**Verify**: chosen suite passes. For smoke path: `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` → new scenario green; existing cross-level deny/allow scenarios still green. For structural path: `npx vitest run tests/migration-viewrule.test.mjs` → pass.

### Step 3: Run the broader premium-contract regression

Run `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs`, `bash scripts/smoke-podcast-domain.sh node scripts/smoke-podcast-domain.mjs`, and `bash scripts/smoke-progress.sh node scripts/smoke-progress.mjs` — all must stay green (archival hiding, published checks, entitlement revalidation unchanged).

**Verify**: all three exit 0; `pnpm typecheck` exits 0.

## Test plan

- **Migration test**: structural — new migration's `viewRule` lacks `level = ...` and still contains `status = 'published' && topic.status = 'published'` + auth conjuncts.
- **Behavioral test**: cross-level Variant access (proxy or native file token) while `selected_level != variant.level` → 200 (entitled). Existing denied cases (draft/archived/unpublished topic → 404, suspended/expired → 403) remain 403/404.
- **Regression**: full lessons/podcast-domain/progress smoke suites green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "viewRule" server/pb_migrations/1700000031_fix_lessons_viewrule_cross_level.js` hits and the `level = @request.auth.selected_level` string does NOT appear in that file's `viewRule` assignment
- [ ] `grep -rn "level = @request.auth.selected_level" server/pb_migrations/` returns no hit (or only in the revert branch of 0031 if you kept it — main assignment must not contain it)
- [ ] `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` exits 0 and output mentions the new cross-level assertion (or the structural test passes if that path chosen)
- [ ] `bash scripts/smoke-podcast-domain.sh node scripts/smoke-podcast-domain.mjs` exits 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- The excerpts in "Current state" do not match live code (proxy still checks `level` or viewRule already changed).
- `1700000031` already exists (numbering drift since `1062bb0`) — use next free number and report.
- PB 0.39.9 rule cannot be updated via `app.save(collection)` for `viewRule` (migration API drift) — report actual error.
- The smoke harness cannot set up a cross-level Episode with two Variants without touching `topics` publish state — report instead of weakening publish invariants.
- You need to edit any hook file or Caddy/deploy config.

## Maintenance notes

- The viewRule is defense-in-depth for protected file downloads only; the proxy is the primary entitlement enforcement (it alone can join categories and check live subscription via `subscriptions`). Do not add subscription checks to the viewRule — PB rules cannot join that collection.
- If a new collection gains a `level` field and needs similar cross-level semantics, add its viewRule without `level` from the start and cite `PODCAST_DOMAIN.md` "level is not an authz boundary" in the migration comment.
- Reviewers: verify the `up` and `down` branches are exact string inverses (except the level clause) so `git log --follow` shows intentional drift fix.

