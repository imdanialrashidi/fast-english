# Product Contract

Non-confidential source of truth for what Fast English Podcast must do.

## Users and problem
- Primary users: Persian-speaking adults in Iran learning English on mobile.
- Problem: no calm, mobile-first, Persian-UI English-learning product with manual card-to-card payment suited to the Iranian market.
- Why now: manual-payment + PWA/APK delivery is achievable with a small static + PocketBase stack.

## MVP outcome
- Measurable outcome: a user can sign up, pay manually, get approved, take a 20-question placement test, access level-appropriate lessons with audio, and track simple progress, on web/PWA and Android APK.
- Deadline: end of 2026-07-30 (two calendar days from execution start 2026-07-28). Hard prioritization constraint, not permission to weaken security or fake verification.
- Platforms: modern Android via installable PWA + downloadable APK; modern browsers. Linux dev environment.

## Must-have user flows
1. Signup/login with Iranian phone + password; session restore.
2. Manual card-to-card payment: choose plan, upload one receipt, see pending/rejected, resubmit after rejection.
3. Operator review: queue, approve/reject with reason; user becomes active on approval.
4. Placement test: 20 questions, resume, one final submission, suggested + selected CEFR level.
5. Active student: browse lessons by level, read text, play protected audio, see progress.
6. Install: PWA install; APK download from landing.

## Non-goals
- No official CEFR certification; placement is a recommendation only.
- No SMS OTP, no email verification, no self-service password recovery (documented support recovery only).
- No sales/SEO-outcome/educational-outcome promises.
- No payment-request creation, receipt upload, dashboards, or placement on the static landing.
- No CMS, SSR, GraphQL, microservices, custom Node backend, Docker, Next.js/Astro.

## Surface separation
- Static landing (`fastenglishpodcast.com`): fully static; intro, value prop, CEFR levels, sample lesson preview, plans + manual-payment explanation, APK link + version/size/SHA-256, PWA install instructions, app link, FAQ, about, cooperation, support, privacy, terms. Tailwind allowed here only.
- Product app (`app.fastenglishpodcast.com`): all product behavior. Material UI only; no Tailwind.
- Admin (`admin.fastenglishpodcast.com`): the Unified Staff Admin Console (separate Vite application); routine payment review lives there. PocketBase superuser dashboard stays unreachable publicly.

## Plans (owner-approved launch set, 2026-08-15)
- **monthly** — «ماهانه», 30 days, **299,000 toman**.
- **quarterly** — «سه ماهه», 90 days, **807,300 toman** (= 10% discount vs 3 × 299,000 = 897,000).
- **There is NO yearly/365-day plan.** It is never offered in Student, Landing,
  Admin, public copy or launch configuration.
- Canonical pricing source = the `plans` collection (backend-managed). The
  public Landing renders prices from the public settings endpoint
  (`GET /api/fast-english/public/settings`) — no hard-coded prices anywhere.
  The quarterly saving badge on the Landing is DERIVED from the two prices.
- Seeded via `pnpm seed:plans` (seeds/business/plans.json); editable at any
  time by a Staff Admin in the Admin Console → تنظیمات → تنظیمات کسبوکار.

## Authentication
- `phone` required + unique identity; `name` required; `password` required; `email` optional.
- Canonical storage `+989XXXXXXXXX`; UI may accept `09…/989…/+989…`; normalize + validate server-side.
- Client may never set/update `role`, `account_status`, subscription/payment/review fields, or server-calculated values.
- Initial server-managed: `role=student`, `account_status=pending_payment`.
- Roles: visitor, student, operator, content manager, technical admin/superuser.

## Manual payment
- Intended Student journey (deliberately simple): choose plan → see the
  destination card (number, holder, bank, one short instruction, review ETA,
  support action) → transfer manually → upload ONE receipt → submit → wait
  for staff approval. The Student UI collects only `plan_id` + the receipt
  file; no transaction-reference fields, banking forms, gateway concepts or
  extra confirmation steps are presented to the Student.
- The server still accepts optional legacy fields (`bank_reference`,
  `sender_card_last4`, `transfer_at`) for backward compatibility; the
  Student UI no longer sends them.
- Review ETA copy defaults to «حداکثر تا ۲۴ ساعت» and is configurable via
  Business Settings (`payment_destination.review_sla_text`).
- Client submits `plan_id` + receipt only (minimal surface). Server snapshots plan name/price/duration.
- States: pending, approved, rejected, cancelled. One pending request per user; resubmit only after rejection; old rejected requests auditable.
- Approval is operator-only and backend-enforced; rejection requires a user-visible reason; internal note separate.
- Receipt image alone never proves payment; operator compares with external bank info.
- Approval + subscription create/extend in one DB transaction; unique subscription→payment-request link enforces idempotency; repeated approval never adds duration twice.
- Renewal: new subscription starts at approval; renewal starts from later of current expiry and approval time.

## Receipt security
- Exactly one image: JPEG/PNG/WebP, max 5 MB (lower if evidence requires). Reject SVG/HTML/PDF/archives/executables and extension/MIME/signature mismatch.
- Protected PocketBase file field, randomized storage name, short-lived authorized preview, no permanent public URL, no receipt URL in logs. Owner/operator/tech-admin access only. Generic user errors, no server paths.
- Never collect CVV2, expiry, dynamic password, full card number, card photo, national ID. Optional last-4 digits allowed.
- Retention: open decision; 90-day reversible proposal; backups must eventually obey same policy.

## Placement
- Active users who haven't completed placement only. Exactly 20 active questions from current test version; 4 choices each; correct answers never sent to client; backend grading; attempt persists across refresh; one accepted final submission; duplicate submit rejected or idempotent. Suggested level stored separately from selected level; user may accept or change. Described as recommendation, not certification.

## Content and progress
- Podcast Library Categories; Episodes (Topics) shared across CEFR levels; one level-specific Episode Variant (Lesson) per topic+CEFR level (A1–C2); protected audio; published state; one public sample lesson; per-Variant per-user progress.
- Entitled Students (authenticated, active, non-suspended, placement completed, active subscription) may access every Published Episode Variant across all levels — level is not an authorization boundary; the default browsing level is the Student's preferred level.
- Premium content served only when authenticated, not suspended, active subscription, Category+Episode+Variant published. Pending/rejected/expired/suspended users must not receive premium body/audio even via direct API.
- PWA SW never caches `/api/`, auth, payments, receipts, placement, premium text/audio, private account data, or artwork. Only app shell + public static assets cached.
- Level browsing is read-only: it never changes the Placement result (recommended level), the preferred level, Progress of other levels, or the Subscription. Progress is stored per Variant and stays independent across levels. Archiving content hides it but never deletes Progress.

## Operator
- Restricted routes `/payments`, `/payments/:requestId` (Admin Console). Queue: pending first, status filter, search by phone/name/bank ref, pagination, request age, plan/amount snapshot, status badges. Review screen: masked sensitive values, snapshot, protected receipt zoom/preview, transfer details, current subscription, approve/reject, confirm dialog, double-submit lock, feedback, reviewer + reviewed time. Every Staff endpoint verifies the `staff_admins` collection + `is_active` server-side (requireStaffAdmin); UI guard is not authorization. Staff never access passwords, tokens, superuser settings, unrestricted user records, technical credentials.

## Student product language (Podcast Slice 5)
- The Student App is presented as a Personal English Podcast App: final destinations خانه / کتابخانه / پیشرفت / حساب (phone Bottom Navigation, tablet Navigation Rail, desktop Side Navigation); legacy /dashboard redirects to the Home route.
- Canonical public vocabulary: اپیزود (never درس/فایل/مطلب/پادکست/جلسه for the same entity), کتابخانه, سطح پیشنهادی (Placement result, never changed by browsing), سطح پیشفرض (default browsing level), ادامه گوشدادن, شروع گوشدادن, مرور دوباره, کلمات کلیدی, متن اپیزود, پیشرفت. Central source of truth: `app/src/app/copy/productCopy.ts` + `copy-guidelines.md`.
- Home answers, in order: what to listen now (Continue Listening hero when real resumable progress exists; intentional first-use start experience otherwise), what else is relevant (preferred-level episodes with featured-first sort — not marketed as smart/personalized), how progress is going (one compact level-scoped panel), and whether the account/subscription needs attention (quiet compact line; never a payment-style card).
- Theme preference (سیستم/روشن/تاریک) exists only in Account settings. No Staff/operator terminology appears in the Student surface.

## UI and accessibility
- Single custom MUI theme, CSS variables, RTL. Persian UI `lang="fa" dir="rtl"`; English lesson body `lang="en" dir="ltr"`. Self-hosted verified Vazirmatn variable WOFF2 (license/attribution confirmed); robust local fallback; no runtime CDN font. English content may use system Latin sans.
- Semantic tokens (Visual Slice 1, from the approved brand palette): complete Light/Dark systems with roles for primary/secondary/accent/background/surface (tonal ladder)/outline/inverse/status/focus/disabled/scrim — defined only in `shared/ui/tokens/colors.ts` and verified by the WCAG contrast gate. CEFR colors via named tokens with accessible pairs. No raw colors scattered in components; typography/spacing/shape/elevation/motion/focus tokens are centralized in `shared/ui/tokens/`. Light/Dark/System theme with persisted preference (`mui-mode`), pre-paint initialization, and Capacitor system-bar sync.
- Mobile-first; bottom nav on mobile; clear hierarchy; restrained elevation; no heavy glassmorphism/glow/excess gradients/decorative animation; no lorem-ipsum; no horizontal overflow; no undersized touch targets; no status by color alone.
- Every flow defines loading/empty/error/disabled/success/permission-denied/offline/stale states. WCAG 2.2 AA: semantics, keyboard, visible focus, labels, contrast, reduced motion, dialog focus, SR async feedback. Visual QA widths: 360/375/390/430/768/1440.

## Performance and UX budgets
- Core pages: fast first paint; no unbounded reads/N+1; paginated lists; lazy audio; bounded concurrency.
- Device/network baseline: low-to-mid Android phones, unstable mobile network; offline-tolerant app shell.

## Acceptance criteria
- [x] Signup/login with real PocketBase; phone normalization + collision handled.
- [x] One real disposable receipt request approved; exactly one subscription; repeated approval no double extension; unauthorized receipt/approval fail.
- [x] 20-question placement completes on real backend in browser + Android; no answer leakage.
- [x] Active student accesses real lesson + audio; pending/expired denied; progress survives refresh.
- [ ] PWA installable; release APK installs on physical device; APK version + SHA-256 produced. (PWA proven; release APK + physical-device gate open — needs keystore + device.)
- [ ] Both builds reproducible; `scripts/verify.sh` green; sensitive-diff `/review` passed; `/ship` run. (Builds + verify green; `/review` and `/ship` not run.)

## Open product decisions (external inputs)
- **Resolved 2026-08-15:** plan set + prices (see Plans); review ETA default;
  support/collaboration share one configurable contact (`site_settings`);
  demo placement bank + guarded seeding tool exist; matching public-sample
  demo package exists; Landing pricing via runtime public settings.
- **Still HUMAN INPUT REQUIRED before live launch:** destination card
  number/cardholder/bank name + transfer instructions; operator
  identities/count; rejection/refund policy; receipt retention approval;
  approved privacy/terms copy; public support/collaboration URL value; final
  logo/app icons (current assets are generated placeholders); 20 reviewed
  placement questions (demo bank is NOT the reviewed bank); final Episode
  library (demo sample package is NOT the production library); VPS (expected
  in Iran — provider unselected) + DNS access; release keystore ownership +
  secure storage.

## Security/privacy/compliance constraints
- Data classification: phone + name + receipt images = private; never public. No public receipt files.
- Critical access: server-side authz on every protected action/object; client never trusted for role/price/status.
- External/payment: manual card-to-card only; no payment provider integration; operator verifies externally.
- Retention: receipt retention open (90-day proposal); backups obey same policy eventually.
