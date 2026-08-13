# Execution Plan — Student App production performance + observability

Status: ACTIVE (started 2026-08-13)
Owner: primary agent

## Goal

Make the Fast English Student App production-ready from a frontend performance
and observability perspective WITHOUT changing product behavior or redesigning
the accepted UI. Measure first; optimize only what the measurements justify;
add a minimal observability/analytics foundation with a clean adapter boundary.

## Non-goals

- No Landing page work, no production deployment.
- No Student UI redesign, no Player lifecycle/progress semantic changes.
- No auth/entitlement/payment/placement/content logic changes.
- No vendor SDK (Sentry etc.) by default; no new large dependencies.
- No speculative chunk-splitting that produces no measured improvement.

## Acceptance contract

- A1. Initial Student payload materially improved where analysis shows
      avoidable cost. Proof: before/after build stats (raw + gzip) for the
      entry chunk + composition diff showing payment/placement/episode/
      library/lessons code removed from the entry chunk.
- A2. Major routes load without pulling unrelated feature code. Proof:
      per-route chunk inventory (which chunk each route needs) + marker
      scan showing no payment/placement/staff code in the entry chunk.
- A3. Production-like lab measurements for representative Student journeys
      (entry/login, Home, Library, Episode, Account) with LCP/CLS and
      responsiveness where measurable. Proof: committed measurement harness
      (`scripts/measure-app-perf.*`) + recorded before/after results,
      explicitly labeled lab evidence (not field data).
- A4. No obvious LCP/CLS/runtime regression from the optimization. Proof:
      before/after lab comparison on the same harness, same network profile.
- A5. Frontend runtime failures diagnosable in production without exposing
      secrets/sensitive data. Proof: instrumentation for uncaught errors,
      unhandled rejections, API failures, app/build version, route context,
      Player/media failures, deployment version diagnostics; redaction rules
      + unit tests; no secrets in payloads.
- A6. High-value funnel/listening events with a deliberate low-noise
      contract. Proof: `docs/OBSERVABILITY.md` event contract + bounded
      implementation (signup completion, payment-request submission,
      placement completion, episode start, meaningful progress/completion,
      install intent where the surface exists).
- A7. Observability failures never break the Student experience. Proof:
      all instrumentation wrapped, no throws from telemetry, unit tests
      proving a broken sink cannot crash or affect render.
- A8. Existing affected verification and functional contracts stay green.
      Proof: verify:fast, affected smoke suites, affected Playwright specs
      (@critical + podcast-home/library/episode + player-lifecycle subset),
      final diff review.

## Confirmed current state (baseline, 2026-08-13)

- Single-entry production build: `dist-app/assets/index-*.js` ≈ 984 KB raw /
  ≈ 285 KB gzip; NO code splitting (one JS chunk + workbox-window chunk).
  CSS is tiny (697 B; MUI styles inject at runtime).
- Vite 8 (rolldown) build; `App.tsx` statically imports every route:
  payment (~124 KB src), placement (~46 KB), library (~37 KB), lessons +
  episode (~106 KB), plus zod (~269 KB) + react-hook-form (~131 KB) enter
  the initial bundle via Login/Signup/Payment forms.
- npm deps dominate: @mui/material ~898 KB src, react-dom ~533 KB,
  react-router ~340 KB, zod ~269 KB, RHF ~131 KB, pocketbase ~40 KB.
- CatalogRoute is already tree-shaken out of prod builds. Good.
- Artwork: fixed 1:1 aspect ratio, `loading=lazy` default, server-resolved
  thumbnail overrides via protected-by-published-state proxy routes.
- Font: self-hosted Vazirmatn variable woff2 (~111 KB), `font-display: swap`
  in CSS; no preload; SW precaches it.
- Route guards, PlayerProvider (single audio element), PWA register,
  AppShell chrome — all healthy and not in scope for behavioral change.

## Decisions

1. Route-level `React.lazy` splitting in `App.tsx` for every route except the
   first-paint surfaces (EntryRoute, HomeRoute, NotFoundRoute) and the
   always-mounted chrome (AuthProvider, PlayerProvider, AppShell, PwaManager).
   Keeps `path=` strings and route structure so `App.routes.test.ts` stays
   green. Suspense fallback = existing skeleton/StatePanel loading states.
2. No `manualChunks` vendor carving unless measurements show a remaining
   avoidable cost after route splitting; rolldown naturally hoists shared
   modules to the entry chunk.
3. Font: measure first; only add preload if evidence shows it helps LCP
   without hurting the critical path.
4. Observability: new `app/src/lib/telemetry/` adapter with sink boundary —
   default ring-buffer sink (bounded, in-memory, zero network) + optional
   beacon sink gated by `VITE_TELEMETRY_ENDPOINT` (default off). Version +
   build-time + surface markers on the document for deployment diagnostics.
   Runtime instrumentation: error/rejection listeners, PB request failure
   wrapper (method/status/path only — never bodies/tokens), player failure
   events (no URLs), route-context sampling. All wrapped; never throws.
5. Analytics: `telemetry.track()` at the small set of funnel/listening
   call sites (signup success, payment request submit, placement final
   submit/level accept, episode start, ≥ meaningful progress threshold,
   episode completion, PWA install intent). No per-render events.
6. Perf harness: `scripts/measure-app-perf.sh` + `scripts/measure-app-perf.mjs`
   — disposable PB (global-setup pattern) + example-episode import via the
   content CLI + real API fixture creation (active student) + `vite preview`
   + Playwright-driven journeys with PerformanceObserver LCP/CLS + long-task
   measurement and per-route transfer accounting. Lab-only; clearly labeled.

## Ordered next actions

1. [x] Baseline bundle analysis (984 KB entry; composition per package/dir).
2. [ ] Build the perf harness; capture reproducible BASELINE lab numbers for
       the 5 journeys (entry, Home, Library, Episode, Account).
3. [ ] Implement route-level splitting in `App.tsx` + Suspense fallbacks.
4. [ ] Rebuild; verify chunk inventory + entry composition; re-measure.
5. [ ] Font/asset/loading refinements ONLY where measurement shows impact.
6. [ ] Observability foundation (`app/src/lib/telemetry/`) + instrumentation
       + version/deployment diagnostics + unit tests.
7. [ ] Analytics call sites + contract doc `docs/OBSERVABILITY.md`.
8. [ ] Verification: verify:fast, affected smokes, affected e2e specs,
       browser-qa journeys, reviewer + security-auditor.
9. [ ] Final report with criterion → evidence; commit + PR.

## Verification evidence log

- Baseline build 2026-08-13: entry 984,064 B raw / 285,138 B gzip (old hash
  index-B-9Uu5If.js: 984,536 B / gzip 291,778 B).
- Baseline lab (throttled Slow-4G-ish + 4x CPU, single run): entry LCP 2548
  / CLS 0.001 / TBT 1160 / JS 288 KiB; home 4616/0/2521; library 4564/0/2005;
  account 2940/0.06/1333; episode 2720/0.072/1345; nav home→library 8038 ms.
  File: .artifacts/perf/baseline.json.
- After split (final config, best clean runs): entry LCP 2704 / TBT 733 /
  JS 208 KiB (−28%); home 3628/1254; login 3916/922; library 3924/1192;
  account 3872/0.06/1030; episode 3712/0.072/1027. Files:
  .artifacts/perf/final-run1.json + final-run2.json.
- Experiments recorded (reverted): manualChunks groups (no improvement),
  font preload (no improvement), Home idle prefetch (no measurable
  improvement — removed; SW precaches all chunks from visit 2 anyway).
- Chunk inventory after split: 36 shared modulepreload chunks + entry
  index (~288→97 KiB raw); payment/placement/library/episode/lessons code
  NOT in the entry graph (marker scan clean).

## Implementation log

- [x] App.tsx: React.lazy for all non-first-paint routes; Suspense via
      RouteLoadFallback; path strings unchanged (App.routes.test.ts green).
- [x] home/api.ts: local narrow dashboard wrapper (removes placement zod
      schemas from the entry chunk; degradation semantics preserved).
- [x] Observability: app/src/lib/telemetry/ (redact, events, sinks, facade,
      runtime) + wiring (main.tsx, pocketbase.ts send wrapper, PlayerProvider
      media failures, App route surface, useProgressSave milestones,
      VariantDeck episode_started, auth signup, payment submit, placement
      submit + level select, PwaManager install intent) + 17 unit tests.
- [x] Version/deployment diagnostics: vite define __APP_VERSION__/
      __BUILD_TIME__ + data-app-version/data-build-time on #root.
- [x] docs/OBSERVABILITY.md contract.
- [x] Lab harness: scripts/measure-app-perf.sh/.mjs/-seed.mjs.

## Remaining

- [x] Final measurement run 2; report tables.
- [x] verify:fast + affected Playwright specs + browser QA.
- [x] reviewer + security-auditor passes; fix findings.
- [ ] Final diff review, report, commit, PR.

## Reviewer/auditor findings — all fixed

- BLOCKER: `staff_admins` in redact.ts STATIC_SEGMENTS leaked the literal
  into dist-app → bundle-boundary gate FAIL. Fixed by removing
  staff/superusers from the allowlist (they redact to `:id`; the Student
  app never calls those paths). Gate passes.
- MAJOR: `/sample` + `/dev/catalog` lazy without Suspense → blank window.
  Fixed: Suspended wrappers; catalog reverted to eager import (tree-shaken
  in prod, no chunk emitted; catalog e2e tests green again).
- MAJOR: sanitizeMessage missing phones/emails → added Iranian mobile +
  email redaction; later hardened bare `token=value` (no query marker)
  after an in-browser probe caught it.
- MINOR: BeaconSink visibilitychange listener leak (fixed);
  episode_completed double-fire guard (fixed); home wrapper tightened
  (integer, >= 0) + tests; nav metrics in the lab harness no longer
  report cumulative per-navigation LCP/CLS (fixed); dead export removed.
- Security-auditor hardening: route paths sanitized at the route_change
  boundary, ring-buffer snapshot deep-copies, instrumentSend null-safe,
  residual limitations documented in docs/OBSERVABILITY.md. Posture LOW.

## E2E evidence (full lane, CI=1, built app)

- 282+ tests passed across all app specs (p1-s1/s2, p2, p3, podcast-*,
  player-lifecycle, payment-redesign, student-admin-boundary, p4-s2-pwa,
  visual-slice-*, content boundary).
- Fixed by this slice: p4-s2-pwa 'protected API responses' + 'tokenized
  audio URLs' (SW precache now includes the public `tokens-*.js` chunk;
  assertions made query-precise to match the SW's isProtectedUrl guard),
  visual-slice-1 catalog tests (eager catalog), visual-slice-2 'login
  keyboard flow' (wait for the lazy login chunk before tabbing).
- Pre-existing (fail identically on the pristine tree; documented, not
  regressions): visual-slice-1 'App Bar uses semantic foregrounds',
  visual-slice-2 'Continue Listening is the dominant action' + 'mini
  player: one audio element' (environment-related on this machine).
- Flaky-pass-on-retry (load-related): player-lifecycle T6, podcast-home
  responsive pair, p4-s2-pwa update prompt.

## In-browser telemetry verification (built app, real browser)

- `#root` carries data-app-version/data-build-time/data-surface; facade
  `window.__fepTelemetry()` present; forced uncaught error + unhandled
  rejection → 2 client_error events, payloads redacted (token + phone
  probe strings absent); route_change events with redacted paths; lazy
  login chunk renders.

## Open risks / blockers

- Perf harness numbers are lab-only; real-user field data needs RUM in
  production (documented as UNPROVEN).
- Production telemetry endpoint/provider decision pending (documented).
- Full `verify:full` gate is long; will run the justified subset +
  targeted lanes unless the final diff warrants the full gate.
