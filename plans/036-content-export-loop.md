# Plan 036: Direction spike — content export loop (unblocks launch library)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- docs/CONTENT_PIPELINE.md shared/content-package/zip.ts server/pb_hooks/content_import_core.pb.js server/pb_hooks/content_admin_routes.pb.js admin/src/features/content/ content-packages/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M (spike — design + prototype, not full build)
- **Risk**: MED (version-bump semantics, audit trail)
- **Depends on**: 033 (duration authoritative — not blocking, just re-import path), 025 (library pagination shape)
- **Category**: direction (content loop asymmetry — highest launch leverage)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`docs/CONTENT_PIPELINE.md` is `content:new → validate → plan --json (zero-mutation dry-run, planStateHash) → import --yes` (Staff-auth multipart `POST /api/fast-english/staff/content-import/{plan,execute}`, `checkRate` 30/min, `60MB/64-entry ZIP_LIMITS` in `zip.ts:38`). `scripts/content/template.mjs:53` `summaryFa:'TODO_REPLACE'` intentionally fails `editorial.ts:PLACEHOLDER_VALUE`. Browser `shared/content-package/zip.ts` already parses ZIP via `DecompressionStream` for Admin import, but no export exists — classic export-without-import asymmetry. `content-packages/typical-workday-sample/` is DEMO only; final Episode library is `HUMAN INPUT REQUIRED` blocking launch (`docs/PRODUCTION_CHECKLIST.md`). An export loop (download package / duplicate as new version) lets Persian editors iterate without CLI and reuses `checksums.ts`/`versioning.ts`.

## Current state

- **Pipeline:** `content:new` scaffolds `episode.json` + `artwork_square` + `hero_wide` + `audio` + `transcript` + `vocabulary` per `schemas/episode-package.schema.json` (strict, `additionalProperties:false`). `validate` mirrors server re-validation; `plan --json` is zero-mutation with `planStateHash` staleness guard; `execute` is atomic `runInTransaction` (probe 14/14 proved rollback). `server/pb_hooks/content_import_core.pb.js` mirrors `shared/content-package` checksums/versioning; `content_admin_routes.pb.js` Staff-guarded.
- **Zip limits:** `shared/content-package/zip.ts:38` `ZIP_LIMITS = {maxEntries:64, maxTotalBytes:60*1024*1024}`. Browser parser uses `DecompressionStream`.
- **Asymmetry:** `admin/src/features/content/routes/EpisodesRoute.tsx` has publish/archive but no download. `docs/CONTENT_CREATOR_AI_TEMPLATE.md` exists because hand-crafting `episode.json` is heavy friction.
- **Architecture:** `docs/PRODUCT.md:26` no CMS pre-launch; `docs/OBSERVABILITY.md` beacon OFF; `docs/PODCAST_DOMAIN.md` grandfather-until-republish.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Content import smoke | `bash scripts/smoke-content-import.sh node scripts/smoke-content-import.mjs` | 28 scenarios green (import still authority) |
| Content admin smoke | `bash scripts/smoke-content-admin.sh node scripts/smoke-content-admin.mjs` | green |

## Scope

**In scope** (spike — read, prototype, document; do NOT ship full feature as merge to main):

- Spike branch `spike/content-export` with `docs/adr/ADR-export-roundtrip.md` + draft `shared/content-package/zip-export.ts` (inverse of `parser.mjs` → canonical manifest + per-asset SHA256 + ZIP stream).
- Design `GET /api/fast-english/staff/content-export/{contentKey}?version=` (read-only, `requireStaffAdmin`, no `planStateHash` change for export).

**Out of scope** (do NOT touch as build):

- No `server/pb_migrations/*` for export.
- No full Admin "Download ZIP" button merged to `main` (prototype behind flag only).
- No change to `60MB/64-entry` ceiling.

## Git workflow

- Branch: `spike/content-export`
- Commits: doc/spike only; do NOT merge to `main`. Record open questions in `docs/adr/ADR-export-roundtrip.md`.

## Steps

### Step 1: Design export serializer (inverse of import)

1. Read `docs/CONTENT_PIPELINE.md:14-22` + `shared/content-package/zip.ts` inverse: trace `parser.mjs` → `checksums.ts`/`versioning.ts` → `content_import_core.pb.js:applyImport`.
2. Design `GET /api/fast-english/staff/content-export/{contentKey}?version=` returning ZIP (canonical manifest + per-asset SHA256 + ZIP stream) reusing `DecompressionStream` inverse. Read-only, staff-guarded, no `planStateHash` mutation. Document `contentVersion` increment rule (same version + different fingerprint → 409 conflict `same version+different fingerprint`) in HelpRoute or `docs/CONTENT_PIPELINE.md`.
3. Prototype minimal: server returns `content-packages/typical-workday-sample/` as ZIP download (no new infra) via `shared/content-package/zip-export.ts` draft. Prove round-trip: `export → import --yes` with same `version` but different `fingerprint` → 409, bumped version → success.

Deliverable: `docs/adr/ADR-export-roundtrip.md` (1 page) + helper `shared/content-package/zip-export.ts` draft if trivial.

**Verify (spike):** `bash scripts/smoke-content-import.sh node scripts/smoke-content-import.mjs` still green (export read-only, import authority unchanged). `pnpm verify:fast` green.

### Step 2: Document version-bump semantics + help

Add note in `admin/src/features/content/routes/EpisodesRoute.tsx` HelpRoute or `docs/CONTENT_PIPELINE.md` draft: export read-only, version bump required for content change, `planStateHash` staleness still guards import.

**Verify**: doc exists; no `pnpm verify:fast` regression.

## Test plan (spike)

- **Round-trip:** export → import with same version+different fingerprint → 409, bumped version → success (via spike branch).
- **Regression:** existing parity harnesses `smoke:content-import`/`smoke:content-admin` green.

## Done criteria (spike — not a ship)

- [ ] `test -f docs/adr/ADR-export-roundtrip.md` and it cites `TODO_REPLACE` blocking, `planStateHash`, `64-entry/60MB`, and API `GET /api/fast-english/staff/content-export/{contentKey}` draft
- [ ] `pnpm verify:fast` exits 0 (spike did not change `main` code beyond doc/prototype behind flag)
- [ ] `git status` on spike branch shows only `docs/adr/*` + `shared/content-package/zip-export.ts` draft if any

## STOP conditions

Stop and report back if:

- Export version-bump semantics conflict with import's `planStateHash` staleness contract (would need breaking change).
- Any prototype would require changing `productCopy.ts` ("smart" claims) — strictly honest copy per `DESIGN.md`.
- You need to change `60MB/64-entry` ceiling — out of scope.

## Maintenance notes

- `64-entry/60MB` ZIP limits (`shared/content-package/zip.ts:38`) still apply to export; do not raise package ceiling in Caddyfile without updating `ZIP_LIMITS`.
- Reuse `checksums.ts`/`versioning.ts` helpers from import for export checksum — keep single source.
- Reviewers: this spike unblocks launch library (the only true external dependency `HUMAN INPUT REQUIRED`) — promote before 037/038.

