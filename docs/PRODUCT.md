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
- Admin (`admin.fastenglishpodcast.com`): PocketBase superuser dashboard for technical/content admin only; routine payment review uses the in-app operator UI.

## Plans (prices are open business inputs)
- monthly: 30 days; quarterly: 90 days; yearly: 365 days. Prices backend-managed.

## Authentication
- `phone` required + unique identity; `name` required; `password` required; `email` optional.
- Canonical storage `+989XXXXXXXXX`; UI may accept `09…/989…/+989…`; normalize + validate server-side.
- Client may never set/update `role`, `account_status`, subscription/payment/review fields, or server-calculated values.
- Initial server-managed: `role=student`, `account_status=pending_payment`.
- Roles: visitor, student, operator, content manager, technical admin/superuser.

## Manual payment
- Client submits only `plan_id` + permitted transfer/receipt fields. Server snapshots plan name/price/duration.
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
- Topics; one lesson version per topic+CEFR level (A1–C2); protected audio; published state; one public sample lesson; simple per-user progress.
- Premium content served only when authenticated, not suspended, active subscription, lesson published. Pending/rejected/expired/suspended users must not receive premium body/audio even via direct API.
- PWA SW never caches `/api/`, auth, payments, receipts, placement, premium text/audio, private account data. Only app shell + public static assets cached.

## Operator
- Restricted routes `/operator`, `/operator/payment-requests[/:id]`, `/operator/subscriptions`, limited user support view. Queue: pending first, status filter, search by phone/name/bank ref, pagination, request age, plan/amount snapshot, status badges. Review screen: masked sensitive values, snapshot, protected receipt zoom/preview, transfer details, current subscription, approve/reject, confirm dialog, double-submit lock, feedback, reviewer + reviewed time. Every operator endpoint verifies operator role server-side; UI guard is not authorization. Operators never access passwords, tokens, superuser settings, unrestricted user records, technical credentials.

## UI and accessibility
- Single custom MUI theme, CSS variables, RTL. Persian UI `lang="fa" dir="rtl"`; English lesson body `lang="en" dir="ltr"`. Self-hosted verified Vazirmatn variable WOFF2 (license/attribution confirmed); robust local fallback; no runtime CDN font. English content may use system Latin sans.
- Semantic tokens (Visual Slice 1, from the approved brand palette): complete Light/Dark systems with roles for primary/secondary/accent/background/surface (tonal ladder)/outline/inverse/status/focus/disabled/scrim — defined only in `app/src/app/theme/tokens/colors.ts` and verified by the WCAG contrast gate. CEFR colors via named tokens with accessible pairs. No raw colors scattered in components; typography/spacing/shape/elevation/motion/focus tokens are centralized in `app/src/app/theme/tokens/`. Light/Dark/System theme with persisted preference (`mui-mode`), pre-paint initialization, and Capacitor system-bar sync.
- Mobile-first; bottom nav on mobile; clear hierarchy; restrained elevation; no heavy glassmorphism/glow/excess gradients/decorative animation; no lorem-ipsum; no horizontal overflow; no undersized touch targets; no status by color alone.
- Every flow defines loading/empty/error/disabled/success/permission-denied/offline/stale states. WCAG 2.2 AA: semantics, keyboard, visible focus, labels, contrast, reduced motion, dialog focus, SR async feedback. Visual QA widths: 360/375/390/430/768/1440.

## Performance and UX budgets
- Core pages: fast first paint; no unbounded reads/N+1; paginated lists; lazy audio; bounded concurrency.
- Device/network baseline: low-to-mid Android phones, unstable mobile network; offline-tolerant app shell.

## Acceptance criteria
- [ ] Signup/login with real PocketBase; phone normalization + collision handled.
- [ ] One real disposable receipt request approved; exactly one subscription; repeated approval no double extension; unauthorized receipt/approval fail.
- [ ] 20-question placement completes on real backend in browser + Android; no answer leakage.
- [ ] Active student accesses real lesson + audio; pending/expired denied; progress survives refresh.
- [ ] PWA installable; release APK installs on physical device; APK version + SHA-256 produced.
- [ ] Both builds reproducible; `scripts/verify.sh` green; sensitive-diff `/review` passed; `/ship` run.

## Open product decisions (external inputs)
- monthly/quarterly/yearly prices; destination card number, cardholder, bank name; review SLA; operator hours/identities/count; rejection/refund policy; receipt retention approval; approved privacy/terms copy; support contact; final logo + app icons; 20 reviewed placement questions; initial topics/lesson texts/audio; VPS + DNS access; release keystore ownership + secure storage.

## Security/privacy/compliance constraints
- Data classification: phone + name + receipt images = private; never public. No public receipt files.
- Critical access: server-side authz on every protected action/object; client never trusted for role/price/status.
- External/payment: manual card-to-card only; no payment provider integration; operator verifies externally.
- Retention: receipt retention open (90-day proposal); backups obey same policy eventually.
