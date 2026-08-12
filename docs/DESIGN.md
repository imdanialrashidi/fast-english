# Product Design Contract — Fast English Podcast

This is the visual and interaction source of truth shared by design, implementation, browser QA, and review. It records the **existing accepted direction** (Visual Slice 1/2, Payment redesign, Podcast Slice 5/6 — see `docs/PLAN.md` slice records); a new visual direction requires an accepted `/design` decision, not an edit here.

## Experience brief

- Product / surface: Student App (`app/`, MUI) — a Persian-first "Personal English Podcast App"; supporting surfaces: static Landing (`landing/`, Tailwind) and Staff Admin Console (`admin/`, MUI).
- Primary audience: Persian-speaking adults in Iran on low-to-mid Android phones over unstable mobile networks.
- Single job of the Student surface: let an active student calmly discover and listen to level-appropriate English podcast episodes and track progress — with honest payment/placement/offline states along the way.
- Desired user feeling before → after: "another noisy app / an uncertain path to content" → "a quiet, credible home where the next listen is obvious and nothing lies to me."
- Success signal: a student returns to Continue Listening, finishes episodes, and understands exactly what state their account/level/subscription is in (no surprise routes, no invented values).

## Brand character

- calm, not loud — restrained elevation, no heavy glassmorphism/glow/excess gradients; the midnight/ice palette and quiet surfaces carry the tone (enforced by `shared/ui/tokens/` + `static-quality.test.ts`).
- credible, not corporate — honest Persian copy (no fluency/certification promises, "بررسی دستی توسط پشتیبان", real numbers only); authoritative values always come from the backend, never fabricated in the UI.
- warm and human, not decorative — Persian-first Vazirmatn type, icon+text states (never color alone), what/why/next-action error and empty states (`StatePanel`), canonical product vocabulary (`app/src/app/copy/productCopy.ts`).

## Reference calibration

| Reference | Adopt | Avoid | Why it fits this product |
|---|---|---|---|
| Material 3 foundations & design tokens | Semantic role naming, elevation/motion/shape semantics, tonal surface ladders | M3 default visual identity; generic cards | The token system is explicitly "Material-3-inspired" (`shared/ui/tokens/colors.ts`); familiarity lowers cognitive cost for a mainstream mobile audience |
| Vazirmatn (OFL) | Self-hosted variable font as the Persian-first stack | Any runtime CDN font | Persian UI quality and privacy (no CDN); license/attribution committed (`app/src/assets/fonts/OFL.txt`) |
| WCAG 2.2 + Web Vitals | AA contrast/reflow/zoom targets; LCP/INP/CLS budgets | Treating accessibility as a checklist after design | The product's users include low-end devices and unstable networks; the contrast gate is machine-verified |

References calibrate principles; they are not permission to clone another product.

## Direction

- Visual thesis: a calm, credible midnight-and-ice Persian surface where the CEFR level language makes progress legible at a glance and nothing competes with the content being listened to.
- Signature element: the **CEFR level color language** — named, accessible level pairs (`shared/ui/tokens/cefr.ts`) rendered through the `LevelBadge` (icon + text, never color alone) across Home, Library, and lesson surfaces; echoed by the midnight CEFR-stripe hero on the Landing.
- One justified aesthetic risk: the brand blue `#4f95b5` is deliberately **not** used as a text-bearing fill in Light mode (white on it is ~3.4:1); brand identity is preserved through containers, accents, and the Dark-mode primary (`shared/ui/tokens/colors.ts`). This is a documented, contrast-driven departure from the obvious brand-color button.
- What must feel familiar: standard MUI interaction patterns, bottom navigation on phones, a single obvious primary action per screen.
- What must never look generic: interchangeable gradient/glow/glass effects, a hero plus statistic cards, a wall of equally rounded cards, decorative numbering/badges, or animation everywhere instead of the composed level/continue-listening moments.

## Semantic tokens

All values below are confirmed from `shared/ui/tokens/`; the full Light/Dark role sets (50+ roles each) live in `shared/ui/tokens/colors.ts` and are the only source for colors (`static-quality.test.ts` rejects raw hex in components).

### Color (key roles)

| Role | Light | Dark | Foreground/background use | Contrast proof |
|---|---|---|---|---|
| canvas (background) | `#f5f9fa` | `#05090a` | page canvas | `shared/ui/palette.contrast.test.ts` |
| surface | `#edf4f7` (ladder → `#ffffff`–`#d7e2e8`) | `#0c1316` (ladder → `#070b0d`–`#202c31`) | cards, sheets, chrome | machine-verified AA pairs |
| text (onSurface) | `#0e171b` | `#e4edf1` | primary text | ≥ 4.5:1 |
| muted text (onSurfaceVariant) | `#414e55` | `#b3c1c8` | secondary text | ≥ 4.5:1 |
| action (primary) | `#2a6f8c` / onPrimary `#ffffff` | `#4a90b0` / onPrimary `#04141c` | primary CTA; hover/pressed variants exist | ≥ 4.5:1 on all fill states |
| accent | `#2e7092` / container `#cde8f5` | `#5fb3dd` / container `#307191` | brand accents, selected states | ≥ 4.5:1 pairs |
| danger / success / warning | `#b3261e` / `#1b7a56` / `#8a5a1e` (+ containers) | `#f2b8b5` / `#5db891` / `#d9a05a` (+ containers) | status, never color alone | ≥ 4.5:1 text pairs |
| CEFR levels | A1 `#e0f2fe`/`#075985` … C2 `#fce7f3`/`#9d174d` (`shared/ui/tokens/cefr.ts`) | same named pairs | level badges | AA foreground/background pairs |

### Typography

- Family: Vazirmatn variable WOFF2 self-hosted (`app/src/assets/fonts/Vazirmatn-VF.woff2`, OFL), fallback `"IRANSansX", "Tahoma", "Segoe UI", system-ui…`; English lesson body uses the Latin system stack; numeric/timer tokens keep tabular numerals (`shared/ui/tokens/typography.ts`).
- Scale: rem-based `displayLarge 2.5rem/1.2/700` → `bodyMedium 1rem/1.7/400` → `labelSmall 0.75rem`; Persian body line-height ≥ 1.6; button labels never uppercased; `audioTime` is LTR-isolated so `12:34` stays stable in RTL.
- Purpose: display/headline for page identity, body for Persian reading comfort, `numericMetric`/`audioTime` for progress counts and player timers.

### Geometry and depth

- Spacing: 4px scale (`2/4/8/12/16/24/32/48/64`) plus semantic layout roles (page gutters, section gaps, chrome heights, safe areas) — `shared/ui/tokens/spacing.ts`.
- Grid/content measure: mobile-first single column; English reading content explicitly LTR with a bounded ~40rem measure; no horizontal overflow at any QA width.
- Radius: `10/12/16/20/24/999` semantic roles (control/input/card/dialog/hero/pill) — `shared/ui/tokens/shape.ts`; pill reserved for chips and compact statuses.
- Elevation: 5 elevation roles × scheme mapped to `--mui-elevation-*` (`shared/ui/tokens/elevation.ts`); restrained use; arbitrary shadows rejected by scanner.
- Icon/media: MUI icons only (no second icon set); monochrome brand mark (`shared/ui/brand/Brand.tsx`); status always icon + text.

### Media and art direction

- Photography/illustration: none in the product UI — the brand mark and CEFR color language carry identity; the Landing uses the midnight CEFR-stripe + waveform motif.
- Icon family: MUI (24px grid, outlined semantics); stroke/fill rules follow MUI defaults with themed selected-state shapes (bottom-nav `::after`, tonal rail/side-nav).
- Asset source/licensing: Vazirmatn OFL (attribution committed); brand SVG/PNG assets under `shared/assets/brand/` + `app/src/assets/brand/`; generated PWA/APK icons via `scripts/generate-brand-icons.mjs`.
- Fallbacks: robust local font stacks; `alt` text meaningful on all media; broken-media states handled by `StatePanel`.

## Composition and responsiveness

- Desktop composition: lg+ Side Navigation (248px) + in-flow content; md–lg icon-only Navigation Rail (88px).
- Mobile recomposition: compact Top App Bar + 4-item Bottom Navigation (safe-area aware); content padded in-flow (nothing ever covered by chrome).
- Dense/long-content behavior: long Persian/English titles wrap (`overflowWrap`), CTAs reachable at 360px; tables/cards recompose at narrow widths; 200% zoom containment verified.
- Supported viewport/device baseline: 360/375/390/430 (phones), 768/1024 (tablets), 1440 (desktop); 200% text zoom; touch + keyboard input.
- RTL/localization behavior: `lang="fa" dir="rtl"` shell with MUI RTL Stylis + Emotion cache (portals inherit); English lesson body `lang="en" dir="ltr"`; LTR-isolated phone/email/card-number/timer blocks inside the RTL shell; `fa-IR` locale formatting for numbers/dates.

## Components and states

| Component / pattern | Variants | Required states | Reuse or change |
|---|---|---|---|
| `StatePanel` | loading/empty/error/permission/offline/unavailable | icon+text, what/why/next-action; `requestId` placeholder for errors | shared (`shared/ui/StatePanel.tsx`) |
| `PageSkeletons` | dashboard/lessons/detail | polite live-region announcements | shared |
| `LevelBadge` | CEFR A1–C2 | default (icon+text, accessible pair) | shared pattern across Home/Library/lessons |
| `LessonCard` | not_started / in_progress / completed / unavailable | never color-only; text + icon + `progressbar` | shared card across surfaces |
| Bottom Nav / Rail / Side Nav | 4 destinations (خانه/کتابخانه/پیشرفت/حساب) | `aria-current`, selected shape indicator, ≥44px targets | shared shell |
| `AudioPlayer` | play/pause/seek/±10s/speed/volume/mute | loading/playing/paused/error/completed; no autoplay; resume from saved position | shared player |
| Payment journey | 5 explicit stages | pending/rejected/approved/cancelled; copyable destination; receipt picker/preview | payment feature |
| Theme control | سیستم/روشن/تاریک | persisted (`mui-mode`), pre-paint init, Capacitor system-bar sync | Account settings + Top Bar |

Required journey states: loading (skeletons), empty (honest no-lessons/no-progress), error/retry (StatePanel), success (persistent after submit/approve), permission-denied (guards + StatePanel), offline (SW shell + honest copy).

## Motion and feedback

- Orchestrated moment: the Continue Listening hero (resume) and the CEFR badge language are the composed moments; everything else is restrained state feedback.
- State-transition motion: route entrance (fade+rise, opacity/transform only), Mini Player entrance, theme cross-fade, metadata quieting while reading — all from motion tokens (`shared/ui/tokens/motion.ts`: 80/150/240/420ms, standard/decelerate/accelerate/emphasized easings).
- Reduced-motion alternative: theme-level `prefers-reduced-motion` collapse, verified in-browser; no `transition: all`, no raw durations (scanner-enforced).
- Sound/haptics: none.

## Content voice

- Vocabulary and tone: canonical Persian product vocabulary — اپیزود, کتابخانه, سطح پیشنهادی, سطح پیشفرض, ادامه گوشدادن, شروع گوشدادن, مرور دوباره, کلمات کلیدی, متن اپیزود, پیشرفت — centralized in `app/src/app/copy/productCopy.ts`; no Staff/operator terminology in the Student surface (scanner-enforced).
- Action-label rules: verbs match the real action («ادامه از HH:MM», «شروع گوشدادن»); labels never restate the obvious.
- Error and empty-state rules: state + reason + next action; no raw backend errors, no fabricated values; payment copy never implies automatic verification.
- Realistic content fixtures: `app/src/data/previewData.ts` (clearly marked), deterministic e2e fixtures; long Persian/English titles exercised.

## Quality budgets

- Accessibility target: WCAG 2.2 AA (semantics, keyboard, visible focus, labels, contrast, reduced motion, dialog focus trap/return, SR async feedback).
- Contrast: text ≥ 4.5:1, UI components ≥ 3:1, focus rings ≥ 3:1, disabled ≥ 1.5:1 — machine-verified by `shared/ui/palette.contrast.test.ts`.
- Touch target: ≥ 44px primary controls; keyboard focus visible.
- Performance: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75 as production targets (rubric defaults); no unbounded reads/N+1, paginated lists, lazy audio, bounded concurrency; offline-tolerant shell.
- Image/font/JS budget: self-hosted variable font (single WOFF2), no runtime CDN; deterministic builds.
- Supported browsers/input: modern Chrome/Android WebView (PWA + Capacitor APK), modern desktop browsers; touch + keyboard.

## Screen acceptance

| Flow / screen | Critical states | Viewports/locales | Visual proof |
|---|---|---|---|
| Entry / login / signup | loading, validation, error, permission | 360–1440, fa-RTL | `e2e/visual-slice-2.spec.ts` + quality gates |
| Shell (Home/lessons/library/progress/account) | skeletons, empty, error, offline | 360/375/390/430/768/1024/1440, light+dark | `e2e/visual-slice-1/2.spec.ts` (50+88 tests) |
| Payment journey | pending/rejected/approved/cancelled, receipt picker/preview, offline | 360–1440, fa-RTL | payment feature specs + `payment-redesign.quality.test.ts` |
| Lesson detail + player | loading/playing/paused/error/completed, resume | 360–1440, en-LTR body | `e2e/p3-s1/p3-s2.spec.ts` |
| Landing | static, APK/PWA links honest, legal banners | 360–1440 | `e2e/p4-s1-landing.spec.ts` |
| Admin Console | queue/empty/error, review states | 360–1440 | operator e2e specs |

Screenshot evidence is captured during QA under `.artifacts/playwright/` (git-ignored); committed proof is the deterministic browser gates above.

## Episode Experience (Slice 7 — accepted design decision)

The Student Episode page (`/lessons/:variantId`) is the listening **and** learning room. It unifies what Slice 6 discovers: one Episode, one CEFR Variant at a time, one calm flow from artwork to transcript, with the level unmistakable and the learning layer reading like liner notes below the music — never like an LMS or a dashboard.

### Direction

- **Thesis:** every Episode is a record you hold — the artwork is the jacket, the CEFR level is the edition stamped on it, the Deck is the player, and the learning layer (Persian summary → key vocabulary → transcript) reads like liner notes beneath it; listening and reading never compete.
- **Signature — the Edition Rail:** the six CEFR plates (A1–C2) beneath the artwork, like edition labels on a record: the current Variant's plate is filled with its level pair, `پیشفرض`/`پیشنهادی` markers sit on the relevant plates (precedence when a plate is both: «پیش‌فرض» — the student's explicit choice — outranks «پیشنهادی» guidance on the 44px plate), unpublished editions are honestly disabled, and the Deck is crowned by a 4px level-colored edition stripe (the CEFR-stripe motif already native to the Landing). Switching an edition swaps audio, progress, summary, vocabulary and transcript as **one Variant state** — never mixed old/new.
- **One justified aesthetic risk:** the desktop composition abandons the single stacked column for a two-column **jacket + liner-notes** layout — a sticky jacket column (artwork, edition rail, identity, Deck always visible) beside a bounded reading column (≤40rem). This is the real departure from the safe stacked-card template; it must be proven at 1024 (rail nav) and in dark mode, where the jacket column must not crush the reading measure.
- **Rejected generic choice:** the stacked-card lesson page — identity/player/summary/vocabulary/transcript as a wall of equally rounded MUI cards with chip-heavy metadata and tabbed sections. That is the trajectory of the current surface and reads as an LMS/dashboard; it scales instead of transforming.
- **Rendered grounding (measured at 390px, current product):** identity row = LevelBadge + 3 chips (incl. the English title repeated); Deck = 288px bordered card with a 5-chip speed wall; no artwork anywhere in the listening surface; transcript opens with a repeated English H2 at full gutter width; summary/vocabulary/pronunciation/level-switch/prev-next are absent. Slice 7 therefore: brings artwork into the listening surface, replaces chip walls with the Edition Rail + speed menu, merges the 134px resume card into the Deck, turns the learning layer typographic, and recomposes desktop into two columns.
- What must stay familiar: shell navigation, MUI controls, `LevelBadge`, `StatePanel`, one dominant action per state, RTL shell with LTR-isolated English (existing token/typography discipline).

### Composition and responsive transformation (three real tiers)

| Tier | Viewport | Composition |
|---|---|---|
| Phone `xs` | <600 | Jacket: artwork (start-aligned, ≤240px, aspect 1:1 reserved) → Edition Rail → identity (H1 titleFa, EN caption, level line, quiet meta) → Deck → خلاصهٔ اپیزود → کلمات کلیدی → متن اپیزود → prev/next footer. Deck is in-flow; once playing, the existing MiniPlayer follows the student when the Deck scrolls away (never over the bottom nav). |
| Tablet `md` | 600–1023 | Jacket-front: artwork (~200px) beside the identity; Edition Rail under the artwork; Deck full-width, sticky below the header while reading (existing safe-bound behavior kept); learning sections single-column. |
| Desktop `lg+` | ≥1024 | Two-column: sticky jacket column (artwork ~280px, Edition Rail, identity, Deck always visible) + reading column with خلاصه → کلمات کلیدی → متن, measure ≤40rem, start-aligned; prev/next at the end of the reading column. |

### The Jacket (artwork + Edition Rail + identity)

- **Artwork:** reuse `EpisodeArtwork` (aspect-ratio reserved → no CLS; resolution chain; Product fallback; `eager` — it is the first-viewport asset; public-cacheable). Alt = Persian title.
- **Edition Rail (radiogroup `aria-label="سطح اپیزود"`):** renders the full CEFR ladder from `CEFR_ORDER`; published editions come from `availableLevels` (variantId, isRecommended, isPreferred). Plate = 44px square, `LevelBadge` box styling (level pair). States: current = filled level pair + `aria-current`; other published = outlined neutral; unpublished/archived = disabled muted plate that never navigates. Attempting an unpublished plate reveals the honest line «این اپیزود هنوز در سطح X منتشر نشده است.» (no invented «بهزودی»). When current ≠ recommended, a quiet caption sits under the rail: «سطح پیشنهادی برای تو B2 است.» — guidance, never a restriction, never a block.
- **Read-only browsing:** switching editions only changes the route (`/lessons/:variantId`; Back works; URL is the browsing state). It never mutates `recommendedLevel`, `preferredLevel`, other levels' Progress or the Subscription. There is **no** "set as default level" affordance on this surface — changing the preferred level stays an explicit separate action (Account/Placement screens, existing).
- **One-Variant swap:** all Variant content (audio, progress, summary, vocabulary, transcript, counts) comes from one Variant payload; while a switch is in flight the rail is disabled with «در حال بارگذاری نسخهٔ سطح X…» + skeletons of the variant-dependent regions only — the jacket (artwork + rail + identity) stays rendered, nothing from the old Variant remains visible, stale responses are discarded (existing seq-guard pattern).
- **Identity block:** category kicker (primary caption, 700 — existing EpisodeCard language) → H1 = `titleFa` (`headlineLarge` xs / `headlineMedium` lg, `overflowWrap`) → English title as LTR `englishMetadata` caption → level line «سطح B1 · متوسط» (+ «پیشنهادی»/«پیشفرض» markers live on the rail) → quiet meta «اپیزود ۱۲ · ۱۲ دقیقه» (episode number and authoritative duration only when real). No chips in the identity block. The repeated English H2 above the transcript is removed — the title lives in the jacket.
- While the transcript is being read, the identity block quiets (opacity only, presentation-only — existing behavior kept).

### The Deck (the player — the primary visual object)

- **Anatomy (top→bottom):** edition stripe (4px, level pair bg) → state line («در حال گوش‌دادن · ۲۱٪» / «این اپیزود کامل شده است» + check / error line with retry) → timeline (slider + `audioTime` timestamps, tabular LTR) → transport row: [−10s] [primary CTA, fixed 56px slot] [+10s] [speed menu] [mute]; volume slider `sm+`. Tonal surface (`surfaceContainerHigh`), `radiusCard`, no border, no elevation — the Deck reads as the room's player, not a card in a wall.
- **Primary CTA (single dominant control, fixed height → no CLS):** not started → «شروع گوش‌دادن»; in progress ≥5s → «ادامه از HH:MM» (plays from the saved position); <5s → «پخش»; completed → «مرور دوباره» (plays from 0); playing → pause icon in the same slot. The 134px resume card above the player is **merged into the Deck** — resume is a label on the play control, not a second surface.
- **Speed:** a compact menu (button «۱×» → 0.75–2×), replacing the 5-chip wall.
- **Progress:** per-Variant only (existing `useProgressSave` hooks, throttled + revision-guarded); the timeline is the progress bar; percent text in the state line.
- **Deck budget:** ≤ ~220px tall at 390px (today 288px) and **zero chips**.
- **States:** loading metadata / ready / playing / paused / resumed / completed / temporary audio error (retry, no raw media errors) / unavailable source («فایل صوتی در دسترس نیست.») / entitlement loss → route-level permission `StatePanel` + player session cleared (MiniPlayer hides).

### Learning layer (liner notes — typographic, no cards)

- **خلاصهٔ اپیزود:** `variant.summaryFa` as a Persian lede (`bodyLarge`), plain flow, no card, no English duplication.
- **کلمات کلیدی:** heading carries the count («کلمات کلیدی · ۳»). One column of rows; row line 1 = term (`titleMedium`, LTR, bold) + phonetic (`englishMetadata`, LTR, muted) + part of speech (`labelSmall`, muted — text, not a pill); line 2 = Persian meaning. Each row expands (one open at a time, `aria-expanded`) to reveal English definition + example sentence (`englishReading`, LTR) + the pronunciation control. Quiet row dividers; wraps at 360px; never a table, never a card wall, never flash-card mode. Legitimate empty state (Variant truly has none): «برای این اپیزود واژهای ثبت نشده است.»
- **Pronunciation (explicit contract):** chain = uploaded `pronunciation_audio` (protected URL, same token mechanics as Episode audio; never precached — existing SW boundary) → device/browser speech synthesis (English voice; voices may load async via `voiceschanged` — a click before voices arrive shows a brief loading state and re-evaluates on the event; no English voice after the event → unavailable) → honest unavailable: «تلفظ صوتی برای این واژه در دسترس نیست.» A transient playback failure (network blip, rate limit) is a retryable error («تلاش دوبارهٔ تلفظ»), not a permanent unavailable — only the definitive chain end marks a word unavailable; a superseded/interrupted utterance never poisons the word. Exclusivity: pronunciation playback **always pauses the Episode audio first**, plays the short clip, and leaves the Episode paused at the same position — the student resumes deliberately; a pronunciation clip never seeks the Episode, never saves progress, never touches the Player session; the control is disabled while a Variant switch is in flight. Per-word control states: idle → loading → playing (icon swap, «توقف تلفظ») → retryable error → unavailable (honest line, control hidden/disabled).
- **متن اپیزود (transcript as a serious reading surface):** H2 «متن اپیزود» (Persian); body = English paragraphs only (plain `\n\n` splits — no arbitrary HTML, existing `splitParagraphs` contract); `englishReading` (18px/1.8, LTR, ≤40rem). Long transcripts keep the measure and paragraph rhythm — no pagination, no tabs, no sticky chrome over text.

### Previous/next footer

Rendered **only from server-provided refs** when real published neighbors exist at the current browsing level (with a published Variant): quiet pair «اپیزود قبلی» / «اپیزود بعدی» with a 56px artwork thumb + `titleFa`; mobile after the transcript with bottom-nav clearance; desktop at the end of the reading column. Absent refs → no footer at all (no fabricated neighbors, no carousel).

### State language (complete contract)

| State | Visual + copy | Announcement / behavior |
|---|---|---|
| Loading (first visit) | Media-aware skeleton: artwork block → rail plates → identity lines → Deck skeleton → section lines (evolved `LessonDetailSkeleton`) | polite live region «در حال بارگذاری اپیزود…» |
| Variant switching | Rail disabled, «در حال بارگذاری نسخهٔ سطح X…», skeletons of variant regions only; jacket stays | «نسخهٔ سطح X بارگذاری شد.» |
| Unpublished level | Disabled plate + «این اپیزود هنوز در سطح X منتشر نشده است.» | same line on focus attempt |
| Resumable | Deck CTA «ادامه از HH:MM» seeks + plays from saved position | CTA label is the state |
| Completed | «این اپیزود کامل شده است» + check in the Deck; CTA «مرور دوباره»; 100% timeline | — |
| Audio failure | Deck error line + «تلاش مجدد» (no raw media errors) | `role="alert"` |
| Pronunciation unavailable | per-word honest line, control hidden/disabled | — |
| Empty vocabulary (legitimate) | one quiet line under the heading | — |
| Long transcript | measure + rhythm only; no pagination | — |
| Entitlement loss | route-level permission `StatePanel` («بازگشت به کتابخانه») + session cleared, MiniPlayer hides | existing guard copy |
| Recoverable network failure | surface `StatePanel` error + retry (Library refresh-nonce pattern); Deck keeps its inline retry | — |

### Motion

- One orchestrated moment: the **edition switch** — the selected plate fills with its level pair (standard 150ms), the variant-dependent regions cross-fade as one unit (decelerate 240ms, fade+rise), the live region announces the loaded level. Everything else is restrained state feedback (timeline seek, CTA label swap, expander). Tokens only; the theme-level `prefers-reduced-motion` collapse covers all of it.

### Content voice (canonical copy additions — `productCopy.ts`)

Add to the canonical set (adult, concise, consistent with existing Podcast-first vocabulary; scanner-enforced like the existing list): خلاصهٔ اپیزود, تلفظ, پخش تلفظ, توقف تلفظ, تلاش دوبارهٔ تلفظ, اپیزود قبلی, اپیزود بعدی, پیشنهادی (rail marker), پیش‌فرض (rail marker), plus the exact strings:

- «در حال بارگذاری نسخهٔ سطح X…» / «نسخهٔ سطح X بارگذاری شد.»
- «این اپیزود هنوز در سطح X منتشر نشده است.»
- «سطح پیشنهادی برای تو X است.»
- «برای این اپیزود واژهای ثبت نشده است.»
- «تلفظ صوتی برای این واژه در دسترس نیست.»
- «این اپیزود کامل شده است.» (replaces the legacy «این درس کامل شده است.» in the player)
- «اپیزود N · M دقیقه» (only when the values are real)

### Implementation constraints and data-contract deltas

- No new dependencies; MUI + `shared/ui/tokens` only; no raw hex/durations (existing scanners cover new components); the podcast copy scanner must cover the new surface's copy.
- Components: `LessonDetailRoute` evolves into the Episode surface (same route, phase machine, progress hooks); new `EpisodeJacket` (artwork + Edition Rail + identity), `VariantDeck` (player), `LearningSection`, `VocabularyList`, `PronunciationControl`, `PrevNextFooter`; reuse `EpisodeArtwork`, `LevelBadge`, `StatePanel`, `PageSkeletons`, `AudioPlayer` mechanics (transport/seek/speed/mute), `PlayerProvider` (single audio element, MiniPlayer interplay unchanged).
- API deltas (server, in Slice 7 scope): (1) student-side vocabulary endpoint per Variant (ordered by `sort_order`, sanitized, `pronunciation_audio` via the protected token mechanics); (2) `previousEpisode`/`nextEpisode` refs on the lesson detail response (only when real published neighbors exist at the current browsing level). The detail response already carries `episode`, `variant` (summaryFa + transcript), `availableLevels`, `vocabularyCount`, `recommendedLevel`/`preferredLevel`.
- TTS guard: `speechSynthesis` presence + an English voice (async `voiceschanged`); TTS never runs while Episode audio plays.
- The Edition Rail renders the full CEFR ladder client-side and intersects it with server `availableLevels` (published only) — the server stays the authority; disabled plates are honest absence, never «بهزودی».

### Quality budgets (Slice 7)

- WCAG 2.2 AA; contrast machine-verified (plates reuse the tested CEFR pairs; the edition stripe is non-text, checked ≥3:1 against the Deck surface; focus rings from tokens).
- Touch ≥44px (rail plates, CTA, transport, expanders, prev/next); keyboard: rail radiogroup arrows, speed menu, expanders, full Deck keyboard operation; visible focus everywhere.
- No horizontal overflow at 360/375/390/430/768/1024/1440, light+dark; 200% text zoom (rail may wrap; no fixed heights on text); reduced motion collapsed.
- LCP ≤2.5s (artwork eager + public cache), CLS ≤0.1 (reserved aspect ratio, fixed CTA slot, switch skeletons), INP ≤200ms (one Variant fetch per switch, no work on the hot path).
- RTL/LTR: RTL shell; LTR-isolated term/phonetic/timestamps/English captions.

### Screen-level visual acceptance and evidence (what `/build-ui` ships and `/design-review` proves)

| State / view | Mobile (390) | Tablet (768) | Desktop (1440) | Both modes |
|---|---|---|---|---|
| Fresh (not started) + long title | ✓ full-page | ✓ | ✓ two-column | light + dark |
| Resume (ادامه از HH:MM in the Deck) | ✓ | ✓ | ✓ | light + dark |
| Completed | ✓ | — | ✓ | light + dark |
| Edition switch mid-flight + after | ✓ (skeletons, no mixed state) | — | ✓ | light + dark |
| Unpublished plate attempt | ✓ honest line | — | ✓ | both |
| Vocabulary expanded + pronunciation playing | ✓ | — | ✓ | both |
| Pronunciation unavailable | ✓ | — | — | both |
| Empty vocabulary | ✓ | — | — | both |
| Audio failure + retry | ✓ | — | ✓ | both |
| Entitlement loss / network failure | ✓ `StatePanel` | — | ✓ | both |
| 200% text zoom | ✓ no overflow | — | ✓ | both |

Committed deterministic gates (mirroring `visual-slice-2`): new `e2e/podcast-episode.spec.ts` (real PB: CTA labels per state, resume seeks to saved position, edition switch swaps Deck label + summary + vocabulary + transcript + progress in one state and never mixes, unpublished plate + honest line, pronunciation pauses the Episode and never saves progress, vocab expander, prev/next only with real refs, rail radiogroup keyboard, RTL/LTR isolation) + the geometry sweep at all QA widths light/dark (no overflow; Deck ≤ ~220px at 390px; transcript measure ≤640px; rail within jacket) + contrast-gate extension for the stripe pair. Human-review screenshots (opt-in, `podcast-s5`-style artifacts outside the repo) cover every row of the table above.

## Decisions intentionally deferred

- Final logo / app icons / brand polish (open input; placeholder assets flagged).
- Landing redesign (documented record: not started).
- Payment and Operator redesigns are complete; Audio reliability, Performance, Monitoring remain not started (see `docs/PLAN.md` slice records).

## Decision log

| Date | Decision | Evidence / rationale | Revisit when |
|---|---|---|---|
| 2026-08-02 | Replace raw midnight/violet foundation with the M3-inspired semantic Light/Dark token system (`shared/ui/tokens/`) | Visual Slice 1 record (`docs/PLAN.md`); contrast gate 83 checks | A new accepted brand direction |
| 2026-08-02 | `#4f95b5` not used as a Light text-bearing fill | colors.ts rule; AA requires ≥4.5:1 | Palette revision with evidence |
| 2026-08-02 | Student surface recomposed phone/tablet/desktop navigation (bottom nav / rail / side nav) | Visual Slice 2 record; browser geometry sweeps | New IA decision |
| 2026-08-03 | Payment journey as 5 explicit stages with honest manual-review copy | Payment Experience Redesign record | Operator/payment flow change |
| 2026-08-06+ | Podcast-first Home + Library vocabulary (اپیزود/کتابخانه/…) centralized in `productCopy.ts` | Podcast Slice 5/6 records; copy scanner | New product language |
| 2026-08-09 | Episode Experience (Slice 7): record-jacket composition — artwork-led jacket, Edition Rail (CEFR plates + level stripe on the Deck), resume merged into the player, typographic learning layer (خلاصه/کلمات کلیدی/متن), two-column desktop; one-Variant swap semantics; pronunciation exclusivity contract | Slice 7 design decision (this document); rendered geometry of the current surface (deck 288px with 5 speed chips → ≤220px with zero chips; chip walls → Edition Rail + speed menu; artwork enters the listening surface) | Implementation opens a different composition or changes level semantics |
