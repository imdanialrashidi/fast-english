# Production Tooling Setup

This repository pins a small production-oriented Pi tool stack. Pi installs the project packages after the repository is trusted.

The reviewed Pi pin requires Node.js 22.19.0 or newer. The included CI pins Node 22.23.2; the container pins Node 24.19.0 on Debian Bookworm slim.

## Included packages

- `pi-sub-agent@0.1.5`
- `@juicesharp/rpiv-todo@2.12.0`
- `pi-lsp-adapter@0.1.3`
- `@dreki-gg/pi-doc-search@0.3.2`
- `@bytetrue/pi-web-search@0.5.1`

Pi `1.0.0` loads `.pi/mcp.json` natively. It pins `@playwright/mcp@0.0.83`, exposes only the listed browser tools on demand, and keeps unlisted tools hidden. No MCP adapter is installed.

The packages remain installed and their commands remain available, but their model-call schemas are deferred. `./p` starts with seven repository tools plus `harness_tools` and native `tool_search`:

| `harness_tools` capability | Activated schemas |
|---|---|
| `planning` | `todo` |
| `delegation` | `subagent` |
| `code_intelligence` | `lsp_diagnostics`, `lsp_definition`, `lsp_references`, `lsp_workspace_symbols`, `lsp_more` |
| `docs` | `doc_search_resolve_library_id`, `doc_search_get_library_docs` |
| `web` | `web_search`, `web_fetch` |

Ask the agent to activate all required groups together. Passing an empty capability list unloads the managed specialist schemas without removing unrelated custom tools. A restored session reactivates the groups in its latest continuity snapshot.

## First startup

```bash
./p
```

The repository launcher passes Pi's official `--approve` trust override, so it loads project resources and installs missing pinned packages without a trust prompt. It grants normal implementation access across the writable workspace, while arbitrary Git/GitHub mutations remain disabled independently. Routine delivery uses the reviewed `scripts/ai-pr.mjs` helper on the persistent `ai-changes` branch; install/authenticate `gh` as the owner and see `docs/GIT_POLICY.md`. Set `AI_PR_DELIVERY=off` for local-only runs. Use `PI_PROJECT_TRUST=ask ./p` only when you intentionally want the interactive trust decision.

For the reviewed Pi `1.0.0` pin, the launcher defaults to:

| Variable | Default | Effect / opt-out |
|---|---:|---|
| `PI_SMART_READ` | `1` | Bounds implicit reads of regular files at least 96 KiB; set `0` to disable. |
| `PI_SMART_READ_BYTES` | `98304` | Size threshold in bytes. |
| `PI_SMART_READ_LINES` | `400` | Injected limit for a qualifying read; explicit ranges are unchanged. |
| `PI_BLIND_RETRY_LIMIT` | `2` | Blocks the next identical tool call after this many errored executions; set `0` to disable. |
| `PI_CONTINUITY` | `1` | Persists/injects the bounded mechanical continuity capsule; set `0` to disable. |

These controls are model/provider neutral. Pi owns schema compatibility; the launcher does not force experimental features.

Reload after package changes:

```text
/reload
```

Validate the repository configuration:

```bash
bash scripts/pi-doctor.sh
```

## Localized fast path

For a tiny, obvious, low-risk change, invoke the project skill directly:

```text
/skill:quick-fix <small low-risk change>
```

Pi exposes project skills as `/skill:name` commands and also selects them from their descriptions. This path deliberately skips plans, todos, subagents, broad suites, and full gates unless scope, risk, or repository policy requires escalation.

## Todo panel

Confirm the extension:

```text
/todos
```

Use todos only for genuinely multi-step work.

## MCP and Playwright browser tools

Check the native connection inside Pi:

```text
/mcp
```

Servers connect in the background; the first prompt does not wait for deferred browser tools. Native `tool_search` waits for connection when discovery is needed. Search for the exact capability, then call the returned `mcp__playwright__*` schema. Loaded tools persist on the active branch across resume/reload. Codemode remains opt-in; native nested calls still pass through the guard.

A bounded smoke request:

```text
Use tool_search to load Playwright browser_snapshot. Do not navigate anywhere. Report whether the tool is available.
```

For browser QA, start the real local application. Use snapshots for actions and native screenshots for appearance; artifacts live in `.artifacts/playwright/`. Autonomous mode permits focused `browser_evaluate`; strict mode blocks evaluation and public navigation. Upload, file injection, browser installation, and arbitrary browser scripting are hidden.

The default server needs Chrome. If it is unavailable, install the browser as the operator following Playwright's reported command, or set a known installed browser's `--executable-path` in the server args. Installing a generic Chromium build does not by itself install the default Chrome channel. Keep server and browser versions compatible.

Remove any user-level `pi-mcp-adapter` in `pi config` before starting: it registers `/mcp` and replaces the built-in connection. Convert personal servers to `~/.pi/agent/mcp.json`; keep credentials there, outside Git. `/mcp` is the reliable in-session check; the separate `pi mcp list` CLI reads project servers only after persistent project trust.

### Visual evidence across model capabilities

The workflow uses the active model's native image input; it does not install or call a separate image model or add a Vision tool schema. The runtime reports configured image support on image results and refreshes guidance on visual user turns or with loaded browser tools. Model names are never used to infer support. For custom models, confirm accurate `input` metadata in the operator's Pi configuration; do not silently change it.

Playwright now uses `--image-responses allow`: a requested screenshot returns native image content through native MCP as well as a saved artifact. Native MCP bounds direct text results and retains the full text in a temporary file; Pi `1.0.0` normalizes tool-result images. Request only useful viewport/element screenshots and retain Pi's default image resizing. If a permitted response contains only a path, use `read` on that exact file; do not paste base64 or assume the model can see a filename.

`harnessVision.imageInput` and `imageBlocks` in tool details mean configured support and blocks returned, not provider acceptance or completed inspection. Pi's `images.blockImages` setting can strip images after the extension hook, and a provider can reject them. Respect that setting and user privacy opt-outs: disabled/filtered/unsupported/unreadable pixels leave appearance-only criteria `UNPROVEN`. TUI image display is separate from model input. After updating `.pi/mcp.json`, run `/reload` and reconnect Playwright with `/mcp` or start a fresh session.

Use browser-observable evidence first for behavior: accessibility snapshots, DOM structure, element geometry, computed state, console output, network evidence, and deterministic browser tests. For appearance, follow the `browser-qa` pixel-inspection loop: references/baseline, small desktop/mobile evidence set, focused detail crops, bounded critique/repair, then final re-capture. Exact contrast and dimensions need measurement, not visual estimates. Images may contain private data and incur provider image-token cost; capture synthetic/masked fixtures only and keep artifacts out of commits.

Do not claim pixel-level or aesthetic screenshot findings that the active model cannot actually inspect. Mark those acceptance criteria `UNPROVEN` and report the saved screenshot path instead.

## Language server setup

Check available servers:

```text
/lsp status
```

Install only the server required by the current project, for example:

```text
/lsp install vtsls
/lsp doctor vtsls
```

or:

```text
/lsp install pyright
/lsp doctor pyright
```

Missing language servers are not silently installed.

The `/lsp` management command is always available. The model activates `code_intelligence` only when definitions, references, workspace symbols, or diagnostics add evidence beyond exact text search.

## Documentation search

`pi-doc-search` queries Context7 directly and keeps a persistent local cache. It works without a key at lower rate limits. For higher limits, set the key in your shell or user environment, never in the repository:

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
```

Use `doc_search_resolve_library_id` and `doc_search_get_library_docs` only when local source, installed types, and repository patterns do not answer a version-sensitive framework question. The raw-cache helper remains installed but is intentionally omitted from the default tool surface because the normal documentation result already covers routine use.

The model activates the `docs` capability before these calls; no documentation schema is paid for on an ordinary localized edit.

## Web search

The included search extension defaults to Exa free MCP search and does not require a model-native search provider. The upgraded package keeps private config under the agent directory in `pi-pkg-cfg/pi-web-search/config.json` and copies legacy configuration forward without deleting it. `/web` is the preferred setup. Fetches revalidate redirects and block private/network metadata targets; use browser tools for localhost QA.

Inspect or change the provider with:

```text
/web
```

Show current configuration:

```text
/web --show
```

The agent has two web tools:

- `web_search` for current external information;
- `web_fetch` for a specific public URL.

The model activates the `web` capability before using them.

Do not commit search API keys or proxy credentials.

## Recommended smoke checks

After setup:

```text
/todos
/lsp status
/mcp
/web --show
```

Then test capabilities with bounded requests:

```text
Activate the docs capability, then use doc_search_resolve_library_id to resolve the React documentation library ID. Do not fetch broad documentation yet.
```

```text
Use tool_search to load the native Playwright browser_snapshot tool. Do not navigate.
```

## Updating packages

Package versions are pinned for reproducibility. Review release notes before changing a pin. After intentionally updating pins:

```text
/reload
```

then run:

```bash
bash scripts/pi-doctor.sh
```

## Fast English project skills

In addition to the template skills, this repository ships four conditional domain contracts under `.pi/skills/`:

- `accessibility-audit` — scoped WCAG and assistive-technology evidence when a
  user-facing accessibility criterion is in scope;
- `web-performance` — repeatable route measurements and lab/field separation
  when loading, latency, layout or asset budgets are in scope;
- `technical-seo` — public indexability, rendering, metadata, crawl and
  structured-data evidence when search discoverability is in scope;
- `rtl-i18n` — direction, bidi, formatting and long-string evidence when
  localized or RTL behavior is in scope.

These four are not a second browser, test, SEO, profiling, or translation
framework. The Playwright MCP browser and the repository's existing commands remain the
execution layer. Routing fixtures live in `evals/skill-cases.json`; validate
them with `node scripts/validate-skill-evals.mjs`.

Run `node scripts/validate-project-context.mjs --static` before product work. The
unbootstrapped template is intentionally `NOT READY`; after `/bootstrap`,
`--require-ready` is a real gate against empty contract prompts.

## Fast English verification levels

1. `bash scripts/pi-doctor.sh --ci --static` — structure, pins, metadata and eval-copy validation.
2. `node scripts/verify-package-integrity.mjs` — reviewed package pins.
3. `bash scripts/verify.sh` — deterministic workflow tests and the product gate: fast verification plus all 18 real-PocketBase smoke suites, deterministic three-surface builds, topology and PWA checks.
4. `node scripts/run-workflow-evals.mjs --dry-run` — evaluation suite structure without model calls.
5. `node scripts/run-workflow-evals.mjs --model <provider/model> --trials 3` — opt-in paid model trials.

The 18 suites are the canonical `pnpm smoke:*` family (auth, payment, payment-preview, placement, placement-levels, placement-race, placement-capacity, lessons, episode, progress, podcast-domain, content-import, content-admin, library, business-settings, staff, operator, plus one alias) — see `docs/QUALITY.md` for the mapped lane.

An unavailable prerequisite is `NOT EXECUTED` or `BLOCKED`, not `PASS`.
