# Plan 001: Real project verification gate + delete debug browser spec

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5774c6f..HEAD -- scripts/ tests/browser/ README.md CONTRIBUTING.md composer.json package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `5774c6f`, 2026-10-18
- **Issue**: omit

## Why this matters

Today `scripts/verify.sh` is presented as "the canonical gate" (`README.md:77-83`, `CONTRIBUTING.md:4,10`) but it never touches Pint, Pest, or Playwright: it runs only whatever npm scripts exist (`typecheck`, `build`), while the binding proof lanes (PostgreSQL Pest incl. the money race suite, Range, browser journeys per `docs/QUALITY.md`) have no one-command entry point. Contributors get a green "gate" that exercised none of the gates that matter. A committed throwaway debug spec (`tests/browser/debug-login.spec.ts`) adds an 8s unconditional sleep and fixture-shaped credentials to the serial browser lane. This plan makes green mean green and removes the noise.

## Current state

The relevant files, each with one line on its role:

- `scripts/verify.sh` — template-generic gate; lines 42-45 already support a `scripts/project-verify.sh` override (`if [[ -x scripts/project-verify.sh ]]; then exec scripts/project-verify.sh; fi`), lines 59-73 run only existing npm scripts (`format:check/typecheck/lint/test/build`), never PHP/Pest/Playwright.
- `tests/browser/debug-login.spec.ts` — throwaway debug script, not a suite test (full content):
  ```ts
  import { test } from '@playwright/test';
  test('debug admin login state', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('backup-staff@example.com');
    await page.getByRole('textbox', { name: /Password/ }).fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(8000);
    console.log('URL after click: ' + page.url());
    const body = await page.locator('body').innerText();
    console.log('BODY len=' + body.length);
    console.log(body.slice(0, 2000));
    await page.screenshot({ path: 'test-results/browser/debug-login.png' });
  });
  ```
- `tests/Feature/ExampleTest.php` — asserts only `GET / → 200`; duplicates `S8LandingTest` with weaker assertions.
- `tests/Unit/ExampleTest.php` — asserts `assertTrue(true)`.
- `.github/workflows/quality.yml:56-175` — the CI reference for the three real lanes: `vendor/bin/pint --test`, `php artisan test` (PostgreSQL), `npm run typecheck`, `npm run build`, `npx playwright test m0-inertia m1-journey design-theme --project=chromium`.
- `composer.json:40-48` — `test` script is `php artisan config:clear` + `php artisan test`; `package.json:8-12` — scripts are only `build/dev/typecheck` (no `lint`/`test`).
- `phpunit.xml` — `DB_CONNECTION=pgsql`, `SALES_ENABLED=true` for the money suites.

Repo conventions that apply: bash scripts use `set -Eeuo pipefail` with `ROOT_DIR` resolution (copy the header of `scripts/verify.sh:1-7`); CI is the executable spec of "green" — the new script must invoke the same commands, not invented equivalents.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Gate (new) | `bash scripts/project-verify.sh` | exit 0, all three lanes pass |
| PHP style | `vendor/bin/pint --test` | exit 0, no style violations |
| PHP tests | `php artisan test` | all pass (needs PostgreSQL per `.env`/CI env) |
| Frontend types | `npm run typecheck` | exit 0 |
| Frontend build | `npm run build` | exit 0 |
| Browser lane | `npx playwright test m0-inertia --project=chromium` | pass (needs server on `:8111` per `playwright.config.ts`; skip only with reason recorded) |

## Suggested executor toolkit

None required beyond the repo's own toolchain.

## Scope

**In scope** (the only files you should modify):

- `scripts/project-verify.sh` (create, executable)
- `tests/browser/debug-login.spec.ts` (delete)
- `tests/Feature/ExampleTest.php` (delete)
- `tests/Unit/ExampleTest.php` (delete)
- `README.md` (gate paragraph only, lines ~77-83)
- `CONTRIBUTING.md` (gate references only)

**Out of scope** (do NOT touch, even though they look related):

- `scripts/verify.sh` — template-owned; the override hook already exists, do not modify it.
- `.github/workflows/quality.yml` — CI is the reference, not the target.
- Any `app/`, `database/`, `routes/`, `resources/`, `config/` product code.
- `phpunit.xml`, `playwright.config.ts`, `composer.json`, `package.json` scripts — read as inputs, do not change.

## Git workflow

- Branch: `advisor/001-verify-gate` (repo has no branch convention evident; use this name).
- Commit per step or per logical unit; message style: short imperative (repo history is squashed `changes` commits — keep messages descriptive, e.g. `Add project verification gate and drop debug browser spec`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete the throwaway specs

What to do: `git rm tests/browser/debug-login.spec.ts tests/Feature/ExampleTest.php tests/Unit/ExampleTest.php`. If `tests/Unit` becomes empty, leave the directory with its `.gitignore` (check one exists); do not add a placeholder test.

**Verify**: `ls tests/browser/debug-login.spec.ts tests/Feature/ExampleTest.php tests/Unit/ExampleTest.php` → all three report "No such file". `grep -rn "debug-login" tests/ playwright.config.ts .github/` → no matches.

### Step 2: Create `scripts/project-verify.sh`

What to do: create an executable script that is the single entry point for the repo's binding lanes. It MUST:

1. Resolve `ROOT_DIR` and `cd` there (same 4-line header as `scripts/verify.sh:4-7`).
2. Fail fast with a clear message when PostgreSQL is unreachable (attempt `php artisan db:show --count 2>/dev/null` or `pg_isready`; print `BLOCKED: PostgreSQL unreachable — start it and set DB_* per .env.example` and exit 3).
3. Run in order, stopping on first failure: `vendor/bin/pint --test`; `php artisan test`; `npm run typecheck`; `npm run build`.
4. Run the browser lane ONLY when the app server answers on the configured base URL (default `http://127.0.0.1:8111`): `npx playwright test m0-inertia --project=chromium`. If the server is absent, print `SKIP: browser lane (no server on :8111)` and exit 0 for the lanes that ran — but the browser skip MUST be printed, never silent.
5. `chmod +x` the file. Because `scripts/verify.sh:42-45` execs it when executable, `bash scripts/verify.sh` must now reach your script.

Keep it dependency-free (bash + the repo's own commands). Do not add flags, watch modes, or caching.

**Verify**: `bash -n scripts/project-verify.sh` → exit 0 (syntax). `test -x scripts/project-verify.sh` → true.

### Step 3: Point README/CONTRIBUTING at the real gate

What to do: in `README.md` (the `## Verification and delivery` section, ~lines 77-83) and `CONTRIBUTING.md` (the two `verify.sh` references), replace the bare `bash scripts/verify.sh` instruction with: run `bash scripts/project-verify.sh` (full gate: Pint + Pest on PostgreSQL + typecheck + build + affected Playwright spec), noting PostgreSQL and the `:8111` server as prerequisites and the explicit SKIP line when the browser lane is skipped. Change nothing else in either file.

**Verify**: `grep -n "project-verify" README.md CONTRIBUTING.md` → at least one match in each. `git diff --stat` → only in-scope files.

## Test plan

- No new product tests (this plan IS the test infrastructure). Pattern to follow: the CI lane definitions in `.github/workflows/quality.yml:102-106,161-175`.
- Verification: `bash scripts/project-verify.sh` → exit 0 with all lanes passing where prerequisites exist; `bash scripts/verify.sh` → delegates to the new script.
- If PostgreSQL or the browser server is unavailable in your environment, record exactly which lane was BLOCKED/SKIPPED and why — that lane stays UNPROVEN, and this plan is not DONE until the full gate has been observed green somewhere (local or CI) and the evidence pasted in the handoff.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bash -n scripts/project-verify.sh` exits 0 and the file is executable
- [ ] `vendor/bin/pint --test` exits 0
- [ ] `php artisan test` exits 0 (PostgreSQL)
- [ ] `npm run typecheck` and `npm run build` exit 0
- [ ] `npx playwright test m0-inertia --project=chromium` passes, OR an explicit SKIP line was printed and recorded
- [ ] `ls tests/browser/debug-login.spec.ts tests/Feature/ExampleTest.php` fails (files gone); `grep -rn "debug-login" tests/ playwright.config.ts .github/` is empty
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" (verify.sh override hook, debug spec content, CI lane commands) don't match the live files.
- PostgreSQL cannot be reached AND the operator cannot provide it — record BLOCKED, finish the deletions + script + docs (verifiable without DB), and report the gate as UNPROVEN.
- `php artisan test` fails on the pristine tree before your change (pre-existing red) — report the failing suite, don't fix product code in this plan.
- Any step seems to require touching an out-of-scope file.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- When a new lane is added (e.g. an npm `lint` script), add it to `project-verify.sh` in CI order and to the table in this plan's "Commands" section.
- The browser SKIP path is a documented hole: a skipped lane is not proof. CI's `browser` job is the backstop; never mark a browser-risk change DONE on a skipped lane.
- If the template updates `scripts/verify.sh`'s hook contract, re-check the `exec` delegation still fires.
