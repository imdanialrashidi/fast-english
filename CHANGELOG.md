# Changelog

All notable workflow changes are documented here. This project follows the spirit of Keep a Changelog; versioning begins when the first release is tagged.

## Unreleased

## 1.0.0 — 2026-08-16 (release candidate)

### Added

- Release identity v1: root package version 1.0.0 embedded by App, Landing and
  Admin builds (data-app-version / data-landing-version / data-admin-version +
  build-time markers) and cross-checked with the Android versionName by
  `pnpm android:check:version`; `scripts/check-production-bundle.sh` now runs in
  the canonical gate and fails when any surface reports the pre-release 0.0.0
  identity.
- Record-level backup/restore proof (`pnpm smoke:restore-proof`): disposable
  PocketBase runs the full chain — real Student signup → payment request with
  receipt upload → staff approval → subscription → content/progress/placement/
  settings fixtures → Backups-API backup → wipe → restore into a clean data dir →
  same record IDs and fields, same user authenticates, receipt file bytes
  identical (sha256). Wired into `scripts/project-verify.sh` (13h) and the CI
  backend lane (18 parallel suites).
- Landing redesign (final pre-production pass): the public site now runs on the
  accepted midnight/ice semantic system (`shared/ui/tokens` family), uses the
  official logo assets (wordmark PNG + byte-identical inline mark, official
  favicon), and tells a conversion narrative — Hero (episode-jacket composition:
  artwork, CEFR edition rail, deck) → why one episode in six levels → activation
  journey → student experience (continue listening / vocabulary / transcript /
  progress) → CEFR ladder → real sample episode → honest payment (runtime-derived)
  → install/access → FAQ → final CTA. Persian copy rewritten to be concrete,
  credible and truthful (no fabricated claims; payment and Android states stay
  honest pre-launch).

### Changed

- `.env.example` documents the environment contract with explicit
  REQUIRED/OPTIONAL/DISABLED classification; `deploy/env.production.example`
  fixed (FEP_SMOKE_STUDENT_* drift removed).
- Landing favicon replaced with the official app favicon (PNG); OG image
  regenerated on the midnight/ice palette; landing token layer derived from the
  accepted Light scheme (canvas #f5f9fa, primary #2a6f8c, midnight #0b1220 panels,
  CEFR pairs).

### Added

- Behavioral coverage for autonomous/strict guard modes and launcher trust overrides.
- Product design contract, distinctive frontend-design skill, visual hard gates, and scored craft rubric.
- Idea-to-production prompts: discover, design, spec, ADR, build UI, design review, release plan, and incident response.
- Evidence-gated product roadmap template.
- Safety-guard behavior tests and a contained Docker launcher.
- Security reporting and dependency-review policy.
- `test-design` and `/test` workflows with red/pre-fix defect-sensitivity guidance.
- Deterministic affected-file verification routing with a conservative full-gate fallback.
- Workflow eval schema v2 with executable assertions, trace metrics, baseline comparison, and a real code/test repair fixture.
- Primary-source research and audit record in `docs/RESEARCH.md`.

### Changed

- Made `./p` trust the checked-out project and run autonomously by default: routine workflow edits, task-branch Git delivery, public browser navigation, and focused page evaluation no longer require intermediate approval; the optional Docker launcher selects strict mode.
- Narrowed the safety guard to high-blast-radius actions such as secret access, destructive host/Git commands, force/deleting pushes, publication/deployment/production mutation, and browser file exfiltration.
- Replaced archived `pi-context7` with maintained `pi-doc-search`.
- Corrected the vision integration: replaced `@bytetrue/pi-vision` with capability-aware `@getpipher/vision`, added explicit primary/vision model switching, and renamed the delegated tool to `describe_image`.
- Removed the template's forced model/provider selection.
- Pinned Pi installation guidance and GitHub Actions by immutable revision.
- Raised browser QA, accessibility, responsive, and Core Web Vitals requirements for visual work.
- Made the canonical full verification gate validate the template before product source is bootstrapped.
- Reduced duplicate always-loaded policy and added a combined context-size ratchet.

### Changed

- Parallelized the canonical CI gate (`.github/workflows/quality.yml`): independent `static` / `backend` / `e2e` (5 Playwright shards) lanes plus a `verify` merge gate, cutting measured green-run wall-clock from ~17 min to ~6–7 min. The 16 real-PocketBase smoke suites now run concurrently on dedicated ports (`scripts/verify-smokes-parallel.sh`; opt-in via `FEP_VERIFY_PARALLEL_SMOKES=1` in `scripts/project-verify.sh`), and the full Playwright suite is sharded across runners with per-shard PocketBase isolation and per-shard failure artifacts. Local `pnpm verify:fast` / `verify:feature` / `verify:full` serial model is unchanged.
- Made the last un-gated evidence-screenshot spec (`e2e/content-studio-screenshots.spec.ts`) opt-in via `FEP_SCREENSHOTS=1`, matching its three sibling evidence specs.
- `scripts/ci-install.sh` skips the Chromium download when `CI_SKIP_PLAYWRIGHT=1` (non-browser CI lanes).

### Changed

- Production performance + observability for the Student App (lab evidence in `.artifacts/perf/`):
  - Route-level `React.lazy` code splitting in `app/src/app/App.tsx` — only Entry/Home/NotFound/shell/player stay in the entry chunk; payment, placement, library, lessons/episode and login/signup load their own chunks. Initial-load JS dropped from ~984 KiB raw / ~288 KiB gzip to ~300 KiB raw / ~210 KiB gzip (lab-measured transfer), with TBT roughly halved on Home; `home/api.ts` no longer pulls the placement zod schemas into the entry chunk.
  - Minimal observability foundation (`app/src/lib/telemetry/`, see `docs/OBSERVABILITY.md`): bounded in-memory ring buffer by default (no vendor SDK), optional `sendBeacon` sink gated by `VITE_TELEMETRY_ENDPOINT` (off by default), uncaught-error/unhandled-rejection capture, API-failure reporting (5xx/429/transport only, redacted paths), player media-failure classification, route-surface context, build-version diagnostics (`data-app-version`/`data-build-time` on `#root` + `__APP_VERSION__`/`__BUILD_TIME__` defines), and a deliberate low-noise funnel event set (signup, payment request, placement submit, level select, episode start, 50% milestone, completion, install intent). All payloads redacted (no tokens/phones/emails/receipts/media URLs/bodies); failure-isolated with 30+ unit tests.
  - Reproducible lab harness `scripts/measure-app-perf.{sh,mjs,-seed.mjs}`: disposable PocketBase + real content import + entitled fixture student + throttled Chromium journeys (entry/login/home/library/episode/account) capturing LCP/CLS/TBT/transfer + SPA nav latency.
