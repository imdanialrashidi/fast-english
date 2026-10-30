# Fast English — Product Contract

Source baseline: `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` v1.0 (2026-10-07). It is the authority after the latest explicit owner instruction. Section numbers below refer to that scope (`§`). Do not reconstruct scope from memory; read the scope file for detail.

Authority order: latest explicit owner instruction → accepted slice contract → scope + recorded fresh decisions → repository docs. Conflicting behaviors are never both planned as valid (see conflict log in the active exec plan).

## Owner instruction 2026-10-25 — app-like shell, one brand lockup, pagination

- **One owner-supplied brand set.** The supplied app icon and header lockup are the sources (`Logo/fast_english_app_favicon.png`, `Logo/fastenglish_header_logo.png`); `public/icons/*`, `public/favicon.ico`, and `public/images/brand/*` are derived from them. The light lockup sits on paper, the warm-paper lockup on the deep footer. The old icon-plus-text approximation is gone.
- **The learner app does not repeat the logo.** Root screens use a contextual `ScreenHeader` (title + at most one action); nested screens add a back affordance. The brand appears on landing/login, the PWA icon/splash, and the desktop rail only; the mobile brand bar is retired.
- **One paginator, server-clamped.** Discover, Saved, and Words share one component. An out-of-range or malformed `page` redirects to the nearest valid page with the same filters; a page change focuses and scrolls to the results and is announced; page numbers are Persian.
- **Discovery is app-dense.** Sticky search, a filter sheet for level/category, removable active-filter chips, and compact rows put the first result above the fold. The URL remains the source of browsing state.
- **CSV is fully retired.** Both export and import are gone (2026-10-25). Words are saved from a lesson or edited in the notebook; the bulk «همه را می‌دانم» action remains, and existing rows are untouched.
- **Reader completion moved after the reading surface.** Bookmarking stays near the top; «خواندم» and reset live after the lesson and glossary, followed by the way back to Discover.
- **The shell carries real state.** The Words tab shows the learner's real due-word count; Account exposes a level CTA, Today a first-run level card; Chromium gets an event-driven install card with remembered dismissal; successful mutations raise a visual toast while the inline status stays the accessible source.
- **Motion stays optional.** Press/enter feedback is 150–180 ms and only under `prefers-reduced-motion: no-preference`.

## Owner instruction 2026-10-25 — catalog, card fallback, published trust copy

- **Prices:** 30 days = 399,000 toman; 90 days = 20% off (957,600); 365 days = 30% off (3,351,600). Plan names are duration-based. `PlanCatalogSeeder` installs/updates them by stable slug; the staff Plans resource edits them without a deploy.
- **Domain:** production canonical is `https://fastenglishpodcast.ir`; `fastenglish.ir` has no nameserver/delegation (checked 2026-10-28) and cannot resolve until the owner sets DNS at the registrar. Support/cooperation channel: `info@fastenglishpodcast.ir`; support hours remain unset until the owner supplies them.
- **Card-to-card is the only checkout (owner decision 2026-10-30).** Staff can replace the active destination and edit transfer instructions in Business settings. A fresh environment gets an obvious placeholder card; checkout is blocked until a real 16-digit card, holder, and bank replace it.
- **No online gateway.** Provider/merchant/sandbox fields and the driver map were removed on 2026-10-30. There is no online charge, callback, or gateway driver to configure; adding one would be a new product decision and scope change.
- **Trust copy is published.** Terms, privacy, and refund are staff-editable Persian paragraphs with config defaults; `/refund` was added to the public pages, footer, and sitemap. The owner still needs a qualified review before launch.
- **Sales stay off by default.** `SALES_ENABLED=true` only after the real card, final legal review, and the remaining launch inputs in `docs/LAUNCH_INPUTS_FA.md`.

## Owner instruction 2026-10-25 — review pass: no developer errors, CSV export removed, player polish

- **CSV export is retired.** The export route, button, download response, and its tests were removed. The transactional import was retired later the same day (see the app-shell instruction above); the bulk «همه را می‌دانم» action remains.
- **Learner errors are Persian end to end.** `lang/fa/{auth,passwords,validation,pagination}.php` own the framework copy; the app locale is fixed to `fa`; JSON validation/auth/throttle/403/404 messages are translated once in the exception pipeline; 419/429/405 render Persian pages/ErrorPage states.
- **Public pages never expose internal workflow labels.** The trust pages dropped `DRAFT`/`BLOCKED` badges and public-facing internal notes; missing legal/support text renders a calm «هنوز منتشر نشده / به‌زودی» state with no invented contact or legal text. Landing's primary action follows reality: while no APK is published, the sample is primary and download is informational.
- **Player is one shared console** (`AudioConsole`) for the persistent learner bar and the public sample: buffering indicator, buffered progress, one seek/skip/speed interaction model, RTL-correct time alignment, save-failure surfacing, and expansion-aware content clearance. No autoplay; one audio element; Media Session unchanged.
- **UI review fixes:** expanded player no longer covers content or the PWA notice; the navigation skeleton is skipped for partial reloads, sits below the player, and releases after 20 s; library/words search uses Inertia (playback survives); placement save state is truthful and final submit stays gated on all answers; SRS grading cannot double-submit; destructive reset/cancel/delete actions are two-step; sample CTAs follow the session; failure text is styled/announced as errors; Today's headline reflects real progress.

## Owner instruction 2026-10-21 — plain reader, Persian app chrome

- READ-03 sentence-level sync is retired: the reader, public sample, and landing preview render plain English paragraphs beside the normal audio player. Text never highlights, bolds, auto-scrolls, or seeks by sentence. The cue columns, validators, staff editor, and cue tests were removed in the same cutover.
- Learner chrome is Persian; the English editorial kickers (`Today`, `Discover`, `Words`, `Review`) and the English `Example` field label are removed.
- The app shell drops the in-app marketing footer, the duplicate signed-in header account CTA, and the account page's duplicate main-navigation chips.
- Account becomes an app profile screen: identity, subscription status with one next action, settings list, and logout.

## Owner follow-up 2026-10-22 — vocabulary tools, reminders, player metadata

- Vocabulary keeps the same owner-scoped rows and deterministic SRS, with a cloze presentation and a bulk «همه را می‌دانم» action. CSV import and export are both retired (2026-10-25).
- Account lists recent payment requests (status, plan, snapshot amount) without receipt/bank/internal fields. Renewal reminders are one-per-window; real SMTP remains a launch input.
- Media Session metadata/controls are published where supported; background audio is still not promised.
- Learner navigation shows a delayed skeleton, and learner pages share one Persian type scale.
- `/sample` is indexable while a published sample exists (sitemap, canonical, Article JSON-LD).

## Product outcome

Mobile-first Persian-RTL web product where learners pick a short English article at a CEFR level, read it, and listen to the matching audio (scope §1). Brand working name: Fast English. Prices, domain, contact channels, and standard legal copy were supplied on 2026-10-25; final brand assets, real card credentials, SMTP, signing identity, hosting, staff roster, and content production remain launch-only inputs (§25) and block only their own launch boundary. Development continues with clearly labelled fixtures; `docs/LAUNCH_INPUTS_FA.md` tracks what is still missing.

Reference domain: `fastenglishpodcast.ir` (live production origin; the earlier `fastenglish.ir` reference has no DNS delegation as of 2026-10-28, so it cannot be the public origin until the owner fixes its registrar nameservers). Ownership/DNS verification remains a launch check (§25). The checkout is a working rebuild-in-progress: domain models, shared Actions, policies, and private media controllers exist, the learner surface is Inertia post-M0–M5 with the M6 regression pending, and staff runs in Filament. See the stage map in `docs/PLAN.md` and the active migration plan in `docs/exec-plans/active/frontend-inertia-migration.md`.

## Admin operations (2026-10-26)

- `/admin/users` completes ADM-02: staff can search every learner/staff account, inspect the current subscription and recent payment/event history, suspend or reactivate with a required reason (logged), and use the shared audited grant/revoke actions. Profile fields, passwords, roles and expiry dates remain non-editable.
- Every privileged staff surface requires the TOTP gate: `/admin` (including Livewire updates), placement publish, import/export, staff audio preview, and the staff branch of the private receipt route. The owner receipt path stays challenge-free. Lost-authenticator recovery is the audited `staff:2fa-reset` CLI; `staff:bootstrap` requires an explicit password.
- The panel displays UTC storage in Asia/Tehran. The payment record exposes learner-supplied transfer hints, internal notes, reviewer/canceller audit, current subscription/events and the retention/missing-file receipt state; the lesson editor preserves the hidden private audio path, offers a draft audio preview, and never bumps `audio_revision` on a title/body-only edit.
- Owner settings normalize Persian/Arabic-Indic card digits, reject a card without holder/bank, and save settings+destination atomically. Topic/category slugs are `alphaDash`; only active staff can be recorded as content reviewers; placement publish is confirmation-gated.

## Scoped requirements by ID (scope §3)

| ID | Requirement | Observable output |
|---|---|---|
| PUB-01 | Public intro | Value proposition, real sample, plans, install, support |
| PUB-02 | Trust pages | About, cooperation, FAQ, support, terms, privacy, refund with owner-editable text and a real contact channel |
| AUTH-01 | Account | Sign-up (name/email/password), login, logout |
| AUTH-02 | Recovery + session | Reset via real SMTP; valid session after refresh |
| LIB-01 | Topic list | Newest topics, one result per topic, pagination |
| LIB-02 | Find content | Level/category filter + simple title search |
| READ-01 | Lesson page | Level selector, English body, audio of the same lesson version |
| READ-02 | Key words | Small per-lesson glossary, no dictionary service |
| READ-03 | Sentence audio cues (RETIRED 2026-10-21) | Owner removed sentence-level sync. Reader/sample/landing render plain paragraphs with the normal player; cue storage and editor were removed too. |
| VOCAB-01 | Vocabulary notebook + SRS | Save lesson words with meaning/example/context; Again/Hard/Good/Easy review with deterministic next-review scheduling; due/learning/known states; owner-only |
| PLAN-01 | Daily learning path | 5/10/15-minute goal with tasks (continue lesson, listen, review due words, next lesson) derived from persisted progress; respects level and premium access |
| MEDIA-01 | Player | Play/pause, seek, ±10s, speed |
| MEDIA-02 | Continue playback | In-layout navigation without unwanted stop; recoverable network error |
| PROG-01 | Progress | Resume position + completed mark, independent per lesson version |
| SAVE-01 | Saved | Topic bookmark + removal |
| LEVEL-01 | Preferred level | Explicit default-level change, independent of placement |
| PLACE-01 | Placement test | 20 questions, server marking, informal suggestion (optional) |
| PAY-01 | Payment request | Plan/amount/destination snapshot before transfer; private receipt; card-to-card is the live method and placeholder destinations block checkout |
| PAY-02 | Payment status | Status view, rejection reason, new request |
| PAY-03 | Staff review | Approve/reject with history and transactional effect |
| SUB-01 | Access | Active subscription, renewal, expiry, controlled revoke |
| ADM-01 | Content ops | Topic, per-level lesson, image, audio, preview, publish |
| ADM-02 | Business ops | Plans, pay destination, support info, payment queue, users |
| MOB-01 | PWA | Install, icons, offline fallback without data leakage |
| MOB-02 | APK | Signed TWA release, asset links, download page |
| OPS-01 | Production ops | HTTPS, logs, essential monitoring, backup + restore |
| QA-01 | Delivery | Real-flow evidence and security/payment/mobile boundaries |

Core journeys (§1, §7): (1) see a real sample before paying; (2) pick topic + level; (3) read text + hear the same version; (4) see a small set of key words; (5) resume from saved position. Revenue path: account → plan → transfer info → off-app card transfer → receipt → staff review → subscription active.

## Level semantics (binding rule)

A level is a **content attribute, not an access permission** (scope §8). All published A1–C2 versions are allowed to an eligible subscriber. Level values are fixed: `A1, A2, B1, B2, C1, C2`; at most one lesson per (topic, level). Missing level shows "این سطح هنوز آماده نیست" with available levels — no silent substitution (§7.2). Browsing a level never silently changes `preferred_level`; changing it requires explicit settings/placement-accept action (§12, §15). Placement is optional and never gates signup, sample, or subscriber use (§12).

## Access and money rules (summary; owners in ARCHITECTURE.md)

- Eligibility (server-computed, §8): `eligible = user exists AND disabled_at IS NULL AND subscription.revoked_at IS NULL AND starts_at <= now_utc < expires_at`. Derived labels (active/expired/pending/rejected) are display-only; no parallel `account_status` on users.
- Public sample allowed only when topic AND lesson are published AND `is_public_sample=true` (§8). Premium body/glossary/audio never sent to ineligible clients, including Livewire payloads (§7.1).
- Money is integer toman; no float, no ambiguous rial/toman conversion (§8). Plan durations are exact days, not calendar months. Timestamps stored UTC, displayed Asia/Tehran.
- Payment snapshot is taken **before** transfer from the active plan/destination (plan name, price, days, card number, holder, bank) and is immutable for that request (§10.2). Client supplies only plan ID.
- One open (`awaiting_receipt`/`pending`) request per user, enforced by partial unique index + server rule (§10.1, §14). Pending grants no new access.
- Approval is one shared transactional action with fixed lock order (User → PaymentRequest → Subscription), idempotent replay, and `subscription_events.source_payment_request_id` unique (§11). Staff cannot approve their own request. Reject needs a public reason; cancelled/rejected history is preserved; resubmit creates a new request.

## Non-goals (scope §4 — binding, as amended 2026-10-09)

Bank gateway/bank API, auto/OCR receipt verification, SMS OTP, native iOS, store publishing, offline download of paid content, push, AI tutor, speaking, runtime AI/TTS, full lesson translation, word-level alignment, public import pipeline, chart dashboard, streaks/leaderboards/achievements, algorithmic recommender, coupons, affiliates, multi-teacher, multi-locale UI. Sentence-level cues (READ-03) were retired by the 2026-10-21 owner instruction; the vocabulary notebook with simple SRS (VOCAB-01) and the daily learning path (PLAN-01) remain IN scope since the 2026-10-09 owner request below. No standalone stats page (progress lives on lesson + Today/continue surfaces). Cooperation/support start as info pages/links; no internal CRM/ticketing. Items enter only via explicit scope change + new acceptance criteria.

## Owner-approved amendments 2026-10-09 (authoritative per scope §0; save-only, no behavior built this turn)

1. Dark mode into v1 (removes `dark mode` from the §4 exclusion above). Light is the default; user chooses system, light, or dark. Reason: owner requires dark alongside light for parity with leading consumer audio/learning apps.
2. Scope §17.1 restraint relaxed, narrowly: gradients/glow only in cover art + landing hero; motion only for state feedback/transitions with `prefers-reduced-motion`; shadows only via named elevation tokens. Reason: owner requires polished/distinctive finish.
3. Navigation to mobile bottom tab bar (Library, Saved, Account) with mini-player above + safe-area padding; supersedes top-bar placement (scope §17.3 already assumes this). Reason: mobile audio-app pattern + polish.
4. Every published topic shows a real cover: default generated abstract cover (GD, deterministic from slug, no baked text); staff may upload licensed photos each with a license record (source, license name, date checked, usage notes); no runtime third-party fetch. Reason: owner forbids empty placeholders; provenance must be auditable.
5. Amber replaces the navy/blue identity from scope §17.1 (primary `#1D4ED8`, primary-hover `#1E40AF`) with the Night Studio amber scale (dark `#F5A524`, light `#B45309`, sepia `#92400E`); navy/blue is no longer the identity. Owner-approved on 2026-10-09 by owner direction. Reason: owner direction requires a distinctive polished palette with a warm amber signal for play/progress.
6. Soft Day light theme (owner Softly inspiration, 2026-10-09) replaces the Night Studio light table and the §17.1 proposal values in code for learner app surfaces (canvas `#FDFCF8`, coral `#FFB7B2`/`#FF9E99`, text `#292524`, muted `#78716C`); sage `#E8EFE8` recorded for landing; perf-heavy effects excluded; landing markup untouched. Owner-approved on 2026-10-09 by owner direction. Reason: owner wants the Softly look in the app without the perf cost.
7. Editorial redesign + three learning features into v1 (owner request 2026-10-09): (a) premium editorial visual identity from the supplied reference (warm ivory canvas, deep navy text, blue primary actions, warm amber accent; Vazirmatn Persian + Inter English; landing, Today «امروز», Discover «کشف مطالب», immersive reader, vocabulary «واژه‌ها», calm account, desktop sidebar + mobile four-tab nav «امروز/کشف/واژه‌ها/حساب»); (b) sentence-level immersive reading with real validated timing data and fallback (READ-03 — retired by the 2026-10-21 owner instruction); (c) personal vocabulary notebook with deterministic Again/Hard/Good/Easy SRS (VOCAB-01); (d) personalized daily learning path with 5/10/15-minute goals derived from persisted progress (PLAN-01). Removes `flashcards/SRS` and `word-by-word highlight` from the §4 exclusion above in this narrow sense only: sentence-level sync is required, word-level alignment stays excluded; no third-party dictionary/translation/transcription/TTS API; streaks/leaderboards/achievements stay excluded. Reason: owner explicitly approved these three scope extensions and the reference visual direction.

## Owner-approved frontend migration 2026-10-10 (M0–M5 delivered 2026-10-11; M6 pending — authoritative per scope §0; history above preserved, not rewritten)

Owner-approved architectural change (see `docs/adr/0002-inertia-react-learner-frontend.md`; history above preserved, not rewritten):

1. Backend unchanged: Laravel 13, PostgreSQL, existing domain models, migrations, server-side authorization, payment/subscription rules, private media delivery, and operational boundaries stay. No database replacement, Laravel regeneration, discarded functionality, or fresh starter kit over the repository.
2. Public and learner-facing Blade/Livewire UI migrates to Inertia 3 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (scope §2 foresees this registered change; no parallel learner frontends). Filament stays for the staff/admin panel; its internal Livewire dependency is acceptable and isolated.
3. Dark mode removed completely (supersedes amendment 1 of 2026-10-09 above, which had brought dark into v1). The product has one permanent light theme. Interim canonical palette is the owner-approved Modern Hybrid light table (2026-10-10, exact hexes in the ADR); the next-phase owner palette, when supplied, supersedes by explicit amendment — never by substitution. No `system/light/dark` choice, no theme storage, no theme-choice UI.
4. This is a migration of the existing product: every existing public, authentication, learner, media, payment, placement, vocabulary, and account route is inventoried and migrated slice by slice (see active exec plan `frontend-inertia-migration.md`). Backend behavior and security invariants in this contract (level semantics, eligibility, snapshots, integer toman, lock order) survive unchanged.

## Owner-required paid-only learner app + shell split 2026-10-11 (authoritative per scope §0; history above preserved, not rewritten)

Owner-required product change (supersedes the public-sample-in-learner-shell behavior; all scope/money/time rules stay in force):

1. Paid-only learner app: every learner-app route and learner mutation (library, reader, Today, saved, words/review, progress, bookmarks, placement) enforces an active, valid subscription server-side per request (`subscribed` gate on the existing eligibility formula; staff bypass preserved; disabled accounts stay blocked). No-subscription, pending, expired, and revoked states get a dedicated locked state (403, one subscription CTA) on pages and 403 JSON on mutations/media; no premium content, answers, vocabulary, or media URLs leak in denied responses. Money, snapshot, approval-transaction, integer-toman, and data-integrity invariants are untouched.
2. One explicit public sample: exactly the published lesson(s) designated by the existing `is_public_sample` flag remain readable without a subscription, through the public `/sample` experience only (same audio + Range contract, read-only glossary). Learner URLs resolving to a sample redirect there; all other lessons and media stay gated. No hardcoded lesson id/slug/title.
3. Shell split: public marketing (`/`, `/sample`, trust pages, `/download`, auth) renders in a dedicated marketing layout with its own navigation — never the learner sidebar, bottom tabs, or global player. The learner layout (with the locked state) serves only the gated app. Palette, type, and RTL/LTR rules unchanged. The full marketing + learner visual redesign stays a subsequent slice.
4. Account/status/checkout/payment pages stay reachable without an active subscription under their existing rules and expose no learner content; placement is gated as learner-app functionality (no free public diagnostic).

## Owner requests 2026-10-28 (authoritative per scope §0; history above preserved)

1. **Email verification by code.** A new account gets a six-digit code at its email address (not a link) and must enter it before the learner surface opens. The code is valid 10 minutes, resends are rate-limited (60 s cooldown, route throttle), five wrong guesses invalidate it, and only a bcrypt hash is stored. Registration still creates the account if the mail server is temporarily down; the verification page then offers a resend. Existing accounts are grandfathered as verified by migration so the owner and early testers keep access. Staff accounts are created verified by `staff:bootstrap`.
2. **Android APK 1.0.0.** The signed APK is `public/downloads/fast-english-1.0.0.apk` (package `com.fastenglishpodcast.app`, minSdk 24, targetSdk 36). The `/download` page reads its measured version/date/size/SHA-256 from `config/release.php`; the landing's download action links directly to the file once published. `/.well-known/assetlinks.json` serves the release certificate fingerprint in production. Real-device installation remains a launch check (AC-20); the build/signature/association are verifiable artifacts, not a claim that a specific handset was tested.
3. **No demo/test content in the app.** `DatabaseSeeder` no longer creates the `Test User`, sample lessons, tone-file audio, fixture payments, or fixture placement version. A fresh database gets only the owner catalogs (plans + real placement test). The `content:purge-fixtures` command removes any fixture rows/media left by an older environment (dry-run by default, `--force` deletes) and production currently reports none. Fixture seeders stay in git for Pest only and are excluded from the production image.
4. **Operator guide.** `docs/ops/CONTENT_UPLOAD_FA.md` is the Persian step-by-step for staff content upload (categories, topics, lessons, audio, review, publishing, verification, common errors).

## Measurement and operations

- Activation: a user with no in-person help views the sample, submits a payment request, and uses content after approval (§1).
- Staff independence: staff publishes a lesson and reviews a receipt without code edits (§1).
- Invariants: audio/text/progress never mixed across levels or users; duplicate/concurrent requests never double-apply subscription effect (§1).
- Budgets/targets: list paginated at 12 topics/page, no N+1, `preload=metadata`, no admin assets in learner bundle, real baseline measured in S0 (§20.2). Accessibility target WCAG 2.2 AA on main paths (functional target; full conformance claim needs an audit — see DESIGN.md).
- Telemetry: no product analytics dashboard in v1 (§4). Required ops signals: availability, 5xx, job/backup failure, disk space, pending-payment age (§19.2). No secrets, receipts, paid content, answer keys, or tokens in logs (§19.2).

## Open product decisions (pointers, not approvals)

All of §25 remains owner/Domain input at its launch boundary: stack confirmation, nav/placement confirmation, staff model, brand/logo/domain, package ID + signing owner, plans/prices, bank destination, snapshot-validity policy, staff SLA text, email/SMTP, placement questions + cut scores, pilot content (proposed 5 topics / ≥12 lessons covering all six levels + two-level sample), palette/fonts/assets, refund/privacy/retention policy, VPS/storage/backup destination, support channel, budget/deadline. Proposed defaults are labelled as proposals in DESIGN.md/PLAN.md and never presented as owner approval.
