# Plan 017: Enforce one CEFR level order across the five declarations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/podcast_domain.pb.js server/pb_hooks/content_import_core.pb.js server/pb_hooks/content_admin_core.pb.js shared/podcast/domain.ts shared/ui/tokens/cefr.ts tests/ .pi/verification.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (behavioral duplication)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The CEFR ladder `A1 A2 B1 B2 C1 C2` is declared **five times** and its
ORDER is behavioral: Variant resolution, the Edition Rail, level
normalization, import validation, and the level sort all depend on it.

1. `server/pb_hooks/podcast_domain.pb.js:45` — `CEFR_ORDER` (resolution,
   rail ordering, normalization).
2. `server/pb_hooks/content_import_core.pb.js:24` — `CEFR_LEVELS` (import
   validation).
3. `server/pb_hooks/content_admin_core.pb.js:25` — `CEFR_ORDER` (admin
   readiness/sort).
4. `shared/podcast/domain.ts:11` — `CEFR_ORDER` (canonical, `as const`,
   client mirror + its own test).
5. `shared/ui/tokens/cefr.ts:14` — `cefrLevels` (badge colors).

Adding or reordering a level means touching five files in lockstep, and
the server copies can silently diverge from the shared contract (the
existing `podcast-domain.test.ts` only mirrors #4, it does not enforce
equality across the five). The goja hooks cannot import TS, so the
cheapest mechanical enforcement is a **static consistency gate** that
parses all five declarations and asserts they are identical — the repo's
established pattern (static-guard tests).

**Non-goal**: no codegen, no cross-runtime module sharing (L-effort, out
of scope). The gate + "keep in sync" comments are the fix.

## Current state

```js
// server/pb_hooks/podcast_domain.pb.js:45
  var CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
// server/pb_hooks/content_import_core.pb.js:24
  var CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
// server/pb_hooks/content_admin_core.pb.js:25
  var CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
// shared/podcast/domain.ts:11
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
// shared/ui/tokens/cefr.ts:14
export const cefrLevels: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
```

The harness lane (`node --test` list in `.pi/verification.json`) is the
home for the new static test (pattern: `tests/hook-rate-limit.test.mjs`,
`tests/deploy-config.test.mjs`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Static gate | `node --test tests/cefr-consistency.test.mjs` | 1+ tests pass |
| Harness lane | `node --test tests/hook-rate-limit.test.mjs tests/deploy-config.test.mjs tests/cefr-consistency.test.mjs` | all pass |
| Fast gate | `pnpm verify:fast` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `tests/cefr-consistency.test.mjs` (new static test)
- `.pi/verification.json` (add the test to the harness lane list)
- The five declarations themselves ONLY to add a `// keep in sync with
  <canonical> (cefr-consistency gate)` comment — do not reformat or touch
  anything else.

**Out of scope** (do NOT touch):
- `shared/podcast/domain.ts`'s `CefrLevel` type, `normalizeLevel`, or any
  behavior.
- The CEFR color pairs in `shared/ui/tokens/cefr.ts` (only the order
  list is in scope).
- Any codegen or build step.

## Git workflow

- Branch: `advisor/017-cefr-consistency` (repo convention: `topic-slug`).
- Commit style: conventional (`test: enforce one CEFR order across the five declarations`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The static gate

Create `tests/cefr-consistency.test.mjs` (node:test style). For each of
the five files, extract the level-list literal with a regex that tolerates
the declaration differences (`CEFR_ORDER`/`CEFR_LEVELS`/`cefrLevels`,
single/double quotes, `as const`, type annotations):

- `server/pb_hooks/podcast_domain.pb.js` — `CEFR_ORDER = [...]`
- `server/pb_hooks/content_import_core.pb.js` — `CEFR_LEVELS = [...]`
- `server/pb_hooks/content_admin_core.pb.js` — `CEFR_ORDER = [...]`
- `shared/podcast/domain.ts` — `CEFR_ORDER = [...]`
- `shared/ui/tokens/cefr.ts` — `cefrLevels: readonly CefrLevel[] = [...]`

Assert: (1) each list exists and contains exactly the six levels;
(2) all five lists are EQUAL as ordered arrays to the canonical
`['A1','A2','B1','B2','C1','C2']`. One test per file + one equality test
is fine (5-6 tests total).

**Verify**: `node --test tests/cefr-consistency.test.mjs` → all pass.
Red-green: temporarily change one file's order (e.g. `['A2','A1',...]` in
`content_admin_core.pb.js`), confirm the gate FAILS, restore.

### Step 2: Wire into the harness lane

Add `tests/cefr-consistency.test.mjs` to the `node --test` command list in
`.pi/verification.json`.

**Verify**: the combined harness command passes.

### Step 3: Sync comments

Add a one-line comment at each of the five declarations:
`// Keep in sync with shared/podcast/domain.ts (tests/cefr-consistency.test.mjs).`
For the three server files this is a comment-only edit inside goja files —
safe, but prove the files still load.

**Verify**: `pnpm smoke:podcast-domain` (or the cheapest smoke that loads
the touched hook files: podcast-domain loads all three) exits 0;
`pnpm verify:fast` exits 0.

## Test plan

- New static gate `tests/cefr-consistency.test.mjs` (Steps 1-2):
  presence + order equality for all five declarations; red-green proven.
- Existing nets: `pnpm verify:fast`, `pnpm smoke:podcast-domain`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --test tests/cefr-consistency.test.mjs` passes (red-green proven)
- [ ] `.pi/verification.json` harness lane includes the new test
- [ ] All five declarations carry the keep-in-sync comment
- [ ] `pnpm verify:fast` exit 0; `pnpm smoke:podcast-domain` exit 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The five lists are ALREADY divergent when you run the gate for the first
  time (the gate's first run is the audit — report the divergence with the
  two orderings; do NOT silently pick one).
- A declaration shape differs from the excerpts (e.g. generated or
  multi-line) — adapt the regex and note it.

## Maintenance notes

- When the product ever adds a level (unlikely for CEFR), the gate forces
  all five files to change together — that is the point.
- If a future refactor single-sources the server lists via the plan-002
  style shared module (goja `require`), delete this gate's per-file
  parsing and keep only the cross-runtime check.
