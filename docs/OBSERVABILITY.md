# Observability & Analytics (Student App)

Durable contract for the minimal production observability foundation in the
Student App (`app/src/lib/telemetry/`). Companion to `docs/QUALITY.md`
(performance budgets + evidence rules) and `docs/ARCHITECTURE.md`.

## Status summary

| Capability | Status | Where |
|---|---|---|
| Uncaught error / unhandled rejection capture | Implemented, no provider needed | `runtime.ts` + `reportError` |
| Important API/network failure capture (5xx, 429, transport) | Implemented | `pocketbase.ts` send wrapper |
| App/build version + deployment diagnostics | Implemented | build-time `define` + `data-app-version`/`data-build-time` on `#root` |
| Route/surface context (redacted) | Implemented | `App.tsx` route effect |
| Player/media failure classification | Implemented | `PlayerProvider` error path |
| Funnel/listening events (low-noise contract) | Implemented, sink off by default | `events.ts` + call sites |
| Network egress of telemetry | **Requires a decision** — OFF by default | `VITE_TELEMETRY_ENDPOINT` beacon sink |

**Evidence classification:** the performance harness (`scripts/measure-app-perf.sh`)
is LAB evidence only. Real-user field Web Vitals require RUM — either the
beacon sink pointed at an approved endpoint, or a provider decision
(see "Open production decisions" below).

## Design invariants

1. **No vendor SDK by default.** There is no Sentry/GA/etc. The whole
   foundation is ~600 lines of standard platform code (no new
   dependencies).
2. **Failure isolation.** Every public entry point and every sink is
   wrapped; observability can never throw, block, or change app behavior.
   Enforced by `telemetry.test.ts`.
3. **Privacy redaction at the boundary.** Everything entering an event
   passes through `redact.ts`:
   - API paths: query strings stripped, record-id segments → `:id`;
   - free text (error messages/stacks): token/JWT/long-random strings
     redacted, bounded length;
   - never captured: passwords, auth tokens, receipt data or URLs, private
     lesson media URLs, `MediaError.message`, phones, names, emails,
     request bodies, correct placement answers.
4. **Low-noise.** Funnel events are one-shot, user-meaningful moments.
   There is no per-render, per-second, or per-save telemetry.

## Residual privacy limitations (documented, mechanically bounded)

- **Free-text redaction is shape-based.** `sanitizeMessage` redacts
  Iranian mobile numbers (ASCII digits), emails, JWTs, bearer tokens,
  query-string tokens, and long random strings. Free-form *names* and
  Persian-digit phone numbers are NOT redacted by pattern. This is safe
  by construction today: every error emitted by the app is a static
  string (auth/payment/placement error mappers verified) and PocketBase
  validation messages never echo submitted values. If dynamic user
  values ever enter error messages, redaction must be extended first.
- **Navigation aborts/timeouts are not reported as `api_failure`.** The
  PocketBase SDK flags aborts via `ClientResponseError.isAbort`; the
  wrapper intentionally reports only 5xx, 429 and TypeError-level
  transport failures to keep navigation noise out. Timeout observability
  is therefore partial until an abort classifier is added.

## Default sink: in-memory ring buffer

Events are always recorded into a bounded (200-entry) ring buffer, exposed
read-only as `window.__fepTelemetry()` for support sessions. Zero network
egress by default. The buffer holds the same redacted events the beacon
sink would send.

## Optional beacon sink (OFF by default)

Building with `VITE_TELEMETRY_ENDPOINT=<url>` attaches a `sendBeacon`
sink that batches events (≤ 20) and flushes on `pagehide`/hidden and every
30 s. `text/plain` blob keeps the POST preflight-free. Failures are
swallowed. The endpoint must accept `application/x-www-form-urlencoded`-ish
POSTs — no endpoint exists in this repository yet; adding one (e.g. a
PocketBase hook behind `/api/fast-english/telemetry` with its own
rate-limit and redaction verification) is a deliberate production
decision, not part of this slice.

## Runtime failure events

| Event | Level | Fields | Trigger |
|---|---|---|---|
| `client_error` | error | `kind` (`uncaught` / `unhandled_rejection`), sanitized `message`, truncated `stack` | window `error` / `unhandledrejection` |
| `api_failure` | error (http) / warn (network) | `path` (redacted), `method`, `status`, `kind` | PB `send()` failures: 5xx, 429, transport-level. 4xx business errors are expected/user-facing and never reported |
| `player_failure` | warn | `lessonId`, `code` (`media_err_network`/`decode`/…, from `MediaError.code`) | shared `<audio>` error path |

## Funnel / listening events (the complete set)

| Event | Fields | Trigger |
|---|---|---|
| `route_change` | `path` (redacted) | every SPA navigation (one per navigation) |
| `signup_completed` | — | signup + auto-login succeeded |
| `payment_request_submitted` | `planId` | payment request accepted by the server |
| `placement_submitted` | — | final placement submission accepted |
| `level_selected` | `level` | activation/placement completion (level chosen) |
| `episode_started` | `lessonId` | Deck CTA pressed (start/resume/review) |
| `listening_milestone` | `lessonId`, `milestone: '50'`, `durationSeconds` | first 50% crossing per lesson session |
| `episode_completed` | `lessonId` | lesson audio `ended` |
| `install_intent` | — | browser-native `beforeinstallprompt` |

No event carries phone, name, email, receipt/transfer/payment data, media
URLs, or answer data. `lessonId`/`planId` are non-personal record ids
already present in URLs.

## Deployment health / version diagnostics

- `#root` carries `data-app-version` and `data-build-time` (injected by
  `vite.app.config.ts` `transformIndexHtml`) — readable without JS;
  `check-production-bundle.sh`-style greps and support sessions can assert
  the deployed build.
- Every telemetry event carries `appVersion` + `buildTime`.
- The bundle defines `__APP_VERSION__` / `__BUILD_TIME__` (also mirrored
  in `vitest.config.ts` for tests).

## Open production decisions (blocked on credentials/approval)

1. **Telemetry endpoint/provider.** Network egress is OFF by default. To
   collect in production, either (a) approve a minimal PocketBase hook
   `/api/fast-english/telemetry` (rate-limited, redaction-verified,
   retention-bounded) or (b) select a provider and set
   `VITE_TELEMETRY_ENDPOINT` at build time. Until then the ring buffer is
   the only capture surface — failures are diagnosable through support
   sessions but not aggregated.
2. **Field Web Vitals.** Lab numbers exist (`scripts/measure-app-perf.sh`);
   real-user LCP/CLS/INP need RUM through the chosen sink. The
   `docs/QUALITY.md` budgets (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at
   p75) are production targets, not yet field-proven.
