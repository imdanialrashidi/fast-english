# Fast English Podcast — Pi Tooling Setup

Project-local Pi stack for reliable agent-assisted development on the Fast English Podcast repository. Package pins are installed by Pi after the repository is trusted. This project is **Node-only** (TypeScript + Vite + React + MUI + PocketBase + Capacitor); there is no Python or Go surface.

The reviewed Pi pin requires Node.js 22.19.0 or newer. The repository pins **Node 24** (`.nvmrc`, `engines.node >=24 <25`) and **pnpm 11.17.0** (`packageManager`, `engines.pnpm >=11 <12`). CI uses Node 24 with corepack.

## Included packages

- `pi-sub-agent@0.1.5`
- `pi-mcp-adapter@2.20.1`
- `@juicesharp/rpiv-todo@2.1.0`
- `pi-lsp-adapter@0.1.3`
- `@dreki-gg/pi-doc-search@0.3.2`
- `@getpipher/vision@0.5.2`
- `@bytetrue/pi-web-search@0.1.3`

The project MCP configuration pins `@playwright/mcp@0.0.79` and exposes a restricted browser tool set through the single `mcp` proxy (lazy server, no file upload/drop, autonomous mode).

## First startup

```bash
./p
```

The repository launcher passes Pi's official `--approve` trust override, so it loads the project resources and installs missing pinned packages without a trust prompt. Use `PI_PROJECT_TRUST=ask ./p` only when you intentionally want the interactive trust decision.

Reload after installation:

```text
/reload
```

Validate the repository configuration:

```bash
bash scripts/pi-doctor.sh
```

## Repository quick reference

- Install dependencies: `pnpm install` (CI: `bash scripts/ci-install.sh` — corepack enable + frozen lockfile + Playwright Chromium).
- PocketBase test binary (pinned by `server/VERSION`): `pnpm setup:pocketbase` → `server/pocketbase`. Never commit `server/pb_data/`.
- Local development:
  - `pnpm dev:app` → Student App on http://localhost:5173 (Vite `/api` proxy → local PocketBase).
  - `pnpm dev:landing` → static Landing on http://localhost:5174.
  - `pnpm dev:admin` → Admin Console on http://localhost:5175.
  - `pnpm dev:server` (`scripts/dev.sh`) → disposable PocketBase on http://127.0.0.1:8090; **health signal**: `curl http://127.0.0.1:8090/api/health`; logs in a temp dir, cleaned on exit.
- Verification lanes (see `docs/QUALITY.md`):
  - `pnpm verify:fast` — typecheck + Biome + Vitest (everyday gate).
  - `pnpm verify:feature [auth|payment|placement|lessons|progress|all] [app|landing|all]` — fast + mapped real-Backend smokes + `@critical` Playwright + affected build.
  - `pnpm verify:full` — the canonical full gate (`scripts/project-verify.sh` + full Playwright). `scripts/verify.sh` delegates here (CI/release compatibility entry).
  - Affected-change routing: `node scripts/verify-affected.mjs --file <path> --plan` (routes in `.pi/verification.json`; unmatched files fall back to the full gate). The lanes: app feature code (`app/src/features/**`, `app/src/lib/**`) → `verify-feature all app` (fast + real-Backend smokes + `@critical` Playwright + app build); app shell/pwa/landing/shared/admin → `verify:fast`; e2e specs → `playwright-fast` + a Biome check over `e2e/` and `playwright.config.ts` (e2e stays out of the app tsconfig by design).
- Real-Backend smokes (`pnpm smoke:*`, 18 suites) each start a disposable PocketBase in `/tmp` — they never touch `server/pb_data/`; throwaway credentials never appear in output (`scripts/pb-test-helper.sh`).
- Browser lanes: `pnpm test:e2e:fast [spec]` (low-resource: Vite dev servers, one worker, no retries/video/trace/screenshots, `PW_FAST=1`), `pnpm test:e2e:smoke`, `pnpm test:e2e:failed`, `pnpm test:e2e:full` (`CI=1`: built app/landing/admin via `vite preview`, at most one retry, trace on first retry, screenshots on failure only). Never set `CI=1` locally.
- Android: `pnpm android:build:debug`, `pnpm android:build:release` (fails safely without `FEP_ANDROID_*` signing vars), `pnpm android:verify:release` (apksigner/zipalign/SHA-256).

Failure evidence lives in: concise runner output per step, `/tmp/fep-vite-*.log` (dev servers), `test-results/` (Playwright), and the disposable PB data dir printed by the smoke wrappers — no secrets in any of them.

## Todo panel

Confirm the extension:

```text
/todos
```

The agent should use todos only for work with at least four meaningful steps, cross-module work, sessions likely to exceed fifteen minutes, or work that may survive compaction.

## MCP and Playwright browser tools

Check the adapter:

```text
/mcp status
```

The Playwright server is lazy. It starts only on the first browser-tool call and stops after an idle period.

A useful smoke request is:

```text
Use the mcp proxy to find the Playwright page snapshot tool. Do not navigate anywhere.
```

For actual browser QA, prefer the committed deterministic lane first (`pnpm test:e2e:fast`); use MCP navigation against a running local dev server (`pnpm dev:app` / `pnpm dev:server`) for interactive exploration of states that are hard to fixture. Interactive MCP evidence is not a substitute for committed specs. Browser actions should begin with accessibility snapshots; screenshots are reserved for appearance-related evidence and are saved under `.artifacts/playwright/`.

Autonomous mode exposes focused `browser_evaluate` for state that snapshots and normal interactions cannot reveal. It still hides:

- file upload;
- drag-and-drop file injection;
- MCP JavaScript scripting.

It also uses an isolated in-memory profile and blocks service workers. `PI_GUARD_MODE=strict` disables page evaluation and restricts navigation to localhost. Neither mode is a network sandbox or redirect containment; use `SECURITY.md` isolation guidance when egress is sensitive.

If Playwright reports that no browser executable is available, install Chromium once outside the normal agent session:

```bash
npx -y playwright install chromium
```

The repository's own Playwright version (1.62.0, `@playwright/test`) is the one to use for the committed suites.

## Language server setup

Check available servers:

```text
/lsp status
```

This is a TypeScript-only project (Vite + React + PocketBase JS hooks). Install only `vtsls`:

```text
/lsp install vtsls
/lsp doctor vtsls
```

The default install mode is explicit/prompted; missing language servers are not silently installed.

## Documentation search

The maintained `pi-doc-search` package queries Context7 directly and keeps a persistent local cache. It works without a key at lower rate limits. For higher limits, set the key in your shell or user environment, never in the repository:

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
```

Use `doc_search_resolve_library_id`, `doc_search_get_library_docs`, and `doc_search_get_cached_doc_raw` only when local source, installed types, and repository patterns do not answer a version-sensitive framework question (MUI, React, PocketBase, Vite, Capacitor, Playwright versions are pinned in `package.json`/`server/VERSION`).

## Web search

The included search extension does not require DeepSeek or a model-native search provider.

Default search is keyless Exa with automatic fallback to keyless Bing. Inspect or change the provider with:

```text
/web
```

Show current configuration:

```text
/web --show
```

For a restricted network, configure a proxy through `/web` or the package's user-level configuration. Do not commit search API keys or proxy credentials.

The agent has two tools:

- `web_search` for current external information;
- `web_fetch` for a specific public URL.

## Vision models: primary plus delegate

`@getpipher/vision` supports two model roles without forcing a provider:

The exact reviewed release is independently visible on [npm](https://www.npmjs.com/package/@getpipher/vision/v/0.5.2), with source and command documentation in the [`getpipher/vision`](https://github.com/getpipher/vision) repository.

| Active primary | Image path | Delegated model |
| --- | --- | --- |
| Text-only | `describe_image` sends the image to the configured vision model and returns text | Used |
| Image-capable | The image is attached to the primary model natively | Not called; `describe_image` is hidden |

This avoids a second paid request when the selected primary already understands images. It also means that a true text-model-plus-vision-model setup requires a text-only primary and a separately configured image-capable delegate.

### Configure both roles

1. Authenticate each provider you intend to use:

   ```text
   /login
   ```

2. Choose the primary coding/text model:

   ```text
   /model
   ```

3. Open the authenticated, image-capable model picker for the delegate:

   ```text
   /vision model
   ```

4. Verify the resolved configuration:

   ```text
   /vision show
   ```

The picker filters Pi's available model registry to models whose `input` includes `image`. The delegated choice is saved to `~/.pi/agent/vision.json`; credentials remain in Pi's normal credential store. Do not commit either file or any provider key.

### Change either model

| Intent | Command |
| --- | --- |
| Change primary model now | `/model` |
| Limit primary-model cycling | `/scoped-models`, then Ctrl+P / Shift+Ctrl+P |
| Pin the primary for this repository | Set `PI_MAIN_MODEL="provider/model-id"` in `.pi/models.env` (leave empty to keep the `/model` choice) |
| Pick a delegated vision model | `/vision model` |
| Switch the delegate directly | `/vision-use provider/model-id` |
| Switch the delegate by hotkey | Ctrl+Shift+I |
| Configure a failure fallback | `/vision fallback provider/model-id` |
| Inspect effective vision settings | `/vision show` |

Current image-capable examples in Pi's catalog (checked 2026-08-09) are [`openai/gpt-5.4-nano`](https://pi.dev/models/openai/gpt-5-4-nano), an economical delegate, and [`google/gemini-3.5-flash`](https://pi.dev/models/google/gemini-3-5-flash), a larger-context alternative. These are examples rather than template defaults: availability, capability metadata, and pricing can change, so confirm with the [live Pi model catalog](https://pi.dev/models) and your provider before adoption.

Direct-switch examples after provider authentication:

```text
/vision-use openai/gpt-5.4-nano
/vision fallback google/gemini-3.5-flash
/vision show
```

### Custom or local vision models

Pi loads custom models from `~/.pi/agent/models.json`. The model entry must include image input explicitly:

```json
{
  "id": "my-vision-model",
  "input": ["text", "image"]
}
```

Place that entry inside the appropriate provider's `models` array and configure the provider and authentication as described in Pi's [custom-model documentation](https://pi.dev/docs/latest/models). If `input` is omitted, Pi defaults it to `["text"]`, so the vision picker will correctly exclude it. Reopen `/model` to reload `models.json`, then run `/vision model`.

### Paste, cost, and privacy posture

The package defaults text-only paste handling to `hint`: it marks referenced images and lets the primary decide whether `describe_image` is necessary. Keep that for deterministic, bounded QA. `/vision paste-mode auto` delegates every referenced image automatically and can increase cost or disclose more screenshots than intended; use it only for an accepted workflow.

Before analyzing sensitive images, check routing with `/vision show`. Delegation sends image bytes to the selected vision provider; native pass-through sends them to the active primary provider. `/vision audit show` displays recent routing metadata without image bytes or full prompts. `/vision local-only on` blocks new network delegation (local cache hits still work), so a new image will be refused rather than analyzed remotely.

For visual QA with a text-only primary, ask Pi to call `describe_image` with a local screenshot path and a focused question. For an image-capable primary, reference or paste the screenshot directly.

## Recommended smoke checks

After setup:

```text
/todos
/lsp status
/mcp status
/web --show
/vision show
```

Then test capabilities with bounded requests:

```text
Run `bash scripts/pi-doctor.sh` and report each failing check.
```

```text
Run `pnpm verify:fast` and report the exact outcome.
```

```text
Use `node scripts/verify-affected.mjs --file app/src/lib/auth.tsx --plan` and describe the selected verification plan.
```

```text
Use `doc_search_resolve_library_id` to resolve the React documentation library ID. Do not fetch broad documentation yet.
```

```text
Use the MCP proxy to locate the Playwright snapshot tool. Do not navigate.
```

For image analysis with a text-only primary, provide a small local screenshot path and ask Pi to call `describe_image` with a focused visual question. Confirm the audit entry afterward with `/vision audit show`. No provider call is needed when the primary is image-capable; reference the screenshot directly.

## Updating packages

Package versions are pinned for reproducibility (`package.json` pins + `pnpm-lock.yaml`; Pi tool pins in `.pi/settings.json` + `.pi/package-integrity.json`). Review release notes before changing a pin. After intentionally updating the pins:

```text
/reload
```

and run:

```bash
bash scripts/pi-doctor.sh
```
