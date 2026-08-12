# Quality Contract

This file defines the evaluator-facing quality bar for meaningful changes. Keep it project-specific after `/bootstrap`; do not turn it into a generic checklist dump.

## Release rule

A change is not complete because the code compiles or the happy-path test passes. Every accepted behavior must be implemented rather than stubbed, exercised at the appropriate layer, and supported by evidence.

A required criterion that is unproven is **not passed**.

## Functional completeness

For accepted scope:

- controls that imply behavior must actually perform that behavior;
- persistence must survive the lifecycle promised by the product;
- displayed state must come from the authoritative source rather than a convenient fake;
- required error, empty, loading, disabled, success, permission, retry, and recovery states must behave coherently;
- no accepted feature may be satisfied by a placeholder, TODO handler, mock response, display-only control, or hard-coded success path unless the contract explicitly says it is a prototype.

## Correctness

- Preserve domain invariants across success and failure paths.
- Validate external/untrusted data at boundaries.
- Handle retries, duplicate requests, time, rounding, ordering, partial failure, and concurrency where they are material to the changed behavior.
- A production bug should gain regression evidence when practical.
- Tests should assert behavior and contracts rather than implementation trivia.

## Security and data integrity

For trust-boundary changes, require the `risk-review` workflow.

At minimum:

- authorization and ownership are enforced server-side;
- client-provided roles, prices, payment/subscription states, ownership, and permissions are never authoritative;
- secrets and sensitive data do not enter source, logs, screenshots, fixtures, prompts, or public artifacts;
- money/callback/state-transition operations are verified, idempotent, replay-aware, and auditable where applicable;
- schema/data changes have compatibility, rollback/recovery, and failure-path reasoning.

## User-facing quality

For rendered interfaces:

- exercise the critical journey in the real browser when browser behavior matters;
- preserve keyboard access, visible focus, semantic controls, labels, contrast, touch targets, and reduced-motion behavior;
- check realistic data, long text, localization/RTL when relevant, and at least one narrow viewport for mobile-facing surfaces;
- use existing design tokens/components and avoid unrelated redesign;
- do not add explanatory copy that merely restates obvious UI;
- visual polish cannot compensate for missing interaction depth or broken behavior.

## Visual excellence (frontend design contract)

For visually significant work, the rendered interface is judged against the accepted product/design contract in `docs/DESIGN.md` and the full rubric in `.pi/skills/frontend-design/references/visual-quality-rubric.md` — never against generic taste or template defaults.

Hard gates (any failure ⇒ `NOT READY` regardless of craft):

1. The critical journey is functional; no accepted control is decorative or display-only.
2. No material overflow, clipping, unreadable overlap, broken media, or unexpected layout shift in required states (Fast English sweep: 360/375/390/430/768/1440, light and dark).
3. Keyboard order, visible focus, accessible names, semantic controls, and error identification work; RTL directionality is correct in pages and portals (dialogs/menus/popovers).
4. Color is never the only carrier of meaning; WCAG 2.2 AA contrast/reflow/zoom targets are met (Fast English: machine-verified by `shared/ui/palette.contrast.test.ts` — text ≥ 4.5:1, UI components ≥ 3:1, disabled ≥ 1.5:1).
5. Motion respects `prefers-reduced-motion` (Fast English: theme-level collapse verified in-browser; no `transition: all`, no raw durations — scanned by `static-quality.test.ts`).
6. Loading, empty, error, success, disabled, selected, and permission states required by the flow are coherent (Fast English: `StatePanel` variants + per-flow states).
7. No uncaught console error or failed critical request remains (browser console/network evidence required).
8. Accepted pre-release performance budgets are met: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 as production targets; before field data exists, a repeatable lab baseline plus RUM instrumentation is required — never claim field performance from Lighthouse alone.

Craft score: each of the eight rubric dimensions (brief fidelity, hierarchy, typography, color/material, system coherence, interaction/motion, content/state design, finish/responsiveness) is scored 0–4.

- Ordinary production UI: all hard gates pass, average ≥ 2.75, no dimension below 2, and brief fidelity, hierarchy, and system coherence each ≥ 3.
- Flagship/launch/high-aesthetic surface (the Fast English Student App is treated as one): all hard gates pass, average ≥ 3.25/4, no dimension below 3, and the accepted signature element scores 3 or 4 on both specificity and execution.

Anti-template review: flag any choice not justified by the Fast English brief — interchangeable gradient/glow/glass effects, a generic hero plus statistic cards, a wall of equally rounded floating cards, decorative numbering/badges, fashionable type pairings without a subject rationale, or animation everywhere instead of one composed moment. For the Student App specifically, the accepted language is the calm midnight/ice M3-inspired semantic system in `shared/ui/tokens/` with restrained elevation, self-hosted Vazirmatn, and honest Persian copy (`docs/DESIGN.md`, `app/src/app/copy/productCopy.ts`).

Findings use the rubric's severity format (BLOCKER/MAJOR/MINOR/NIT) with route/state/viewport evidence, the violated dimension, the user-visible consequence, the smallest coherent fix, and the proof needed to close it.

## Reliability and performance

Apply only where relevant to the changed path:

- avoid unbounded reads/work, N+1 access, duplicate calls, uncontrolled concurrency, and blocking hot paths;
- use explicit timeouts/cancellation/retries where the boundary requires them;
- preserve meaningful non-sensitive logs or diagnostics for critical transitions;
- performance claims require a reproducible baseline and after-measurement;
- a flaky test or intermittent runtime path is a reliability defect, not automatic permission to weaken the gate.

## Maintainability and architecture

- Prefer existing project patterns and stable framework/platform primitives.
- Keep public interfaces small and backward-compatible unless a breaking change is accepted.
- Keep business rules separable from presentation/transport when the existing architecture supports it.
- New abstractions should solve more than one real current use case or remove a demonstrated risk/duplication.
- New dependencies require a concrete benefit over existing/platform capabilities.
- Architecture invariants that matter repeatedly should be enforced mechanically with types, lint rules, structural tests, schemas, or CI rather than prose alone.

## Evidence hierarchy

Prefer stronger evidence when practical:

1. deterministic automated test of the accepted behavior;
2. real browser/API/database exercise of the relevant journey;
3. type/lint/structural/static analysis for invariant classes;
4. reproducible measurement for performance/reliability claims;
5. focused manual inspection for aspects that cannot be automated economically.

A reviewer or subagent opinion alone is not proof.

## Evaluator rubric

An evaluator should assess the accepted contract, not invent adjacent scope.

For each acceptance criterion return one of:

- **PASS** — implementation and evidence satisfy the criterion;
- **FAIL** — evidence demonstrates incorrect/incomplete behavior;
- **UNPROVEN** — implementation may exist but adequate evidence is missing;
- **BLOCKED** — a genuine prerequisite prevents verification.

Then inspect cross-cutting regression risk only where the diff makes it relevant.

The overall task cannot be called complete while a required criterion is `FAIL` or `UNPROVEN`, or while a required independent review has an unresolved BLOCKER/MAJOR finding.

## Project-specific quality invariants (Fast English Podcast)

Confirmed from `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, the verification scripts, and the smoke suites. Do not invent targets the repository has not accepted.

### Canonical verification lanes

- `pnpm verify:fast` — everyday gate: `tsc --noEmit` + `biome check .` + Vitest. No PocketBase, no builds, no browser.
- `pnpm verify:feature [auth|payment|placement|lessons|progress|all] [app|landing|all]` — fast + the mapped real-Backend smoke group + `@critical` Playwright tests + affected build.
- `pnpm verify:full` — the canonical full application gate: `scripts/project-verify.sh` (fast + all 16 real-PB smoke suites + deterministic three-surface builds + topology/boundary checks + PWA output checks + Android version/signing fail-safe + deploy redaction proofs) followed by the full Playwright suite. `scripts/verify.sh` is the compatibility entry that delegates here for CI and release tooling; `scripts/verify-full.sh` is the executable gate.
- `pnpm test:e2e:fast [spec]` / `test:e2e:smoke` / `test:e2e:failed` — the low-resource local lane (`PW_FAST=1` via `scripts/playwright-fast.sh`): Vite dev servers only (no builds, no landing), one worker, zero retries, stop at first failure, list reporter, no video/trace/screenshots/HTML report; the disposable PocketBase setup is preserved. Never set `CI=1` locally.
- `pnpm test:e2e:full` — production-like lane (`CI=1`): built app + landing (pre-rendered) + admin served by `vite preview`, at most one retry, trace on first retry, screenshots on failure only.
- Smoke suites (`pnpm smoke:*`) start their own disposable PocketBase in a fresh `/tmp` data dir and never touch `server/pb_data/`; `scripts/pb-test-helper.sh` creates a throwaway superuser whose credentials never appear in output. The `server/pocketbase` binary is pinned by `server/VERSION` and installed via `pnpm setup:pocketbase`.

### Layer ownership (evidence expectations)

- Vitest = pure logic, schemas, formatters, state derivation, design tokens, and static guards (cross-surface build isolation, forbidden raw hex/durations, receipt-privacy contract, product-copy scanner).
- Smoke suites = the backend contract proof: routes, authz, payment idempotency, placement grading, progress concurrency, protected files, entitlement denial — always against a real PocketBase, never mocks.
- Playwright = browser-required behavior only (real user journeys, RTL/accessibility, responsive geometry, PWA cache boundary). Interactive MCP evidence is not a substitute for committed specs.

### Non-negotiable invariants (mechanically enforced)

1. **Three-surface separation.** `landing/` (static, Tailwind) → `dist-landing`, `app/` (MUI product app) → `dist-app`, `admin/` (Staff Admin Console) → `dist-admin`. No cross-surface imports; Admin never ships the Student PWA artifacts. Enforced by `scripts/check-bundle-boundaries.mjs`, `shared/build-boundary.test.ts`, and topology checks in `scripts/project-verify.sh` (steps 15–15c).
2. **Server-side authorization.** Client never sets role/account_status/subscription/payment/review/server-calculated fields; phone is canonical `+989XXXXXXXXX` and unique; staff endpoints verify `staff_admins` + `is_active` server-side (`requireStaffAdmin`); a UI guard is never authorization. Enforced by tampering scenarios in `smoke-auth`, `smoke-payment`, `smoke-operator`, `smoke-staff`.
3. **Payment integrity.** One pending request per user; resubmit only after rejection; approval + subscription creation/extend in one DB transaction; unique subscription→request link makes repeated approval idempotent; renewal starts at `max(expiry, approval)`. Enforced by `smoke-payment` / `smoke-operator`.
4. **Receipt security.** Exactly one JPEG/PNG/WebP ≤5 MB with signature/MIME/extension match; protected file field, randomized storage name; owner-only preview route; receipt URLs never in logs, responses, or the SW cache. Enforced by `smoke-payment-preview` + the deploy redaction proofs (steps 22–23 of `project-verify.sh`).
5. **Placement secrecy.** Correct answers never leave the server; exactly one accepted final submission; server-side grading. Enforced by `smoke-placement` (answer-leak assertions).
6. **Premium entitlement.** Pending/rejected/expired/suspended users are denied premium body/audio/artwork even via direct API; the audio proxy re-validates entitlement on every request (leaked file tokens grant nothing). Enforced by `smoke-lessons`, `smoke-progress`, `smoke-podcast-domain`.
7. **PWA cache boundary.** The Service Worker precaches app-shell/public assets only — never `/api/`, `/files/`, or tokenized URLs. Enforced by the precache scan in `project-verify.sh` (step 18) and `e2e/p4-s2-pwa.spec.ts`.
8. **Content pipeline integrity.** `schemas/episode-package.schema.json` (strict, `additionalProperties: false`); CLI validation mirrors server re-validation; zero-mutation dry-run plan; fingerprint idempotency; locked audit. Enforced by `smoke-content-import` + the schema step in `project-verify.sh`.
9. **Design-token discipline.** No raw hex colors, raw durations, or `transition: all` in components; tokens live in `shared/ui/tokens/` (colors, typography, spacing, shape, elevation, motion, focus, cefr); WCAG AA contrast is machine-verified. Enforced by `static-quality.test.ts`, `palette.contrast.test.ts`, `tokens.test.ts`, and the visual-slice quality gates.
10. **Product copy discipline.** Canonical Persian vocabulary (`اپیزود`, `کتابخانه`, `سطح پیشنهادی`, …) is centralized in `app/src/app/copy/productCopy.ts`; Staff terminology never appears in the Student surface. Enforced by the `podcast-slice-5.quality.test.ts` scanner.
11. **No secrets in the tree.** `.env.example` documents names only; Android signing keys come from `FEP_ANDROID_*` env vars and the release gate fails safely with `Production signing material: REQUIRED` when absent; `server/pb_data/`, keystores, and `releases/` are git-ignored; smoke wrappers suppress credentials.

### Release rule (Fast English)

- Local final delivery: `pnpm verify:full` green (or the explicitly justified subset).
- CI must run the harness doctor (`bash scripts/pi-doctor.sh --ci`) and the real full application gate, not just the fast lane.
- Release APK work additionally requires `pnpm android:verify:release` evidence (apksigner/zipalign/SHA-256) and never weakens the signing fail-safe.
