# Plan 030: Re-enable static checks for server hooks (`tsconfig.server.json` + Biome override)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- tsconfig.json tsconfig.server.json biome.json server/pb_hooks/*.pb.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (Goja globals `+$app`/`$security` need stub types; wrong override churns huge diffs)
- **Depends on**: none
- **Category**: dx (static analysis blind spot)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`tsconfig.json` and `biome.json` explicitly exclude `server/pb_hooks/**` and `server/pb_migrations/**` — 5k+ LOC of payment transactions, entitlement checks, approval atomicity, and placement grading have zero IDE squiggle and zero lint. Typos/regressions are only caught by 18 heavy smoke suites (10–15 min). A lightweight `allowJs+checkJs` pass plus a Biome override that understands Goja globals gives fast local feedback without slowing the fast lane.

## Current state

- **Files:**
  - `tsconfig.json:13-23`:
```json
{ "include": ["app/src/**/*","landing/src/**/*","shared/**/*","admin/src/**/*","vite.*.config.ts"] }
```
    Omits `server/**` and `scripts/**`.
  - `biome.json:files.includes`:
```json
{ "includes": ["**","!server/pb_hooks","!server/pb_migrations","!android"] }
```
    Linter deliberately blind to hooks.
  - `server/pb_hooks/*.pb.js` ~5k LOC (goja ES5: `routerAdd`, `$app`, `$security`, `$filepath`, `$os`, `require(__hooks + '/...')`, `Record`, `BadRequestError` globals). Hooks are excluded from Biome so `npx biome check .` never sees them.
  - `scripts/**` similarly excluded.

- **Conventions:** Biome is formatter+lint for TS; hooks are ES5 JS with Goja globals that must be declared. Do not change `biome.json` excludes for `android` (large vendor), only add a server override. `pnpm verify:fast` is `tsc --noEmit` + `biome check .` + `vitest` — the new server check must slot as a separate `tsc --project tsconfig.server.json` step, not via the main `include` (to keep main lane fast and avoid polluting app types with Goja).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Server typecheck | `npx tsc --project tsconfig.server.json --noEmit` | exit 0 (errors only for real drift, not for Goja globals) |
| Lint hooks | `npx biome check server/pb_hooks/` (if override wired) | exit 0 or only style nits |
| Fast gate | `pnpm verify:fast` | exit 0 (main lane unchanged) |
| Typecheck main | `pnpm typecheck` (`tsc --noEmit`) | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `tsconfig.server.json` (new)
- `server/pb_hooks/goja.d.ts` (new — Goja globals stub)
- `biome.json` (add `overrides` for `server/pb_hooks`)
- `package.json` (add `typecheck:server` script; optionally wire into `verify:fast` as a second `tsc` invocation — see Steps)
- `scripts/verify-fast.sh` (optional — add `tsc --project tsconfig.server.json` before fast gate if cheap; otherwise leave for a later `verify:full` integration)

**Out of scope** (do NOT touch, even though they look related):
- Any `server/pb_hooks/*.pb.js` logic — no hook code changes; only config/stubs.
- `tsconfig.json` main `include` — do not add `server/**` there.
- `server/pb_migrations/*.js` — keep excluded (large historical); only `pb_hooks` are in scope.
- `android/**`.

## Git workflow

- Branch: `advisor/030-server-typecheck-lint`
- Commit: `chore(dx): enable tscheck for server hooks (goja stubs + biome override)`
- Do NOT push unless instructed.

## Steps

### Step 1: Create `server/pb_hooks/goja.d.ts` stub

Create `server/pb_hooks/goja.d.ts`:

```ts
// Goja JSVM globals for server/pb_hooks/*.pb.js — typecheck only.
declare const $app: {
  findRecordById(col: string, id: string): any;
  findRecordsByFilter(col: string, filter: string, sort: string, limit: number, offset: number, params?: Record<string, unknown>): any[];
  findCollectionByNameOrId(col: string): any;
  save(rec: any): void;
  runInTransaction(fn: (txApp:any)=>void): void;
  dataDir(): string;
  logger(): { info(m:string):void; error(m:string):void };
  findAuthRecordByToken(token:string, type:string): any;
};
declare const $security: { randomString(len:number):string };
declare const $filepath: { join(...parts:string[]):string; clean(p:string):string };
declare const $os: { readFile(p:string): any };
declare const $apis: { requireAuth(col:string): unknown };
declare function routerAdd(method:string, path:string, handler:(e:any)=>any, middleware?:any): void;
declare function migrate(up:(app:any)=>void, down:(app:any)=>void): void;
declare const __hooks: string;
declare class Record { constructor(coll:any); id: string; get(f:string):any; set(f:string,v:any):void; baseFilesPath():string; }
declare class BadRequestError extends Error { constructor(msg:string, data?:any); status:number; rawData:any; }
declare function toBytes(reader:any, maxBytes:number): any[];
declare function readerToString(body:any): string;
declare const globalThis: any;
```

Keep it minimal — only what hooks actually reference (grab from `payment_routes.pb.js:62,623` + `lesson_routes.pb.js:45` if needed). Add stubs incrementally when `tsc` complains, not speculatively.

**Verify**: file exists; `npx tsc --project tsconfig.server.json --noEmit` (after Step 2) shows no Goja errors.

### Step 2: Create `tsconfig.server.json`

Create `tsconfig.server.json` at repo root:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "skipLibCheck": true,
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "types": ["node"]
  },
  "include": ["server/pb_hooks/**/*.pb.js", "server/pb_hooks/goja.d.ts"],
  "exclude": ["server/pb_data", "server/pb_data.bak", "node_modules", "dist-*"]
}
```

- `allowJs+checkJs` lints JS without changing emit.
- `strict:false` keeps noise low; the goal is typo/drift detection, not full strictness on 5k LOC of ES5.
- `goja.d.ts` is included so `$app` etc. resolve.

Run:
```bash
npx tsc --project tsconfig.server.json --noEmit
```
Fix any remaining Goja symbols by extending the stub, not by adding `// @ts-ignore` in hooks.

**Verify**: `npx tsc --project tsconfig.server.json --noEmit` exits 0.

### Step 3: Add Biome override for `server/pb_hooks`

Edit `biome.json` to add an `overrides` entry after the top `linter`:

```json
{
  "files": { "includes": ["**","!dist-*","!node_modules","!server/pb_data","!server/pocketbase","!android"] },
  "overrides": [
    {
      "includes": ["server/pb_hooks/**/*.pb.js"],
      "linter": {
        "rules": {
          "correctness": { "noUndeclaredVariables": "off" },
          "suspicious": { "noExplicitAny": "off", "noConsoleLog": "off" },
          "style": { "useConst": "off", "noVar": "off" }
        }
      }
    }
  ]
}
```

- The key change: stop excluding `server/pb_hooks` from `files.includes` (the `!server/pb_hooks` entry is removed or changed to keep it included) and use overrides to relax ES5-appropriate rules (`noVar`/`useConst` off, `noUndeclaredVariables` off because Goja globals).
- Keep `!server/pb_migrations` unless you also want migrations linted (out of scope).

Test:
```bash
npx biome check server/pb_hooks/payment_routes.pb.js
```
Should exit 0 or report only real style issues, not `noUndeclaredVariables` for `$app`.

**Verify**: `npx biome check server/pb_hooks/` exits 0 (or only known-style warnings); `npx biome check .` still exits 0.

### Step 4: Wire `typecheck:server` into package.json and optionally into `verify-fast`

Add to `package.json` scripts:
```json
{ "typecheck": "tsc --noEmit", "typecheck:server": "tsc --project tsconfig.server.json --noEmit" }
```

- Do NOT replace `typecheck`; add alongside.
- Optionally edit `scripts/verify-fast.sh` to run both:
```sh
npx tsc --noEmit
npx tsc --project tsconfig.server.json --noEmit
```
  Keep this opt-in: if `tsconfig.server.json` is too noisy initially, leave `verify-fast.sh` unchanged and document `pnpm typecheck:server` as the opt-in lane. Note choice in commit message.

**Verify**: `pnpm typecheck:server` exits 0; `pnpm verify:fast` still exits 0.

### Step 5: No hook code edits

This plan must not change any `server/pb_hooks/*.pb.js` logic. If `tsc` flags a hook typo (e.g. `findRecordsByFilter` arg typo), fix the stub, not the hook, unless the typo is clearly a bug (then STOP and report).

**Verify**: `git diff --stat HEAD -- server/pb_hooks/*.pb.js` is empty (only new `goja.d.ts`).

## Test plan

- **Typecheck:** `npx tsc --project tsconfig.server.json --noEmit` → 0.
- **Biome:** `npx biome check server/pb_hooks/` → 0 (or only style).
- **Regression:** `pnpm verify:fast` (`tsc --noEmit` + `biome check .` + `vitest`) → 0 (main lane unchanged plus optional server lane).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f tsconfig.server.json` and `test -f server/pb_hooks/goja.d.ts`
- [ ] `npx tsc --project tsconfig.server.json --noEmit` exits 0
- [ ] `npx biome check server/pb_hooks/` exits 0 (or only known-style warnings with `noUndeclaredVariables` off)
- [ ] `pnpm typecheck` exits 0; `pnpm verify:fast` exits 0
- [ ] `git diff --stat HEAD -- server/pb_hooks/*.pb.js` shows no logic changes (only `goja.d.ts` added)
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- `tsconfig.server.json` `extends` resolution fails (Biome/tsc version pinned 7.0.2 may not support `checkJs` on `.pb.js`) — report tool version mismatch.
- Goja globals list is longer than stub (hook uses `$http`, `$crypto`, etc. not in stub) — report actual glob and enlarge stub; do not add `// @ts-ignore` in hooks.
- Biome `overrides` `includes` key not supported in pinned 2.5.6 (API drift) — report; use `files.includes` adjustment instead.
- Wiring `typecheck:server` into `verify-fast.sh` makes the fast lane >60s (hooks 5k LOC check) — then leave it as opt-in `typecheck:server` and document.
- You need to edit any hook `.pb.js` logic — out of scope for this DX plan.

## Maintenance notes

- New hook files must be ES5 + `var`/`function`; the stub file documents the allowed Goja globals. Extend `goja.d.ts` when a new global is introduced (e.g. `$http` for a future integration).
- If `allowJs+checkJs` becomes noisy after a hook refactor, consider moving hooks to `.ts` with `// @ts-check` header — but that requires PB 0.39 JSVM compatibility check (goja supports limited TS? document before migrating).
- Reviewers: this plan's value is local squiggle, not CI blocking. Consider promoting `typecheck:server` to CI `static` lane only after 2 weeks of green local runs.

