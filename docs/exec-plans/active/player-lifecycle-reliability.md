# Slice 8 — Player Lifecycle Reliability (audio reliability across navigation, lifecycle, interruptions, Android/PWA)

Status: active
Updated: 2026-07-11 (e2e suite written, all 8 green twice)

## Goal

Make Fast English Podcast audio playback reliable across Student SPA navigation, background/foreground transitions, interruptions and the Android/PWA lifecycle — with one authoritative Player (existing PlayerProvider single `<audio>` host), honest degradation where the platform forbids background playback, Media Session integration as progressive enhancement, and every protected invariant preserved.

## Non-goals

- No redesign of Deck, MiniPlayer, Home, Library, Episode page.
- No downloads/offline audio, playlists, queueing, autoplay recommendations, CarPlay/Android Auto, lock-screen artwork generation, notification redesign.
- No second Player implementation (no native ExoPlayer/foreground service; Media Session only mirrors the web `<audio>` element).
- No performance/analytics/monitoring/Landing/deployment/release work.

## Acceptance contract (status as of 2026-07-11 e2e green)

| Criterion | Status | Evidence so far | Proof still required |
|---|---|---|---|
| A1 — one authoritative player across SPA navigation | PROVEN (e2e) | T1 green: single `audio[preload=metadata]` across Home/Library/Progress/Account + return; position advances (>= leaving+1), no restart; MiniPlayer follows | — |
| A2 — background/foreground honesty, no fabricated/duplicate Progress | PROVEN (e2e) | T2 green: frozen-return in one evaluate → paused UI, rate re-applied to 1.25, playbackState 'paused', revision delta == 1, furthest monotonic | — |
| A3 — Media Session metadata/playbackState/positionState sync + clear | PROVEN (e2e) | T3 green: metadata title/artist/artwork, states, clamped positionState (duration 599-601), 6 actions registered; stop → element removed + metadata null + 'none' | — |
| A4 — external controls drive the same player, obey Progress semantics | PROVEN (e2e) | T3 green: captured real handler closures: pause/seekto(30)/seekforward(+10)/seekbackward(±10 fallback)/play/stop; saved progress ≈ 30 after seekto | — |
| A5 — variant switch / pronunciation / retry / entitlement loss / teardown consistency | PROVEN (e2e) | T4 (prefs survive remount incl. volume 0.5 + rate 1.25; B1 practical saved; B2 fresh; metadata follows), T5 (exclusivity: pause, no writes during clip, playing count <=1, metadata unchanged), T6 (error UI, practical saved, fresh token URL, resume from target), T8 (logout: 0 elements, mini player gone, MS cleared) green | — |
| A6 — unsupported Media Session degrades safely | PROVEN (e2e) | T7 green: getter-stubbed-undefined; play/pause/seek work; surface probed > 0 times; no page errors | — |
| A7 — existing behavior + server entitlement boundaries unchanged | PROVEN (full gate) | no server code changed; nonce provably inert (proxy reads only `token`); podcast-domain SMOKE suite green in `verify:full` project gate; ALL 16 smoke suites + builds + topology + PWA + Android checks green | full Playwright suite green on the built app — CLOSED 2026-08-12: pre-existing fixture-multiplication debt fixed (idempotent owned seeding in podcast-library/episode/domain/visual-slice-2/player-lifecycle; per-Student rate-budget splits; PWA-toast-scoped locators; stale Slice-7-surface assertions updated in podcast-domain); `scripts/verify-full.sh` fully green locally (384 passed / 12 env-gated skipped); CI run pending |

## Confirmed current state (recovered from working tree)

### Completed and locally verified

- **Pure lifecycle module** `app/src/features/player/lifecycle.ts` (176 lines) + `lifecycle.test.ts` (159 lines): bind transitions (fresh/same/soft-refresh), retry-restore guard (`decideResumeTarget`), user-seek override (`resolveUserSeek`), visibility reconciliation (`reconcileSnapshot` — maps real element state only, never emits a save signal), position clamp. 17 unit tests passing.
- **Media Session adapter** `app/src/features/player/mediaSession.ts` (139 lines) + `mediaSession.test.ts` (187 lines): `MediaSessionHost` interface, `getMediaSessionHost`, `buildMediaMetadataPayload`, `clearMediaSession`, `createMediaSessionHandlers` (pure closures over a controller), `registerMediaSessionActions` (per-action capability capture). 14 unit tests passing (fake host + fake controller).
- **PlayerProvider integration** `app/src/features/player/PlayerProvider.tsx` (730 lines, +428): session-generation guard (stale `play()` promises dropped), bind soft-refresh for same-Variant new source (preserves practical position via pending seek + retry restore), element-mount preference re-apply (volume/rate/mute), visibility reconcile listeners (`visibilitychange` visible / `pageshow` persisted / `resume`), Media Session effects (metadata/playbackState/positionState throttled at 0.5s + one-time action registration), `retry()` arms practical-position restore, `handleError` saves practical position when > 0.5s, logout clears session + Media Session, `PlayerSession` gains optional `artwork`.
- **Route wiring** `app/src/features/lessons/routes/LessonDetailRoute.tsx`: session gains resolved artwork URL (`api.resolveMediaUrl`); `onRetry` now ALWAYS rebuilds the protected URL with a fresh PB file token (sequence-guarded) instead of reloading the same expired URL.
- **Progress hide-flush** `app/src/features/progress/useProgressSave.ts`: visibilitychange-hidden + pagehide flush of the newest REAL pending position (never invented).
- **One deliberate design fix** (2026-07-11): `handleLoadedMetadata` clears `pendingSeekRef` but KEEPS `retryRestoreRef` armed until saved Progress catches up or explicit user intent supersedes it — a stale CTA label (older save) can never regress the practical position after a retry.

### Verification already executed

- `npx tsc --noEmit` — clean.
- `npx biome check` on all changed files — clean (one fixable lint fixed).
- `npx vitest run` — 743/743 passing (includes 31 new player tests; two initial test-expectation bugs found and fixed).
- Probes in real headless Chromium (temporary `e2e/zz-probe.spec.ts` — MUST be deleted):
  - CDP `Input.dispatchKeyEvent` media keys do NOT reach Media Session handlers in headless → A4 handler exercise at the smallest faithful layer = real-browser harness capturing the closures the real provider registered, then invoking them; plus unit-level handler-controller tests. OS media-key delivery remains device/emulator-dependent (unproven).
  - `navigator.mediaSession.positionState` is NOT readable in Chromium → e2e observes `setPositionState` calls via an observation harness (patched `Navigator.prototype.mediaSession` getter with a recording proxy).
  - ffmpeg available (`/usr/bin/ffmpeg`); 600s silent MP3 generated (4.8MB, `test-results/player-lifecycle-probe.mp3` — temp artifact); buffered range [0, 524] at 3.5s of playback → mid-playback failure simulation = block audio route + seek beyond live `buffered.end` within ~0.5s of play start (race margin 15s), error event retains element position.

### Not yet done

- `e2e/player-lifecycle.spec.ts` — WRITTEN, 8/8 green twice (2026-07-11).
- `pnpm verify:fast`, affected e2e specs, reviewer/security-auditor passes, Android compile evidence, `docs/ARCHITECTURE.md` update, `pnpm verify:full`, delivery.

### Known constraints / environment facts

- Working tree on branch `update-pi-workflow` carries accepted-but-uncommitted prior work (harness migration + Slices 1–7). Delivery = scoped task branch committing the accepted tree state; never touch `main` directly. `main` is at aa46bc4 lineage; no remote branch exists for this work yet.
- Server progress semantics (verified in `server/pb_hooks/progress_routes.pb.js`): `position_seconds` is written as-sent; only `furthest_seconds`/`completed` are monotonic. Lesson audio FileField maxSize 10MB (600s@64k = 4.8MB fits). Audio proxy re-validates entitlement per request; Range 206 supported.
- CI (`scripts/verify.sh` on ubuntu-latest) has ffmpeg; local has it. The spec's beforeAll should FAIL LOUDLY if ffmpeg is unavailable (long clip is required for nearly all tests).
- Media Session in the Capacitor WebView follows the same web code paths; hardware lock-screen controls/background audio on Android remain UNPROVEN (no device attached) — must be marked unproven in the final report.
- `useProgressSave` pause-save writes the real element position; with the 2s fixture this regresses seeded `position_seconds` — tests assert `furthest_seconds` monotonicity and revision deltas instead.

## Relevant surface

- `app/src/features/player/PlayerProvider.tsx`, `lifecycle.ts`, `mediaSession.ts` (+ tests)
- `app/src/features/lessons/routes/LessonDetailRoute.tsx` (session artwork, retry rebuild)
- `app/src/features/progress/useProgressSave.ts` (hide flush)
- `app/src/features/episode/components/VariantDeck.tsx` (unchanged; binds via provider)
- `e2e/podcast-episode.spec.ts` (seeding + playback patterns to mirror)
- `scripts/verify-fast.sh`, `scripts/playwright-fast.sh` (lanes), `.pi/verification.json` (app/** → frontend-fast)
- `docs/ARCHITECTURE.md` (player section to update)

## Decisions

- Keep the single-element architecture; all fixes live in PlayerProvider + pure modules — no second player, no native changes.
- Pure-logic modules (repo pattern: useProgressSave helpers, pronunciationPlayback) keep every meaningful decision unit-testable; provider stays a thin adapter.
- Soft refresh (same lesson + new src) is THE retry/token-rebuild path; it preserves session, practical position (pending seek + restore guard) and preferences.
- Reconcile never writes Progress itself; the element's own pause event stays the single pause-save writer (no duplicate writes).
- Media Session is progressive enhancement: null host → no-ops; per-action try/catch; metadata cleared on stop/logout/invalid session; pronunciation never touches it (episode pause flips playbackState to 'paused' = honest exclusive state).
- e2e media-session evidence via observation harness (patched prototype getter recording metadata/playbackState/setPositionState/action registrations + capturing handler closures), because headless Chromium cannot deliver OS media keys and does not expose positionState.
- Retry always rebuilds the protected URL (fresh file token); provider retry() calls onRetry and only falls back to `audio.load()` when no rebuild callback exists.
- Android: no native changes; evidence = `cap sync` + `assembleDebug` compile; hardware behavior explicitly unproven.
- **T6 mechanism (H1 falsified by direct measurement):** through the dev proxy the WHOLE clip rides ONE long-lived response stream — the element issues NO range requests (buffered grows to [0,600] with ZERO requests visible to Playwright; route blocks on new requests cannot interrupt playback). The faithful mid-playback failure = `audio.load()` after a real seek: it aborts the stream and issues a FRESH fetch that hits the block; the load-algorithm pause carries the REAL pre-reset position (proven by the transient pause in T1), so the practical position is saved through the normal pause-save writer. The element resets to 0 before retry, so the retry restore cannot arm from state; the resume happens through the CTA derived from the SAVED practical position («ادامه از 0:30») — observable contract proven.
- **Retry-rebuild same-second token bug (REAL, fixed):** PB's `/api/files/token` returns a byte-identical JWT for calls within the same second (verified empirically — no iat/jti in the payload). The route's retry rebuild could therefore produce a URL equal to the current one; React then bails out of the re-render (Object.is on the state) and the source never reloads — the retry dead-ends (this was the podcast-episode test 10 regression root cause). Fix: `setAudioUrl(current => current === url ? url + '&_r=' + Date.now() : url)` — a cache-busting nonce the audio proxy ignores (it only reads `token`).
- **Deck CTA while reloading (REAL, fixed):** `retry()` clears hasError optimistically BEFORE the rebuilt source is ready; a fast CTA click then calls play() on the still-broken element → rejection → the error returns. The CTA is now disabled while `player.isLoading` (the click auto-waits; the old flow skeletonized the whole deck during retries).
- **Server finding (out of scope, documented):** `lesson_progress.position_seconds`/`furthest_seconds` are required NumberFields and PB 0.39.9 rejects 0 on required numbers ('cannot be blank') — a PUT with positionSeconds 0 returns 500 (hook does not map it to 400). Unreachable from the app UI (every save is a real position > 0; handleError guards > 0.5s) and from smoke suites (all saves > 0). e2e resets "fresh" by DELETING the progress record via the rule-free superuser instead of writing 0.
- **RTL finding:** the app is RTL and MUI flips range-input arrows in RTL (ArrowRight DECREASES) — the volume-slider keyboard path uses Home + 10×ArrowLeft. Volume lands at 0.49999999999999994 (float accumulation) — assert toBeCloseTo(0.5, 2).
- **Pre-existing spec fixes (gate blockers, accepted specs were never validated under suite composition):** (a) podcast-library hard-coded visible counts (13/7/2) that only hold in isolation — now DERIVED from the live PB with the Library route's own rule (published topics × published category × ≥1 published variant matching the level filter; `level=all`/preferred = the resolution fallback, not a strict filter); (b) podcast-episode's single-shot progress reads + deck-height measurement hardened into polls (transient frames under load); (c) the 9b flake root cause: under full-suite load single-shot GETs return anomalous responses — polled reads are structurally immune.

## Evidence

- Unit: `npx vitest run app/src/features/player` — 31/31 passed (2026-07-11).
- Full unit: `npx vitest run` — 743/743 passed.
- Type/lint: `npx tsc --noEmit` clean; `npx biome check` clean on changed files.
- Browser probes: media keys unavailable in headless; positionState unreadable; buffering behavior measured ([0,524]/600s at 3.5s); ffmpeg available.
- **e2e (2026-07-11): `pnpm test:e2e:fast -- e2e/player-lifecycle.spec.ts` — 8/8 green, three consecutive runs.**
- Affected specs: podcast-library (27/27 after count-derivation fix), podcast-episode (21/21 isolated), p3-s2 + visual-slice-2 green in combined runs.
- **Environmental finding (fast lane):** combined-suite runs intermittently hit `net::ERR_INSUFFICIENT_RESOURCES` on the Vite dev server's on-demand module fetches (~200 modules per fresh page context vs the browser's 6-connection per-origin pool, plus long-lived audio streams) — the affected pages degrade and different podcast-episode tests flake per run (9b reads, deck height, zoom, retry stage-3, prevnext). Isolated runs are consistently green. The canonical gate (verify:full) serves the BUILT app (vite preview — no transforms, ~1-2 requests/page) where this phenomenon does not exist.
- Not yet: reviewer/security-auditor, Android build, `pnpm verify:full`, delivery.

## Next actions (ordered)

1. ~~Write `e2e/player-lifecycle.spec.ts`~~ DONE — 8/8 green ×4. Probe artifacts deleted.
2. ~~Affected specs + `pnpm verify:fast`~~ DONE (podcast-library 27/27, podcast-episode 21/21 isolated, p3-s2 + visual-slice-2 green in combined runs; verify:fast green).
3. ~~Independent review~~ DONE — reviewer (no BLOCKER; MAJOR cross-Variant progress-clobber FIXED via stable id-guarded onSaved/onStaleRevision; T2 resume-dispatch FIXED to document target; poll hardenings applied) + security-auditor (no BLOCKER/MAJOR; 0-position save guard FIXED in handlePause/stop; deleteProgress loopback+escape hardening applied).
4. ~~Android compile evidence~~ DONE — `cap sync` + `assembleDebug` BUILD SUCCESSFUL (93 tasks, app-debug.apk). `docs/ARCHITECTURE.md` player/lifecycle section DONE.
5. ~~`pnpm verify:full`~~ EXECUTED — project gate GREEN; full Playwright suite on the built app BLOCKED by pre-existing full-suite debt (non-idempotent beforeAll seeding → fixture multiplication; sqlite evidence 16× «دسته آلفا» categories in one run). Slice-8 tests pass in the full lane except the T7 float boundary (fixed) and library-11 pagination derivation (fixed).
6. ~~Delivery~~ DONE — branch `slice8-player-lifecycle-reliability` (commit 366d42b), pushed, PR #1 (https://github.com/imdanialrashidi/fast-english/pull/1). Follow-up workstream: make the prior-slice e2e beforeAlls idempotent (owned-fixture dedupe), then re-run `pnpm verify:full` to close A7's full-suite e2e evidence.

## Risks / blockers

- Headless e2e cannot prove OS lock-screen/background behavior on Android hardware — emulator/device-dependent evidence stays UNPROVEN and must be labeled as such.
- T6 now uses the `audio.load()` fallback (H1 falsified: the dev proxy serves the whole clip through ONE stream; range requests never happen, so route-blocking new requests cannot interrupt playback). The mechanism is deterministic and green.
- **Fast-lane environmental flakiness (NOT a product bug):** combined fast-lane runs intermittently exhaust the browser socket pool fetching the Vite dev server's module graph (`net::ERR_INSUFFICIENT_RESOURCES`) — different podcast-episode tests degrade per run; isolated runs are green.
- **FULL-GATE BLOCKER (pre-existing, not slice 8) — RESOLVED 2026-08-12:** the canonical Playwright suite on the built app failed because the accepted prior-slice specs' `beforeAll` seeding was non-idempotent — the library/podcast-episode/podcast-domain `beforeAll`s re-run multiple times in one run, multiplying every fixture (sqlite evidence from a single run: 16 «دسته آلفا» + 16 «دسته بتا» + 16 «دسته پیشنویس» categories; episode counts 62+). Consequences: strict-mode locator collisions, hard-coded counts, pagination and geometry assertions breaking, and progress-rate-window 429s under the multiplied request volume. Fix: owned-marker idempotent seeding (fixed category keys / topic slugs / (topic, level) unique-index reuse / fixed plan slugs / card-number destination dedupe / random phone generators), per-Student rate-budget splits in podcast-episode (3 students) and visual-slice-2 (dedicated list-page identities), PWA-offline-toast-scoped alert/body locators, derived category counts, and stale Slice-7-surface assertion updates in podcast-domain (Persian H1, jacket level line, deck resume CTA). Re-entry proven: double-seed runs leave exactly-once records (3 categories / 15 topics / 18 lessons; previously 16×).
- The dirty working tree means the delivery diff includes accepted prior-slice files; commit only the accepted state, no unrelated new work.
- No unresolved product-code failures in slice 8: the retry flow, nonce and deck-CTA fixes are e2e-proven; reviewer MAJOR (cross-Variant progress clobber) and security minor (0-position save) both fixed.

## Handoff

- Changed (uncommitted, on branch `update-pi-workflow`, HEAD aa46bc4): `app/src/features/player/PlayerProvider.tsx` (integrated), `app/src/features/lessons/routes/LessonDetailRoute.tsx`, `app/src/features/progress/useProgressSave.ts`; NEW `app/src/features/player/lifecycle.ts` + `lifecycle.test.ts`, `mediaSession.ts` + `mediaSession.test.ts` (31/31 passing); NEW `e2e/player-lifecycle.spec.ts` (8/8 green twice); `docs/exec-plans/active/player-lifecycle-reliability.md`.
- Verified: `npx tsc --noEmit` clean; `npx biome check` clean on changed files; `npx vitest run app/src/features/player` 31/31; full `npx vitest run` 743/743; `pnpm test:e2e:fast -- e2e/player-lifecycle.spec.ts` 8/8 ×2.
- Remains: affected e2e specs + `verify:fast`, reviewer + security-auditor, Android compile evidence, `docs/ARCHITECTURE.md` update, `pnpm verify:full`, delivery (task branch + PR).
- Must not be overwritten: the accepted Deck/MiniPlayer/Episode design (`docs/DESIGN.md`), server entitlement hooks (`server/pb_hooks/`), prior-slice accepted-but-uncommitted work in the working tree, `main` branch.
- Resolved hypotheses: (H1) buffered-range mid-playback failure — FALSIFIED by measurement (single-stream dev-proxy delivery; no range requests); replaced by the `audio.load()` fallback the plan pre-authorized. (H2) React state flush inside a single `page.evaluate` for the frozen-return path — CONFIRMED (T2 green).
- First action for a fresh session: run the affected e2e specs + `pnpm verify:fast` (next actions #2), then reviewer/security-auditor, Android evidence, `docs/ARCHITECTURE.md`, `pnpm verify:full`, delivery.

---

Start a fresh Pi session and run `/resume docs/exec-plans/active/player-lifecycle-reliability.md`.
