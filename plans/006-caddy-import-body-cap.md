# Plan 006: Fix the Caddy 6 MB body cap vs the 64 MB content-import contract

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- deploy/Caddyfile tests/ .pi/verification.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (deploy config) + security (body-size boundary)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The content pipeline (Podcast Slice 3/4) is the operator's primary way to
add episodes: CLI `pnpm content:import` and the Admin Console ZIP import
both POST a package of up to ~60 MB (`shared/content-package/zip.ts` caps
`maxTotalUncompressedBytes` at 60 MiB) to
`POST /api/fast-english/staff/content-import/plan|execute`, which parses
multipart with a 64 MB limit (`content_import_routes.pb.js:736`).

But Caddy caps ALL `/api/*` request bodies at 6 MB (sized for the 5 MB
receipt + margin) on both the app and admin domains (`deploy/Caddyfile`).
Every import package larger than ~6 MB is rejected at the proxy with 413 —
the entire content pipeline is broken at deploy time, and an operator sees
an opaque failure. The fix scopes a larger cap to the import paths only, so
the receipt boundary (5 MB + margin) is preserved everywhere else.

## Current state

`deploy/Caddyfile` — two identical generic blocks (app domain ~:149-163,
admin domain ~:213-227):

```caddy
	# PocketBase APIs (including /api/fast-english/* custom routes, realtime,
	# file URLs). Bounded request body: 5MB receipt + 1MB documented margin.
	# API failures terminate here — they are never sent to the SPA fallback.
	handle /api/* {
		request_body {
			max_size 6MB
		}
		reverse_proxy 127.0.0.1:8090 {
			transport http {
				read_timeout 360s
			}
		}
	}
```

The import route parses `64 * 1024 * 1024` (`server/pb_hooks/content_import_routes.pb.js:736`),
and the browser ZIP adapter caps total uncompressed at 60 MiB
(`shared/content-package/zip.ts:42`). Caddy `handle` blocks choose the most
specific matcher, so a `handle /api/fast-english/staff/content-import/*`
block with a 64 MB cap wins over `handle /api/*` for those paths (place it
BEFORE the generic block anyway — order-independent in Caddy, but explicit).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Static gate | `node --test tests/deploy-config.test.mjs` | 3 tests pass |
| Harness lane | `node --test tests/hook-rate-limit.test.mjs tests/deploy-config.test.mjs` | all pass |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Import smokes (unchanged behavior) | `pnpm smoke:content-import && pnpm smoke:content-admin` | all pass |

Note: no local `caddy` binary exists in this environment; `caddy validate`
is NOT available. The static test + the deploy-time `smoke-prod.sh` (which
runs against the real Caddy) are the verification story. If a caddy binary
appears, additionally run `caddy validate --config deploy/Caddyfile`.

## Scope

**In scope** (the only files you should modify):
- `deploy/Caddyfile` (both site blocks)
- `tests/deploy-config.test.mjs` (new static test)
- `.pi/verification.json` (add the new test to the harness lane command list)

**Out of scope** (do NOT touch):
- `server/pb_hooks/content_import_routes.pb.js` and `shared/content-package/zip.ts`
  — their 64 MB/60 MiB budgets are correct; the mismatch is Caddy's.
- The receipt 6 MB cap for all OTHER `/api/*` paths — preserved.
- `deploy/smoke-prod.sh`, `deploy/deploy.sh` — no change needed.

## Git workflow

- Branch: `advisor/006-caddy-import-body-cap` (repo convention: `topic-slug`).
- Commit style: conventional (`fix(deploy): scope a 64MB body cap to the content-import API paths`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the scoped import cap to both site blocks

In `deploy/Caddyfile`, in BOTH the app domain and the admin domain, insert
immediately BEFORE the generic `handle /api/*` block:

```caddy
	# Content-import packages (CLI + Admin ZIP) legitimately reach ~60MB
	# (server parses 64MB; zip.ts caps 60MiB uncompressed). Scoped to the
	# import paths only — every other /api/* body keeps the 6MB boundary
	# (5MB receipt + margin). The most-specific handle wins in Caddy.
	handle /api/fast-english/staff/content-import/* {
		request_body {
			max_size 64MB
		}
		reverse_proxy 127.0.0.1:8090 {
			transport http {
				read_timeout 360s
			}
		}
	}
```

**Verify**: read both blocks back — the scoped handle appears twice (once
per domain), before each generic `/api/*` block; the generic blocks are
unchanged at 6 MB.

### Step 2: Static regression test

Create `tests/deploy-config.test.mjs` (node:test style, mirroring
`tests/hook-rate-limit.test.mjs`). Assert over `deploy/Caddyfile` source
text:
1. The string `handle /api/fast-english/staff/content-import/*` occurs
   exactly twice (app + admin domains).
2. Every occurrence of `max_size 64MB` is inside a block that also contains
   the import-path matcher (line-range pairing: the `max_size 64MB` line
   must be between the import `handle` line and the block's closing `}`).
3. Every OTHER `handle /api/*` block still caps at `max_size 6MB` (count:
   `max_size 6MB` occurs exactly twice).

**Verify**: `node --test tests/deploy-config.test.mjs` → 3 tests pass.

### Step 3: Wire into the harness lane

Add `tests/deploy-config.test.mjs` to the `node --test` command list in
`.pi/verification.json` (next to `tests/hook-rate-limit.test.mjs`).

**Verify**: `node --test tests/hook-rate-limit.test.mjs tests/deploy-config.test.mjs`
→ all pass.

## Test plan

- New static test `tests/deploy-config.test.mjs` (Steps 2-3): the Caddyfile
  contract — scoped 64 MB import cap ×2, generic 6 MB cap ×2, pairing
  correct. Defect-sensitive: reverting Step 1 fails assertions 1-3.
- Behavior net (unchanged): `pnpm smoke:content-import` (32 scenarios),
  `pnpm smoke:content-admin` (28 scenarios).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `deploy/Caddyfile` has the scoped `handle /api/fast-english/staff/content-import/*`
      with `max_size 64MB` in BOTH domains, before the generic 6 MB blocks
- [ ] `node --test tests/deploy-config.test.mjs` → 3/3 pass
- [ ] `.pi/verification.json` includes `tests/deploy-config.test.mjs`
- [ ] `pnpm smoke:content-import && pnpm smoke:content-admin` exit 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The Caddyfile structure has drifted (different domain names, site blocks
  merged, or the generic cap changed) — re-derive the insertion points and
  report.
- A `handle` block in the file uses a different proxy target/options shape
  than the excerpt — match the live file's block shape instead.
- `pnpm smoke:content-import` fails after the change (it cannot be caused by
  the Caddyfile locally — that would indicate a hook regression; report).

## Maintenance notes

- If the import package ceiling changes (zip.ts 60 MiB or server 64 MB),
  update this cap in the same commit — the static test only pins the
  presence/pairing, not the value (keep it that way, or update the test
  deliberately).
- When a real deployment happens, `deploy/smoke-prod.sh` exercises the
  import API through Caddy — add an oversized-package scenario there if the
  production smoke doesn't already cover >6 MB imports.
