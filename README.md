# Fast English

Mobile-first Persian-RTL web product where learners pick a short English article at a CEFR level, read it, and listen to the matching audio. One Laravel app, one database, one origin. Learner/public surfaces run Inertia 3 + React 19 + TypeScript + Tailwind 4; staff runs one Filament 5 panel (`/admin`); PostgreSQL is required (no SQLite substitute).

> Workflow (2026-10-25): this repository migrated from the omp production workflow to [DSH Workflow](https://github.com/imdanialrashidi/dsh-workflow) v0.1 (commit `93c9281`, verified against DSH `0.2.1-rc.2`). The workflow is project-local: `AGENTS.md` is the entry point, `.dsh/skills/` holds the runtime skills, and `docs/WORKFLOW.md` + `docs/REVIEW-POLICY.md` replace `docs/HARNESS.md`. The prior files are recoverable in `.artifacts/migration-backup-2026-10-25-omp-to-dsh/` (ignored by git); see `docs/adr/0003-dsh-workflow.md`. Product code, product behavior, and the Pest/Playwright suites are unchanged.

## Workflow

A small, evidence-driven workflow for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It uses DSH's instruction loader, project skill discovery, native tools, permissions, and optional subagents — no plugin, daemon, MCP server, or generated command files.

- `AGENTS.md` — short progressive-disclosure entry point; the only always-loaded workflow file.
- `.dsh/skills/` — `quick-fix`, `spec`, `build`, `verify`, `review`, `test-design`, plus `no-ai-slop` for prose work. DSH discovers these at project rank; users invoke them as `/quick-fix`, `/spec`, and so on.
- `docs/WORKFLOW.md` — decision model, evidence standard, review/repair limits, context rules, DSH integration.
- `docs/REVIEW-POLICY.md` — finding admissibility, severity, independence, convergence.
- `docs/QUALITY.md` — acceptance criteria, project invariants, proof map, definition of done.
- `docs/GIT_POLICY.md` — opt-in scoped delivery; solo work never publishes.
- `scripts/pr-deliver.mjs` — scoped `ai-changes` → `main` PR helper retained from the prior workflow: explicit files only, secret scan, compare-and-swap push guard. Used only on an explicit delivery request.
- `scripts/verify.sh` — canonical gate: DSH workflow self-checks, then the repo's cheapest applicable lane.
- `.github/workflows/quality.yml` — CI runs the gate plus frontend, PHP, and browser lanes.

## Install

DSH `0.2.1-rc.2` (or a later verified version) is required:

```sh
npx @deepseek-ai/dsh web
```

Open this repository in DSH. No global workflow install, package, MCP server, or launcher is needed: `AGENTS.md` and `.dsh/skills/` load from this checkout. If you also want the upstream workflow in other projects, run its [installer](https://github.com/imdanialrashidi/dsh-workflow) separately; this repository does not modify `$DSH_HOME`.

## Daily usage

```text
/quick-fix Fix <obvious low-risk issue>.
/spec <feature>          # contract only when requirements are unresolved
/build <accepted outcome>
/verify                  # execute and classify the real checks
/review                  # defect review, no edits during review
/test-design <behavior>  # design coverage and failure modes
```

`subagent` gives a fresh-context reviewer for non-trivial or high-risk changes; `subagent_fork` inherits this conversation and is not independent. Small proven slice beats large unfinished work. An unproven criterion is not passed; a skipped check is not a pass.

Product contracts: `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/PLAN.md`; baseline `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` v1.0; active plans in `docs/exec-plans/active/` (`fast-english-rebuild.md`, `frontend-inertia-migration.md`).

## Canonical origin

`https://fastenglishpodcast.ir` is the live production origin (the APK,
`assetlinks`, emails, and `APP_URL` all use it). `fastenglish.ir` and
`www.fastenglish.ir` currently have **no DNS delegation/nameservers**, so
they cannot resolve; the owner must set those at the `.ir` registrar before
that domain can serve or redirect. Use the `.ir` spelling
`fastenglishpodcast.ir`, not the `.com`/shorter variants.

## Deploy (Coolify)

The repository ships a production `Dockerfile` (nginx + php-fpm + scheduler +
queue in one non-root container), a self-contained Compose stack
([`compose.prod.yml`](compose.prod.yml): app + PostgreSQL 17 + volumes),
[`.env.production.example`](.env.production.example) for the env checklist,
and `docker/release.sh` for the one explicit migration step.

```bash
scripts/coolify-install.sh --check     # host preflight (ports, RAM, disk, OS)
sudo scripts/coolify-install.sh --install
scripts/coolify-env.sh --domain https://<domain> --out /tmp/fe.env
# Coolify: Project → Docker Compose (Git) → /compose.prod.yml,
#          domain → app:8080, environment → paste /tmp/fe.env, deploy
# then in the Coolify app terminal:
sh /var/www/html/docker/release.sh
# and from this machine:
scripts/coolify-smoke.sh https://<domain>
```

Step-by-step bring-up, mounts, health check, and post-deploy probes:
[`docs/ops/COOLIFY.md`](docs/ops/COOLIFY.md).

The signed Android build and its measured release metadata ship with the
app: `public/downloads/fast-english-1.0.0.apk` is served by the same image,
`/download` reads `config/release.php`, and production serves the TWA
certificate at `/.well-known/assetlinks.json`. Rebuilding/publishing a new
version is documented in [`mobile/README.md`](mobile/README.md).

## Fast English app

Stack: PHP 8.4, Laravel 13, Inertia 3 + React 19 + TypeScript + Tailwind 4 + shadcn/ui (learner/public), Filament 5 staff panel, Fortify auth, Pest + Playwright, PostgreSQL. Pins: `composer.json` (`php: ^8.4`), `.nvmrc` + `package.json` engines (Node 22.23.2), `composer.lock` + `package-lock.json`.

Local setup (PostgreSQL required; no SQLite substitute):

```bash
composer install
cp .env.example .env
php artisan key:generate
# point DB_* at a local PostgreSQL, then:
php artisan migrate --seed   # owner catalogs only: plans + the real placement test
php artisan storage:link     # covers served from /storage/... via the public disk
npm install
npm run build
php artisan test   # Pest suite runs on PostgreSQL (phpunit.xml)
npm run typecheck
```

`DatabaseSeeder` never creates demo lessons, tone-file audio, or test accounts
(owner 2026-10-28). For local sample content, opt in explicitly:
`php artisan db:seed --class=S1SampleSeeder`. With `MAIL_MAILER=log`, the
six-digit registration code appears in `storage/logs/laravel.log`; production
needs real SMTP or new accounts cannot finish verification.

One-command alternative: `composer setup` (install + env + key + migrate + build).

Staff content work: [docs/ops/CONTENT_UPLOAD_FA.md](docs/ops/CONTENT_UPLOAD_FA.md).
Android build, signing, and publish notes: [mobile/README.md](mobile/README.md).

Targeted browser proof (local policy: one relevant spec, one worker, zero retries, reuse servers):

```bash
npx playwright test m0-inertia --project=chromium
```

## Verification and delivery

```bash
bash scripts/project-verify.sh
```

Full gate: Pint + Pest on PostgreSQL + typecheck + build + affected Playwright spec (`m0-inertia --project=chromium`). The local Chromium lane is documented by `scripts/browser-lane.sh` (`start`, `seed`, `status`, `stop`, `reset`, `test`). Requires PostgreSQL reachable and an app server on `:8111` (default `BASE_URL=http://127.0.0.1:8111`); when no server answers, the browser lane prints `SKIP: browser lane (no server on :8111)` and the lanes that ran still count.

Solo default: leave the proven change in the working tree and report its state. Team PR only on explicit request: `node scripts/pr-deliver.mjs prepare` before editing, then `deliver --message ... --title ... --body-file .artifacts/pr-deliver.md --file <path>...` after verification. No per-task branches, no main writes, no auto-merge. Read-only/local-only work never publishes; `PR_DELIVERY=off` opts out. See `docs/GIT_POLICY.md`.

Contribution and private vulnerability-reporting expectations live in [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).

## License

No license has been selected yet. The repository owner must choose and add one before presenting the repository as reusable.
