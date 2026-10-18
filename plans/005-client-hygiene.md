# Plan 005: Shared client fetch helper + stylesheet reconciliation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5774c6f..HEAD -- resources/js resources/css resources/views package.json package-lock.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `5774c6f`, 2026-10-18
- **Issue**: omit

## Why this matters

Five verbatim `csrfToken()` copies, a duplicated `currentCueIndex`, and four `INPUT_CLASS` copies mean one header/cue-math/input-style fix lands in N files — and cue-edge logic has already drifted between Sample (imports the shared helper) and Reader (own copy). Separately, ~15 `fe-*` classes referenced in React (`fe-playerbar`, `fe-english-body`, …) have zero definitions in the loaded stylesheet (`resources/css/inertia.css` is tokens-only, `grep \.fe-` = 0 hits) while their definitions sit in `resources/css/app.css:87-202` which the Inertia root (`resources/views/app.blade.php:25`) never loads — so those hooks render unstyled and ~200 dead lines ship to 5 small server pages. Two unused manifest entries (`concurrently`, `@laravel/multiplex`) add install weight with zero consumers. This plan extracts one helper, reunites styles with their markup, and drops the dead deps.

## Current state

The relevant files, each with one line on its role:

- `resources/js/lib/player.tsx:31` — `function csrfToken()` (verbatim copy #1 of 5; identical copies at `resources/js/pages/Placement/Show.tsx:31`, `resources/js/pages/Reader/Show.tsx:54`, `resources/js/pages/Words/Index.tsx:37`, `resources/js/pages/Words/Review.tsx:43`):
  ```tsx
  function csrfToken(): string {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
  }
  ```
- `resources/js/lib/audio.ts:44-62` — shared `currentCueIndex` (already imported by `Sample/Show.tsx:6`; `Reader/Show.tsx:71-88` carries its own duplicate — diff the two before unifying).
- `INPUT_CLASS` string at `Account/Settings.tsx:27`, `Auth/Register.tsx:14`, `ResetPassword.tsx:19`, `Payments/Show.tsx:48` (4 verbatim copies — read one, e.g. `Auth/Register.tsx:14`, before extracting).
- `resources/js/lib/player.tsx:155,236` + `resources/js/pages/Reader/Show.tsx:59,243` + `Placement/Show.tsx:59`, `Words/Index.tsx:47`, `Words/Review.tsx:68` — 7 hand-rolled `fetch(` sites with per-page headers/status handling; `useForm` (12 sites) and `router.` (5 sites) stay as-is.
- `resources/css/inertia.css:1-120` — loaded by the Inertia root; tokens-only, zero `.fe-` rules.
- `resources/css/app.css:87-202` (+ `:355 .fe-playerbar`, `:1286`, `:1300`, `:1384`, `:1392`) — `.fe-learner/.fe-surface/.fe-btn/...` definitions; loaded only by `layouts/public.blade.php:24` (5 small server pages). The Inertia root `resources/views/app.blade.php:25` loads ONLY `inertia.css + app.tsx + pwa.js`.
- React `fe-*` consumers (verified): `components/AudioPlayer.tsx:63` (`fe-playerbar`), `pages/Reader/Show.tsx:475` + `pages/Sample/Show.tsx:303` (`fe-english-body`), plus `Library/Index`, `Payments/Show`, `AppLayout` (~15 hooks total — enumerate with `grep -rhn "fe-[a-z-]*" resources/js` before porting).
- `package.json:19` `concurrently ^10.0.3` and `:26` `@laravel/multiplex ^0.4.1` — zero source consumers (`vite.config.js:1-27` uses only laravel/tailwind/react/inertia plugins; `multiplex` grep = 0).
- `app/Http/Middleware/PrivateNoStore.php:68-85` — self-admitted dead `isLivewireUpdate()` branch ("dead on `web` but harmless").
- `app/Models/PaymentRequest.php:21-23`, `app/Http/Controllers/PlacementController.php:25-27` — comments asserting a removed Blade/Livewire frontend, contradicted by adjacent Inertia code.

Repo conventions that apply (`resources/css/inertia.css:1-12` header is binding): the `@theme` block owns EVERY color value; components use utilities (`bg-canvas text-ink border-line`) or `var(--color-*)`; NO hex literal outside the block; single permanent light theme. Import alias `@/` maps to `resources/js` (verify in `tsconfig.json` + `vite.config.js` before using `@/lib/http`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Types | `npm run typecheck` | exit 0 |
| Build | `npm run build` | exit 0 (proves no broken CSS/JS refs) |
| Targeted browser | `npx playwright test m0-inertia --project=chromium` | pass (needs `:8111` server; record SKIP if absent) |
| Targeted PHP | `php artisan test --filter="S2CacheHeaders|S8"` | pass (no-store/cache posture unchanged) |
| Style | `vendor/bin/pint --test` | exit 0 |
| Deps | `npm ci` (after manifest edit, if network allows) | exit 0, lockfile consistent |

## Scope

**In scope** (the only files you should modify):

- `resources/js/lib/http.ts` (create: `csrfToken` + `postJson` shared helper)
- The 5 `csrfToken` call sites + 7 `fetch(` sites (route through the helper; identical headers/status semantics)
- `resources/js/pages/Reader/Show.tsx` (import shared `currentCueIndex`, delete local copy)
- One shared input-class module (e.g. `resources/js/components/field.tsx` or `lib/field.ts` — match whichever sibling pattern exists) + 4 consumers
- `resources/css/inertia.css` (port actually-used `fe-*` rules), `resources/css/app.css` (delete ported dead copies, keep `.fe-learner` + anything the 5 server pages use)
- `package.json` + `package-lock.json` (drop the 2 unused deps)
- `app/Http/Middleware/PrivateNoStore.php` (delete dead branch only), the 2 stale comments (reword only)

**Out of scope** (do NOT touch, even though they look related):

- `resources/js/lib/player.tsx` transport/engine, `useHeadlessAudio` unification, `useProgressSaver` extraction, page component splits (Reader/Words/Landing), JSON-error helper, fetch-vs-Inertia transport rule — larger refactors, explicitly deferred.
- `components.json` shadcn aliases, dark header logo asset, audio element ids — separate findings.
- Any route, prop shape, endpoint, or behavior — pure moves + stylesheet wiring.
- `docker/`, `config/`, `bootstrap/` — no infra.

## Git workflow

- Branch: `advisor/005-client-hygiene`
- Commit per move (http helper, cue unification, input class, CSS port, deps, dead-branch/comments); message style: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `lib/http.ts` and route all call sites

What to do: create `resources/js/lib/http.ts` exporting `csrfToken(): string` (the verbatim body) and `postJson(url, body): Promise<Response>` (JSON headers + `X-CSRF-TOKEN` + `Accept: application/json`, same as the per-page `fetch` wrappers — read `lib/player.tsx:155` and one page wrapper first to capture exact semantics). Replace the 5 local `csrfToken` definitions with `import { csrfToken } from '@/lib/http'` (or `postJson` where the file only used the token to post). Route the 7 `fetch(` JSON sites through `postJson` WITHOUT changing status handling, error strings, or retry behavior.

**Verify**: `grep -rn "function csrfToken" resources/js` → exactly 1 (in `http.ts`). `npm run typecheck` → exit 0.

### Step 2: Unify `currentCueIndex` + `INPUT_CLASS`

What to do: diff `lib/audio.ts:44-62` vs `Reader/Show.tsx:71-88`; make Reader import from `@/lib/audio` (keep whichever edge semantics the shared one has — Sample already ships it, so the shared one wins ties; if Reader's copy handles an edge the shared one lacks, port THAT edge into `lib/audio.ts` with a comment, don't keep two). Extract one `INPUT_CLASS` (+ field-error element if the 4 sites share it — check) into a shared module; update the 4 consumers to import it.

**Verify**: `grep -rn "currentCueIndex" resources/js/pages/Reader/Show.tsx` → import line only. `grep -rn "INPUT_CLASS =" resources/js` → exactly 1 definition. `npm run typecheck` → 0.

### Step 3: Reconcile the split stylesheets

What to do:

1. `grep -rhn "fe-[a-z-]*" resources/js -o | sort -u` → the definitive used-hook list.
2. For each used hook, port its rule from `app.css` into `inertia.css` CONVERTED to token utilities/`var(--color-*)` where the old rule uses `var(--fe-*)` or hex (the `@theme` owns all color — `inertia.css:13-29` exact hexes; map old `--fe-*` names to the closest `--color-*` token, never copy hex). Skip porting if the hook is already fully styled by utilities at the call site (then it's a dead class name — remove the name from the JSX instead).
3. Delete the ported rules from `app.css`; KEEP `.fe-learner` (`app.css:87`) and every rule consumed by the 5 server pages under `layouts/public.blade.php` (verify consumers via `grep -rn "fe-" resources/views` before each deletion).
4. Reduce the 6 inline `style=` props (`AudioPlayer.tsx:70,150-159`, `AppLayout.tsx:227`, `Sample/Show.tsx:192`, `Today/Index.tsx:203`) ONLY where the value is static (move to class/token); keep genuinely dynamic ones (progress %, safe-area).

**Verify**: `npm run build` → exit 0. Rendered diff: screenshot the reader + library + player before/after (Playwright or browser spec) — no visual change except hooks that were previously unstyled (list those as now-fixed). `php artisan test --filter="S2CacheHeaders|S8"` → pass.

### Step 4: Drop dead deps, dead branch, stale comments

What to do: remove `concurrently` and `@laravel/multiplex` from `package.json`, regenerate the lockfile (`npm install --package-lock-only` if offline-safe, else document for CI), and confirm `npm run build` still passes. Delete `isLivewireUpdate()` + its `||` operand in `PrivateNoStore.php` (keep the panel copy at `AdminPanelProvider.php:53-63` untouched). Reword the 2 stale comments to the Inertia transport (comment-only).

**Verify**: `grep -rn "concurrently\|multiplex" package.json` → empty. `grep -n "isLivewireUpdate" app/Http/Middleware/PrivateNoStore.php` → empty. `vendor/bin/pint --test` → 0. `npm run build` → 0.

### Step 5: Run the gate

**Verify**: full gate (plan 001) → exit 0.

## Test plan

- No new product tests (pure moves). Safety nets that must stay green: `npm run typecheck`, `npm run build`, `m0-inertia` browser spec, `S2CacheHeaders`, `S8*` landing/marketing specs, full Pest suite in the gate.
- Before/after screenshot comparison for the CSS port (reader, library, player, sample) — attach paths in the handoff.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "function csrfToken" resources/js` → 1 definition; all 7 JSON `fetch(` sites import from `@/lib/http`
- [ ] `currentCueIndex` defined once (`lib/audio.ts`); `INPUT_CLASS` defined once
- [ ] `grep -c "\.fe-" resources/css/inertia.css` > 0 (used hooks ported); every remaining `fe-*` hook in `resources/js` resolves to a loaded rule
- [ ] `concurrently` + `multiplex` absent from `package.json` + lockfile; `npm run build` exits 0
- [ ] Dead Livewire branch + 2 stale comments fixed; `vendor/bin/pint --test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match (e.g. fewer/more `csrfToken` copies, different `fe-*` hook list).
- Any ported CSS rule needs a hex/token not in the `@theme` block — the theme owns color; don't invent tokens, escalate.
- A `style=` prop turns out load-bearing-dynamic (JS-driven value) — keep it, note it.
- `app.css` deletion candidates are consumed by server pages you can't enumerate — keep them, mark TODO in handoff.
- Lockfile regeneration requires network you don't have — hand off the `package.json` edit with `npm install --package-lock-only` left for CI, don't fake the lock.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- New client code MUST use `@/lib/http` for JSON posts — review-check `fetch(` additions.
- New styles go in `inertia.css` (tokens/utilities) for React, `app.css` only for server-rendered pages — never `fe-*` in React without a loaded definition.
- If shadcn components ever land, revisit `components.json` aliases (currently promise dirs that don't exist) in the same cleanup spirit.
