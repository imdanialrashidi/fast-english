# Fast English — Roadmap (S0 → S9)

Source: scope §21 (staged plan), §3 (requirement IDs), §23 (acceptance), §25 (launch inputs). Order follows risk and dependency, not day estimates. Each stage may hold several small slices. UI, data, and authorization for one outcome are built together — no "backend-only for weeks then frontend-only" (§21).

Binding sequence rules: S2 (early PWA/TWA proof) stays early so APK/media risk is not deferred to the end (§21). Staff panel is scaffolded only as far as needed for the first real content; **financial Filament resources are not built before S5/S6** (§21).

## Stage map

| Stage | Output | Main exit conditions | Needs |
|---|---|---|---|
| S0 — Contract + scaffold | Fresh repo, contracts, compatible dependencies | Install/locks valid; auth + one sample Livewire component + one Filament panel work; first plan/evidence recorded. Criteria S0-1…S0-5 below | AUTH-01, QA-01 |
| S1 — Real text/audio path | One topic, two levels, mobile reader | Real DB-driven content; sample without login; real audio/seek; no cross-level mixing | READ-01, MEDIA-01 |
| S2 — Early mobile proof | Small PWA + TWA on staging HTTPS | Android/iPhone install; signing/domain correct; cookie/session + audio; no private cache | MOB-01/02 |
| S3 — Content + library | Constrained Filament content + library | Drafts hidden; valid publish; one result per topic; filter/search; public sample | ADM-01, LIB-01/02, READ-02 |
| S4 — Returning user | Progress, bookmarks, account, level preference | Refresh resume; version/revision isolation; unique bookmarks; explicit settings | PROG-01, SAVE-01, LEVEL-01, MEDIA-02 |
| S5 — Payment submission | Plans, snapshot, receipt, status | Pre-transfer snapshot; private file; one open request; validation/retry; ownership denial | PAY-01/02, ADM-02 |
| S6 — Review + entitlement | Approval/rejection + subscription | Real replay/race; expiry/revoke; self-approval ban; audit; premium deny/allow | PAY-03, SUB-01 |
| S7 — Placement | Optional test + result | Fixed 20-question version; hidden answer key; resume; idempotent submit; explicit preference change | PLACE-01, LEVEL-01 |
| S8 — Public + release candidate | Short landing, SMTP, download, operations | Real copy; reset; metadata; release APK; monitoring + backup ready | PUB-01/02, AUTH-02, OPS-01 |
| S9 — Pilot + handover | Full path on real devices + recovery | Final criteria PASS; real restore; known residual risks; handover docs | QA-01 + all needs |
| R1 — Editorial foundations | Ivory/navy/blue/amber tokens + Inter; learner + desktop shell with «امروز/کشف/واژه‌ها/حساب» IA | Tokens own values; S3DesignTest pairs re-measured; shell renders at 360/1440 | Editorial direction |
| R2 — Landing + Today + Discover | Real-data landing; Today plan/continue/goal/due/recommendations; editorial Discover | Sample without login; tasks open real lessons; one row per topic | PUB-01, LIB-01/02, PLAN-01 |
| R3 — Immersive reader (plain after 2026-10-21) | Paragraph reader + normal player; cue metadata and synced highlight/seek retired from the UI | Body/audio isolation; no cue props or sentence rows | READ-01, MEDIA-01/02 |
| R4 — Vocabulary SRS | Notebook + Again/Hard/Good/Easy scheduling, owner-only | Save/review/reschedule/remove persist; isolation | VOCAB-01 |
| R5 — Daily path validation | Goal/progress from persisted state; premium/level respected | Incomplete stays incomplete after reload | PLAN-01 |

## S0 — first build slice (binding criteria)

Non-goals for S0: real lessons library, player polish, PWA/TWA builds, payments, subscriptions, placement, public landing copy, performance tuning.

- [ ] S0-1 — Dependency resolution is reproducible: `composer.lock` + `package-lock.json` committed, PHP/Node pins recorded, install + Vite build succeed on a clean checkout. Covers QA-01 (scaffold leg). Proof: clean-install + build log.
- [ ] S0-2 — Auth works: register/login/logout with wrong-password rejection and session surviving refresh. Covers AUTH-01. Proof: Pest auth tests on PostgreSQL.
- [ ] S0-3 — One Livewire 4 component renders and mutates server state with validation (no secret/answer-key in hydration). Covers AUTH-01/QA-01 skeleton. Proof: Pest Livewire test + rendered page.
- [ ] S0-4 — One Filament 5 staff panel loads behind `canAccessPanel` + policy; students denied; no learner-layout asset leakage. Covers ADM-01 skeleton (content-side only — no financial resources). Proof: policy negative-path test.
- [ ] S0-5 — Contracts and plan landed: PRODUCT/DESIGN/ARCHITECTURE/QUALITY/PLAN + active exec plan reference scope sections; S1 skeleton named. Covers QA-01 (plan leg). Proof: documentation review (this turn; runtime compatibility explicitly NOT claimed until S0 executes).

## Later-slice acceptance pointers

- S1 covers AC-01 (sample leg), AC-04, AC-05 with a real two-level text+audio path and real MP3 Range proof.
- S2 covers AC-19/AC-20 early legs (install + signing/domain + no-private-cache) on staging; full device PASS only with real devices.
- S3 covers AC-03, AC-04 (glossary leg), AC-17 (content leg).
- S4 covers AC-06, AC-07, AC-08, AC-03 (continue leg).
- S5 covers AC-10, AC-11.
- S6 covers AC-12, AC-13, AC-14, AC-15, AC-16.
- S7 covers AC-09.
- S8 covers AC-01/02 (public legs), AC-18, AC-21, AC-23 (copy/infra legs).
- S9 covers AC-19/20/21/22/23 final PASS + full AC sweep.

## Frontend migration M0 → M6 (2026-10-10 owner-approved; transport only, behavior preserved)

S0–S9/R1–R5 above remain the behavioral milestones; migration slices below are frontend transport with per-slice parity proof. Backend, routes/URLs, money/time rules, and AC proof obligations are unchanged. Status 2026-10-11: M0–M5 delivered in the working tree (uncommitted); M6 pending. Exact sequence and evidence live in `docs/exec-plans/active/frontend-inertia-migration.md`.

| Slice | Output | Exit condition | Status |
|---|---|---|---|
| M0 — Shell + auth parity | Inertia 3 + React 19 + TS + Tailwind 4 + shadcn/ui shell, single light theme, session/CSRF intact; login/register/logout/reset pages | Fortify flows pass on PostgreSQL; no dark code; no learner Livewire | Delivered 2026-10-11 |
| M1 — Public + library + reader | Landing/sample/trust/download + library + reader + covers as Inertia pages | Sample without login; level-URL semantics + missing-level message; RTL/LTR; cues + fallback | Delivered 2026-10-11 |
| M2 — Player persistence | React persistent-layout audio (play/pause/seek/±10s/speed) | In-layout nav preserves; switch/logout stops; one element | Delivered with M1/M3 2026-10-11 |
| M3 — Returning user | Progress/bookmarks/account/settings/Today/words-SRS/placement as Inertia | Resume/isolation/completion; SRS determinism; pinned-version exam | Delivered 2026-10-11 |
| M4 — Payment views | Subscribe/payments status/cancel/receipt-upload UI as Inertia | Snapshot immutability; upload validation; ownership; approval stays Filament | Delivered 2026-10-11 |
| M5 — PWA + hardening + obsolete removal | Manifest/SW/offline/robots/assetlinks/sitemap intact; no-store/SW-allowlist re-audit; Blade learner views + `app/Livewire` + `reader-player.js` + `theme.js` removed after parity | No private SW cache; Range re-proven; no admin assets in learner bundle | Delivered 2026-10-11 |
| M6 — Full regression + handover | Entire Pest + Playwright suites green; rendered inspection desktop + mobile | All migration acceptance criteria PASS with evidence | Pending |

## Fixtures vs launch boundaries

Dev/test fixtures (clearly labelled, never production): test users/staff, one topic with two real lessons, one local/test-only valid subscription seed, synthetic receipt fixture (§21). Seeds never create free production subscriptions or default credentials (§21). Missing real prices, bank destination, legal text, brand, domain, SMTP, signing identity, hosting, staff roster, or content (§25) disables only its commercial boundary (public sale / public exam / release APK / real email) with a clear BLOCKED state — local/staging work continues on fixtures. No fabricated price/card/legal text is ever used for sale (§25).
