# Fast English

Mobile-first Persian-RTL web product where learners pick a short English article at a CEFR level, read it, and listen to the matching audio. One Laravel app, one database, one origin. Learner/public surfaces run Inertia 3 + React 19 + TypeScript + Tailwind 4; staff runs one Filament 5 panel (`/admin`); PostgreSQL is required (no SQLite substitute).

> Workflow (2026-10-14): this repository migrated from the Pi workflow to the [omp production workflow template](https://github.com/imdanialrashidi/omp-production-workflow-template). Workflow files live in `.omp/` (commands, skills, config), `scripts/omp-pr.mjs`, and `scripts/verify.sh`. The Pi launcher (`./p`), `.pi/`, `Dockerfile.pi`, and Pi-only scripts/tests/evals were retired, recoverable in `.artifacts/migration-backup-2026-10-14/` (ignored by git). Product code, product docs, and the Pest/Playwright suites are unchanged.

## Workflow

A minimal, evidence-driven workflow for [oh-my-pi (omp)](https://omp.sh). omp already ships LSP, eval runtimes, parallel subagents, browser, search, planning, debugging, memory, and session continuity — this repo adds only what omp does not ship.

- `AGENTS.md` — short progressive-disclosure map; the only always-loaded workflow file.
- `.omp/RULES.md` — sticky hard requirements (delivery scope, secrets, no stubs, run-before-yield).
- `.omp/commands/` — `/spec`, `/build`, `/review`, `/ship`. No `plan`/`handoff`/`resume` commands: omp ships `/plan` mode and `/handoff` + `/resume` natively.
- `.omp/skills/` — `quick-fix`, `test-design`, `verify`, plus `no-ai-slop` for prose work. No browser/design/eval skills: omp ships `browser`, `lsp`, `debug`, `web_search`, `eval`, and `task` natively.
- `docs/` — `HARNESS.md`, `QUALITY.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `DESIGN.md`, `GIT_POLICY.md`, `PLAN.md`, plus scope baseline `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` and durable plans in `docs/exec-plans/active/`.
- `scripts/omp-pr.mjs` — scoped `ai-changes` → `main` PR helper: explicit files only, secret scan, compare-and-swap push guard.
- `scripts/verify.sh` — canonical gate: template self-checks, then the repo's cheapest applicable lane.
- `.github/workflows/quality.yml` — CI runs the gate plus frontend, PHP, and browser lanes.

Retired Pi pieces (not carried over — omp already covers them): provider/model routing and launcher flags, guard/smart-read harness scripts, Playwright MCP and web-search packages, eval harness (`evals/`, `docs/EVALUATION.md`, `docs/RESEARCH.md`), `/plan` + `/handoff` + `/resume` commands, frontend-design skill, `TOOLING_SETUP.md` and sandbox/docker files.

## Install

Install omp ([docs](https://omp.sh)):

```sh
curl -fsSL https://omp.sh/install | sh
```

Then open this repository in omp. No packages, no MCP servers, no launcher. Project config in `.omp/` loads automatically.

Authenticate and pick a model:

```text
/login
/model
```

## Daily usage

```text
/build Implement <accepted outcome> and verify it.
/spec <feature>        # implementation-ready contract, no code
/review                # independent evidence-backed verdict
/ship                  # full gate + scoped ai-changes PR (opt-in team delivery)
/skill:quick-fix       # obvious low-risk edit, one targeted proof
```

Native companions: `/plan` for planning, `/advisor` for High-risk second-model review (extra cost), `/handoff` + `/resume` across sessions. Small proven slice beats large unfinished work. An unproven criterion is not passed.

Product contracts: `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/PLAN.md`; baseline `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` v1.0; active plans in `docs/exec-plans/active/` (`fast-english-rebuild.md`, `frontend-inertia-migration.md`).

## Fast English app

Stack: PHP 8.4, Laravel 13, Inertia 3 + React 19 + TypeScript + Tailwind 4 + shadcn/ui (learner/public), Filament 5 staff panel, Fortify auth, Pest + Playwright, PostgreSQL. Pins: `composer.json` (`php: ^8.4`), `.nvmrc` + `package.json` engines (Node 22.23.2), `composer.lock` + `package-lock.json`.

Local setup (PostgreSQL required; no SQLite substitute):

```bash
composer install
cp .env.example .env
php artisan key:generate
# point DB_* at a local PostgreSQL, then:
php artisan migrate --seed   # DatabaseSeeder chains S1SampleSeeder + S3/S5/S7 fixtures (labelled dev content)
php artisan storage:link     # covers served from /storage/... via the public disk
npm install
npm run build
php artisan test   # Pest suite runs on PostgreSQL (phpunit.xml)
npm run typecheck
```

One-command alternative: `composer setup` (install + env + key + migrate + build).

Targeted browser proof (local policy: one relevant spec, one worker, zero retries, reuse servers):

```bash
npx playwright test m0-inertia --project=chromium
```

## Verification and delivery

```bash
bash scripts/project-verify.sh
```

Full gate: Pint + Pest on PostgreSQL + typecheck + build + affected Playwright spec (`m0-inertia --project=chromium`). Requires PostgreSQL reachable and an app server on `:8111` (default `BASE_URL=http://127.0.0.1:8111`); when no server answers, the browser lane prints `SKIP: browser lane (no server on :8111)` and the lanes that ran still count.

Solo default: leave the proven change in the working tree and report its state. Team PR only on explicit request: `node scripts/omp-pr.mjs prepare` before editing, then `deliver --message ... --title ... --body-file .artifacts/omp-pr.md --file <path>...` after verification. No per-task branches, no main writes, no auto-merge. Read-only/local-only work never publishes; `OMP_PR_DELIVERY=off` opts out. See `docs/GIT_POLICY.md`.

Contribution and private vulnerability-reporting expectations live in [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).

## License

No license has been selected yet. The repository owner must choose and add one before presenting the repository as reusable.
