# Plan 006: ARCHITECTURE + PRODUCT + README + .env.example freshness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5774c6f..HEAD -- docs/ README.md CONTRIBUTING.md .env.example composer.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `5774c6f`, 2026-10-18
- **Issue**: omit

## Why this matters

Two contract docs are worse than missing — actively wrong. `docs/ARCHITECTURE.md:5-33` describes a "target — nothing built yet" Blade + Livewire 4 + Alpine stack with `app/Livewire`, learner Blade layouts, and `resources/js/player.js` as code homes, while M5 deleted those very artifacts and auth now renders Inertia pages over Fortify. `docs/PRODUCT.md:11` says "No product code exists in this checkout; this is a fresh rebuild" while the tree holds the full domain, 100+ Pest tests, 25+ Playwright specs, and the M0–M5 migrated surface. Contributors and agents designing from these docs will build against a dead stack. Separately, README setup fails on a clean clone (`key:generate` before `composer install`), `.env.example` ships empty assignments that zero out Laravel defaults (`SESSION_LIFETIME=` → lifetime `0` via `(int) env(...)`), and `composer setup` + the SQLite `post-create-project-cmd` contradict the PostgreSQL-only rule.

## Current state

The relevant files, each with one line on its role:

- `docs/ARCHITECTURE.md:5-33` — stale stack prescription. Exact lines to rewrite: `:5` "Current system (target — nothing built yet)"; `:8` "Learner UI: Blade + Tailwind 4.1+ … Livewire 4.x … Alpine … Flux"; `:10` "official Livewire starter kit with Fortify"; `:22` "Forms + validation | Livewire / Laravel"; `:23` "`currentTime` … `resources/js/player.js`"; `:31` code homes incl. `app/Livewire`, learner Blade layouts, `resources/js/player.js`; `:33` "`@persist` for `wire:navigate`".
- `docs/adr/0002-inertia-react-learner-frontend.md` — THE binding decision (read fully before rewriting; the new ARCHITECTURE text must point at it, never restate-then-drift from it). Filament-keeps-internal-Livewire stays.
- `docs/PRODUCT.md:11` — "No product code exists in this checkout; this is a fresh rebuild." Replace with a current-state paragraph + pointer to `docs/PLAN.md` stage map and `docs/exec-plans/active/frontend-inertia-migration.md` (M6 pending).
- `README.md:59-69` — setup runs `php artisan key:generate` BEFORE `composer install` (artisan can't run without `vendor/autoload.php`); never mentions `composer setup` (`composer.json:41-48`), the sample seeder (`database/seeders/S1SampleSeeder.php` — verify exact class/file name before citing), or `storage:link`.
- `.env.example:1-43` — empty assignments that defeat Laravel defaults: `APP_NAME=`, `APP_KEY=`, `APP_DEBUG=`, `APP_URL=` (:3-6), `BCRYPT_ROUNDS=` (:14), `SESSION_LIFETIME=` (:31, read by `config/session.php:35` as `(int) env('SESSION_LIFETIME', 120)` → `0`, sessions expire immediately), `SESSION_ENCRYPT=` (:32) and siblings. Header comment says "Document required variable names only. Never add real values." — keep that rule: fix by REMOVING keys that have safe defaults, not by inventing values.
- `composer.json:41-48` `setup` script (install + key + migrate + npm build — the correct order, undiscoverable) and `:68-71` `post-create-project-cmd` touching `database/database.sqlite` + `migrate --graceful` (contradicts the binding "PostgreSQL required, no SQLite substitute" rule in `.env.example:21-22` + `README.md:57`).
- `.env`, `.env.testing`, `.env.browser` are git-ignored (verified `git check-ignore`); `.env.example`, `.env.testing.example`, `.env.browser.example` are the only committed env files. No secret values exist in the docs scope — and per policy, NEVER write any into these files.

Repo conventions that apply: docs authority order is latest owner instruction → accepted slice → scope + fresh decisions → repo docs (AGENTS.md); scope section numbers (`§`) stay stable — keep every `§` citation, only change the transport nouns around them.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Docs check | `grep -rin "Livewire 4\|wire:navigate\|@persist\|player.js\|nothing built yet\|fresh rebuild\|No product code" docs/ README.md` | after the fix: only intentional historical mentions (ADR, migration plan, CHANGELOG) |
| Setup proof | Follow the rewritten README steps on a clean checkout (or `git worktree`) up to `migrate --seed` | sample journey reachable |
| Gate (docs-only) | `bash scripts/verify.sh` | exit 0 (template self-checks; plan-001 gate unaffected) |

## Scope

**In scope** (the only files you should modify):

- `docs/ARCHITECTURE.md` ("Current system" bullets + state-ownership Livewire/Alpine rows + code-homes + `@persist` rule only)
- `docs/PRODUCT.md` (the line-11 paragraph only)
- `README.md` (setup block ~lines 57-69 + gate paragraph ~77-83 if plan 001 hasn't landed it)
- `CONTRIBUTING.md` (only if it repeats the setup order — check)
- `.env.example` (remove defaulted keys only)
- `composer.json` (delete `post-create-project-cmd` block only)

**Out of scope** (do NOT touch, even though they look related):

- `docs/adr/0002-*.md`, `docs/exec-plans/active/*`, `docs/DESIGN.md`, `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md`, `docs/QUALITY.md`, `docs/PLAN.md` — read as inputs, do not edit.
- `config/*`, `bootstrap/*`, `docker/*`, `routes/*`, `app/*` — no product/infra change; the `.env.example` fix is removals only.
- `composer.lock`, `package-lock.json` — untouched (no dependency change).
- Any Filament/learner code referenced by the docs — docs follow code, never vice versa.

## Git workflow

- Branch: `advisor/006-docs-freshness`
- One commit (docs + example-env + manifest-hook removal are one reviewable unit); message style: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite the ARCHITECTURE "Current system" section

What to do: read `docs/adr/0002-inertia-react-learner-frontend.md` fully first. Then rewrite `docs/ARCHITECTURE.md:5-13` bullets to: Laravel 13 + PostgreSQL unchanged; learner/public transport = Inertia 3 + React 19 + TS + Tailwind 4 + shadcn/ui in a single permanent light theme (cite the ADR, don't re-list hexes); auth = Fortify with Inertia pages (no Livewire starter kit); Filament 5 panel keeps its internal Livewire isolated. Update the state-ownership rows: `Forms + validation → Inertia / Laravel (server)`; player row → persistent React audio in the learner layout (no `@persist`/`wire:navigate`, no `player.js`); code homes → `app/Livewire` REMOVED, learner Blade layouts REMOVED, `resources/js/player.js` → `resources/js/lib/player.tsx` + `resources/js/components/AudioPlayer.tsx`. Rule :33 → "one `HTMLAudioElement` in the shared learner layout (persistent across in-layout navigation); never two concurrent audio elements". Keep every `§` citation and the money/time/Range/PWA text below line 35 byte-identical.

**Verify**: the grep in Commands returns no `Livewire 4|wire:navigate|@persist|player.js|nothing built yet` hits in `docs/ARCHITECTURE.md`. A reader of only the rewritten section would never propose a Livewire learner component.

### Step 2: Fix the PRODUCT stale claim

What to do: replace `docs/PRODUCT.md:11` ("No product code exists…") with 2-3 sentences: the rebuild/migration status quo (domain models + Actions + policies + private media controllers exist; learner surface is Inertia post-M0–M5 with M6 regression pending; staff is Filament), plus pointers to `docs/PLAN.md` (stage map) and `docs/exec-plans/active/frontend-inertia-migration.md`. Touch nothing else in the file.

**Verify**: grep `No product code|fresh rebuild` in `docs/PRODUCT.md` → empty.

### Step 3: Fix README setup + .env.example + composer hook

What to do:

1. README setup becomes: `composer install` (first — creates `vendor/autoload.php`) → `cp .env.example .env` → `php artisan key:generate` → point DB_* at PostgreSQL → `php artisan migrate --seed` (verify the exact seeder invocation: if `DatabaseSeeder` doesn't chain the sample seeder, name `S1SampleSeeder` explicitly — confirm class name via `ls database/seeders/`) → `php artisan storage:link` (verify the app needs the public disk link — `cover_url` uses `/storage/...`; if no link is needed, omit and say why) → `npm install && npm run build`. Mention `composer setup` as the one-command alternative (it already encodes install→key→migrate→build). Coordinate with plan 001's gate paragraph — don't revert it.
2. `.env.example`: DELETE every key whose Laravel default is safe (`SESSION_LIFETIME`, `SESSION_ENCRYPT`, `SESSION_PATH`, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE`, `SESSION_HTTP_ONLY`, `SESSION_SAME_SITE`, `BCRYPT_ROUNDS`, `APP_DEBUG` only if default false is safe — check `config/app.php` + `config/session.php` defaults first; when in doubt KEEP the key with a working dev value rather than deleting). NEVER add real secrets/keys/URLs — deletions or local-safe dev values only.
3. `composer.json`: delete the `post-create-project-cmd` block (SQLite touch + `--graceful` migrate). Keep `setup`, `post-autoload-dump`, `post-update-cmd`, `pre-package-uninstall` untouched. Confirm no doc/CI invokes the removed hook (`grep -rn "post-create-project\|database.sqlite" docs/ README.md CONTRIBUTING.md .github/ composer.json` → only CHANGELOG/history hits allowed).

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('composer.json','utf8'))"` → parses. Fresh-checkout proof: the rewritten steps reach a seeded sample (or record BLOCKED with the exact step + output if the environment lacks PostgreSQL).

## Test plan

- Docs-only: no product tests. Verification is the grep emptiness checks above + JSON parse + the setup walkthrough.
- Existing suites unaffected (no code change); run `bash scripts/verify.sh` template self-checks to confirm nothing broke.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rin "wire:navigate\|@persist\|nothing built yet" docs/ARCHITECTURE.md` → empty; `grep -n "No product code" docs/PRODUCT.md` → empty
- [ ] README setup order has `composer install` before `key:generate`; names the sample seed + `storage:link` (or documents why unneeded); references `composer setup`
- [ ] `grep -n "SESSION_LIFETIME=$\|BCRYPT_ROUNDS=$" .env.example` → empty (trap keys gone)
- [ ] `node -e "JSON.parse(...composer.json...)"` parses; `post-create-project-cmd` absent; no live references to it
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- ADR-0002 contradicts this plan's "Current state" (e.g. it kept some learner Livewire) — the ADR wins; report the discrepancy.
- The seeder chain differs (no `S1SampleSeeder`, different sample path) — use the real one, don't invent.
- Any `.env.example` key's safe default is uncertain — KEEP it with a dev value rather than deleting; never commit a real secret.
- README and plan-001's gate paragraph conflict (both edited the same lines) — rebase onto 001's wording, keep the gate intact.
- Anything in this plan turns out to need a code/config change to be true — docs follow code; report, don't change behavior.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- ARCHITECTURE.md's transport section now tracks ADR-0002: any future transport change needs an ADR first, then this section follows — never the reverse.
- `.env.example` rule stands: required names only, no real values; keys with safe Laravel defaults stay OUT so `cp .env.example .env` boots cleanly.
- If `composer setup` rots (script drift), README's explicit steps are the fallback — keep both accurate.
