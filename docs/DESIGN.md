# Fast English — Design Contract

Source: scope §17 (UI/UX), §6 (routes/nav), §7 (flows), §13 (player/progress). Scope §17.1 palette/typography values are **proposals, not owner approval**.

> **Owner approval 2026-10-29.** The owner delegated the remaining open design/copy decisions ("fill the test / awaiting-owner-approval places yourself") and approved the values already shipped in `resources/css/app.css` and the React pages. `PROPOSED` labels below are kept as history of when a value was introduced; they are no longer open questions. Anything that is a fact rather than a decision (real card, paid provider, licensed content, real-device proof, legal review) is still not claimed as approved.
>
> **Commercial correction 2026-10-29.** The 299,000-toman single-package note is retired. The live catalog is the owner's three plans (399,000 / 957,600 / 3,351,600 toman, see `PlanCatalogSeeder`); the landing quotes the cheapest active plan from the database instead of a hardcoded amount.

## Owner instruction 2026-10-25 — app-like shell, one lockup, denser discovery

This supersedes the earlier quiet brand header, the mobile monogram/wordmark rule, and the full-width filter card. The palette, permanent-light rule, RTL/LTR split, and one-player contract are unchanged.

- **One brand source.** `Logo/fast_english_app_favicon.png` and `Logo/fastenglish_header_logo.png` are the owner sources; `public/icons/*`, `public/favicon.ico`, and `public/images/brand/fastenglish-header-logo{,-dark}.png` are derived. The navy lockup is used on paper, the warm-paper lockup on the deep footer. No icon-plus-text approximation.
- **Contextual app bar, no repeated logo.** Each screen renders `ScreenHeader`: sticky 56px, title at the start, one action at the end, and a back chevron on nested screens. Root screens have no logo bar; mobile Today begins with the greeting. The brand remains on landing/login, the PWA/splash icon, and the desktop rail.
- **Discovery density.** Sticky search under the bar; level/category in a native bottom sheet; active filters as removable chips; result count and a clear link on one line; 16:9 cover at 96px (128px from `sm`), a 2-line English title, one column on mobile and two dense columns from `md`, so the first result sits above the fold.
- **Pagination.** One shared component on Discover, Saved, and Words: Persian numerals, windowed numbers on desktop, compact «قبلی / صفحه ۲ از ۵ / بعدی» on mobile, `aria-current`, results focus/scroll and a live page announcement after a visit. Server-side clamp redirects out-of-range and malformed `page` values with filters intact.
- **Notebook.** CSV import is retired. The review CTA is the only primary action; status tabs are one scrollable row; row actions are quiet text controls; a toast confirms success while the inline status remains the accessible source.
- **Reader.** Back + English title in the bar (the editorial title stays in the page); bookmark near the top; «خواندم»/reset after the glossary with a way back to Discover. No second player.
- **Shell state.** Real due-word badge on the Words tab (count only, shared prop); PWA install card on Account driven by `beforeinstallprompt` (remembered dismissal; no fake iOS button); first-run level card on Today and a level CTA in Account.
- **Motion.** `fe-press` 150ms and `fe-enter` 180ms only under `prefers-reduced-motion: no-preference`; no page-transition framework.

## Owner instruction 2026-10-25 — business settings and honest checkout states

- **Plans are server data.** The subscribe page renders Persian plan names, Persian-digit toman amounts, and duration from active plan rows. Staff edit them in Plans; the owner catalog seeder is only an initial/repeatable install.
- **Unconfigured payment is a calm closed state.** If the active card is the placeholder, the fallback switch is off, or no destination exists, the plan list still shows prices but the CTA reads «پرداخت هنوز فعال نشده» and is disabled; the server refuses creation with the same reason. A placeholder card is never presented as a transfer target.
- **Gateway controls are prepared, visibly not live.** Business settings stores provider/merchant/sandbox and explains that no driver is registered; it never presents an online gateway as working. Card fallback remains the live method.
- **Trust pages read as normal public copy.** Terms, privacy, and refund are readable Persian paragraphs; support/cooperation show the supplied channel as a link. No internal workflow badge or invented contact appears.

## Owner instruction 2026-10-25 — no developer copy, shared player console, calmer states

- **No framework or workflow copy reaches a learner.** Validation, auth, throttle, 403/404, and session-expiry failures render Persian text; internal `DRAFT`/`BLOCKED` labels are never shown on public pages. Missing legal/support/release inputs show a calm «هنوز منتشر نشده / به‌زودی» state with no invented contact, legal text, or download claim.
- **One player surface.** `resources/js/components/AudioConsole.tsx` is the single visual/interaction console for the persistent learner bar and the public sample. Collapsed: play · artwork (≥sm) · EN title + level · elapsed/total · speed · expand, with a top progress line and buffered overlay. Expanded: RTL time labels around the seek fill, `−10s / play / +10s`, live buffering status, and the error/retry blocks. One `#player-play` exists at a time; no duplicate controls.
- **Player feedback.** Buffering shows a spinner and `aria-busy`; failed progress saves surface in the collapsed bar with retry; expansion increases the content end-padding and lifts the PWA notice so neither is covered.
- **Loading discipline.** Public visits show a header hairline; learner visits add a skeleton only after 180 ms, skip it for partial reloads, keep it below the player/tabs, and release a hung navigation after 20 s. Search submits through Inertia so audio and SPA state survive.
- **Truthful state.** Placement answers mark themselves saved per question and gate final submit on the real count; SRS grade buttons stay locked until the next card; destructive reset/cancel/delete are two-step; Today's headline depends on real progress; failures use `role="alert"` + danger styling, not the success/status tone.

## Owner instruction 2026-10-21 — plain reader, Persian chrome, app-like account

This is the current owner direction and supersedes every sentence-cue, English-kicker, and account-navigation rule later in this file.

- **Plain reader:** the learner reader, public sample, and landing preview render normal English paragraphs beside the normal player. No sentence highlight, bold/active row, click-to-seek, cue follow-scroll, or cue-derived copy. Cue columns, validators, staff editor, and cue tests were removed.
- **Persian chrome:** remove the English editorial kickers (`Today`, `Discover`, `Words`, `Review`) and the English `Example` field label. English remains only for lesson content, level codes, timestamps, and the brand.
- **App shell:** remove the in-app marketing footer, the duplicate signed-in header account CTA, and the account page’s duplicate main-navigation chips. The bottom tabs / desktop rail are the only main navigation.
- **Account:** an app-style profile screen — identity card, level/goal summary, subscription status with exactly one next action, a quiet settings list (settings, saved, placement), and logout. Persian dates and digits; email stays LTR.
- **Today:** one due-vocabulary action, no duplicate due-words section, no repeated level line, and a real progress ring derived from `progress_pct`.

## Owner direction (confirmed)

- Calm, professional, adult, readable, editorial; visual focus on text, lesson image, and playback (§17.1).
- Mobile-first, single-column on mobile; reading measure ~680px on desktop (§17.1).
- Persian RTL chrome, English content LTR (scope §17.3).
- No admin-dashboard look in the learner surface (§17.1).
- No second frontend; learner styling is Tailwind 4.1+ with Flux Free only where needed + bespoke Blade (§2).

## Owner instruction 2026-10-09 (authoritative per scope §0 — save-only, no UI built this turn)

The product and landing must look polished, distinctive, and professional, comparable to leading consumer audio and learning apps. Dark mode is required alongside light mode. The palette must be distinctive. Every published topic must show a real cover image, not an empty placeholder.

## Owner-approved amendments 2026-10-09 (supersede cited scope text; reason recorded)

1. Dark mode into v1 (was scope §4 excluded). Full second theme alongside light. Light is the default; user can choose system, light, or dark. Reason: owner requires dark alongside light for parity with leading audio/learning apps.
2. Scope §17.1 restraint relaxed, narrowly. Gradients and glow allowed only in cover art and the landing hero. Motion allowed only for state feedback and transitions, and must respect `prefers-reduced-motion`. Shadows limited to named elevation tokens. Reason: owner requires polished/distinctive finish; prior blanket ban blocks cover/hero craft.
3. Navigation to mobile bottom tab bar: Library, Saved, Account; mini-player above it with safe-area padding. Supersedes top-bar placement. Scope §17.3 already assumes bottom nav/mini-player/safe-area. Reason: owner polish + audio-app pattern on mobile.
4. Covers for every published topic. Default is a generated abstract cover, rendered server-side with GD, deterministic from the topic slug, with no text baked into the image. Staff may upload licensed photos; each upload needs a license record: source, license name, date checked, usage notes. No image fetched from a third-party API at runtime. Reason: owner requires no empty placeholder; provenance must be auditable without runtime dependency.
5. Amber replaces the navy/blue identity from scope §17.1 (primary `#1D4ED8`, primary-hover `#1E40AF`) with the Night Studio amber scale (dark `#F5A524`, light `#B45309`, sepia `#92400E`); navy/blue is no longer the identity. Owner-approved on 2026-10-09 by owner direction. Reason: owner direction requires a distinctive polished palette with a warm amber signal for play/progress.
6. Soft Day light theme (owner Softly inspiration, 2026-10-09) replaces the Night Studio light table and the §17.1 proposal values in code for learner app surfaces: canvas `#FDFCF8`, surface `#FFFFFF`, text `#292524`, muted `#78716C`, coral primary `#FFB7B2`/hover `#FF9E99` with dark label `#292524`, divider `#E7E5E4`, input-boundary `#78716C`, lavender tint `#EFEDF4`; sage `#E8EFE8` recorded for landing. Performance-heavy effects explicitly excluded (no grain overlay, no backdrop-blur, no permanent/floating animation, no giant blurred blobs). Landing markup untouched. Owner-approved on 2026-10-09 by owner direction. Reason: owner wants the Softly look in the app without the perf cost.

## Owner-approved design direction 2026-10-10 — Premium editorial publication (APPROVED, canonical; design-contract only, no UI built this turn)

This section records the new owner-approved design direction verbatim as the canonical design contract. It supersedes all earlier token tables for application UI (Modern Hybrid light/dark 2026-10-10, Blue/Teal 2026-10-09, Soft Day, Night Studio dark/light/sepia, section 17.1 proposals) which are retained below as history only. It also supersedes the 2026-10-09 dark-mode requirement (Owner instruction + amendment 1: system/light/dark choice) — the product now has one permanent light theme only. The 2026-10-10 Inertia migration decision (single permanent light theme) is consistent with this direction and is not reopened. No application code was changed in this turn.

### Owner direction (explicit — OWNER, not agent inference)

- Product feel: distinctive, premium English-learning publication — editorial, calm, sophisticated, highly readable, warm, carefully crafted.
- Explicit avoids: generic SaaS dashboards, excessive cards, clutter, gratuitous gradients, glow effects, random decoration, AI-generated-template aesthetics.
- 2026-10-11 public-to-learning slice (OWNER request: warm editorial canvas, crisp white surfaces, deep navy hierarchy, restrained teal accents, reader-first): maps exactly onto the hexes above with no new values — canvas/surface/ink carry the warmth and hierarchy, accent/accent-strong carry the teal restraint. No new palette choice recorded.
- Exact owner-approved Tailwind CSS 4 palette (hexes preserved exactly, no substitution):

```css
@theme {
  --color-canvas: #F7F4EE;
  --color-surface: #FFFFFF;
  --color-ink: #101B33;
  --color-muted: #55607A;
  --color-line: #E4DED2;
  --color-field: #7C8798;
  --color-primary: #1F3B82;
  --color-primary-hover: #172F69;
  --color-accent: #0E8F8A;
  --color-accent-strong: #0B6E6A;
  --color-success: #1B7F4B;
  --color-danger: #B42318;
}
```

- Permanent light theme only: no dark/system setting, no alternate palette, no theme-choice UI, no theme storage.
- Persian interface with correct RTL layout; English learning content remains LTR and uses appropriate English typography.
- Mobile-first, excellent reading ergonomics, generous but purposeful whitespace, consistent spacing, typography, radii, borders, controls, and interaction states.
- Distinctive information hierarchy; strong editorial treatment of lesson titles and English text.
- Subtle, purposeful transitions only; respect reduced-motion preferences.
- Accessible contrast, clear focus states, descriptive control labels, touch-friendly targets.
- Preserve the exact hex values; define semantic roles and measure real foreground/background pairs rather than arbitrarily changing colors.

### Brief pin (agent synthesis from PRODUCT.md + scope sections 1/6/7/13/17 — PROPOSED framing, not new owner facts)

- Audience: adult Persian-speaking learners (mobile-first) picking a short English article at a CEFR level, reading + listening to the same version, saving words, resuming later.
- Surface single job: get the learner into the right lesson text + matching audio with minimum friction, then keep reading/listening/resuming calm.
- Content/states: real topics/lessons per level, sentence cues with fallback, key-word glossary, vocab notebook + SRS, daily plan, player (play/pause/seek/plus-minus-10s/speed), progress/resume, saved, placement (optional), payment/subscription states (pending/rejected/expired/locked), loading/empty/error/retry/offline.
- Brand tensions (PROPOSED): editorial yet usable; warm yet precise; distinctive yet restrained; confident hierarchy yet quiet chrome; print-craft yet one-thumb mobile.
- Platform baseline: one Laravel app + one DB + one origin; learner/public surfaces migrate to Inertia 3 + React 19 + TS + Tailwind 4 + shadcn/ui (per ADR-0002); Filament stays staff-only; PWA shell with safe-area; no second learner frontend.
- Material constraints: integer-toman money, level-as-content (no substitution), eligibility-gated premium body/audio, private media with Range, no paid-content offline cache, real covers with license records, no fabricated counts/testimonials/prices.

### Thesis, signature, restraint

- Thesis (PROPOSED refinement of owner direction): a warm-paper editorial publication — deep-ink text on ivory, one deep-blue voice for action, one teal voice for learning progress; the reader is the product, chrome stays quiet.
- Signature (PROPOSED): the composed immersive reader — editorial lesson title + bounded cover + level selector + studio player + LTR English sentences + key words as one reading environment, with a calm continue-learning moment on Today.
- Intentional restraint (OWNER constraint + PROPOSED execution): one primary + one accent family only; surfaces stay canvas/surface with hairline dividers; cards only where grouping/interaction requires them (forms, review card, purchase snapshot); lists use quiet divider rows; no gradients/glow/decorative shadows, no permanent animation, no dashboard KPI walls, no badge piles, no stock filler, no decorative charts/numbering.

### Semantic tokens — exact values, roles, code mapping (OWNER hexes; roles + mapping PROPOSED unless noted)

| Tailwind `@theme` token | Hex (OWNER, exact) | Semantic role (OWNER intent + PROPOSED detail) |
|---|---|---|
| `--color-canvas` | `#F7F4EE` | App canvas: warm paper background for all learner/public surfaces. |
| `--color-surface` | `#FFFFFF` | Surface: cards/bars/inputs/sheets on canvas; also label color on primary/accent-strong/success/danger fills. |
| `--color-ink` | `#101B33` | Body text on canvas/surface; headings, lesson titles, focus-ring alternative. |
| `--color-muted` | `#55607A` | Secondary text/meta on canvas/surface only; never as boundary or faint decoration. |
| `--color-line` | `#E4DED2` | Hairline dividers/borders only; decorative, never the sole indicator. |
| `--color-field` | `#7C8798` | Input/checkbox/radio boundaries + placeholder-adjacent chrome; boundary-only, never body text. |
| `--color-primary` | `#1F3B82` | Primary fills, primary-as-text, active nav/level/speed states, focus ring. |
| `--color-primary-hover` | `#172F69` | Hover/pressed fill for primary actions (white label kept). |
| `--color-accent` | `#0E8F8A` | Restricted accent: progress fill, sentence-highlight bar, tiny highlights; large-text/control use only (see contrast). |
| `--color-accent-strong` | `#0B6E6A` | Legible accent: accent-as-text + label-bearing accent fills (white label). |
| `--color-success` | `#1B7F4B` | Status text/fill (always with text/icon, never color-alone). |
| `--color-danger` | `#B42318` | Status text/fill (always with text/icon, never color-alone). |

Implementation mapping (PROPOSED, binding for the next build): Tailwind 4 `@theme` owns every color value; components use utilities (`bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `text-primary`, `bg-primary`, `bg-accent`, etc.) or `var(--color-*)` only. No hex literal outside the `@theme` block. No `dark:` variant, no `[data-theme]` switching, no `fe-theme` storage, no pre-paint theme script, no appearance radio, no second palette. Elevations (if needed) stay named tokens only; no ad-hoc shadows.

Measured contrast (computed WCAG relative luminance, same method as S1/S3, 2026-10-10; pairs are the OWNER hexes, not approvals of new values): ink/canvas 15.60:1, ink/surface 17.12:1, muted/canvas 5.73:1, muted/surface 6.29:1, primary-as-text/surface 10.47:1, primary-as-text/canvas 9.54:1, white-on-primary 10.47:1, white-on-primary-hover 12.75:1, accent-strong-as-text/surface 6.08:1, accent-strong-as-text/canvas 5.54:1, white-on-accent-strong 6.08:1, success-as-text/surface 5.02:1, success-as-text/canvas 4.57:1, danger-as-text/surface 6.57:1, danger-as-text/canvas 5.99:1 — all PASS normal text (>=4.5:1). Controls/focus: primary/surface 10.47:1, field/surface 3.64:1, field/canvas 3.31:1 — PASS non-text boundary (>=3:1); field is boundary-only (3.64:1 FAILS body text, correctly restricted). Accent restriction (no hex changed): accent-as-text/surface 3.95:1 FAILS normal text (passes large/control >=3:1); white-on-accent 3.95:1 FAILS normal text; ink-on-accent 4.33:1 FAILS normal text — therefore `--color-accent` never carries normal-text labels and never stands alone as body text; label-bearing accent fills use `--color-accent-strong` with white (6.08:1 PASS); accent-as-text is large-text/control-only and always paired with a non-color cue. Line/canvas 1.22:1 — dividers only, decorative, never sole indicators. No failing pair waived.

### Type roles (OWNER: Persian RTL + English LTR; fonts carried from prior owner approval, no new font approved this turn)

- Persian chrome/labels: Vazirmatn self-hosted (existing `public/fonts/vazirmatn/`, OFL beside files) with system fallback — carried owner-approved; unchanged this turn (PROPOSED: keep variable weight, controls >=16px).
- English titles/body/player numerals: Inter self-hosted under OFL with license recorded, system-stack fallback when unavailable — carried owner-approved; unchanged this turn (PROPOSED: reader 18–19px/1.8, measure ~680px, well-separated paragraphs; EN title semibold LTR, FA meta muted).
- Direction (OWNER): chrome `lang=fa dir=rtl`; English lesson body/glossary/examples `lang=en dir=ltr`. Long FA/EN text + 200% zoom must not break structure (PROPOSED: test both).
- Display treatment (PROPOSED): editorial lesson titles and English text carry the hierarchy (size/weight/measure, not color); Persian keeps normal case; no condensed-uppercase display unless a later owner direction asks.

### Composition, spacing, shape, controls (OWNER constraints; values PROPOSED)

- Mobile-first single column; desktop recomposes (restrained sidebar or centered measure, not stretched mobile); reading measure ~680px, wide narrative <=1024px (PROPOSED).
- Generous but purposeful whitespace (PROPOSED): sections breathe (~1.5rem), related rows sit tight (0.5–0.75rem); consistent spacing scale, no random padding.
- Radii/borders (PROPOSED): restrained cards ~20–24px, buttons/inputs/pills pill or quiet radius, hairline `line` dividers only; controlled borders, restrained named shadows only.
- Controls (OWNER: consistent + descriptive + touch-friendly; PROPOSED): >=44px targets, visible `<label>`s, field-associated errors, error keeps safe values, success only after server confirmation, color never sole signal, keyboard-operable seek/speed/level, logical order, visible focus (primary 10.47:1 on surface or ink 17.12:1 — never accent-on-white).
- Information hierarchy (OWNER): title → meta → cover → level → player → body → key words stays the reader order; lists show one row per topic (cover/title/levels/minutes), never six results per topic; account shows subscription + current request + one CTA.

### Responsive behavior (PROPOSED unless noted)

- Recomposition, not shrinkage: 1 col mobile → 2 cols from ~640px → 3 from ~1024px for library grids; reader stays single measure at all widths.
- Review at 360/390/430/768/1440 + reflow at 320 CSS px with no h-scroll; bounded covers (`max-height ~15rem`, `object-fit: cover`, fixed 16/9 in cards, lazy except hero).
- Fixed layers clear content via end-padding + `env(safe-area-inset-bottom)`; URL owns browse state (`?level/category/q/page`) for back/share/refresh.

### Player + navigation layering (PROPOSED principles; prior IA preserved)

- IA preserved (owner-approved editorial IA: Today/Discover/Reader/Words/Account + landing hero; mobile bottom tabs + desktop sidebar — unchanged this turn): placement/payment/settings are sub-paths; admin never in learner nav.
- One audio element in the persistent layout; in-layout navigation preserves playback, level-switch/logout stops old audio, no duplicate listeners (behavioral contract unchanged).
- Layer order bottom-up: content → mini/full player → bottom tabs → safe-area; end-of-content padding follows player state so the bar never covers the last line; player never overlaps keyboard or tabs.
- Player stack (PROPOSED): title + speed-cycle top row, full-width seek with real fill, elapsed/total times, centered [minus-10s][play][plus-10s]; speed is one cycle button with visible `Nx` + live `aria-label`, sticky rate, keyboard-operable; controls always have accessible names, never icon-only without a name.
- Sentence cues (READ-03): highlight from real validated cues, select seeks to interval, usable plain-reader fallback when cues absent/stale; lesson stays completable.

### Page-specific rules (PROPOSED; no page built this turn)

- Landing: promise → real sample → how-it-works → plans (real data or honest not-on-sale) → FAQ → install/support; stages the real reader, no marketing art, no fake counts/testimonials/ratings.
- Today: greeting + Continue Learning first, then plan divider rows, goal ring/progress, due vocab, recommendations; incomplete stays incomplete; goal change never writes `preferred_level`.
- Discover: editorial rows (cover + EN title LTR + FA meta + level), pill filters + search with labels, result count, empty + reset, pagination 12/page.
- Reader: title/cover/level/player/LTR body/vocab in one measure; loading/audio-error/locked/missing-level (exact message + available levels, no substitution)/empty-vocab states all designed; mobile safe-area clearance.
- Words: quiet divider rows for list, one solid card for Again/Hard/Good/Easy review; due/learning/known states with text, never color-alone.
- Account: calm subscription + current request + one CTA; pending/rejected/expired each have one clear next action.
- Auth/payment/placement/trust/download/offline: same tokens/type/controls; no second visual language.

### Art direction (OWNER + PROPOSED)

- OWNER (preserved): every published topic shows a real cover — deterministic GD abstract (slug-seeded, no baked text, EXIF stripped, no runtime fetch) or staff-uploaded licensed photo with a four-line license record (source, license name, date checked, usage notes); no empty placeholders, no runtime third-party fetch, no stock filler.
- PROPOSED: covers stay the only imagery in lists/reader; Lucide local inline SVGs stay the single icon family (no CDN, no emoji substitutes, `aria-hidden` by default, named touch targets); no decorative illustration/texture in the learning surfaces.

### Motion (OWNER: subtle + purposeful, reduced-motion respected; values PROPOSED)

- Transitions <=200ms for press/focus/player-state only; seek fill itself never animates; sentence auto-scroll uses `block: nearest` and is skipped under reduced motion; no autoplay, no permanent/floating animation, no gradient blobs/heavy blur/grain.
- `prefers-reduced-motion` disables all motion; content renders fully without JS.

### Content voice (PROPOSED per no-ai-slop)

- Direct Persian chrome, LTR English body; trigger/progress/success/failure copy stays consistent; missing level keeps the exact message; no invented claims.

### Quality budgets (carried; PROPOSED application to this direction)

- Accessibility: WCAG 2.2 AA working target on main paths (full claim needs audit); normal text >=4.5:1, large/control/focus/boundary >=3:1 — measured above, no waiver.
- Performance: LCP <=2.5s, INP <=200ms, CLS <=0.1 at p75 unless stricter budgets accepted; audio `preload=metadata`, never bulk-download list audio; no admin assets in learner bundle.
- Craft: flagship reader demands distinctive editorial finish; hard-gate failures (contrast, focus, touch, RTL/LTR, reduced motion) cannot be offset by aesthetics.

### Anti-template check (run on unresolved choices; explicit owner palette preserved as constraint)

- Palette is an OWNER constraint, not a default failure — preserved exactly, roles chosen for legibility without changing hexes.
- Remaining choices checked: warm-paper publication + deep-navy ink + deep-blue action + teal progress + reader-first composition + quiet divider rows + staged real reader on landing is product-specific; REJECTED the generic slate-blue SaaS card wall, KPI dashboard widgets, gradient/glow hero, floating-card grids, stock-photo filler, decorative charts/badges, and Inter-default marketing look. Boldness is spent on the reader + Today-continue moment; surrounding system stays disciplined.

### Screen-level visual acceptance + required evidence (no implementation ships without this)

- List/Discover + saved: loading/empty/error/locked at 360–430 + 768 + 1440, fa-RTL — inspected rendered images.
- Lesson reader + player: level switch, missing level, network error, cue highlight/seek + fallback; mobile + desktop measure, en-LTR body — rendered + browser interaction (play/pause/seek/speed/keyboard).
- Today + Words + Account/payment: next-action-first, review grades, pending/rejected/expired — rendered + server proof where money/access is involved.
- Hard gates each round: measured contrast on the pairs above, visible focus, 44px targets, keyboard order, 200% zoom, 320 reflow, `prefers-reduced-motion`, RTL/LTR integrity, no console errors, no layout shift from covers.
- Evidence: inspected screenshots (narrow mobile + desktop + one demanding state) + browser interaction notes recorded in QUALITY.md terms (AC-18/AC-27 style); unseen screenshots or exit-zero alone are not proof. Uninspected states stay UNPROVEN.

### What changed vs history (explicit)

- New canonical: this section. Demoted to history: Modern Hybrid tables (light+dark), Blue/Teal tables, Soft Day tokens, Night Studio tables, section 17.1 proposals, and any `data-theme`/system/dark/sepia behavior. Landing markup and cover pipeline are untouched in this turn; shared-token changes must not regress landing (to be verified in browser at build time).
- Resolved open decisions: permanent-light resolves the dark-companion and sepia items (no dark/sepia variants); palette-confirmed resolves to the 12 hexes above; fonts/icons/covers/supplier items stay open as before.
- Agent-proposed vs owner: only the hexes, light-only rule, RTL/LTR rule, editorial-calm-sophisticated-readable-warm-crafted feel, and the avoid-list are OWNER. Thesis wording, signature, radii/spacing values, type scale numbers, player layout details, page copy, and budgets are PROPOSED and reversible without changing owner hexes.

### Implementation state 2026-10-11 (M0–M5 delivered; M6 pending)

- `resources/css/inertia.css` `@theme` implements the 12 hexes above verbatim; React components use tokens/utilities only (locked by `M0InertiaFoundationTest`; no `dark:` variant, no hex literal outside `@theme`).
- `resources/css/app.css` serves preserved server-rendered pages only (staff 2FA, error pages) in its pre-existing light `--fe-*` tokens with the dark block retired (locked light-only by `S3DesignTest`) — explicitly not a second application palette; server-surface realignment stays a deferred slice.
- Latin uppercase kickers (`DISCOVER`, `TODAY`) read as editorial section kickers under this thesis; flagged for one owner sign-off, not changed unilaterally.

## Owner-approved application palette 2026-10-10 — Modern Hybrid (SUPERSEDED by Premium editorial publication above; retained as history)

Explicit owner decision recorded before coding (owner inputs 2026-10-10): single package 299000 toman context aside, the app gets a full modern hybrid refresh — dark-bold Today/stats like hybrid-dark, light-soft Reader/Player like hybrid-light, editorial IA like fast-english-editorial (Today/Discover/Reader/Words/Account + landing hero + desktop sidebar + Vazirmatn FA + Inter EN + ivory #F7F5EF / navy #172238 / blue #4263EB / amber #E9AC52 as base). Both themes reuse the same `--fe-*` names in `resources/css/app.css :root[data-theme]`. The Blue/Teal tables below become history; no hex lives outside `:root` (locked by `tests/Feature/S3DesignTest.php` for BOTH themes).

Light (`:root[data-theme="light"]`) — every hex APPROVED 2026-10-10:

| Token | Hex (APPROVED) | Role |
|---|---|---|
| `--fe-canvas` | `#f7f5ef` | ivory base: app canvas (editorial + hybrid-light) |
| `--fe-surface` | `#ffffff` | white 24px cards/bars/inputs (hybrid-light) |
| `--fe-text` | `#172238` | navy base: body |
| `--fe-muted-text` | `#5b6372` | secondary text (5.55:1 canvas, 6.05:1 surface) |
| `--fe-border` | `#e7dfd2` | warm hairline dividers only (decorative, never sole indicator) |
| `--fe-input-border` | `#5b6372` | input boundaries (reuses muted; 6.05:1) |
| `--fe-primary` | `#4263eb` | blue base: primary fills + active states + focus |
| `--fe-primary-hover` | `#364fc7` | hover/pressed fill (white label 6.77:1) |
| `--fe-on-primary` | `#ffffff` | label on primary/hover (4.98:1 / 6.77:1 PASS) |
| `--fe-secondary` | `#dde5fb` | blue tint: chips, cover tint (navy label 12.61:1) |
| `--fe-on-secondary` | `#172238` | label on secondary |
| `--fe-accent` | `#e9ac52` | amber base: ring + small highlights only (navy label 7.93:1; progress keeps primary blue in light for 4.98:1 visibility — amber-on-ivory 1.84:1 would fail) |
| `--fe-on-accent` | `#172238` | label on accent |
| `--fe-tint-lavender` | `#ede8d6` | warm cover tint (kept token name; navy text 12.94:1) |
| `--fe-success` | `#0f766e` | status text (with text/icon, never color-alone) |
| `--fe-danger` | `#be123c` | status text (with text/icon, never color-alone) |
| `--fe-elev-1/2` | named tokens only | restrained shadows (navy-tinted) |

Dark (`:root[data-theme="dark"]`) — every hex APPROVED 2026-10-10:

| Token | Hex (APPROVED) | Role |
|---|---|---|
| `--fe-canvas` | `#0e1626` | deep navy-black canvas (hybrid-dark bold) |
| `--fe-surface` | `#172238` | navy base as card/bar surface |
| `--fe-text` | `#f7f5ef` | ivory base: body |
| `--fe-muted-text` | `#b9c4d0` | secondary text (10.22:1 canvas, 8.98:1 surface) |
| `--fe-border` | `#2a3a55` | navy divider (decorative, never sole indicator) |
| `--fe-input-border` | `#b9c4d0` | input boundaries (reuses muted; 8.98:1) |
| `--fe-primary` | `#8aa4ff` | blue lightened from #4263EB for dark legibility (navy label 6.68:1; 6.68:1 focus on surface) |
| `--fe-primary-hover` | `#a3b8ff` | hover fill (navy label 8.21:1) |
| `--fe-on-primary` | `#172238` | label on primary/hover |
| `--fe-secondary` | `#2a3a55` | navy fill: chips, dark fills (ivory label 10.50:1) |
| `--fe-on-secondary` | `#f7f5ef` | label on secondary |
| `--fe-accent` | `#e9ac52` | amber base: progress + ring + highlights (navy label 7.93:1; 7.93:1 on navy surface) |
| `--fe-on-accent` | `#172238` | label on accent |
| `--fe-tint-lavender` | `#232f45` | dark cover tint (same token name; ivory label 12.32:1) |
| `--fe-success` | `#2dd4bf` | status text (teal) |
| `--fe-danger` | `#fb7185` | status text (restrained coral) |
| `--fe-elev-1/2` | named tokens only | restrained shadows |

Mapping: ivory #F7F5EF → canvas/text per theme; navy #172238 → text/surface per theme; blue #4263EB → primary (light exact, dark lightened to #8AA4FF/#A3B8FF for 4.5:1 with navy label + 3:1 focus on navy surface); amber #E9AC52 → accent both themes (ring/highlights; progress keeps primary blue in light for visibility). Secondary/tint are blue/warm tints derived from the base (documented above). No other hues in components. Blue restraint: blue fills only on primary actions, active nav/level/speed states, and focus; amber only on ring/highlights (dark progress included); all other surfaces stay canvas/surface with hairline dividers — never a blue-card wall, never a KPI dashboard, never decorative charts.

Measured contrast (computed WCAG relative luminance, same method as S1/S3, 2026-10-10; locked by `tests/Feature/S3DesignTest.php` for BOTH themes): light — text/canvas 14.57:1, muted/canvas 5.55:1, text/surface 15.88:1, muted/surface 6.05:1, on-primary/primary 4.98:1, on-primary/hover 6.77:1, on-accent/accent 7.93:1, on-secondary/secondary 12.61:1, text/tint 12.94:1, success/surface 5.47:1, danger/surface 6.29:1; controls: input-border/surface 6.05:1, primary/surface 4.98:1 (focus/non-text PASS). Dark — text/canvas 16.58:1, muted/canvas 10.22:1, text/surface 14.57:1, muted/surface 8.98:1, on-primary/primary 6.68:1, on-primary/hover 8.21:1, on-accent/accent 7.93:1, on-secondary/secondary 10.50:1, text/tint 12.32:1, success/surface 8.53:1, danger/surface 5.90:1; controls: input-border/surface 8.98:1, primary/surface 6.68:1 (focus PASS). No failing pair waived; decorative dividers exempt and never sole indicators.

Spacing/type system (APPROVED): scale `--fe-space-1/2/3/4/5/6/8/12` (0.25–3rem); radius 20–24px cards (`1.25rem`), pills `999px`; measure `680px` reader, `1024px` wide narrative; titles `--fe-title-hero/page/section`; `.fe-display` condensed uppercase English display (hybrid-dark REPORTS/REVENUE/CATEGORIES, Persian keeps normal case); 44px minimum targets; safe-area insets on playerbar/bottomnav; end-padding `.fe-main-pad` 15rem collapsed / 24rem expanded so fixed bars never cover content; no h-scroll at 360/390/430/768/1440, reflow at 320. Motion ≤200ms (press/focus/player/reveal 180ms) + `prefers-reduced-motion` kill; no autoplay, no permanent animation, no gradient blobs/heavy blur. Type: Vazirmatn FA + Inter EN first with system fallback; reader 18–19px/1.8.

## Owner-approved application palette 2026-10-09 — Blue/Teal (SUPERSEDED 2026-10-10 by Modern Hybrid above; retained as history)

History only — superseded 2026-10-10. The two tables below are NOT canonical. Older palette proposals (Night Studio amber, Soft Day coral, Editorial Ivory navy/blue/amber, §17.1 navy) are superseded for the application UI and are retained above as history only. Landing markup is untouched; shared-token changes must not regress it (verified in browser).

Light (`:root[data-theme="light"]`) — every hex APPROVED:

| Token | Hex (APPROVED) | Role |
|---|---|---|
| `--fe-canvas` | `#f5f9fa` | owner background: app canvas |
| `--fe-surface` | `#ffffff` | readable surface: cards/bars/inputs |
| `--fe-text` | `#0e171b` | owner text: body |
| `--fe-muted-text` | `#42565f` | secondary text (blue-slate, derived for harmony) |
| `--fe-border` | `#d9e6ed` | hairline dividers only (decorative, never sole indicator) |
| `--fe-input-border` | `#42565f` | input boundaries (reuses muted value; 7.70:1) |
| `--fe-primary` | `#4f95b5` | owner primary: fills + progress + focus |
| `--fe-primary-hover` | `#4589a8` | hover/pressed fill (dark label kept readable 4.66:1) |
| `--fe-on-primary` | `#0e171b` | label on primary/hover (dark ink — white 3.33:1 FAILS, dark 5.44:1 PASSES) |
| `--fe-secondary` | `#a3c9dc` | owner secondary: soft fills, cover tint, chips (dark label 10.32:1) |
| `--fe-on-secondary` | `#0e171b` | label on secondary |
| `--fe-accent` | `#6eaecf` | owner accent: progress, today ring, small highlights (dark label 7.45:1) |
| `--fe-on-accent` | `#0e171b` | label on accent |
| `--fe-tint-lavender` | `#e3eef4` | cover-placeholder tint (kept token name; remapped to secondary tint, text 15.39:1) |
| `--fe-success` | `#0f766e` | status text (with text/icon, never color-alone) |
| `--fe-danger` | `#b91c1c` | status text (with text/icon, never color-alone) |
| `--fe-elev-1/2` | named tokens only | restrained shadows |

Dark (`:root[data-theme="dark"]`) — every hex APPROVED:

| Token | Hex (APPROVED) | Role |
|---|---|---|
| `--fe-canvas` | `#05090a` | owner background |
| `--fe-surface` | `#0d161b` | readable surface (slightly lifted ink) |
| `--fe-text` | `#e4edf1` | owner text |
| `--fe-muted-text` | `#9fb3bd` | secondary text (blue-gray) |
| `--fe-border` | `#23495c` | owner secondary reused as divider (decorative, never sole indicator) |
| `--fe-input-border` | `#9fb3bd` | input boundaries (reuses muted value; 8.41:1) |
| `--fe-primary` | `#4a90b0` | owner primary |
| `--fe-primary-hover` | `#6eaecf` | hover fill (reuses owner light accent; dark label 8.21:1) |
| `--fe-on-primary` | `#05090a` | label on primary/hover (deep ink — white 3.55:1 FAILS, ink 5.63:1 PASSES) |
| `--fe-secondary` | `#23495c` | owner secondary: chips, dividers, dark fills (light label 8.11:1) |
| `--fe-on-secondary` | `#e4edf1` | label on secondary |
| `--fe-accent` | `#307191` | owner accent: progress + ring (white label 5.39:1; ink 3.71:1 FAILS so label is white) |
| `--fe-on-accent` | `#ffffff` | label on accent |
| `--fe-tint-lavender` | `#23495c` | cover tint (same token name; light label 8.11:1) |
| `--fe-success` | `#2dd4bf` | status text (teal) |
| `--fe-danger` | `#fb7185` | status text (restrained coral) |
| `--fe-elev-1/2` | named tokens only | restrained shadows |

Mapping: owner background→`--fe-canvas`, owner text→`--fe-text`, owner primary→`--fe-primary` (+ derived hover with readable label), owner secondary→`--fe-secondary`/`--fe-border`(dark)/cover tint, owner accent→`--fe-accent` (progress/ring/highlights only). No other hues in components. Blue restraint rule: blue fills appear only on primary actions, progress, active nav/level/speed states, and focus; all other surfaces stay canvas/surface with hairline dividers — never a wall of blue cards.

Measured contrast (computed WCAG relative luminance, same method as S1/S3, 2026-10-09; locked by `tests/Feature/S3DesignTest.php` for BOTH themes): light — text/canvas 17.12:1, text/surface 18.15:1, muted/canvas 7.26:1, muted/surface 7.70:1, on-primary/primary 5.44:1, on-primary/hover 4.66:1, on-accent/accent 7.45:1, on-secondary/secondary 10.32:1, text/tint 15.39:1, success/surface 5.47:1, danger/surface 6.47:1; controls: input-border/surface 7.70:1, primary/surface 3.33:1 (focus/non-text PASS). Dark — text/canvas 16.84:1, text/surface 15.41:1, muted/canvas 9.20:1, muted/surface 8.41:1, on-primary/primary 5.63:1, on-primary/hover 8.21:1, on-accent/accent 5.39:1, on-secondary/secondary 8.11:1, text/tint 8.11:1, success/surface 9.83:1, danger/surface 6.80:1; controls: input-border/surface 8.41:1, primary/surface 5.15:1 (focus PASS). White-on-primary-blue deliberately NOT used: light white/primary 3.33:1 and dark white/primary 3.55:1 both FAIL normal text, so both themes use an ink label on primary. No failing pair waived; decorative dividers exempt and never sole indicators.

Theme behavior (APPROVED): three choices `سیستم` (default on first visit) / `روشن` / `تیره`. System follows `prefers-color-scheme` and reacts to OS changes; explicit light/dark persists in `localStorage` (`fe-theme`) and wins on later visits; re-selecting System restores OS-following. Theme applies via `data-theme` on `<html>` from an inline pre-paint script (no flash) and is re-asserted after Livewire navigation. Control lives in Settings only (no duplicate backend); auth/learner/public layouts share the same pre-paint snippet. Code token source stays `resources/css/app.css` (`:root[data-theme]` blocks own every color value; components use only `var(--fe-*)`; test fails on any hex outside the token blocks).

Icon system (APPROVED): one family — Lucide (ISC-licensed, stroke-based) — served as locally bundled inline SVGs through a reusable Blade component (`<x-fe-icon name="…" />`, `resources/views/components/fe-icon.blade.php` — the `fe-` prefix avoids the Filament/heroicons `<x-icon>` registration); no CDN, no emoji/Unicode-sigil substitutes, no second family. Icons carry `aria-hidden` by default; interactive icon buttons always have an accessible name + visible label where the glyph alone is ambiguous + ≥44px target. Sizes 16/20/24 via `size` prop; `stroke-width: 2`, `currentColor`, aligned to text baseline.

Direction for this slice (agent-proposed details, NOT owner approval): thesis — a calm teal reading studio: mist canvas, deep-ink text, one confident blue for action, quiet secondary surfaces; audio feels like studio hardware, text stays editorial. Signature — the composed reader + studio player pair (cover/level/sentences/vocab as one learning environment; compact icon-led player with mini-player above bottom tabs). Motion — ≤200ms press/focus/player-state transitions only; `prefers-reduced-motion` disables all; no autoplay, no permanent animation, no heavy blur/gradients/glow (cover art + landing hero only). Type — Vazirmatn Persian + system English stack unchanged; reader 18–19px/1.8, measure ~680px.

## Owner-supplied brand assets 2026-10-10 (APPROVED files; recorded before coding)

Owner dropped four files in `Logo/` (authoritative input, same palette as the approved theme):

| File | Role |
|---|---|
| `fastenglish_header_logo.png` (697×197, transparent) | header lockup (blue speed-FE mark + blue `FAST` + ink `ENGLISH`) — light surfaces |
| `fast_english_logo_black.svg` (monochrome master) | source for the dark-theme header variant (ink pixels recolored to theme text) |
| `fast_english_app_favicon.png` (1024×1024) | app icon master — PWA icons (192/512/maskable/180), favicon, cover placeholder, offline mark |
| `fast_english_color-codes.txt` | confirms the approved Blue/Teal tables (no new colors) |

Mapping (APPROVED): header lockup replaces every `FE` monogram + `Fast English` text brand (learner sidebar/brandbar, public nav, all four auth panels) via one theme-aware `<x-fe-brand>` component (light PNG / generated dark PNG, `role=img` + label, fixed height, width auto). App icon replaces the navy PIL PWA placeholders (same `/icons/*` paths + `apple-touch-icon`, so the manifest/SW allowlist is untouched), becomes `/favicon.ico`, the topic-cover placeholder mark, and the offline-page mark (both icon paths are SW-precached, so they render offline). No other brand art; landing composition still untouched.

Player direction for this slice (agent-proposed details, NOT owner approval): a standard podcast-player stack — title + speed-cycle on the top row, full-width progress seek with real fill, elapsed/total times, centered [−10s][play 64px][+10s] cluster. Speed becomes ONE cycle button (`1 → 1.25 → 1.5 → 0.75 → 1`, always visible `N×` label + gauge icon + live `aria-label`, sticky rate across lessons, keyboard-operable) instead of four pills. Motion stays ≤200ms press/focus only; `prefers-reduced-motion` kills transitions (the fill itself never animates).

## Proposed defaults (NOT owner-approved — reversible)

The following are the scope's §17.1 working proposals. They are defaults for scaffolding and first rendered review, not brand approval:

| Semantic token | Proposed value (§17.1) | Status |
|---|---|---|
| canvas | `#F8FAFC` | PROPOSED |
| surface | `#FFFFFF` | PROPOSED |
| text | `#0F172A` | PROPOSED |
| muted-text | `#475569` | PROPOSED |
| border | `#E2E8F0` | PROPOSED |
| primary | `#1D4ED8` | PROPOSED |
| primary-hover | `#1E40AF` | PROPOSED |
| on-primary | `#FFFFFF` | PROPOSED |
| success | `#15803D` | PROPOSED |
| danger | `#B91C1C` | PROPOSED |

- Typography (PROPOSED): Vazirmatn self-hosted for Persian (license recorded before use); legible system font for English. English body 18px / ~1.75 line-height; main UI controls ≥16px.
- Restraint (binding): no new arbitrary colors, decorative shadows/gradients/glows, or permanent animation. Levels indicated by text + limited tokens — no six loud level colors (§17.1).
- Proposed mobile destinations (PROPOSED, §6): «مطالب» / «ذخیره‌شده‌ها» / «حساب». Placement, payment, settings are sub-paths; admin is not in learner nav.
- Canonical code token source: `resources/css/app.css` (semantic tokens + learner styles). Since S1 the code tokens own the resolved values: `:root` variables `--fe-canvas`, `--fe-surface`, `--fe-text`, `--fe-muted-text`, `--fe-border`, `--fe-primary`, `--fe-primary-hover`, `--fe-on-primary`, `--fe-success`, `--fe-danger`, plus `--fe-font-fa` (self-hosted Vazirmatn variable, `public/fonts/vazirmatn/`, OFL license beside the files) and `--fe-font-en` (system stack). The table above keeps the proposed values and PROPOSED status (unchanged, still not owner approval). Never maintain a second competing palette.
- S1 measured contrast (computed WCAG relative luminance on the actual pairs, 2026-10-08; pairs are the proposals, not approvals): text/canvas 17.06:1, primary/surface 6.70:1, on-primary/primary 6.70:1, success/surface 5.02:1, danger/surface 6.47:1, muted-text/canvas 7.24:1. Every pair measures at or above 4.5:1 for normal text.

## Direction history

- Quiet reading room (S1–S8 working default): text first, one restrained player bar, supporting imagery kept small. SUPERSEDED 2026-10-09 by the owner instruction above; retained here as history. S3/S4/S7/S8 notes below were judged under that thesis.

## Direction — Night Studio (SUPERSEDED 2026-10-09 for the app light theme by the owner-approved Soft Day direction below; dark/sepia tables retained as unapproved history — see open decisions)

- Visual thesis: a night studio — deep ink-blue dark canvas with a warm amber signal for play/progress, editorial reading surfaces in light/sepia; audio controls feel like studio hardware, text stays calm.
- Signature element (proposed): the mini-player + bottom tab bar pair with an amber progress signal, plus deterministic abstract cover art per topic (GD, slug-seeded, no baked text).
- Intentional restraint: one amber accent for primary/progress, one teal for success, one coral for danger; gradients/glow only in cover art and landing hero; motion only for state feedback/transitions with `prefers-reduced-motion` honored; shadows only via named elevation tokens.
- Must never look generic: no interchangeable card-grid marketing look; no dashboard KPI widgets; no stock-photo filler; no ad-hoc colors in components.
- Audience/surface jobs: Persian-RTL learners picking a short English article at a level, reading + listening, resuming later; landing promises one sample, how-it-works, plans, install, FAQ.
- Composition: single column mobile; reading measure ~680px desktop; list = title + level selector + low-noise search + continue-when-valid + newest topics, one card/row per topic (16/9 cover, title, levels, minutes); lesson order title/bounded image → level selector → player → body → key words; account = subscription + current request + one CTA.
- Responsive transformation: bottom tabs + mini-player with safe-area padding (`env(safe-area-inset-bottom)`); end-of-content padding clears fixed controls; reflow at 320 CSS px; review at 360/390/1280 (see D2–D5).
- Motion: no autoplay, no permanent animation; transitions ≤200ms for press/focus/player state only; reduced-motion disables all.
- Content voice: direct Persian chrome, LTR English body; error keeps safe values; success only after server confirmation; color never the sole signal.
- Code mapping (proposed, NOT implemented this turn): `resources/css/app.css` owns tokens as `@theme` variables plus a `[data-theme]` custom variant with per-theme definitions (`dark`, `light`, `sepia`); components use only those variables; no hex literal outside the token block (extends the existing S3DesignTest rule to all three themes).
- Typography (PROPOSED): Persian UI Vazirmatn self-hosted (existing `public/fonts/vazirmatn/`, OFL beside files); English display sans Sora self-hosted under OFL (license file to be recorded at `public/fonts/sora/OFL.txt` before use); English reading serif Newsreader self-hosted under OFL (license at `public/fonts/newsreader/OFL.txt` before use). Roles: Vazirmatn = Persian chrome/labels; Sora = English headings/hero/player numerals; Newsreader = English lesson body/glossary examples. Fallbacks: system-ui stacks. English body 18px/1.75; controls ≥16px.

### Night Studio token tables (every hex PROPOSED until owner approval; ratios measured 2026-10-09 by computed WCAG relative luminance, same method as S1/S3)

Dark — deep ink-blue (design-origin theme; runtime default stays light per amendment 1):

| Token | Hex (PROPOSED) | Role |
|---|---|---|
| canvas | `#0D1526` (PROPOSED) | app background |
| surface | `#172033` (PROPOSED) | cards/player/bars |
| text | `#F2EFE9` (PROPOSED) | body |
| muted-text | `#B8C0D1` (PROPOSED) | secondary |
| border | `#2A3A55` (PROPOSED) | dividers only, decorative |
| input-border | `#7A8BB0` (PROPOSED) | input and checkbox boundaries |
| primary | `#F5A524` (PROPOSED) | amber fill/progress |
| primary-hover | `#F7B84B` (PROPOSED) | hover/pressed fill |
| on-primary | `#1A1206` (PROPOSED) | label on amber |
| success | `#2DD4BF` (PROPOSED) | teal |
| danger | `#FB7185` (PROPOSED) | restrained coral |
| elevation-1 | `0 1px 2px rgb(0 0 0 / 0.45)` (PROPOSED) | shadow only |
| elevation-2 | `0 8px 28px rgb(0 0 0 / 0.45)` (PROPOSED) | shadow only |

Light — warm paper (runtime default):

| Token | Hex (PROPOSED) | Role |
|---|---|---|
| canvas | `#FAF6EF` (PROPOSED) | app background |
| surface | `#FFFDF8` (PROPOSED) | cards/player/bars |
| text | `#1B1E2A` (PROPOSED) | body |
| muted-text | `#5B6372` (PROPOSED) | secondary |
| border | `#E7DFD2` (PROPOSED) | dividers only, decorative |
| input-border | `#776B5B` (PROPOSED) | input and checkbox boundaries |
| primary | `#B45309` (PROPOSED) | amber-700 fill (darkened for contrast) |
| primary-hover | `#92400E` (PROPOSED) | hover fill |
| on-primary | `#FFFFFF` (PROPOSED) | label on amber |
| success | `#0F766E` (PROPOSED) | teal-700 |
| danger | `#BE123C` (PROPOSED) | rose-700 |
| elevation-1 | `0 1px 2px rgb(59 46 31 / 0.12)` (PROPOSED) | shadow only |
| elevation-2 | `0 12px 32px rgb(59 46 31 / 0.14)` (PROPOSED) | shadow only |

Sepia — reader option (proposed):

| Token | Hex (PROPOSED) | Role |
|---|---|---|
| canvas | `#F5EBD3` (PROPOSED) | reader background |
| surface | `#FFF8E7` (PROPOSED) | reader cards/bars |
| text | `#3B2E1F` (PROPOSED) | body |
| muted-text | `#6B5D4D` (PROPOSED) | secondary |
| border | `#E3D5B8` (PROPOSED) | dividers only, decorative |
| input-border | `#76644F` (PROPOSED) | input and checkbox boundaries |
| primary | `#92400E` (PROPOSED) | amber fill |
| primary-hover | `#78350F` (PROPOSED) | hover fill |
| on-primary | `#FFF8E7` (PROPOSED) | label on amber |
| success | `#0F766E` (PROPOSED) | teal |
| danger | `#9F1239` (PROPOSED) | deep rose |
| elevation-1 | `0 1px 2px rgb(59 46 31 / 0.12)` (PROPOSED) | shadow only |
| elevation-2 | `0 12px 32px rgb(59 46 31 / 0.14)` (PROPOSED) | shadow only |

### Measured contrast (computed ratios; body ≥4.5:1 PASS, controls/focus/input-boundaries ≥3:1 PASS; decorative dividers exempt, never sole indicators)

Dark (`#0D1526` canvas / `#172033` surface): text/canvas 15.88:1, text/surface 14.18:1, muted/canvas 9.98:1, muted/surface 8.91:1, on-primary/primary 9.08:1, on-primary/hover 10.51:1, success/surface 8.74:1, success/canvas 9.79:1, danger/surface 6.04:1, danger/canvas 6.77:1, primary/canvas 8.93:1 (focus/non-text), primary/surface 7.97:1, input-border `#7A8BB0`/surface 4.76:1 (control boundary). Border `#2A3A55`/canvas 1.59:1 — dividers only, decorative, never the sole control indicator; focus uses primary (≥7:1).

Light (`#FAF6EF` canvas / `#FFFDF8` surface): text/canvas 15.40:1, text/surface 16.32:1, muted/canvas 5.61:1, muted/surface 5.95:1, on-primary/primary 5.02:1, on-primary/hover 7.09:1, success/surface 5.38:1, success/canvas 5.08:1, danger/surface 6.18:1, danger/canvas 5.83:1, primary-as-text/surface 4.94:1, primary-as-text/canvas 4.66:1, primary-focus/surface 4.94:1, input-border `#776B5B`/surface 5.12:1 (control boundary). Border `#E7DFD2`/canvas 1.23:1 — dividers only, decorative; focus uses primary (≥4.6:1).

Sepia (`#F5EBD3` canvas / `#FFF8E7` surface): text/canvas 11.09:1, text/surface 12.42:1, muted/canvas 5.37:1, muted/surface 6.01:1, on-primary/primary 6.70:1, on-primary/hover 8.57:1, success/surface 5.17:1, success/canvas 4.61:1, danger/surface 7.57:1, danger/canvas 6.76:1, primary-as-text/surface 6.70:1, primary-as-text/canvas 5.98:1, input-border `#76644F`/surface 5.35:1 (control boundary). Border `#E3D5B8`/canvas 1.22:1 — dividers only, decorative; focus uses primary (≥5.9:1).

No failing pair waived: all body-text pairs ≥4.5:1, all control/focus/input-boundary pairs ≥3:1 on the listed fills; decorative divider borders are exempt and never sole indicators. Anti-template check: ink-blue + warm-paper + sepia triple with amber-progress/mini-player/abstract-cover signature is product-specific; rejected the generic slate-blue + Inter-default marketing look.

## Direction — Soft Day (owner-approved light theme 2026-10-09; implemented in `resources/css/app.css` this turn)

- Visual thesis: a soft daylight reading room — warm paper canvas, white pill surfaces, one coral signal for primary actions and progress; calm Persian chrome, friendly but adult.
- Signature element: the floating pill topnav (solid surface, soft shadow, no blur) with dark pill CTA, coral primary buttons, and lavender monogram covers on cream.
- Intentional restraint: one coral accent for primary/progress, retained teal/rose for status text only (always with text/icon, never color-alone); soft shadow only via `--fe-elev-1`; transitions ≤200ms for press/focus only; `prefers-reduced-motion` disables all.
- Explicitly excluded by owner order (perf cost): SVG grain overlay, `backdrop-blur` nav, permanent/floating blob animations, giant blurred background blobs.
- Must never look generic: no navy-SaaS blue, no dashboard widgets, no stock-photo filler, no ad-hoc colors outside the table below.
- Palette (every hex owner-approved 2026-10-09; code owns values in `resources/css/app.css :root`):

| Token | Hex (APPROVED 2026-10-09) | Role |
|---|---|---|
| canvas | `#FDFCF8` | app background |
| surface | `#FFFFFF` | cards/bars/inputs |
| text | `#292524` | body |
| muted-text | `#78716C` | secondary (4.67:1 on canvas — thin but PASS, recorded) |
| border | `#E7E5E4` | dividers only, decorative |
| input-border | `#78716C` | input/checkbox/radio boundaries (4.80:1 on surface) |
| primary | `#FFB7B2` | coral fill/progress (dark label 9.15:1) |
| primary-hover | `#FF9E99` | hover/pressed fill (dark label 7.66:1) |
| on-primary | `#292524` | label on coral |
| tint-lavender | `#EFEDF4` | cover-placeholder bg (dark monogram 13.07:1; never muted text) |
| success | `#15803D` | retained status text (5.02:1) |
| danger | `#B91C1C` | retained status text (6.47:1) |
| elev-1 | `0 4px 20px -2px rgb(0 0 0 / 0.05)` | soft shadow only |

- Landing record (APPROVED for future landing work; landing markup untouched this turn): same canvas/surface/text/muted/coral tokens plus sage `#E8EFE8` and lavender `#EFEDF4` screen/tint backgrounds with dark `#292524` text.
- Measured contrast, light (computed WCAG relative luminance, same method as S1/S3, 2026-10-09): text/canvas 14.78:1, text/surface 15.17:1, muted/canvas 4.67:1, muted/surface 4.80:1, on-primary/primary 9.15:1, on-primary/hover 7.66:1, success/surface 5.02:1, danger/surface 6.47:1, input-border/surface 4.80:1 (control boundary), text/primary 9.15:1 (dark focus ring on accent), text/surface 15.17:1 (dark focus ring), text/lavender 13.07:1. Coral `#FFB7B2`/surface 1.66:1 — coral is NEVER body text or a lone boundary; it is fill-with-dark-label only. No failing pair waived.
- Shape language: cards/filters/empty/cover blocks 1.5rem; buttons/inputs/pills/nav links 999px; player bar top corners 1.25rem; floating pill topnav with 1rem side margins (solid surface, soft shadow).
- Focus: 3px dark ring (`--fe-text`) — ≥9:1 on surface, canvas, and accent; never coral-on-white.
- Typography (unchanged this turn): Vazirmatn Persian + system English stay; Outfit/Reenie Beanie deferred (Latin-only glyphs, extra downloads — open decision).
- Motion: explicit no-motion direction beyond ≤200ms press/focus feedback; the existing reduced-motion kill-switch stays.
- Anti-template check: cream + coral + lavender + pill-nav + monogram-cover signature is product-specific; rejected both the generic navy-SaaS look and the superseded ink-blue Night Studio.

## Direction — Editorial Ivory (owner-approved 2026-10-09; reference image is the primary visual direction)

- Visual thesis: a premium editorial learning product — the elegance of a digital magazine with the usability of a modern learning app. Generous whitespace, clear hierarchy, editorial headlines, consistent image crops, readable measures, precise alignment.
- Signature element: the immersive reader — title/cover/level/audio/English text/vocabulary as one designed reading experience — plus the editorial landing hero and the «امروز» continue-learning moment.
- Intentional restraint: one blue for primary actions/active states, one amber as a limited accent (progress, today ring, small highlights); off-white surfaces, subtle separators, controlled borders, restrained shadows; no rainbow badges, glowing borders, decorative charts, oversized empty dashboard sections, or rows of indistinguishable icon-and-text boxes. Every visual element has a clear purpose.
- Palette (hexes are the reference-derived proposals from the owner request; semantic roles APPROVED 2026-10-09; code owns resolved values in `resources/css/app.css :root`):

| Code token | Value | Semantic role |
|---|---|---|
| `--fe-canvas` | `#F7F5EF` | warm ivory app background |
| `--fe-surface` | `#FFFDF8` | clean off-white cards/bars/inputs |
| `--fe-text` | `#172238` | deep navy body text |
| `--fe-muted-text` | `#5B6372` | secondary text (must measure ≥4.5:1 on canvas) |
| `--fe-border` | `#E7DFD2` | subtle separators/dividers only |
| `--fe-primary` | `#4263EB` | blue primary actions + active states |
| `--fe-primary-hover` | `#364FC7` | pressed/hover fill |
| `--fe-on-primary` | `#FFFFFF` | label on blue |
| `--fe-accent` | `#E9AC52` | warm amber accent: progress, today ring, small highlights (never body text alone) |
| `--fe-success` | `#0F766E` | status text (with text/icon, never color-alone) |
| `--fe-danger` | `#BE123C` | status text (with text/icon, never color-alone) |
| `--fe-elev-1/2` | named tokens only | restrained shadows |

- Mapping: reference canvas→`--fe-canvas`, primary text→`--fe-text`, primary actions→`--fe-primary`, limited accent→`--fe-accent`. Supersedes the Soft Day coral/ink tokens for learner + landing surfaces (soft-day table retained above as history). Focus ring uses `--fe-primary` (4.90:1 on surface — PASS as a ≥3:1 control indicator). Amber `#E9AC52` is fill-with-navy-label only (7.93:1); blue `#4263EB` is fill-with-white-label only (4.98:1); neither is body text on surface. No failing pair waived.
- Measured contrast (computed WCAG relative luminance, same method as S1/S3, 2026-10-09, locked by `tests/Feature/S3DesignTest.php`): text/canvas 14.57:1, muted/canvas 5.55:1, text/surface 15.62:1, muted/surface 5.95:1, on-primary/primary 4.98:1, on-primary/hover 6.77:1, on-accent/accent 7.93:1, text/lavender 13.68:1, success/surface 5.38:1, danger/surface 6.18:1; controls: input-border/surface 5.12:1, primary/surface 4.90:1.
- Typography: Vazirmatn for Persian (existing self-hosted `public/fonts/vazirmatn/`, OFL beside files); Inter for English (self-hosted under OFL with license recorded, fallback system stack when unavailable). English reader body 18–19px / ~1.8 line-height, measure ~680px, well-separated paragraphs; Persian chrome per existing scale.
- Layout: mobile-first single column; desktop uses a restrained sidebar (Today/Discover/Words/Account) with a strong content area, same IA as the mobile four-tab bottom bar («امروز»/«کشف»/«واژه‌ها»/«حساب»); saved lessons reachable from Discover/Account; landing/auth/staff stay distinct; no admin navigation for students.
- Required screens: (A) landing with hero + value proposition + start action + editorial image + method + lesson selection + workflow + benefits + real-data plans + FAQ + public sample; (B) «امروز» greeting + Continue Learning + today plan + goal progress + due vocab + recommendations, next action first; (C) «کشف مطالب» editorial library with imagery/titles/metadata/search/pagination/level-category filters, one row per topic, level→version-or-unavailable; (D) immersive reader (title/cover/level/player/LTR text/vocab controls, loading/audio-error/locked/missing-level/empty-vocab states, mobile safe-area clearance); (E) vocabulary notebook + focused Again/Hard/Good/Easy review; (F) calm account/subscription/settings; (G) desktop sidebar layout, not a stretched mobile page.
- Motion: short purposeful transitions (≤200ms) for navigation/interaction state only; `prefers-reduced-motion` disables all; no autoplay.
- Anti-template check: ivory + navy + blue/amber + editorial hero + reader-first composition is product-specific; rejected generic SaaS card walls and dashboard KPI looks.

## Composition and responsiveness

- List page (§17.2): page title, level selector, low-noise search, a "continue" section only when valid progress exists, then newest topics. One card/row per topic (six versions never become six results). Card: fixed-ratio image, title, available levels, estimated time. No badge piles, internal metadata, tables, or finance KPIs.
- Saved page reuses the list pattern (§17.2). Account shows subscription + current request state with one clear CTA.
- Lesson page order (§17.3): title/bounded image → level selector → player → body → key words. No oversized card per paragraph.
- Reader + mini-player must not overlap keyboard, bottom nav, or safe-area; end-of-content padding fits the fixed controls. Speed + bookmark sit in a fixed, understandable spot; controls are not icon-only without names.
- Viewports: 360 / 390 / 430 / 768 / 1440 reviewed; reflow at 320 CSS px for the main path (§17.4). Mobile recomposition, not shrinkage.
- RTL/LTR: chrome `lang=fa dir=rtl`; English body `lang=en dir=ltr` (§17.3). Long FA/EN text and 200% zoom must not break structure.

## Components and states

Required journey states with real data in QA (§17.4): loading, empty, error/retry, locked (premium without access), pending, rejected, expired. Error keeps safe form values; success never shown before server confirmation (§7.4). Color alone never signals error/status.

## Accessibility targets (scope §17.4 — functional target)

- WCAG 2.2 AA on main paths as a working target; full conformance claimed only after a sufficient audit.
- Normal-text contrast ≥ 4.5:1, large text ≥ 3:1 — measured on real pairs, not assumed.
- Touch target design goal 44×44 CSS px; seek usable by keyboard as well as drag.
- Visible focus, logical keyboard order, labels, control names, field-associated errors, status announcements.
- Reduced motion honored; no autoplay. Modals hold and correctly return focus.
- First UI proof gate: list + reader on mobile with real content, inspected as rendered images before full UI build (§17.4).

## Quality budgets

- Accessibility: above. Performance: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75 unless stricter product budgets are accepted; pre-release lab budget + production RUM/rollout proof required before field claims.
- Reader payload: audio `preload=metadata`; never auto-download all list audio; admin JS/CSS never loaded in learner bundle (scope §20.2).

## Screen acceptance (proof plan; evidence in QUALITY.md)

| Flow | Critical states | Viewports/locales | Visual proof |
|---|---|---|---|
| List + saved | loading, empty, error, locked | 360–430, 768, 1440; fa-RTL | Rendered images inspected (AC-03, AC-18) |
| Lesson reader + player | level switch, missing level, network error | mobile first + desktop measure; en-LTR body | Rendered + browser interaction (AC-04, AC-05, AC-18) |
| Account/subscribe/payment | pending, rejected, expired | mobile | Rendered + server proof (AC-10/11/14, AC-18) |

## Decisions intentionally deferred

Final brand/logo, multi-locale UI (out of v1). Palette/typography above stay PROPOSED until measured approval.

## Open owner decisions (need explicit approval; nothing here blocks save-only turn)

- Palette confirmation: approve or revise every hex in the dark/light/sepia tables.
- Dark companion for Soft Day: Night Studio dark is superseded with no replacement yet; approve a Soft-Day dark palette or defer dark past v1 (amendment 1 still requires dark in v1 — needs a decision).
- Display fonts: Outfit/Reenie Beanie are Latin-only and add downloads; Vazirmatn + system EN stay until owner approves self-hosted OFL fonts with licenses recorded.
- App icons: still navy PIL placeholders; approve a Soft Day icon set before release.
- Sepia mode: confirm the reader-only sepia option ships in v1 or stays deferred.
- Source of licensed photos: owner names the supplier(s) for staff-upload covers; uploads require the license record (source, license name, date checked, usage notes) before publish.

## S3 library note (2026-10-08 — no owner choices; proposals unchanged)

No explicit user style/color choice was given for S3, so nothing is recorded as owner-approved: the §17.1 palette stays PROPOSED and the canonical token source stays `resources/css/app.css` (`:root --fe-*`). The library reuses those tokens only — a test (`tests/Feature/S3DesignTest.php`) fails the build if any color literal appears outside the `:root` block.

- Composition: page title, GET filter form (level select, category select, title search — each with a visible `<label>`), result count, then one card per topic; empty state with a reset link; pagination (12/page) sharing the 44px target rule. Single column on mobile, 2 columns from 640px, 3 from 1024px (recomposition, not shrinkage).
- Card: fixed 16/9 cover (`aspect-ratio: 16/9`, `object-fit: cover`, lazy), English title (`lang=en dir=ltr`), available levels as text, approximate minutes. Cover-less topics show a restrained FE monogram block in canvas/muted tones — no stock imagery.
- Reader additions: bounded cover (`max-height: 15rem`) and the active lesson's glossary only (word LTR bold, Persian meaning, optional LTR example), all escaped.
- Re-measured contrast on the real pairs (computed WCAG luminance, 2026-10-08): text/canvas 17.06:1, muted-text/canvas 7.24:1, text/surface 17.85:1, muted-text/surface 7.58:1, primary/surface 6.70:1, on-primary/primary 6.70:1, success/surface 5.02:1, danger/surface 6.47:1 — every pair ≥ 4.5:1.
- Studio pass: library at 360/390/320 plus desktop 1280 and the reader glossary inspected as rendered pixels (test-results/browser-shots/s3-*.png); quiet reading-room thesis holds; fixture covers are labelled PIL placeholders, not art direction.

## S4 returning-user note (2026-10-08 — no owner choices; proposals unchanged)

No explicit user style/color choice was given for S4, so nothing is recorded as owner-approved: the §17.1 palette stays PROPOSED and the canonical token source stays `resources/css/app.css` (`:root --fe-*`). No new colors or text pairs were introduced — `tests/Feature/S3DesignTest.php` still passes on the same eight pairs (all ≥ 4.5:1).

- Thesis kept: quiet reading room — text first, one restrained player bar, supporting imagery kept small. Signature: the persistent lesson player + level selector pair, now with a mini-player line (`در حال پخش: topic (level)`) in the same bar.
- Top nav: three destinations (مطالب / ذخیره‌شده‌ها / حساب), each a 44 px target, reusing text/border/surface tokens only.
- Saved reuses the library card component (`library/_card.blade.php`) with the single fixed 16/9 media container (`.fe-card-media`); reader keeps the bounded cover + active-lesson glossary only.
- Player bar grows by one mini-player line; end-of-content padding raised 19 rem → 22 rem so the last glossary/body row clears the fixed bar when scrolled to the bottom (proven at 360/390).
- Studio pass: saved + reader at 360/390 plus glossary at 390 inspected as rendered pixels (test-results/browser-shots/s4-*.png); restraint holds, no badge piles or dashboard look.

## S7 placement note (2026-10-09 — no owner choices; proposals unchanged)

No explicit user style/color choice was given for S7, so nothing is recorded as owner-approved: the §17.1 palette stays PROPOSED and the canonical token source stays `resources/css/app.css` (`:root --fe-*`). Placement reuses learner tokens only — question cards, answer options, result panel, and the neutral "در دست آماده‌سازی" state share `.fe-card`/`.fe-btn`/`.fe-filters` styling with no new colors or text pairs. `tests/Feature/S3DesignTest.php` still guards the eight measured pairs (all ≥ 4.5:1). Thesis kept: quiet reading room; signature stays the persistent player + level selector pair — placement adds no second signature, only a restrained question/result sheet in the same measure.

## Slice note — product refinement + landing (agent-proposed details, NOT owner approval)

SUPERSEDED 2026-10-10 for tokens: the Modern Hybrid tables (2026-10-10) are now canonical; Blue/Teal is history. Theme behavior (system default / light / dark persist / pre-paint, OS-following) unchanged. What follows is the agent's reversible visual direction for this slice, recorded before coding per the frontend-design skill:

- Thesis (proposed): a calm teal reading studio you can operate with one thumb — mist canvas, deep-ink text, one confident blue for action; the reader stays editorial while the player behaves like studio hardware.
- Signature (proposed): the compact studio player + editorial landing hero pair — a collapsed mini-bar (play · lesson · speed · expand) that opens into the full seek/skip console, and a landing hero that stages the real reader (sentences + active highlight + speed) instead of marketing art.
- Restraint (proposed): cards only where grouping or purchase interaction requires them (forms, flashcard, continue panel, plan purchase, snapshot); lists (plan tasks, vocab rows, glossary) use quiet divider rows. No gradient blobs, no stock illustration, no floating-card walls, no fabricated testimonials/counts/ratings/claims. Motion is CSS-only entry reveals (staggered ≤8 items) + ≤200ms press/focus/player transitions; `prefers-reduced-motion` disables all and the content renders without JS.
- Player (proposed): single `#lesson-audio` owner unchanged; same IDs (`#player-play/back/forward/seek/speed/current/duration`) so existing proofs keep addressing the same elements. Collapsed shows play + title + compact elapsed/total + speed-cycle + expand toggle; expanded reveals the seek slider + ±10s cluster + status rows. Idle (no lesson) keeps the collapsed bar with play disabled. The bar rests collapsed on first paint at every width (deterministic); the toggle always wins, and errors auto-expand. End-of-content padding follows the state so the bar never covers the last line or the bottom tabs; safe-area insets respected in both states.
- Landing (proposed): own rhythm on shared tokens — hero (eyebrow + H1 + one-line sub + primary CTA to the real public sample + secondary to the library) beside a real-data product preview (sample title/level, three sentences with one active, play + speed row, real cover when present); then how-it-works (3 steps), real sample, real plans (or the honest not-on-sale state), FAQ (3 + link), final CTA. Copy is direct Persian per no-ai-slop; the DRAFT badge is removed because the page is now real.

## S8 public note (2026-10-09 — no owner choices; proposals unchanged)

No explicit user style/color choice was given for S8, so nothing is recorded as owner-approved: the §17.1 palette stays PROPOSED and the canonical token source stays `resources/css/app.css` (`:root --fe-*`). Landing, trust, download, reset, and staff-2FA pages reuse learner tokens only (`.fe-card`/`.fe-btn`/`.fe-field` plus small var-only additions: `.fe-hero`, `.fe-draft-badge`, `.fe-blocked`, `.fe-meta-table`, `.fe-footer`, `.fe-prose`). `tests/Feature/S3DesignTest.php` still passes (same eight pairs, all ≥ 4.5:1; no hex literal outside `:root`). Thesis kept: quiet reading room; signature unchanged — the landing is a short single-measure sheet (promise → sample → how-it-works → plans → install → FAQ) with one restrained DRAFT badge, no marketing hero art, no price claims.

## Mega slice 2026-10-10 — Modern Hybrid + D4 covers (working tree, local-only; no commit/PR)

Owner inputs APPROVED 2026-10-10: (a) single package 299000 toman integer limited-time label, snapshot honored until final decision no auto-timeout, sales OFF until bank+terms, no countdown without real end date; (b) full modern hybrid refresh (dark-bold Today like hybrid-dark, light-soft Reader/Player like hybrid-light, editorial IA Today/Discover/Reader/Words/Account + landing hero + desktop sidebar + Vazirmatn FA + Inter EN + ivory #F7F5EF / navy #172238 / blue #4263EB / amber #E9AC52 base, same `--fe-*` names, old tables history); (c) placement FIXTURE 20Q TEST, no CEFR claim, public exam disabled with preparing + manual-level. No fabrication: no card/holder/bank, terms/privacy, SMTP, domain, keystore, end-date, countdown, counts, testimonials. Fixtures stay TEST.

- Tokens: Hybrid light/dark tables above are canonical; Blue/Teal demoted to history. S3DesignTest locks both themes (11 body + 3 control pairs, same WCAG method) + no-literal rule. Spacing scale, 44px, safe-area, end-padding, no h-scroll 360/390/430/768/1440 + 320 reflow proven via design-theme (7) + s1/s4-mobile (9) + manual 1440 geometry + inspected 390/1360 light+dark. Motion ≤200ms (reveal 180ms) + reduced-motion kill. Inter EN first with system fallback (no admin assets in learner bundle).
- Covers (D4): `App\Support\TopicCover` GD abstract deterministic from slug (800×450, hybrid palette, no baked-text APIs, EXIF stripped via re-encode, no runtime fetch); `App\Support\TopicLicense` enforces staff source+license+date+notes (Checked YYYY-MM-DD real date), GD `covers/gd-*.jpg` exempt; `PublishLesson::topicProblems` refuses publish without cover or without valid staff record. Seeders (S1/S3/S4) use GD only; PIL `s3-cover-fixture.*` remain solely as upload-validation test bytes, never as published covers (D4CoversTest locks no-seeder-reference). Every published fixture topic carries a real file (D4CoversTest). Library cards shot shows GD abstracts, one row per topic, image/title/level/minutes.
- Today/Discover/Reader/Words: tokens only (no logic change); R3/R4/R5 + S7/S5/S8 suites green; r-today/r-words/r-reader-cues browser (6) + s7-placement/s5-payment (3) green; inspected r-today/r-reader/r-words 390 + today/reader 1440. Next action first, incomplete stays incomplete, premium/level respected, goal never writes preferred_level; Discover 12/page query/level in URL back/forward; Reader cue highlight+seek + missing/stale fallback completable + level-switch no substitution; Words save/review Again/Hard/Good/Easy deterministic owner-only; player standard stack single speed-cycle 1→1.25→1.5→0.75→1 Nx + live aria-label + sticky rate.
- Placement + 299k: 20Q FIXTURE server marking skippable resumable explicit accept, no key in HTML/JSON/hydration (S7-1), disclaimer بدون گواهی رسمی, disabled preparing + manual-level (S7-7). 299k recorded here as owner-approved commercial input (integer toman, limited-time label, no countdown, snapshot honored until final decision, sales OFF until real bank+terms); no real destination/terms/SMTP/domain/keystore fabricated; fixtures stay TEST; sales OFF refused with nothing stored (S8SalesFlagTest); snapshot isolation intact (S5SnapshotIsolationTest).
- Anti-slop: no blue-card wall, no KPI dashboard, no decorative charts, no stock filler, no gradient blobs/heavy blur/permanent animation; Lucide local icons only; reader 18–19px/1.8 measure 680px; direct Persian copy.

## Discover slice 2026-10-10 — premium editorial library (agent-proposed details, NOT owner approval)

No new explicit owner style/color choice was given for this slice, so nothing below is owner-approved: the Modern Hybrid tables above stay canonical and `resources/css/app.css :root[data-theme]` stays the single token source. No new hue is introduced; every addition reuses `var(--fe-*)` (locked by `tests/Feature/S3DesignTest.php` no-literal rule for BOTH themes).

- Thesis (proposed): a premium editorial library — a calm ivory reading room where each topic is one magazine row with real art; one confident blue for action, amber only as a tiny highlight, text stays editorial.
- Signature (proposed): the editorial Discover row — 16/9 cover with a level-chip overlay + EN semibold title (LTR) + muted FA meta (minutes + levels) + pill filters + studio mini-player with a 40px thumb.
- Restraint (proposed): cards keep 20px radius (`1.25rem`) + single soft shadow (`--fe-elev-1`) only; no gradient blobs, no heavy blur, no permanent animation, no stock filler, no badge piles, no blue-card wall, no dashboard widgets.
- Palette/type (proposed): tokens only; EN eyebrow `DISCOVER` in `.fe-display` (uppercase condensed, Persian keeps normal case) + Persian H1 page scale + lede; card title EN 1.125rem/1.5 semibold LTR; meta FA 0.9375rem muted; chips use secondary/tint fills with theme-text labels.
- Composition (proposed): single column mobile, 2 columns from 640px, 3 from 1024px (recomposition, not shrinkage); `.fe-card-media` owns 16/9 with overlay chip top-start; search is an inline pill (`type=search`) + level/category pills are links carrying `?level/category/q/page` so reload/back-forward/share preserve state; empty state with a reset link; pagination is Persian pill (`قبلی`/`بعدی` + numerals, 44px targets).
- Art direction (proposed): GD fallback has 6 deterministic layout variants from the slug hash (`TopicCover::variant` 0–5: bands, horizon, orbits, pillars, diamonds, dots — hybrid palette only, 800×450, no baked-text APIs, EXIF stripped via re-encode, no runtime fetch); staff JPEG/PNG/WebP uploads keep the four-line license record (Source/License/Checked YYYY-MM-DD real date/Notes) enforced at the publish gate; PIL `s3-cover-fixture.*` stay only as upload-validation bytes, never as published covers.
- Motion (proposed): ≤200ms press/focus/player transitions only; `prefers-reduced-motion` kills all; no autoplay; seek fill itself never animates.
- Player shell (proposed): same single `#lesson-audio` owner and IDs; mini shows 40px thumb + 2-line title + play + speed-cycle + expand; expanded centers `[−10s][play 64px][+10s]` (the same play element relocates into the cluster) + full-width seek + LTR times; speed stays ONE cycle `1 → 1.25 → 1.5 → 0.75 → 1` with visible `N×` + live `aria-label`, sticky rate, keyboard-operable.
- Copy (proposed, per no-ai-slop): direct Persian — «کشف مطالب», «یک مطلب کوتاه در سطح خودت پیدا کن», «مطلبی با این مشخصات پیدا نشد», «پاک کردن فیلترها», «حدود X دقیقه»; no invented counts/testimonials/claims.

## Reader slice 2026-10-10 — immersive editorial reader (agent-proposed details, NOT owner approval)

No new explicit owner style/color choice was given for this slice, so nothing below is owner-approved: the Modern Hybrid tables above stay canonical and `resources/css/app.css :root[data-theme]` stays the single token source. No new hue is introduced; every addition reuses `var(--fe-*)` (locked by `tests/Feature/S3DesignTest.php` no-literal rule for BOTH themes).

- Thesis (proposed): a calm ivory reading studio — title, bounded cover, level pills, studio player, LTR sentences with real cue highlight, and key words as one composed learning environment; text stays editorial, audio feels like studio hardware.
- Signature (proposed): the composed reader — EN 600 title (LTR) + muted FA meta + 15rem bounded cover + level pills + sentences with an accent-bar `aria-current` highlight that seeks on select and stops at the interval end, plus vocab rows with a save action in the same measure.
- Restraint (proposed): one blue for primary/active/focus, amber only as the tiny sentence bar and highlights (dark progress included); no gradient blobs, no heavy blur, no permanent animation, no stock filler, no badge piles, no blue-card wall, no word-level highlight.
- Palette/type (proposed): tokens only; reader title EN 1.5rem/1.5 weight 600 LTR; meta FA muted 0.9375rem–1rem; sentences and fallback body 18px/1.8 LTR in a 680px measure; vocab word bold LTR + FA meaning + muted LTR example; focus ring uses primary (both themes ≥3:1).
- Composition (proposed): DOM and visual order stay title → bounded cover → level pills → player → body → key words; cover keeps `max-height: 15rem` with `object-fit: cover` and 20px radius; level pills are links carrying `?level` so reload/back-forward/share preserve state and missing levels show the exact message with available levels (never substituted); the fixed studio player (single `#lesson-audio` owner, same IDs) sits above the tab bar with safe-area and end-padding clearance; vocab lists the active lesson only with a coherent empty state.
- Art direction (proposed): real GD/staff covers only (D4 pipeline, no baked text, no placeholders); Lucide local icons only; no decorative imagery in the reader.
- Motion (proposed): ≤200ms press/focus/player transitions only; `prefers-reduced-motion` kills all; no autoplay; the seek fill itself never animates; sentence auto-scroll uses `block: nearest` and is skipped under reduced motion.
- Copy (proposed, per no-ai-slop): direct Persian — «سطح», «حدود X دقیقه مطالعه», «ادامه از موقعیت ذخیره‌شده», «این درس تکمیل شده است», «ذخیره برای بعد», «خواندم», «واژه‌های کلیدی», «ذخیره واژه», «برای این درس واژه‌ای ثبت نشده است», «همگام‌سازی جمله‌به‌جمله برای این نسخه هنوز آماده نیست؛ پخش عادی فعال است و درس بدون مشکل کامل می‌شود», «این سطح هنوز آماده نیست»; no invented counts/testimonials/claims.

## Today slice 2026-10-10 — dark-bold premium Today (agent-proposed details, NOT owner approval)

No new explicit owner style/color choice was given for this slice, so nothing below is owner-approved: the Modern Hybrid tables above stay canonical and `resources/css/app.css :root[data-theme]` stays the single token source. No new hue is introduced; every addition reuses `var(--fe-*)` (locked by `tests/Feature/S3DesignTest.php` no-literal rule for BOTH themes).

- Thesis (proposed): a dark-bold Today that reads like hybrid-dark REVENUE/CATEGORIES — one solid hero card for the next action, calm divider rows for the plan, one amber ring for progress; text stays editorial, numbers stay tabular.
- Signature (proposed): the solid Continue hero — real 88px cover + EN 600 title (LTR) + level chip + resume position (LTR times) + primary open action — followed by the amber goal ring with big condensed tabular numbers.
- Restraint (proposed): solid single-color hero (surface, no gradient/glow), 20–24px radius (`1.25rem`) + single shadow token (`--fe-elev-2` hero, `--fe-elev-1` goal), calm divider rows (no KPI wall, no decorative charts, no badge piles, no blue-card wall); amber only on ring/progress/tiny highlights (hero start-border + ring), blue only on primary open action/active/focus; Lucide only; direct Persian.
- Palette/type (proposed): tokens only; EN eyebrow `TODAY` in `.fe-display` (uppercase condensed, Persian keeps normal case) + Persian greeting/H1 page scale; hero title EN 1.125rem/1.5 weight 600 LTR; meta FA 0.9375rem muted with LTR times tabular; ring numbers EN 700 tabular (`font-variant-numeric: tabular-nums` on `.fe-display`/ring/meta times); chips use secondary/tint fills with theme-text labels.
- Composition (proposed): DOM and visual order stay greeting → continue hero → plan divider rows → goal ring → due vocab → recommendations; hero is `cover + head` row (88px thumb, `min-width: 0` wrap, no h-scroll at 320); plan rows open real lessons/review (`reader.show`/`words.review`/`subscribe.index`); goal ring 5rem with `role=img` + Persian label; recommendations reuse `library._card` with real GD/staff covers.
- Art direction (proposed): real covers only (D4 pipeline, `/storage/{cover_path}`, no placeholders, no stock filler); Lucide local icons only (`sun`/`play`/`file-text`/`check`/`languages`/`compass`/`book-open`/`clock`); no decorative imagery.
- Motion (proposed): ≤200ms press/focus transitions only; `prefers-reduced-motion` kills all; no autoplay; seek fill never animates.
- Copy (proposed, per no-ai-slop): keep proven strings — «سلام، {name}», «امروز هم قدمی بزرگ به سمت هدف‌هات برداشتی.», «ادامه یادگیری», «ادامه مطالعه», «برنامه امروز», «هدف امروز: X دقیقه مطالعه», «Y دقیقه از برنامه امروز انجام شده.», «مرور واژه‌ها», «X واژه برای مرور», «واژه‌های امروز», «شروع مرور», «مطالب پیشنهادی», «مشاهده همه», «کشف مطالب»; resume meta «سطح {level} · ادامه از {m:ss} از {m:ss} · حدود {n} دقیقه»; no invented counts/testimonials/claims.

## Words slice 2026-10-10 — calm premium notebook + focused review (agent-proposed details, NOT owner approval)

No new explicit owner style/color choice was given for this slice, so nothing below is owner-approved: the Modern Hybrid tables above stay canonical and `resources/css/app.css :root[data-theme]` stays the single token source. No new hue is introduced; every addition reuses `var(--fe-*)` (locked by `tests/Feature/S3DesignTest.php` no-literal rule for BOTH themes). Refs inspected: mock-up-for-inspreation/hybrid-light.png (primary: white 24px cards, pill actions, episode divider rows with thumb/title/meta/play, centered player), mock-up-for-inspreation/fast-english-editorial.png (IA: Words divider rows habit/consistent/opportunity/progress + single flashcard opportunity/فرصت + blue Next + 3/5 progress), mock-up-for-inspreation/hybrid-dark.webp (amber signal only: ring/progress/tiny highlights, condensed uppercase display). Broken baseline inspected: test-results/browser-shots/design-words-light-390.png (no eyebrow, stacked search card, card-wall empty) + r-words-390.png (due-zero card).

- Thesis (proposed): a calm premium notebook that reads like the Reader — ivory measure, quiet divider rows for the list, one solid card for review; text stays editorial, review stays focused with no flashcard rainbow.
- Signature (proposed): the quiet vocab row — EN word LTR bold + FA meaning + muted LTR example + lesson-context link — paired with the single solid review card (big EN word, hidden-then-shown meaning, four calm grade buttons).
- Restraint (proposed): list uses `.fe-divider-list` quiet rows only (no card wall, no badge piles, no charts, no stock filler); review is ONE surface card (`--fe-elev-1`, `1.25rem` radius); blue only on primary/show/active/focus, amber only as the tiny «موعد امروز» dot + review progress text (never color-alone, always with text); Lucide local icons only (added `pencil` in the same stroke family for the edit action); direct Persian.
- Palette/type (proposed): tokens only; EN eyebrow `WORDS` / `REVIEW` in `.fe-display` (uppercase condensed, Persian keeps normal case) + Persian H1 page scale + muted lede; row word EN 1.125rem/1.5 weight 700 LTR; meaning FA 1rem; example EN 0.9375rem muted LTR; meta FA 0.875rem muted with tabular LTR times; review word EN 2rem/700 LTR; focus ring uses primary (both themes ≥3:1).
- Composition (proposed): notebook order stays eyebrow → H1 → lede → status pills (all/due/learning/known with counts) → inline search pill → due CTA → divider rows → Persian pagination (`pagination.fe`); row order stays word → meaning → example → lesson link → state line → actions (edit / known-learning toggle / remove); review order stays eyebrow → H1 → remaining → single card (word → show → meaning/example/lesson → grades → keyboard hint) → back link; due-zero and empty states stay coherent per tab with one clear next action.
- Art direction (proposed): no covers Imagery in Words; Lucide only (`languages`/`search`/`play`/`pencil`/`check`/`x`/`eye`/`book-open`/`circle-check`/`inbox`/`compass`); no decorative imagery.
- Motion (proposed): ≤200ms press/focus transitions only; `prefers-reduced-motion` kills all (existing global kill-switch); no autoplay; grades advance by full reload so state is always server-confirmed.
- Copy (proposed, per no-ai-slop): keep proven strings — «واژه‌ها», «دفترچه واژه‌های خودت — از درس‌ها ذخیره کن، سر موعد مرور کن.», «همه», «موعد امروز», «در حال یادگیری», «می‌دانم», «جست‌وجو در واژه‌ها», «جست‌وجو», «شروع مرور», «واژه‌ای برای مرور امروز نیست.», «هنوز واژه‌ای ذخیره نکرده‌ای. از صفحه هر درس، واژه‌های کلیدی را ذخیره کن.», «کشف مطالب», «دیدن در متن اصلی», «مرور واژه‌ها», «واژه برای مرور», «واژه‌ای برای مرور نیست.», «بازگشت به دفترچه», «نمایش معنی», «دوباره», «سخت», «خوب», «آسان»; new strings kept direct — «ویرایش», «ذخیره تغییرات», «می‌دانم شد», «برگردان به یادگیری», «حذف», «کلیدهای ۱ تا ۴ هم کار می‌کنند.»; no invented counts/testimonials/claims.

## Landing slice 2026-10-10 — premium editorial hero rebuild (agent-proposed details, NOT owner approval)

No new explicit owner style/color choice was given for this slice, so nothing below is owner-approved: the Modern Hybrid tables above stay canonical and `resources/css/app.css :root[data-theme]` stays the single token source. No new hue is introduced; every addition reuses `var(--fe-*)` (locked by `tests/Feature/S3DesignTest.php` no-literal rule for BOTH themes). Refs inspected: mock-up-for-inspreation/fast-english-editorial.png (RTL hero + شروع کنید, Today/Discover/Reader/Words IA, ivory/navy/blue/amber, Vazirmatn+Inter) + mock-up-for-inspreation/hybrid-light.png (white 24px cards, pill actions, episode rows, centered player). Broken baseline inspected: test-results/browser-shots/s8-landing-390.png (thin hero, no workflow/benefits, install before FAQ).

- Thesis (proposed): a premium editorial hero that sells by staging the real product — promise + start CTA beside a real-data reader preview (sample title/level, 3 real sentences with one active, play + speed row, real GD cover), then how-it-works, real sample, featured, workflow, benefits, real-data plans, FAQ, final CTA, install.
- Signature (proposed): the staged real reader + solid final CTA pair — hero preview (cover + EN title LTR + muted FA meta + 3 LTR sentences + play/track/1×) beside eyebrow/H1/one-line sub + pill primary (/sample) + outline secondary (/app); final CTA repeats sample-first with account-second in one solid card.
- Restraint (proposed): sections in order hero/how/sample/featured/workflow/benefits/plans/FAQ/final/install with calm dividers; solid hero card 20px (`1.25rem`) + single shadow (`--fe-elev-2`); pill primary + outline secondary; gradient/glow nowhere outside hero (none added); Lucide only; direct Persian per no-ai-slop, no fake counts/testimonials/ratings/claims.
- Palette/type (proposed): tokens only; eyebrow pill (tint fill) + H1 hero scale + one-line lede (muted); preview title EN 1rem LTR + meta FA 0.8125rem muted; sentences EN 0.9375rem/1.7 LTR with accent-bar active; workflow/benefits use `.fe-divider-list` quiet rows + 44px icon tiles (text color, never blue fill); plans show DB names+durations + 299k limited chip (tint fill) with no amounts and no timer; focus ring uses primary (both themes ≥3:1).
- Composition (proposed): single column mobile, 2-col hero ≥900px (recomposed, not shrunk); sample deep-links to `reader.show?level=` while hero/final CTAs open `/sample` (302 to the published sample, 404 when none, no login, no draft/premium leak); featured reuses `library._card` (one row per topic, real covers); workflow (4 divider rows: continue/listening/review/next) + benefits (3 rows: level-as-content/sentence-sync/save-resume) carry no numbers; FAQ 3 + full-page link; install last (download + web).
- Art direction (proposed): real GD/staff covers only (D4 pipeline, hero eager + fetchpriority high, rest lazy, no placeholders, no stock filler); Lucide local icons only (`headphones`/`play`/`compass`/`book-open`/`file-text`/`clock`/`languages`/`circle-check`/`bookmark`/`card`/`info`/`user`/`arrow-left`); no decorative imagery.
- Motion (proposed): CSS-only — 8 `.fe-reveal` max (hero-copy/hero-preview/how/sample/featured/workflow/benefits/plans; FAQ/final/install static), 180ms entry + ≤200ms press/focus/hover; hero pulse keyframes exist only for `[data-playing=true]` (static preview never sets it, so no permanent animation); `prefers-reduced-motion` kills ALL motion and content renders without JS (opacity 1 default); no autoplay, no floating/blob/blur/grain/backdrop-blur; lab LCP 268ms ≤2.5s, zero pageerrors.
- Copy (proposed, per no-ai-slop): keep proven strings — «انگلیسی را با داستان‌های کوتاه و صوت هماهنگ یاد بگیر», «هر مطلب یک متن انگلیسی در سطح توست با صوت همان نسخه.», «شروع با نمونه رایگان», «دیدن مطالب», «نمونه بدون ثبت‌نام باز می‌شود.», «پیش‌نمایش روش کار با متن واقعی نمونه — برای شنیدن، نمونه را باز کن.», 3-step how, «یک نمونه واقعی، بدون ثبت‌نام», «تازه‌ترین مطالب», «در دست آماده‌سازی», «بسته واحد ۲۹۹٬۰۰۰ تومان», «پیشنهاد محدود», FAQ 3, «با همان نمونه رایگان شروع کن», «نصب و دانلود»; new strings kept direct — «مسیر روزانه‌ات از پیشرفت واقعی ساخته می‌شود», «برای خواندن و شنیدن واقعی ساخته شده», «باز کردن نسخه وب»; no invented counts/testimonials/claims.

## Landing rebuild 2026-10-21 — owner request: professional, de-slopped, mobile-first

Owner direction (explicit, this turn): fully audit the landing, fix its problems, make it more beautiful and professional, remove its AI-slop character, and make it more responsive on phones. No new palette, font, theme, or fabricated content was requested.

Baseline defects found and fixed:
- Twelve stacked sections repeated the same three promises (why / how / experience / daily path / sentence notes) and repeated the sample CTA four times and the download CTA five times.
- Every card used a 40px radius plus shadow; three cards were rotated; every section carried an icon-chip eyebrow. The hero preview showed a fake 38% progress bar and a display-only 1× control.
- The sample cover rendered a 16:9 image in a 4:5 frame, cropping it to a flat colour band; the featured shelf required sideways scrolling on phones.
- The header wordmark and nav wrapped at 360px, and three conditionally hidden nav links stayed visible because the base `inline-flex` overrode `hidden`, producing 563px of scroll width at a 390px viewport.
- The dev server 404ed the self-hosted Vazirmatn files because laravel-vite-plugin disables Vite's publicDir; `vite.config.js` now proxies `/fonts` to `APP_URL` in dev (production already served them from `/public`).

Implementation (agent-owned; PROPOSED details on top of the owner direction):
- IA: asymmetric hero (copy beside a working sample) → three-step method band → real sample feature → newest topics as divider rows → plans (DB names and durations, or the honest preparing state) → three FAQ rows → closing action. Removed the why/experience/sentence-notes/daily-path/install sections and their duplicated copy.
- Hero preview is the real product: the sample's own audio stream, its opening paragraphs, play/pause, elapsed/duration, a read-only progress bar, and the real rate cycle (1 → 1.25 → 1.5 → 0.75). No autoplay, no mock controls, retry on error. Sentence-level cues are retired (owner direction 2026-10-21).
- Form: 12–20px radii, hairline `line` borders, no shadows (the preview is a flat bordered surface), no rotation, gradient, glow, blur, grain, or looping motion. Primary actions use `primary`; `accent-strong` is reserved for progress/accents. English content stays LTR; Persian prose uses Persian digits, player time/rate stay LTR.
- Chrome: a full-width sticky masthead on `canvas` with a hairline rule replaces the floating pill; a full-bleed ink footer holds the brand and a two-column link grid. Brand wordmark is right-aligned against its monogram and hidden below 350px so login/register never wrap.
- Responsive: 320/360/390 single column with 16px gutters; method steps recompose from 1 to 3 columns; sample and hero pair at ≥1024; featured rows replace the horizontal shelf; every link/button target is ≥44px; no horizontal scroll at any tested width.
- Kept browser contracts: H1 text, «شروع با نمونه رایگان», preview label and note, the opening-paragraph preview, «نمونه واقعی» heading, «تازه‌ترین مطالب», both sales lanes, the FAQ question, «صفحه دانلود», and «مشاهده همه پرسش‌ها».

Verification: Playwright at 320/360/390/768/1440 (no overflow, no sub-44px control, no pageerror or 4xx), `s8-landing` 4/4 with the sales lane enabled, `m0-inertia` 2/2, the `m1-journey` landing leg, and a played preview (20s stream, rate cycle, progress bar). Visual inspection covered the mobile hero/footer/plans and desktop hero/method/footer.

## Landing/app boundary + account correction 2026-10-21 — owner request

Owner direction (explicit, this turn): fix the account page; make the landing system fully separate from the app; a signed-in user must not reach the landing; the landing exists for Google discovery and app download. No new palette, font, theme, or fabricated content was requested.

Implementation (agent-owned; PROPOSED visual details on top of the owner direction):
- `marketing.guest` middleware (`RedirectAuthenticatedToApp`) gates `/` and the trust pages. A signed-in request returns to `/app/today`; `/sample`, `/install`, and `/download` stay outside the boundary because the in-app locked state links to the sample and a signed-in learner who wants the APK must not be sent to the paywall. The app shell no longer links to marketing pages: brand and footer point at app surfaces only; the public shell shows a signed-in viewer of `/sample` a «بازگشت به اپ» action and app-local footer links.
- The landing never links into `/app`: featured topics are informational rows, plan interest goes through registration, and the primary conversion is the download page. Hero and closing actions are «دانلود اپلیکیشن» + the free sample; no link bounces a guest to login.
- SEO moved server-side: `LandingController` supplies title, description, canonical, and JSON-LD (`WebSite`, `SoftwareApplication`, `FAQPage`); `app.blade.php` renders description/Open Graph/Twitter/JSON-LD before React. The FAQ list has one server source for both the visible accordion and structured data. Download gets its own server-rendered title/description. Page-level `<Head>` keeps the title only — no second client-rendered description meta.
- Account page: an active subscription now reads «اشتراک فعال تا …» and offers «تمدید اشتراک» (renewal extends from the current end), never the first-purchase «انتخاب پلن» CTA. Expired/revoked/no-subscription states stay distinct. The profile email gets its own LTR line, daily-goal digits are Persian, the desktop rail is a compact 44px pill (no stretched grid cell), and the main end-padding follows actual track presence so pages without audio no longer reserve a phantom player's height.

Verification: Pest `S0AccountTest`, `S8LandingTest`, `M0InertiaFoundationTest`, and the full suite (306 passed) on PostgreSQL; `npm run typecheck` and `npm run build` clean; Playwright on the `fe_browser` lane with built assets: `s8-landing` 4/4, `s8-download` 2/2, `m0-inertia` 2/2, `design-theme` 8/8 including the new active-account/desktop-rail test. Inspected pixels: landing 390/1440, account 390/1440, download and mobile library/words/reader.

## Follow-up feature slice 2026-10-22 — owner selection

Owner selected the vocabulary, account/player, shell, SEO, and tooling follow-ups from the release-readiness review. No new palette, font, theme, or fabricated content was introduced.

- Vocabulary review uses a cloze card: the target word is blanked inside its real example until reveal; a word without a usable example keeps the word-first fallback. The SRS schedule and grade endpoint are unchanged.
- Notebook adds an owner-only CSV export (formula-safe, UTF-8 BOM), a 500-row transactional import, and a two-step «همه را می‌دانم» bulk action. The export is a private response, never a public asset. **(Export and import both retired 2026-10-25; the bulk action remains.)**
- Account adds a recent payment-history list (status, plan, snapshot amount, date) with no receipt/bank/internal fields. `subscriptions:remind-expiring` sends one mail per current window; real SMTP delivery stays a launch prerequisite.
- The persistent player and public sample publish Media Session metadata and play/pause/seek handlers when supported. Background audio is still not promised.
- In-app navigation shows a delayed skeleton after 180ms; the previous page remains mounted underneath. Learner pages share `.fe-title` / `.fe-prose` / `.fe-meta` and bidi-safe headings.
- `/sample` joins the sitemap while a published sample exists, canonicalizes to `/sample` without query, and ships description + Article JSON-LD.
- CI: 14 pre-existing Pint failures fixed; `workflow-doctor` runs the template-only gate; the browser job seeds `S2BrowserSeeder` with sales on. `scripts/browser-lane.sh` is the documented local lane.

Verification: Pest 313 passed / 3931 assertions on PostgreSQL; global Pint clean; `npm run typecheck` and `npm run build` clean; full Playwright suite on `fe_browser` covers the cloze journey, Media Session wiring, skeleton, bulk-known tests, and the existing journeys (historical; CSV import was retired later the same day). Inspected captures: account history/active 390+1440, cloze 390, skeleton 390, landing/reader/download.

## Mobile UI polish 2026-10-23 — owner request: audit the whole app UI and improve mobile beauty/professionalism

Owner direction (explicit, this turn): review the complete app UI, then make it more beautiful, professional, and mobile-appropriate. No new palette, font, theme, or fabricated content was requested; every change uses the canonical `@theme` tokens.

Defects found and fixed:
- Tablets (640–1023px) had no navigation at all: the tab bar was hidden at 640px but the desktop rail only appeared at 1024px. The four tabs now stay through tablet widths.
- The player was `position: fixed` inside an already-fixed shell wrapper, so it ignored the app measure and bled edge-to-edge on desktop. The wrapper owns the fixed layer now; the bar is measured with the shell and above the tabs.
- Account overflowed horizontally at 320px because the unbreakable email set the profile card's min-content width. The identity text now wraps/truncates and the card fits.
- The PWA update banner covered the bottom tabs/player on mobile. It now sits above the shell chrome and above the player on desktop.

Polish (agent-owned within the contract):
- Brand lockups are one LTR wordmark (app icon + `Fast English`) in the app, public header/footer, and auth panel; the duplicate auth brand on mobile is gone and the public footer brand returns to the RTL start.
- Shell: soft `primary/10` active nav pills/icon capsules (desktop rail and mobile tabs), contained desktop player, title truncation reads LTR, narrow-player density (thumbnail/gauge thresholds).
- Reader: 10rem cover on mobile (full artwork at wider measures, right-aligned with the chrome column), inline level label, primary action first, tighter page rhythm so real text is visible on the first screen.
- Library: one-row compact search with an icon submit on mobile, compact inline filter groups on a single scrollable line below 640px (wrap above), count/clear row, quieter rows without the stray arrow, borderless level chip.
- Today: tighter section gap and a heading action instead of a trailing button; recommendation cover chips use the first level; Clock icon for time meta.
- Words: review action first when due, import tools collapsed behind a native disclosure, tab chips do not wrap text, flat search row.
- Auth: no autofocus (avoids opening the mobile keyboard), 2px field focus ring replacing the doubled outline, clean login footer links.

## Email verification + released APK (owner 2026-10-28)

- **Verify email page** (`Auth/VerifyEmail`): same auth frame, brand promise, and field/button tokens as login/register. One six-digit field (`inputMode=numeric`, `autocomplete=one-time-code`, LTR, spaced digits), the masked recipient address, a short validity/spam note, a resend button with a live Persian countdown, and a logout path for a wrong address. The code and mailbox are never echoed in full; the server owns expiry/attempts. No autofocus on mobile, 44 px targets, one primary action.
- **Published download state**: when release metadata is complete, `/download` shows the real version, code, date, Persian-formatted size, SHA-256 (LTR, monospace, wrapping), and one primary «دانلود فایل نصب (APK)» action with a short safety note. The landing's download action goes straight to the file (one click); before publication it opens the honest status page. Partial metadata keeps the «هنوز منتشر نشده» state — no invented values, no dead link.
- Both states keep the public shell, RTL copy, no gradients/looping motion, and the existing 44 px targets.

Verification (final build): `npm run typecheck` + `npm run build` clean; Playwright on `fe_browser` (`BASE_URL=http://127.0.0.1:8112`): 50 passed across s1-mobile, s3-mobile, s3-library, r-today, m1-journey, s4-mobile, s4-persistent, s1-player, design-theme, r-words, r-reader, s2-pwa. 320px overflow rechecked on account/settings/placement/subscribe/words. Inspected pixels: reader 390/768/1440, library 320/390/768/1440, today 320/390/1440, words 390, account 320/390, login 390, sample/landing header.

## Launch pricing + missing-sample states 2026-10-30 — owner request

Owner direction (explicit, this turn): show the real prices, prepare the site for launch, and stop presenting experimental or empty states.

- **Prices are visible product information.** The landing plan cards and the signed-in `/app/subscribe` list render each active plan's Persian name, server-formatted toman amount (`App\Support\Toman`), and duration. Raw integer amounts never cross the Inertia boundary. When sales are closed, the cards still show prices; the CTA is disabled and reads «پرداخت هنوز فعال نشده», with one calm notice explaining that purchase is closed. The server-side sales gate in `PaymentRequestController` is unchanged.
- **`/plans` is public again.** Guests are redirected to the plan section of the landing (`/#plans`); a signed-in learner goes to `/app/subscribe`. The old unconditional redirect sent guests to an auth-only route.
- **No imaginary sample.** When no published public sample exists, the landing does not render the empty preview column, sample CTAs, or a claim that a free sample is available. `HandleInertiaRequests` shares `has_public_sample` on public/auth surfaces only, and the public header/footer, trust copy, install guide, download page, and error page stop linking to `/sample` when it would 404. The FAQ answer follows the same flag. Learner routes skip the lookup so their fixed query budgets stay intact.
- **Download copy follows release reality.** The published state says the APK is available on this page; the unpublished state no longer promises a file that is not there.
- **One verification email.** Registration sends only the Persian six-digit code mail; Laravel's default English signed-link notification is suppressed because its GET link lands on the code page and cannot verify the account. The browser lane verifies fresh test users through that one code mail.

Verification: see the final task report (`S8LandingTest`, `S8SalesFlagTest`, `P004QueryBudgetsTest`, typecheck/build and Chromium sales-on/sales-off captures).
