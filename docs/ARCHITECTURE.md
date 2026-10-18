# Fast English — Architecture Contract

Source: scope §2 (stack), §5 (roles), §8 (access/time), §9 (content), §10–11 (payment/subscription), §13 (player/progress), §14 (data model), §15 (state ownership), §16 (file delivery/security), §18 (PWA/TWA), §19 (deploy/ops). Section numbers refer to the scope.

## Current system (target — nothing built yet)

- Runtime: PHP 8.4 (supported patch), Laravel 13.x, Nginx + PHP-FPM, PostgreSQL (supported), Vite asset build, Node for build only (§2).
- Learner UI: Blade + Tailwind CSS 4.1+ compatible; server-driven interaction Livewire 4.x; instant browser interaction Alpine bundled with Livewire + limited JS; Flux Free only where needed, no Flux Pro requirement (§2).
- Staff: one Filament 5.x panel (`/admin`); learner Filament assets never loaded in learner layout (§2).
- Auth: official Livewire starter kit with Fortify (login, register, reset, standard security) (§2).
- Topology: one Laravel app, one database, one origin. No subdomains, no separate auth client, no parallel REST API, no Node API server (§15, §6).
- Resolved versions pinned in `composer.lock` + `package-lock.json` (+ PHP/Node pins) at S0; majors never auto-bumped per session (§2). Alpine never double-loaded via CDN/second bundle (§2). No Redis/Octane/WebSocket/standalone search/monorepo/public API/Docker required by this scope (§2).

## State ownership — one owner per piece of state (scope §15)

| State | Owner | Rule |
|---|---|---|
| Data, role, publication, access, money | PostgreSQL / Laravel (server) | Client never authoritative |
| Browse level, category, query, page | URL (`?level=`, filters, pagination) | Back/share/refresh compatible; silent default change forbidden |
| `preferred_level` | `users` row | Only explicit settings change or placement-result accept |
| `recommended_level` | Latest completed placement attempt | Browsing a level never changes it |
| Forms + validation | Livewire / Laravel (server) | Server is validation reference |
| `currentTime`, speed, play state | JS player (`resources/js/player.js`) | No round-trip for instant controls; never bind `timeupdate` to server |
| Confirmed progress | DB `lesson_progress` scoped to (user, lesson) | Browser only requests saves |
| Sentence cues | DB `lessons.audio_cues` JSON, keyed to `audio_revision` | Client never authoritative; stale-revision cues rejected; missing cues fall back to plain reader |
| Vocabulary state | DB `vocabulary_words` scoped to (user) | Client only requests save/review/remove; ownership enforced server-side |
| Daily goal | `users.daily_goal_minutes` (5/10/15) | Explicit settings change only; never writes `preferred_level` |
| Guest non-sensitive preference | Limited `localStorage` | No tokens, receipts, lesson bodies, answer keys |
| Theme | Fixed light in v1 | Dark/system needs its own scope |

Code homes (proposed, §15): `routes/web.php` (pages + essential media/controller routes) · `app/Models` · `app/Policies` · `app/Livewire` (list/forms/account/placement with server state) · `app/Http/Controllers` (protected files + essential HTTP) · `app/Http/Requests` · `app/Actions` (shared sensitive rules: ApprovePayment/RejectPayment/PublishLesson) · `app/Filament` · `resources/views` (public/student layouts) · `resources/js/player.js` (single audio lifecycle) · `resources/css/app.css` (tokens) · migrations/seeders · `tests/Feature,Unit` + `tests/browser` · `docs`.

Rules: one `HTMLAudioElement` in the shared learner layout with `@persist` for `wire:navigate`; never two concurrent audio elements (§13.1). No parallel controller/service/repository/manager per model; direct Eloquent is fine, Actions carry shared/transactional rules (§15). No speculative abstractions, public event bus, or framework-class wrappers (§15).

## Eligibility and server-side enforcement (scope §8)

Eligibility (UTC, server-computed):

```text
eligible = user exists AND disabled_at IS NULL
  AND subscription.revoked_at IS NULL
  AND starts_at <= now_utc < expires_at
```

- Owner of eligibility: server (Laravel policy/query), recomputed per request — never client state, never cached `account_status` on users (§8).
- Public sample allowed only if topic AND lesson published AND `is_public_sample=true`; staff draft preview only via allowed panel route (§8).
- Enforcement points (each independently server-checked): page access, audio file route, progress mutations, Livewire actions, list-body exclusion (public list carries title/image/summary/category/available-levels only — no body, paid glossary, private paths, answer keys) (§8).
- Level is not a permission: every published level is allowed to an eligible subscriber (§8).
- Expiry is immediate for subsequent premium requests; already-buffered bytes are not revocable and no DRM is claimed (§8).

## Payment snapshot + approval transaction (scope §10–11)

- Snapshot owner: server. On plan select, server creates `awaiting_receipt` with immutable plan name, price (toman integer), duration days, card number, holder, bank (§10.2). Later plan/destination edits affect only later requests. Proposed commercial default (PROPOSAL, needs owner sign-off before selling): snapshot honored until final decision, no auto-timeout (§10.2, §25).
- Receipt owner: filesystem private disk (random name, re-encoded, EXIF stripped) + `payment_requests` row; file written before DB mutation, orphan cleanup job, no success shown before DB commit (§10.3). Constraints: one image JPEG/PNG/WebP ≤5MB, MIME/signature + decodability checked, suggested 6000×6000 cap; SVG/HTML/PDF/executables rejected (§10.3).
- Request owner: `payment_requests` state machine (§10.1). One open request per user (partial unique index on `awaiting_receipt`/`pending` + server rule). Pending is not editable by the student; pending creates no access (§10.1).
- Subscription truth owner: `subscriptions` current window per user (`subscriptions.user_id` unique) + immutable `subscription_events` audit; request is source of one unique event (§11.1). No financial status duplicated on users.

ApprovePayment — single shared Action used by every UI/CLI path; logic never copied into the Filament resource (§11.2). Fixed lock order in one transaction: **User (owner) → PaymentRequest → Subscription** (§11.2–11.3). Steps: staff/suspension/CSRF/self-approval checks → lock in order → idempotent approved-replay returns prior result with no new event/date → read stored snapshots → lock/create subscription → `base = current_expires_at` if window active and unrevoked else `approved_at_utc`; `new_expires_at = base + snapshot_days × 24h` (fresh purchase `starts_at` = approve time; active renewal preserves `starts_at`; clears `revoked_at`) → insert event with unique `source_payment_request_id`, before/after, duration, actor, time → mark request approved with reviewer/time + update subscription → commit; notifications only after commit (§11.2). Manual grant/revoke/reject use the same lock order and mandatory reason + event; `expires_at` is never free-form CRUD (§11.3). Replayed old approvals never reactivate a revoked subscription (§11.3).

## Private media + receipt delivery with Range (scope §16)

- Audio + receipts on a private disk outside public; covers/icons/assets may be public. Physical paths never built from raw user input; lookup via model + server path (§16).
- Audio route owner: controller (`/media/lessons/{lesson}/audio`). Checks policy + `audio_revision` first; production byte delivery via Nginx internal location + `X-Accel-Redirect` (external URL to the internal location 404s); dev uses standard file responses with Range (§16). Never load whole audio via `file_get_contents` (§16).
- Receipt route owner: policy (`/media/payment-requests/{request}/receipt`); owner + authorized staff with session only; no permanent public URL; `Cache-Control: private, no-store`; excluded from CDN/SW caches (§16, §10.3).
- HTTP contract: `GET`/`HEAD`, `Accept-Ranges`, `206`+`Content-Range` for valid ranges, `416` for out-of-range, correct seek after partial fetch; private media/account HTML/Livewire responses `private, no-store`; public fingerprinted assets long cache (§16). Errors: invalid upload → 422; unauthorized → 403/404 per route contract; invalid session → auth redirect; no debug/stack/query/secrets in production (§16).
- Request hardening: CSRF, secure/HttpOnly/SameSite session cookie, session regeneration, hashing, rate limits (proposed: login 5/min per account+IP, uploads 5/min, payment creates 10/day per user — tune with real sample, §16); Livewire actions treat all data/IDs as untrusted; no secrets/answer keys in hydration (§16).

## PWA and TWA boundaries (scope §18)

- PWA owner: manifest (`lang=fa`, `dir=rtl`, `display=standalone`, `start_url=/app`, proper scope, standard + maskable icons) + limited service worker. SW allowlist-caches only public fingerprinted assets, icons, fonts, and the public offline page. All data-bearing navigations, auth, Livewire, admin, receipts, placement, progress, and media are network-only — even sample audio is NOT in the v1 offline cache (§18.1). Offline shows a public "connect to continue" page with retry; never serves the last premium/account page as fallback (§18.1). SW versioning + old-cache eviction; no forced reload mid-receipt/exam/playback (§18.1). Logout clears player + page state; back/forward + bfcache must not show prior-account private data without session recheck (proved with two accounts + real logout, §18.1).
- TWA/APK owner: Bubblewrap wrapper of the same HTTPS site; no second frontend, no Node API (§18.2). Proposed package ID `com.fastenglishpodcast.app` (PROPOSAL — finalize before first release, §18.2). `/.well-known/assetlinks.json` matches real release package + SHA-256; domain/signing verified early on reachable staging + real Android, with verification failures/toolbar behavior documented (§18.2). Keystore/passwords/recovery outside Git with independent backup + named owner (§18.2). Download from project domain; versioned file with versionCode/versionName/date/size/SHA-256 on the page (§18.2). Ordinary web changes need no new APK; package/manifest/signing changes have their own release path (§18.2). Online-only app; no background-audio guarantee across devices (§18.2).

## Data constraints (summary; full table in scope §14)

Models added only with their slice — no full schema before the first real page (§14). UTC timestamps, FKs everywhere. Required uniques: `lessons(topic_id,level)`, `lesson_progress(user_id,lesson_id)`, `bookmarks(user_id,topic_id)`, `vocabulary_words(user_id,word)` (case-folded), partial unique open `payment_requests(user_id)`, unique-when-not-null `subscription_events(source_payment_request_id)`, `subscriptions(user_id)`, `placement_answers(attempt_id,question_id)`, `placement_questions(test_id,position)`, partial unique in-progress `placement_attempts(user_id)`, single `placement_tests.is_current=true` (published only), single active bank destination. Checks: allowed level/status sets, positive plan/snapshot amounts and durations, expiry after start, cue start<end within server duration, goal in (5,10,15), SRS grade in (again,hard,good,easy). Indexes: status/published_at, topic/category, payment queue (status, created_at), progress (user_id, updated_at), vocabulary (user_id, due_at), cues read with the lesson row (no extra query). No cascade delete over financial/progress/vocabulary history; archive/disable is the default. Secrets/answer keys/internal notes/private paths hidden from public serialization (hidden ≠ DTO allowlist).

New tables (R-slice): `lessons.audio_cues` JSONB nullable + `audio_cues_revision` integer (equals the `audio_revision` the cues were timed against; reader ignores cues on mismatch) validated by `App\Support\AudioCues` (sentence_index, start/end seconds, monotonic, within `duration_seconds`); staff edits cues in the Filament lesson form with duration validation. `vocabulary_words` (user FK restrict, word, word_key lowercased, meaning_fa, example_en nullable, lesson/topic FK nullable set-null, status learning/known, ease_factor, interval_days, repetitions, lapses, due_at, last_reviewed_at) owned per user via `VocabularyWordPolicy`. `users.daily_goal_minutes` smallint default 10. Daily plan (`App\Support\DailyPlan`) is computed, never stored: continue-lesson from latest `lesson_progress`, listen task from the same lesson audio, review task from due vocabulary count, next-lesson by `preferred_level` fallback newest; progress from persisted completions + reviewed-today count. Cue/vocab/plan payloads never enter SW caches, logs, or Livewire hydration beyond the eligible reader page.

## Owner-approved frontend migration 2026-10-10 (M0–M5 delivered 2026-10-11; M6 pending — history above preserved)

See `docs/adr/0002-inertia-react-learner-frontend.md` for the binding decision. What changes: public + learner HTML transport becomes Inertia 3 + React 19 + TypeScript + Tailwind 4 + shadcn/ui (one learner frontend); single permanent light theme (Modern Hybrid light exact table in the ADR; dark/system/sepia superseded for learner/public surfaces). What stays: runtime/topology (one Laravel app, one DB, one origin), eligibility formula, enforcement points, snapshot/approval transaction, private media + Range contract, PWA/TWA boundaries, data constraints, and the shared-Action rule. Filament 5 panel (`/admin`) stays with its internal Livewire isolated; learner Livewire/Alpine artifacts (`app/Livewire`, learner Blade layouts/views, `reader-player.js`, `theme.js`, `wire:navigate`, `@persist`, pre-paint/`fe-theme`/appearance radios) are removed only after per-slice parity proof. State-ownership deltas: "Forms + validation" owner becomes Inertia + Laravel (server still the reference; error bags replace Livewire validation responses); player state owner becomes the React persistent-layout audio element (same single-element, no-`timeupdate`-to-server rule); "Theme" row becomes fixed single light (no stored choice); list-body exclusion and answer-key/correct-option/scoring-rules/receipt-path secrecy extend from "Livewire payloads/hydration" to "Inertia props" with identical force. No parallel REST API, no Node API server, no second auth client.
