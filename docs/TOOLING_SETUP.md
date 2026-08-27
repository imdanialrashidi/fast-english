# Production Tooling Setup

This repository pins a small production-oriented Pi tool stack. Pi installs the project packages after the repository is trusted.

The reviewed Pi pin requires Node.js 22.19.0 or newer. The included CI pins Node 22.23.2; the container pins Node 24.19.0 on Debian Bookworm slim.

## Included packages

- `pi-sub-agent@0.1.5`
- `pi-mcp-adapter@2.26.1`
- `@juicesharp/rpiv-todo@2.6.2`
- `pi-lsp-adapter@0.1.3`
- `@dreki-gg/pi-doc-search@0.3.2`
- `@bytetrue/pi-web-search@0.2.1`

The project MCP configuration pins `@playwright/mcp@0.0.79` and exposes a restricted browser tool set through the single `mcp` proxy.

The packages remain installed and their commands remain available, but their model-call schemas are deferred. `./p` starts with seven repository tools plus `harness_tools`:

| `harness_tools` capability | Activated schemas |
|---|---|
| `planning` | `todo` |
| `delegation` | `subagent` |
| `browser` | `mcp` |
| `code_intelligence` | `lsp_diagnostics`, `lsp_definition`, `lsp_references`, `lsp_workspace_symbols`, `lsp_more` |
| `docs` | `doc_search_resolve_library_id`, `doc_search_get_library_docs` |
| `web` | `web_search`, `web_fetch` |

Ask the agent to activate all required groups together. Passing an empty capability list unloads the managed specialist schemas without removing unrelated custom tools. A restored session reactivates the groups in its latest continuity snapshot.

## First startup

```bash
./p
```

The repository launcher passes Pi's official `--approve` trust override, so it loads project resources and installs missing pinned packages without a trust prompt. It grants normal implementation access across the writable workspace, while arbitrary Git/GitHub mutations remain disabled independently. Routine delivery uses the reviewed `scripts/ai-pr.mjs` helper on the persistent `ai-changes` branch; install/authenticate `gh` as the owner and see `docs/GIT_POLICY.md`. Set `AI_PR_DELIVERY=off` for local-only runs. Use `PI_PROJECT_TRUST=ask ./p` only when you intentionally want the interactive trust decision.

For the reviewed Pi `0.84.2` pin, the launcher defaults to:

| Variable | Default | Effect / opt-out |
|---|---:|---|
| `PI_EXPERIMENTAL` | `1` | Enables capability-gated strict-prefer JSON-schema sampling for supported built-ins plus Pi's official first-run setup; set `0` to compare legacy sampling. |
| `PI_SMART_READ` | `1` | Bounds implicit reads of regular files at least 96 KiB; set `0` to disable. |
| `PI_SMART_READ_BYTES` | `98304` | Size threshold in bytes. |
| `PI_SMART_READ_LINES` | `400` | Injected limit for a qualifying read; explicit ranges are unchanged. |
| `PI_BLIND_RETRY_LIMIT` | `2` | Blocks the next identical tool call after this many errored executions; set `0` to disable. |
| `PI_CONTINUITY` | `1` | Persists/injects the bounded mechanical continuity capsule; set `0` to disable. |

These controls are model/provider neutral. Review them with every Pi upgrade because `PI_EXPERIMENTAL` is intentionally tied to the exact tested pin.

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

Check the adapter:

```text
/mcp status
```

The Playwright server uses lazy lifecycle and stops after an idle period. When the MCP metadata cache is valid, sessions can defer the server until the first browser-tool call. A clean, missing, invalid, or stale cache triggers a startup catalog connection so the adapter can rebuild metadata.

A useful smoke request is:

```text
Activate the browser capability, then use the mcp proxy to find the Playwright page snapshot tool. Do not navigate anywhere.
```

For actual browser QA, start the project's local application and navigate to its URL. Begin with accessibility snapshots; use screenshots when appearance materially matters. Screenshots are stored under `.artifacts/playwright/`.

Autonomous mode exposes focused `browser_evaluate` when snapshots and normal interactions cannot reveal the required state. File upload, drag-and-drop file injection, and MCP scripting remain unavailable. `PI_GUARD_MODE=strict` disables page evaluation and restricts navigation to localhost.

If Playwright reports that no browser executable is available, install Chromium once outside the normal agent session:

```bash
npx -y playwright install chromium
```

Use the browser version already installed by a real project when possible.

### Visual evidence across model capabilities

The workflow uses the active model's native image input; it does not install or call a separate image model or add a Vision tool schema. `harness_tools` reports configured image support when activating `browser`, and runtime guidance refreshes on visual user turns. Model names are never used to infer support. For custom models, confirm accurate `input` metadata in the operator's Pi configuration; do not silently change it.

Playwright now uses `--image-responses allow`: a requested screenshot returns native image content through the MCP adapter as well as a saved artifact. The adapter's output guard bounds text, not images; Pi `0.84.2` normalizes tool-result images. Request only useful viewport/element screenshots and retain Pi's default image resizing. If a permitted response contains only a path, use `read` on that exact file; do not paste base64 or assume the model can see a filename.

`harnessVision.imageInput` and `imageBlocks` in tool details mean configured support and blocks returned, not provider acceptance or completed inspection. Pi's `images.blockImages` setting can strip images after the extension hook, and a provider can reject them. Respect that setting and user privacy opt-outs: disabled/filtered/unsupported/unreadable pixels leave appearance-only criteria `UNPROVEN`. TUI image display is separate from model input. After updating `.mcp.json`, restart the Playwright MCP connection or start a fresh Pi session so cached server arguments do not retain `omit`.

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

The included search extension does not require a model-native search provider.

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
/mcp status
/web --show
```

Then test capabilities with bounded requests:

```text
Activate the docs capability, then use doc_search_resolve_library_id to resolve the React documentation library ID. Do not fetch broad documentation yet.
```

```text
Activate the browser capability, then use the MCP proxy to locate the Playwright snapshot tool. Do not navigate.
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
