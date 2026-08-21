# Plan 035: Extract Vite base, audit deps, fix Android SDK pin and placeholder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- vite.app.config.ts vite.admin.config.ts vite.landing.config.ts android/variables.gradle android/build.gradle android/gradle/wrapper/gradle-wrapper.properties package.json docs/DEPLOYMENT.md scripts/check-android-version.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (Vite base refactor touches 3 builds; Android downgrade needs local Gradle verification)
- **Depends on**: 028 (pnpm cache keeps Gradle verification fast)
- **Category**: tech-debt / dependencies
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

- **Vite configs triplicated:** `vite.app/admin/landing.config.ts` each repeat `pkgVersion` regex, `buildTime`, `apiProxy{/api:target}`, `define{__APP_VERSION__}` verbatim. Changing proxy/version touches 3 files in lockstep (drift already `cacheDir` vs `envDir`).
- **Android pins preview SDK 36 + AGP 8.13/Gradle 8.14.3:** API 36 is not GA (stable 35); Play Console will reject preview-targeted APK; AGP/Gradle pre-release combo is untested. Official Capacitor 8 template pins 35/8.7/8.12.
- **`workbox-window` placeholder?** Kept correctly per `plans/010-dead-code-removal.md` death certificate (`virtual:pwa-register/react` needs it) — but the placeholder file `docs/CONTENT_CREATOR_AI_TEMPLATE.md` exists at repo root (`.pi/settings.json` diff shows untracked) and should be checked for staleness if it is a placeholder vs a real doc. The real tech-debt is Vite base, not workbox duplicate.

## Current state

- **`vite.app.config.ts:17-45` / `vite.admin.config.ts:8-48` / `vite.landing.config.ts:10-38` verbatim:**
```ts
const pkgVersion = JSON.parse(readFileSync(resolve(...,'package.json'),'utf8')).version;
const buildTime = new Date().toISOString();
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pkgVersion)) throw new Error(`invalid ...`);
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8090';
const apiProxy = { '/api': { target: apiTarget, changeOrigin: true } };
define: { __APP_VERSION__: JSON.stringify(pkgVersion), __BUILD_TIME__: JSON.stringify(buildTime) }
```
  Delta is plugins: `VitePWA` in app, `tailwindcss` in landing.

- **`android/variables.gradle:2-4`:** `compileSdkVersion=36`, `targetSdkVersion=36`, `minSdkVersion=24`.
- **`android/build.gradle:12`:** `classpath 'com.android.tools.build:gradle:8.13.0'`.
- **`android/gradle/wrapper/gradle-wrapper.properties:3`:** `gradle-8.14.3-all.zip`.
- **`package.json:108`:** `workbox-window:7.4.1` direct + transitive via `vite-plugin-pwa` — intentionally kept (plan 010). Do not remove.
- **`package.json:38`:** `vite@8.1.5` pre-release major — keep for now (downgrade is controversial and out of scope unless 035 wants it; choose not to here).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install` | exit 0 |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Builds | `pnpm build:app && pnpm build:landing && pnpm build:admin` | each emit `dist-*` deterministic |
| Android | `pnpm android:build:debug` (if Gradle present) | assembleDebug exit 0; APK `dist-app` assets present |
| Mobile check | `node scripts/check-android-version.mjs` | version triple consistent, SDK 35 |
| Audit | `pnpm audit --prod --audit-level high` (local, npmjs registry outside CI may be blocked) | exit 0 or HIGH advisory only if advisory exists |

## Scope

**In scope** (the only files you should modify):
- `vite.base.ts` (new — shared helpers: `versionDiagnostics(root)`, `apiProxyConfig()`, `cacheDirConfig(name)`)
- `vite.app.config.ts`, `vite.admin.config.ts`, `vite.landing.config.ts` (thin wrappers importing base)
- `android/variables.gradle`, `android/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties` (pin alignment)
- `scripts/check-android-version.mjs` (extend assertion to `compileSdk <=35` if not already)
- `docs/ARCHITECTURE.md` or comment header noting base extraction (optional one-line)

**Out of scope** (do NOT touch, even though they look related):
- `package.json` dependency bumps (`vite`, `workbox-window`) — downgrade is MED risk, keep pins.
- Any `server/pb_hooks/**` or `deploy/**`.
- `docs/CONTENT_CREATOR_AI_TEMPLATE.md` — if untracked placeholder, just flag in maintenance notes; do not delete.

## Git workflow

- Branch: `advisor/035-vite-base-ci-audit`
- Commits: 1) `build(vite): extract vite.base.ts shared helpers` 2) `chore(android): align compileSdk to 35, AGP 8.7, Gradle 8.12`
- Do NOT push unless instructed.

## Steps

### Step 1: Extract `vite.base.ts`

Create `vite.base.ts` at repo root:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function versionDiagnostics(root: string) {
  const pkgVersion = JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version as string;
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pkgVersion)) throw new Error(`invalid package.json version: ${pkgVersion}`);
  return { pkgVersion, buildTime: new Date().toISOString() };
}
export function apiProxyConfig() {
  const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8090';
  return { '/api': { target: apiTarget, changeOrigin: true } };
}
export function cacheDirConfig(name: 'app'|'admin'|'landing') {
  return `../node_modules/.vite-${name}`;
}
```

Each `vite.*.config.ts` becomes:

```ts
import { defineConfig } from 'vite';
import { versionDiagnostics, apiProxyConfig, cacheDirConfig } from './vite.base';
const { pkgVersion, buildTime } = versionDiagnostics(import.meta.dirname ?? '.');
export default defineConfig({
  cacheDir: cacheDirConfig('app'),
  server: { proxy: apiProxyConfig() },
  define: { __APP_VERSION__: JSON.stringify(pkgVersion), __BUILD_TIME__: JSON.stringify(buildTime) },
  plugins: [ /* surface plugin */ ],
  build: { outDir: '../dist-app' }
});
```

Adjust `resolve` root per surface (`landing` uses `root:'landing'` + `envDir`). Keep all three building.

**Verify**: `pnpm build:app && pnpm build:landing && pnpm build:admin` all exit 0; `pnpm verify:fast` exit 0; `grep -n "vite.base" vite.*.config.ts` hits 3.

### Step 2: Align Android pins to Capacitor template GA

Edit:

- `android/variables.gradle`:
```
compileSdkVersion = 35
targetSdkVersion = 35
minSdkVersion = 24
```
- `android/build.gradle:12`:
```
classpath 'com.android.tools.build:gradle:8.7.0'  // or 8.7.2 if Capacitor 8.4.2 template says so — check `npx cap --version` + template tag capacitor@8.4.2
```
- `android/gradle/wrapper/gradle-wrapper.properties:3`:
```
distributionUrl=https\://services.gradle.org/distributions/gradle-8.12-all.zip
```

Confirm template source: `https://github.com/ionic-team/capacitor/blob/capacitor%408.4.2/android-template/variables.gradle` vs local; match it. If local `capacitor.config.json` `webDir=dist-app` mismatched, keep as is.

**Verify**: `node scripts/check-android-version.mjs` — extend to assert `compileSdk <=35` (if not already). Run `pnpm android:build:debug` if Gradle is present locally; if not present, at least `node scripts/check-android-version.mjs` must exit 0.

### Step 3: Add structural guard for Vite base import

Extend `tests/docs-drift.test.mjs` (from plan 023) or `shared/build-boundary.test.ts` to assert each `vite.*.config.ts` imports `vite.base.ts`:

```js
for (const cfg of ['vite.app.config.ts','vite.admin.config.ts','vite.landing.config.ts']) {
  const src = readFileSync(cfg,'utf8');
  assert.ok(src.includes("from './vite.base'") || src.includes('from "./vite.base"'), `${cfg} must import vite.base`);
}
```

Keep existing doc-drift assertions.

**Verify**: `npx vitest run tests/docs-drift.test.mjs` or `shared/build-boundary.test.ts` pass.

### Step 4: Audit placeholder doc (no deletion)

Check `docs/CONTENT_CREATOR_AI_TEMPLATE.md` exists at repo root (untracked per `git status` `?? docs/CONTENT_CREATOR_AI_TEMPLATE.md`). If it is a placeholder template duplicated in `docs/CONTENT_PIPELINE.md`, just add a note in commit body. Do not delete it in this plan (out of scope).

## Test plan

- **Structural:** Vite base import assertion, Android version triple (`gradle.properties` ↔ `build.gradle` ↔ `cap` template) via `scripts/check-android-version.mjs`.
- **Build:** three `vite build` deterministic.
- **Regression:** `pnpm verify:fast` green; `pnpm verify:full` header suite counts already fixed in plan 023.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f vite.base.ts` and `grep -q "versionDiagnostics" vite.base.ts` and `grep -q "apiProxyConfig" vite.base.ts`
- [ ] `grep -l "vite.base" vite.app.config.ts vite.admin.config.ts vite.landing.config.ts | wc -l` == 3
- [ ] `grep -q "compileSdkVersion = 35" android/variables.gradle` and `grep -q "gradle:8.7" android/build.gradle` and `grep -q "gradle-8.12" android/gradle/wrapper/gradle-wrapper.properties`
- [ ] `node scripts/check-android-version.mjs` exits 0 and output mentions 35
- [ ] `pnpm build:app && pnpm build:landing && pnpm build:admin` exits 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- `vite@8.1.5` with `rolldown` bindings breaks on `vite.base.ts` ESM import (use `createRequire` vs `import.meta.dirname` — report actual error).
- Capacitor 8.4.2 template no longer at `compileSdk 35` (then align to whatever `capacitor@8.4.2` template actually says; do not guess).
- `pnpm android:build:debug` fails due to missing Android SDK/NDK locally (expected) — then verify via `check-android-version.mjs` only and report.
- You need to bump `vite` major or remove `workbox-window` — out of scope for this tech-debt slice.

## Maintenance notes

- Future surface (e.g. `vite.ops.config.ts`) must import `vite.base.ts` — the structural guard will catch missing import.
- Quarterly `pnpm android:sync` drift check should compare `variables.gradle` to `capacitor@<pinned>` tag; consider a Renovate rule or `scripts/check-android-version.mjs` CI gate (already exists).
- Do not re-introduce `pnpm-workspace.yaml` — repo keeps `pnpm.minimumReleaseAgeExclude` in `package.json` per `AGENTS.md` "no workspace" rule.

