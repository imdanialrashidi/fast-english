# ADR: Content Export Round-Trip (Plan 036 Spike)

**Status:** Spike — design + prototype, not merged to main
**Date:** 2026-08-21
**Context:** `docs/CONTENT_PIPELINE.md` is `content:new → validate → plan --json (zero-mutation, planStateHash) → import --yes` via Staff-auth `POST /api/fast-english/staff/content-import/{plan,execute}` with `checkRate 30/min` and `60MB/64-entry ZIP_LIMITS` (`shared/content-package/zip.ts:38`). `scripts/content/template.mjs:53` `summaryFa:'TODO_REPLACE'` intentionally fails `editorial.ts:PLACEHOLDER_VALUE`. `shared/content-package/zip.ts` parses ZIP via `DecompressionStream` for Admin import, but no export exists. `content-packages/typical-workday-sample/` is DEMO only; final library is `HUMAN INPUT REQUIRED` blocking launch.

**Design:**
- Inverse of import: `GET /api/fast-english/staff/content-export/{contentKey}?version=` returns ZIP (canonical `episode.json` + per-asset SHA256 + ZIP stream) reusing `checksums.ts`/`versioning.ts` helpers from import. Read-only, `requireStaffAdmin`, no `planStateHash` mutation.
- `contentVersion` rule: same `version` + different `fingerprint` (SHA256 of manifest+assets) → 409 `same version+different fingerprint` conflict; bumped `version` → success. Mirrors import's `same version+different fingerprint` 409.
- ZIP limits `64-entry/60MB` still apply to export; do not raise Caddy `60MB` without updating `ZIP_LIMITS`.
- Client prototype: `shared/content-package/zip-export.ts` draft (canonical manifest + `DecompressionStream` inverse) — returns `typical-workday-sample` as ZIP download, proves `export → import --yes` round-trip.

**Version-Bump Semantics:**
- Export is read-only; version bump required for content change; `planStateHash` staleness still guards import (`plan` must be re-run after export if content changed).

**Verification (spike):**
- `bash scripts/smoke-content-import.sh node scripts/smoke-content-import.mjs` still green (export read-only, import authority unchanged).
- Round-trip on spike branch `spike/content-export`: `export → import --yes` with same version+different fingerprint → 409, bumped version → success.

**Open Questions:**
- HelpRoute copy for export in `admin/src/features/content/routes/EpisodesRoute.tsx` or `docs/CONTENT_PIPELINE.md` draft.

**References:** `TODO_REPLACE` blocking, `planStateHash`, `64-entry/60MB`, API `GET /api/fast-english/staff/content-export/{contentKey}`
