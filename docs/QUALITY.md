# Fast English — Quality Contract

Source: scope §20 (verification method), §23 (AC-01…AC-23), §17.4 (accessibility), §18 (devices), §11/14 (concurrency), §16 (media/security). AC wording is the scope's contract, not a current PASS claim.

## Release rule

A required criterion that is unproven is **not passed**. Only these statuses are used: **PASS**, **FAIL**, **UNPROVEN**, **BLOCKED**. A green command, an unseen screenshot, or a reviewer opinion alone is never acceptance proof. Placeholder buttons, stub handlers, fake persistence, TODO implementations, display-only controls, and hard-coded success never satisfy a criterion.

Evidence hierarchy (cheapest faithful first): deterministic Pest test on real PostgreSQL → real browser/API/DB exercise (Playwright) → type/lint/structural check (Pint, config) → reproducible measurement → real-device/staging proof where the risk demands it. Mocks never replace the authorization/transaction/storage boundary they claim to prove (§20.1). Tests run on an isolated DB, never developer/production data; time is controlled in expiry tests (§20.1).

## Project-specific invariants (binding)

- Level is content, not permission; missing level never silently substitutes (§8).
- Money is integer toman; durations are exact days; timestamps UTC stored, Asia/Tehran displayed (§8).
- One open payment request per user; pending grants nothing; replay/race creates exactly one effect (§10–11).
- Private audio/receipts never enter public HTML, Livewire payloads, CDN/SW caches, or logs (§8, §16, §18).
- Range delivery re-proven whenever the file path changes (§16). Financial Filament resources are not built before S5/S6 (§21).
- Real-device, real-SMTP, and commercial-data criteria stay UNPROVEN/BLOCKED until the real prerequisite exists — never marked passed on substitutes.

## Acceptance → proof map (scope §23)

| AC | Needs | Expected result | Cheapest faithful proof | Real-prerequisite gate |
|---|---|---|---|---|
| AC-01 | PUB-01, READ-01 | Visitor uses a real sample without account; drafts/premium never leak | Playwright public journey + response/HTML assertion that premium body/audio absent | PASS only with real seeded sample; else UNPROVEN |
| AC-02 | AUTH-01/02 | Register, wrong/right login, logout, session refresh, reset via real email; no cross-actor mutation | Pest auth + negative-path tests; reset requires **real SMTP** send/receive | Without real SMTP: BLOCKED (reset leg) |
| AC-03 | LIB-01/02 | One result per topic, pagination, query/level in URL, missing-version message | Pest list/search/filter + Playwright URL/back-forward check + rendered list image | — |
| AC-04 | READ-01/02 | Level select shows that lesson's text/audio/glossary; no silent preference/recommendation change | Pest lesson isolation + Playwright level-switch journey + DB assertion on `preferred_level` unchanged | — |
| AC-05 | MEDIA-01 | Play, pause, seek, speeds, valid/invalid Range on real MP3 | Real MP3 over HTTP: `206`/`Content-Range`, `416` out-of-range + Playwright player controls | Needs real MP3 fixture at S1 |
| AC-06 | MEDIA-02 | In-layout nav preserves playback; different version/logout stops old audio; no duplicate listeners | Playwright navigation/logout journey + listener-count assertion | — |
| AC-07 | PROG-01 | Last confirmed save returns after refresh; no cross user/lesson/revision mixing; save failure never fakes success | Pest progress isolation/revision tests + Playwright refresh/resume journey | — |
| AC-08 | SAVE-01 | Unique, durable, removable bookmark; archived content has defined behavior | Pest unique-pair/toggle + archived-topic journey | — |
| AC-09 | LEVEL-01, PLACE-01 | Skippable placement; 20 questions, no answer key to client; resume; repeat submit one result; preference only on explicit action | Pest server-marking + hydration/absence-of-key assertion + Playwright resume journey | Real teacher-approved questions required before public exam, else exam leg BLOCKED |
| AC-10 | PAY-01 | Server snapshot before transfer; later plan edits don't mutate snapshot; injected amount/status rejected | Pest snapshot-immutability + tamper-rejection tests | Real prices/destination needed for sale; fixtures otherwise |
| AC-11 | PAY-01/02 | Invalid upload rejected; others' receipts + public paths denied; retry/concurrent double-create yields ≤1 open request | Pest upload validation + ownership/policy tests + PostgreSQL concurrent double-create test | Real PostgreSQL required |
| AC-12 | PAY-03 | Authorized staff approves pending once; retry/concurrent double-approve yields one event + one extension | **PostgreSQL concurrency test**: two concurrent approves → one `subscription_events` row, one expiry extension; idempotent replay test | Real PostgreSQL required |
| AC-13 | PAY-03, SUB-01 | Concurrent approve + manual grant: no lost update; approve/reject race: single final outcome; self-approval rejected | **PostgreSQL race tests** (approve×approve, approve×grant, approve×reject) under fixed lock order User→Request→Subscription + self-approval negative test | Real PostgreSQL required |
| AC-14 | PAY-02/03 | Reject carries reason, no new effect; resubmit creates a new request; prior valid subscription preserved | Pest reject/resubmit/prior-window tests | — |
| AC-15 | SUB-01 | No-subscription/expired/revoked/disabled denied at page + audio route; all published levels allowed to eligible | Pest policy tests across states × (page, audio route, Livewire action) + server-clock expiry test | — |
| AC-16 | SUB-01 | Active renewal extends from expiry; post-expiry purchase from approve time; old replay never revives revoked; manual edits audited | Pest window-math + replay-after-revoke + event-audit tests with controlled clock | — |
| AC-17 | ADM-01/02 | Students denied staff actions; drafts invisible in URL/file/search; staff can publish valid lesson + control plans/destination | Pest policy + draft-invisibility (list/search/URL/media) tests; Filament action test behind `canAccessPanel` + policy | — |
| AC-18 | QA-01 | Mobile, RTL/LTR, keyboard/focus, zoom, contrast, error states with rendered evidence | Playwright journeys (list/reader/payment) at 360–430 + keyboard/zoom pass + measured contrast pairs + inspected rendered images | Rendered inspection required; otherwise UNPROVEN |
| AC-19 | MOB-01 | PWA installs/runs on **real iPhone**; no private SW cache; logout/back with second account leaks nothing | Real iPhone Safari PWA install + logout/two-account bfcache test + SW cache audit | Without real iPhone: UNPROVEN |
| AC-20 | MOB-02 | Release APK installs on **real Android**; asset-links cert match; login/audio/download metadata correct | Real Android + release-signed APK + assetlinks verification + version metadata check | Without real Android/release signing: BLOCKED |
| AC-21 | OPS-01 | HTTPS + secure config, debug off, private storage unreachable directly, secret-free logs, health/monitoring live | Staging config audit + private-path 404 probe + log inspection + healthcheck exercise | Needs staging/hosting; else BLOCKED |
| AC-22 | OPS-01 | Sound DB+file backup; restore in an isolated env proves login/audio/receipt + retention cleanup | Real restore drill in empty env with record/audio/receipt counts + retention run | Needs backup destination; else BLOCKED |
| AC-23 | PUB-02, QA-01 | Real copy/contact/prices, approved terms/privacy, domain/signing ownership, complete handover; no commercial placeholders in public sale | Document + domain/signing inventory review; public-surface placeholder scan | Without real commercial inputs: BLOCKED for sale |
| AC-24 | READ-03 | Sentences highlight from real validated cues; selecting a sentence seeks to its interval; missing cues keep a usable plain reader + completable lesson; stale-revision cues never apply | Pest cue-validation + revision-mismatch tests + Playwright seek/highlight journey on real audio | Real timing data per lesson required; lessons without cues stay in fallback (not FAIL) |
| AC-25 | VOCAB-01 | Save/edit/remove words with meaning/example/context; Again/Hard/Good/Easy reschedules deterministically; due/learning/known shown; state survives reload; no cross-user access | Pest ownership + SRS-math + persistence tests + Playwright review journey | — |
| AC-26 | PLAN-01 | Goal (5/10/15) + progress from persisted completions/reviews; tasks open the right lesson/review; uncompleted stays uncompleted after reload; premium/level respected; goal change never writes `preferred_level` | Pest plan-derivation + goal-isolation tests + Playwright Today journey | — |
| AC-27 | Editorial identity | Landing, Today, Discover, Reader, Vocabulary, Account share the ivory/navy/blue/amber identity at 360–1440 with RTL/FA + LTR/EN intact | Inspected rendered screenshots (desktop + narrow mobile + one demanding state) + measured contrast pairs | Uninspected screenshots are UNPROVEN |

## Concurrency, privacy, expiry, device notes

- Concurrency (AC-11/12/13): PostgreSQL-only proof; SQLite or mocked transactions are not faithful. Fixed lock order User → PaymentRequest → Subscription is asserted by the race tests.
- Receipts (AC-11): private-disk storage, owner/staff-policy delivery, `private, no-store`, no public URL, no receipt/bank data in logs/analytics.
- Expiry (AC-15/16): server UTC clock controlled in tests; active renewal vs post-expiry base verified; revoked windows never revived by replay.
- Devices (AC-19/20): pilot matrix minimum — one real Android with release APK, one Android browser/PWA, one iPhone Safari/PWA, each with device/OS/browser/build recorded (§18.2). Missing device → UNPROVEN, never passed.

## Visual excellence

For new learner surfaces (list, reader, account), judge rendered evidence against the `docs/DESIGN.md` thesis and quality budgets using the `browser` tool. Ordinary production craft threshold is 2.75/4 with no dimension below 2; an explicitly flagship surface requires 3.25/4 with every dimension at least 3. Hard-gate failures (contrast, focus, touch, RTL/LTR, reduced motion) cannot be offset by aesthetic scoring.

## Entry gates per slice (proposed commands resolved by checkout)

Pint check, slice-scoped Pest suite on PostgreSQL, Vite asset build where UI changes, related Playwright journeys where browser/device risk exists. Canonical commands come from this checkout and QUALITY policy, not from assumed script names; no hypothetical command is invented to resemble the scope.

## Frontend-migration proof delta 2026-10-10 (M0–M5 delivered 2026-10-11; AC table above unchanged)

- Prop-leakage rule: "never in Livewire payloads/hydration" reads as "never in Inertia props" with identical force (premium body/glossary/audio URLs, answer keys, `correct_option`/`scoring_rules`, receipt paths/bank references, secrets, tokens). Existing absence assertions are ported per slice, never weakened to obtain green.
- AC-06 (MEDIA-02) is proven against the Inertia persistent-layout player (navigation preserves playback; level-switch/logout stops; single audio element; no duplicate listeners) instead of `@persist`/`wire:navigate`.
- AC-18/AC-27 are re-proven in the single light theme only: RTL/FA + LTR/EN, keyboard/focus, 200% zoom, 320 reflow, 44px targets, `prefers-reduced-motion`, and re-measured contrast on the exact light pairs. Dark-theme assertions are retired only after the single-light parity proof; the S3DesignTest no-literal rule is extended to the React/TS surface.
- Money/concurrency proof is unchanged and stays PostgreSQL-only (AC-11/12/13 race suite + fixed lock order User → PaymentRequest → Subscription). Transport migration never weakens these tests.
- Obsolete-learner-code removal (Blade learner views, `app/Livewire`, `reader-player.js`, `theme.js`, `wire:navigate`/`@persist`/`fe-theme`) is accepted only with per-slice parity evidence (Pest + affected Playwright + inspected rendered images). Filament Livewire stays.
