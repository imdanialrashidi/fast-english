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
