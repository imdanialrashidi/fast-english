## Unreleased — landing price truth + owner-delegated launch decisions (owner 2026-10-29)

- **The landing no longer quotes 299,000 toman.** That single-package note predated the three-plan catalog the owner actually ships (399,000 / 957,600 / 3,351,600). The sales-off panel and the plan header now read the cheapest *active* plan from the database (`plansFromLabel`), so the public copy cannot drift from checkout; the unbacked «پیشنهاد محدود» chip is gone.
- **Owner-delegated launch decisions recorded** in `docs/LAUNCH_INPUTS_FA.md`: placement test approved as shipped, standard legal copy accepted (independent legal review still recommended, not claimed), refund window 7 days + 90-day receipt-file retention + account data until deletion, support hours/SLA deliberately unset, one active staff account with mandatory 2FA, no official invoice, contact `info@fastenglishpodcast.ir`. Facts still blocked and explicitly not fabricated: real card destination, payment provider, licensed content, off-server backup, real-device proof.
- `docs/DESIGN.md` carries the 2026-10-29 owner-approval note, so `PROPOSED` labels read as history rather than open questions.
- Evidence: Pint PASS; full Pest 365 passed / 4,472 assertions on PostgreSQL 17; `npm run typecheck` PASS; Vite build PASS; production image built and rolled out through Coolify (`sha256:9c6305e7…`); `scripts/coolify-smoke.sh` 27/27 PASS; live 390px Chromium render shows «پلن‌ها از ۳۹۹٬۰۰۰ تومان» with zero page errors. Deploy record: `docs/ops/LAUNCH_READINESS.md`.

## Unreleased — email verification codes, signed Android 1.0.0, test content removed (owner 2026-10-28)

- **Email verification by six-digit code.** Registration creates the account unverified, mails a hashed-at-rest code (10-minute TTL), and lands on a Persian verification page. Resend has a 60-second cooldown plus route throttles; five wrong guesses destroy the code. A global gate keeps the learner surface closed until verification while auth, logout, staff login, and the free public sample stay reachable. Existing accounts are grandfathered as verified by migration. Mail failure does not lose the registration; the page offers a resend.
- **Signed Android APK 1.0.0.** Built a Trusted Web Activity (`com.fastenglishpodcast.app`, minSdk 24, targetSdk 36) with Bubblewrap 1.25.0, signed with a new release keystore kept outside the repository. The APK ships at `public/downloads/fast-english-1.0.0.apk`; the download page renders its measured metadata and SHA-256, the landing links straight to the file, and production serves the signing fingerprint from `/.well-known/assetlinks.json`. The reproducible TWA project and signing/publishing notes live in `mobile/`.
- **Test content removed.** `DatabaseSeeder` now seeds only the owner catalogs; the `Test User`, sample lessons/tone audio, fixture payment plans, and fixture placement version are gone. `content:purge-fixtures` (dry-run by default) cleans older environments. Fixture seeders remain for Pest and are excluded from the production image.
- **Operator guide.** `docs/ops/CONTENT_UPLOAD_FA.md` documents staff login/2FA, category/topic/lesson fields, audio and cover limits, review/publish rules, verification in the app, and common errors.

## Unreleased — public placement test, iPhone install guide, launch content (owner 2026-10-26)

- **Real placement test.** `PlacementCatalogSeeder` publishes `placement-2026-10-v1`: 20 four-option fill-in-the-blank items, four per CEFR band (A1–C1), ordered easy to hard, one unambiguous completion each, correct option balanced five times per position. `PlacementLevel` documents the cut scores (0–3 A1, 4–7 A2, 8–11 B1, 12–15 B2, 16–20 C1) and stops at C1 deliberately — 20 receptive items cannot place C2, and the result page says so. The learner no longer sees the fixture version string; the result shows the Persian band label.
- **iPhone / PWA install guide.** `/install` is now a real public page (it used to redirect to `/download`): Safari «Add to Home Screen», Chrome Android install, desktop install, the Telegram/Instagram in-app-browser note, and what changes after install. Linked from Download, Account (`نصب روی گوشی`), and the public footer; added to the sitemap. Browser proof at 360 and 1440.
- **No test handle on the public surface.** `@test` support/cooperation and the three legal-copy mentions are replaced by `support@fastenglish.ir`; staff can change the address in Business settings without a deploy.
- **Deploy docs.** COOLIFY bring-up now includes the idempotent catalog seeds (`PlanCatalogSeeder`, `PlacementCatalogSeeder`); `LAUNCH_INPUTS_FA.md` records placement as supplied and keeps the remaining owner inputs explicit.
- Evidence: Pest 351 passed / 4,327 assertions; Pint 301 files; typecheck + build PASS; Chromium 89 passed; production image rebuilt; compose stack healthy with both catalogs seeded; `coolify-smoke` 27/27.

## Unreleased — Coolify bring-up package; production image builds and boots (owner 2026-10-26)

- **The production image now builds.** The Vite `assets` stage lacked `vendor/` (the Filament admin theme is a Vite input that `@import`s the framework CSS) and `app/` (its Tailwind `@source` root), so `npm run build` died with `Can't resolve '…/vendor/filament/…/theme.css'`. The stage now runs after `vendor` and copies both; the build produces a 1.05 GB image with the cache-proof lines.
- **Self-contained production stack.** `compose.prod.yml` runs the app + PostgreSQL 17 + two named app volumes on one private network; `${NAME:?}` variables block a deploy without `APP_KEY`, `DB_PASSWORD`, or `APP_URL`. Proven locally: image build → both services healthy → `release.sh` on an empty database → 25 smoke checks.
- **`docker/release.sh` no longer aborts on a fresh database.** `migrate:status` exits 1 before the `migrations` table exists, and `set -e` stopped the first release; the status call is now tolerant, while `migrate --force` still fails loudly.
- **Image permissions.** `RUN chmod -R a+rX` on the application directories, so a checkout made under `umask 077` (0600 files) cannot crash `www-data` with "Permission denied" while `/up` still reports healthy.
- **`ops:status` stops reporting a false zero.** With `LOG_CHANNEL=stderr` there is no file log; the line is now `recent_errors_24h=unavailable` and points at the container log. New regression test covers the no-file branch.
- **Deploy scripts.** `scripts/coolify-install.sh` (host preflight + official installer), `scripts/coolify-env.sh` (APP_KEY + DB password written outside the repo), `scripts/coolify-smoke.sh` (25 post-deploy probes). `docs/ops/COOLIFY.md`, README, and `STAGING_CHECKLIST.md` describe the Compose path and the first-release restart.
- **CI.** PostgreSQL service 16 → 17 in both jobs, plus a new `image` job that runs `docker build`, so a broken Dockerfile fails the PR instead of the deploy.
- **Browser lane.** `scripts/browser-lane.sh` runs the container as the host uid/gid; a 9-spec run left no root-owned files.
- Evidence: Pest 345 passed / 4,128 assertions; Pint 297 files; typecheck + Vite build PASS; full Chromium suite 86 passed; production image build PASS; Compose stack healthy; `coolify-smoke` 25/25.

## Unreleased — admin panel completion review (owner 2026-10-26)

- Closed the staff step-up gap: `/staff/placement/*`, `/staff/transfer/*`, and the staff branch of the private receipt route now require a passed TOTP session, and the panel auth middleware is persistent so idle/stale Livewire updates cannot keep approving or editing. Owners keep their receipt route without a staff challenge.
- Fixed the lesson editor: `audio_path` is re-added to the form fill/view even though the model hides it from array serialization. Staff can edit a title without re-uploading audio, and a typo fix no longer increments `audio_revision` (which would reset learner progress). Added a private staff-only draft audio preview (route + player) so audio can be checked before publishing.
- Payment queue now shows learner-supplied transfer details (bank reference, sender last 4, transfer time), the internal note, reviewer/canceller audit, the learner's current subscription window + recent events, and a retention/missing-file receipt state instead of a broken image.
- Added a read-only Users resource (ADM-02) with search/filter, current subscription and recent requests/events, audited suspend/activate actions, and the shared grant/revoke actions. Added `staff:2fa-reset` for lost authenticators; `staff:bootstrap` now refuses to create an account without an explicit password.
- Filament timestamps now display in Asia/Tehran, a custom admin theme compiles the custom pages' utility classes (full-width legal textareas and normal spacing), the dashboard shows pending/open payments, active subscriptions, published content and a queue shortcut, and list tables eager-load their relationships.
- Hardened owner settings: Persian/Arabic-Indic card digits are normalized, a card without holder/bank is rejected, settings+destination save in one transaction, topic/category slugs are `alphaDash`, lesson durations are integers, only active staff can be recorded as reviewers, and placement publish asks for confirmation.
- Learner retention page: after a receipt file is removed by the 90-day policy, the status page no longer renders a dead “view receipt” link.
- Evidence: full Pest suite 344 passed / 4,126 assertions; Pint PASS; `npm run build` PASS; Chromium admin sweep (dashboard, users, payment record, lesson editor, business settings, data transfer) with no console/page errors. No commit or deploy.

## Unreleased — app-like shell, brand palette, CSV import retired (owner 2026-10-25)

- Replaced the brand set with the owner-supplied palette icon and lockup. Generated `public/icons/*`, a square 16/32/48/64 `favicon.ico` plus dedicated 16/32 PNGs, and light/dark header lockups; the root HTML versions the favicon URLs by file mtime so browsers fetch the new icon instead of a cached one.
- Removed the repeated mobile brand bar. Each screen now owns a sticky `ScreenHeader` (title, optional back, one action); the brand stays on landing/login, the PWA/splash, and the desktop rail. Reader completion moved after the lesson, with bookmarking still near the top.
- Rebuilt Discover for density: sticky search, native filter sheet for level/category, removable active-filter chips, compact rows, and two dense columns from `md`. Pagination is one shared component with Persian numerals, windowed pages, results focus/announcement, and a server-side clamp for out-of-range or malformed `page` values on Discover, Saved, and Words.
- Retired the vocabulary CSV import (`/app/words/import`, controller, UI, browser assertion, and three feature tests). The notebook keeps review, edit/known/remove, and bulk «همه را می‌دانم»; existing words are untouched.
- Added real shell state: due-word count badge on the Words tab (shared `due_words`, count only; one constant query, P004 budgets updated), first-run level CTA on Account and Today, Chromium install card captured at app boot with remembered dismissal, success toasts (inline status remains the accessible source), and reduced-motion-safe press/enter feedback.
- PWA polish: manifest background/theme colors now `#F7F4EE`, apple web-app title/status bar, and the offline page uses the current palette.
- Docs record the owner instruction in `docs/PRODUCT.md` and `docs/DESIGN.md`; the exec plan §14 carries the evidence and residuals.

## Unreleased — DSH workflow replaces omp (owner 2026-10-25)

- Migrated the repository agent workflow to [DSH Workflow](https://github.com/imdanialrashidi/dsh-workflow) v0.1 (commit `93c9281`, verified against DSH `0.2.1-rc.2`). `AGENTS.md` is now the DSH entry point; the workflow skills plus the project's `no-ai-slop` skill live in `.dsh/skills/`; `docs/WORKFLOW.md` and `docs/REVIEW-POLICY.md` replace `docs/HARNESS.md`; `docs/adr/0003-dsh-workflow.md` records the decision and rollback.
- Retired the omp command files, rules, project config, and the superseded skills under `.omp/`. The previous workflow is recoverable in `.artifacts/migration-backup-2026-10-25-omp-to-dsh/` (ignored by git).
- Retained the reviewed scoped delivery helper as `scripts/pr-deliver.mjs` (renamed from `scripts/omp-pr.mjs`) with provider-neutral markers, lock/receipt names, and `PR_DELIVERY=off`; its behavior and opt-in `ai-changes` → `main` scope are unchanged.
- Updated the workflow self-check to validate `.dsh/skills` frontmatter, required workflow documents, and the renamed helper; added `NOT EXECUTED` to the acceptance statuses so skipped checks are not reported as passes.
- Product code, product behavior, and the Pest/Playwright suites are unchanged.

## Unreleased — owner catalog, card fallback, published trust copy (owner 2026-10-25)

- Added owner-priced plans (399,000 / 957,600 / 3,351,600 toman for 30/90/365 days), a repeatable `PlanCatalogSeeder`, and a staff Plans resource for edits without deploys.
- Added staff Business settings: support/cooperation channels, card destination and fallback switch, prepared gateway metadata, and editable terms/privacy/refund copy. A fresh destination is an obvious placeholder; checkout stays closed until a real 16-digit card, holder, and bank replace it.
- Published `/refund` and the supplied legal copy; support/cooperation now link the `@test` channel from settings. Added the page to the public footer and sitemap; domain recorded as `fastenglish.ir`.
- Added `docs/LAUNCH_INPUTS_FA.md` with received inputs and the remaining SMTP, gateway, content, placement, signing, hosting, and legal-review blockers.

## Unreleased — review pass: Persian errors, shared player console, CSV export removed (owner 2026-10-25)

- Removed the vocabulary CSV export (`/app/words/export`, button, controller response, and tests). The transactional CSV import and the two-step «همه را می‌دانم» action remain; previously exported files still import with the same columns.
- Added `lang/fa/{auth,passwords,validation,pagination}.php`, fixed the app locale to Persian, and translated JSON validation/auth/throttle/403/404 messages in one exception boundary. 419/429/405 now render Persian pages/ErrorPage states. The Filament staff panel keeps English through a staff-path locale boundary.
- Rebuilt the player as one shared `AudioConsole` for the persistent learner bar and the public sample: buffering spinner/`aria-busy`, buffered progress overlay, RTL-correct seek/time alignment, one `#player-play` at a time, save-failure surfacing in the collapsed bar, and expansion-aware content padding. The expanded console no longer covers content, and the PWA notice lifts above it.
- Fixed UX defects found in the review: internal DRAFT/BLOCKED labels removed from public trust pages; landing primary CTA follows the real APK release state; learner skeleton skips partial reloads, stays below the player, and releases after 20 s; library/words search submits through Inertia (audio survives); placement answers track their saved state and gate final submit; SRS grading cannot double-submit; reset/cancel/delete are two-step; sample CTAs follow the session; failure text uses alert/danger styling; Today's headline reflects real progress; guest error pages no longer show learner navigation.
- Server hardening: array query params no longer 500 (sample/library/words), receipt/audio upload limits in nginx/PHP now match the validated 30 MB/5 MB sizes, payment-create failures return field errors to Inertia instead of a JSON modal, and stale/late progress errors are Persian with a client-side duration clamp.

## Unreleased — mobile UI polish: reader-first density, tablet navigation, shell chrome (2026-10-23)

- Restored navigation on 640–1023px tablets (the tab bar used to disappear before the desktop rail appeared).
- Contained the persistent player to the app measure on desktop; kept it above the mobile tabs and refined the narrow-screen layout (LTR title truncation, denser controls).
- Reader: compact mobile cover, inline level selector, primary action first; Library: compact mobile search/filter rows and cleaner topic rows; Today: tighter sections and card meta; Words: review action first, collapsible CSV import, flat search; Account: 320px overflow fixed.
- Unified the brand lockup across app/public/auth, removed the duplicate mobile auth brand, and fixed footer brand alignment.
- Auth forms no longer autofocus (mobile keyboard no longer opens on load); field focus uses a single 2px ring.
- PWA update prompt now sits above the bottom tabs/player instead of covering them.

## Unreleased — vocabulary tools, renewal reminders, Media Session, skeletons (owner 2026-10-22)

- Vocabulary review now uses a cloze card: the target word is blanked inside its real example until reveal; words without a usable example keep the word-first fallback. SRS scheduling is unchanged.
- Vocabulary notebook adds owner-only CSV export/import and a two-step «همه را می‌دانم» bulk action. Export is formula-safe and private; import is one transaction, capped at 500 rows, and never touches another learner's words.
- Account adds a recent payment-history list (status, plan, snapshot amount, date) with no receipt/bank/internal fields. A daily `subscriptions:remind-expiring` command sends one renewal mail per current window; real SMTP delivery remains a launch prerequisite.
- The persistent learner player and public sample publish Media Session metadata plus play/pause/seek handlers when the browser supports them. Background audio is not promised.
- In-app navigation shows a delayed skeleton while the next page loads. Learner pages share a Persian type scale and bidi-safe headings; the duplicate shell brand mark is removed.
- `/sample` joins the sitemap while a published sample exists and ships its own canonical (without query), description, and Article JSON-LD.
- CI: the 14 pre-existing Pint style failures are fixed; `workflow-doctor` now runs the template-only gate; the browser job seeds `S2BrowserSeeder` with sales on and runs the reader/landing/PWA/Media-Session/skeleton specs. `scripts/browser-lane.sh` documents the local Chromium lane.

# Changelog

## Unreleased — plain reader, Persian app chrome, app-style account (owner 2026-10-21)

- Removed sentence-level audio/text sync: reader, public sample, and landing preview render plain English paragraphs beside the normal player; cue props, highlight/bold rows, click-to-seek, follow-scroll, cue columns/validators, and the staff cue editor are gone.
- Replaced the English editorial kickers (`Today`, `Discover`, `Words`, `Review`) and the `Example` field label with Persian chrome; updated the false sentence-sync marketing/SEO copy.
- Simplified the app shell: no in-app marketing footer, no duplicate signed-in header account CTA, and no duplicate account-page navigation chips.
- Account is now an app profile screen: identity card, level/goal summary, subscription status with one next action, settings/saved/placement rows, and logout; dates render in Persian (Asia/Tehran) from an ISO server prop.
- Today drops the duplicated due-words block and repeated level line, and the goal ring now reflects the real `progress_pct`.
- Reader/sample covers are bounded to 14rem; the sample player is in flow instead of a fixed overlay.

## Unreleased — landing/app separation, download-first landing, account fix

- Landing system is guest-only: `marketing.guest` redirects signed-in users from `/`, trust pages, `/download`, and `/install` to `/app/today`; `/sample` stays public as the in-app free path. The app shell no longer links to marketing pages, and the landing no longer links into `/app`.
- Landing conversion is download-first; plan interest goes through registration. Featured topics are informational rows, not app links.
- Server-rendered SEO for landing/download: title, description, canonical, Open Graph, Twitter, and JSON-LD (`WebSite`, `SoftwareApplication`, `FAQPage`) with FAQ copy from one server source.
- Account page: active subscription shows renewal instead of a first-purchase CTA; expired/revoked states distinguish cleanly; desktop sidebar pill no longer stretches; main padding follows actual player presence; email and daily-goal presentation tightened.

## Unreleased — DeepWiki MCP replaces Context7

- Replace `@upstash/context7-mcp@4.1.2` stdio MCP with the official DeepWiki remote MCP (`https://mcp.deepwiki.com/mcp`, hidden, deferred `read_wiki_structure`/`read_wiki_contents`/`ask_wiki_question` via `tool_search`). No package install, no API key for public repos; private repos stay out of scope.
- Drop the `CONTEXT7_API_KEY` env mapping and sandbox passthrough; doctor rejects a stale `context7` server, non-official URLs, stdio commands, and hardcoded keys on the DeepWiki entry.
- Retarget the docs secret/path guard and eval contract to DeepWiki inputs (`repoName`/`question`); legacy Context7 tool names stay guarded.
- Remove the Context7 integrity record (remote servers need none); refresh doctor/integrity/test/docs coverage.

- Replace third-party `@dreki-gg/pi-doc-search@0.3.2` with official `@upstash/context7-mcp@4.1.2` as a native deferred MCP server (`resolve-library-id`, `query-docs` via `tool_search`).
- Remove the `docs` capability from `harness_tools`; docs now follows the same native MCP pattern as Playwright. Legacy `doc_search_*` schemas are cleared on reset/resume for pre-migration sessions; unknown capabilities are ignored without crashing.
- Keep `CONTEXT7_API_KEY` out of Git via `${CONTEXT7_API_KEY}` env mapping; unauthenticated use stays at lower rate limits. Refresh registry integrities and doctor/integrity/test coverage.

## Unreleased — hardening and Pi 1.0.4

- Re-pin reviewed runtime `1.0.0` → `1.0.4` across launcher, Docker, integrity, setup, doctor, and theme schema; structural validation passes on installed `1.0.4` (per-version upstream changelog deltas not individually audited).
- Fix `verify-package-integrity.mjs --online`: unwrap the array `npm view --json` returns so registry comparisons read the real record.
- Block secrets and sensitive file references in Context7 `resolve-library-id`/`query-docs` calls; ordinary docs questions pass.
- Add `docs-mcp-workflow` eval case locking the local-first, `tool_search` + `mcp__context7__*` resolve-then-query contract with no live fetch.
- Document Context7 rate limits, retry behavior, no-cache tradeoff, direct `/org/project` IDs, and key handling.

## Unreleased — LSP host dependency repair

- Correct the reviewed `pi-lsp-adapter@0.1.3` installed manifest before launcher startup: Pi TUI and TypeBox become optional wildcard peers supplied by Pi, preserving LSP source and all unrelated settings.
- Reapply after successful launcher install/update commands; prepare missing LSP on the first trusted session and keep help/opt-out runs free of pre-installs.
- Add a read-only doctor check and focused preservation/idempotence/drift regressions. Keep other extension warnings visible.

## Unreleased — Pi 1.0 compatibility

- Upgrade the reviewed runtime to Pi 1.0.0, todo to 2.12.0, web search to 0.5.1, and Playwright MCP to 0.0.83; refresh registry integrities.
- Replace the third-party MCP adapter and root config with native `.pi/mcp.json` and selective `tool_search`; preserve guard enforcement for direct and nested calls.
- Use project `defaultTools` instead of a CLI allowlist that hides native MCP tools; remove three unintended startup helpers and forced experimental setup.
- Pass native CLI subcommands through correctly; update browser guidance, migration notes, theme schema and runtime checks.
- Retain model/provider choice, design contracts, economical tests, and native run metrics.

## Unreleased — saved design direction and run cost

- Capture natural-language design preferences in the existing DESIGN contract; preserve owner choices across design, build, bootstrap, and resume, with semantic code-token mappings and optional reference calibration.
- Show observed tool wall time, post-error model retries, and native foreground USD cost estimates alongside run time and effective tok/s. Unknown pricing stays unavailable; overlapping tools count once.
- Add no dependencies, tool schemas, or extra setup command.

## Unreleased — deliberate testing

- Make no-new-test decisions explicit in the always-loaded map and review; choose test layers by the actual failure mechanism.
- Replace prose-matching test-design checks with executable evaluation-grader controls for a copy edit and already-covered behavior; keep the existing defect-sensitive pricing regression.
- Reject evaluation records that omit declared post-check results. No new dependencies, tools, or mandatory test quotas.

## Unreleased — writing, terminal theme, and run visibility

- Add a Pi-native, MIT-attributed adaptation of Peter Yang’s `no-ai-slop` for substantive prose, with technical and multilingual exceptions.
- Consolidate the generic `risk-review` skill into `docs/QUALITY.md`; preserve review severity and evidence requirements.
- Add the dependency-free `slate` dark theme and a footer status for elapsed run time and effective output tok/s. Keep Pi’s native footer and provider/model choice.
- Measure through automatic recovery until `agent_settled`; show unavailable usage honestly, clean up timers, and keep print mode silent.
- Add `./p --add-provider` for Pi's four supported custom API protocols; store models and private credentials in the user's Pi config, preserving existing entries.

## Unreleased — evidence integrity and smaller context

- Reduce always-loaded instructions from 8,689 to 5,355 bytes without changing the fixed-branch delivery policy.
- Restore continuity from the active Pi branch, including `/tree`, and discard in-flight tracking on navigation.
- Replace ambiguous shell success with `unproven`; record simple command success as `process-ok`, never acceptance proof. Conservatively migrate legacy `passed` snapshots.
- Adapt OMP's small eval-isolation helper: prevent accidental parent Git discovery, fingerprint immutable inputs and detect symlink/mode changes.
- Reject comparisons with changed inputs or missing required metrics. No new package, provider, tool schema or agent role.
- Model-backed quality improvement remains unmeasured; see the 2026-09-05 amendment in `docs/RESEARCH.md`.

All notable workflow changes are documented here. This project follows the spirit of Keep a Changelog; versioning begins when the first release is tagged.

## Unreleased

### Added

- Native Vision-aware browser QA: live model-capability guidance, image-block delivery diagnostics, reference/baseline inspection, focused crops, and bounded visual re-checks with honest evidence gaps.
- Pi-native `/skill:quick-fix` routing for obvious low-risk edits, with targeted-only verification and explicit escalation boundaries.
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
- Owner-controlled Git/GitHub policy with guard, launcher, prompt, and deterministic-eval enforcement.
- Materialized-file filtering and a Git-independent pre-fix fixture for disposable workflow evaluations.
- A model-neutral harness runtime with capability-group tool loading, Smart Read, bounded identical-call retries, and resume/compaction continuity snapshots.
- Deterministic runtime tests for tool activation/reset, read focusing, retry recovery, state restoration, and secret redaction.

### Changed

- Playwright screenshot responses now include native images (`allow` instead of `omit`); Pi still owns image resizing/filtering, no extra Vision provider is installed, and sensitive captures remain prohibited.
- Adopted automatic scoped PR delivery on persistent `ai-changes`, with a tested helper, opt-out/eval isolation, owner-only main integration, and no per-task branches; this supersedes the earlier per-action Git approval default.

- Reworked `test-design`, `/test`, and `/build` around a Test Value Gate that rejects redundant/coverage-only cases, permits a deliberate `no new test` outcome, and requires independent oracles plus defect-sensitivity evidence.
- Made `./p` trust the checked-out project and grant full-workspace implementation access by default, while independently denying all Git/GitHub mutation until the owner authorizes an exact action; the optional Docker launcher selects strict repository scope.
- Strengthened the safety guard around secrets, destructive host actions, Git metadata/commands, publication/deployment/production mutation, and browser file exfiltration while preserving read-only Git inspection.
- Replaced archived `pi-context7` with maintained `pi-doc-search`.
- Removed delegated image-analysis extensions, model configuration, tools, and workflow guidance; browser QA now relies on browser-native evidence and saved screenshots as artifacts.
- Removed the template's forced model/provider/thinking selection and unmeasured compaction/retry/timeout overrides so the operator's active Pi model and official defaults apply.
- Pinned Pi installation guidance and GitHub Actions by immutable revision.
- Raised browser QA, accessibility, responsive, and Core Web Vitals requirements for visual work.
- Made the canonical full verification gate validate the template before product source is bootstrapped.
- Reduced duplicate always-loaded policy by 30.5%, removed the duplicate `docs/PI_WORKFLOW.md`, and tightened the combined context-size ratchet.
- Reduced the launcher from 22 to 19 active tool schemas and made subagents conditional with a universal self-review fallback.
- Reduced the initial launcher surface again from 19 to eight schemas while retaining twelve specialist schemas across six on-demand capability groups.
- Enabled capability-aware strict-prefer JSON-schema sampling for supported built-in tools on the exact Pi `0.84.2` pin, with explicit environment opt-outs.
- Reduced routine eval default trials from three to one while retaining explicit repeated trials and stronger efficiency thresholds for promotion comparisons.
- Updated reviewed pins to Pi `0.84.2`, `pi-mcp-adapter@2.26.1`, `@juicesharp/rpiv-todo@2.6.2`, and `@bytetrue/pi-web-search@0.2.1` with exact registry integrity records.
