# Plan 038: Re-placement window + honest streak (one-shot → retention loop)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/placement_routes.pb.js server/pb_migrations/1700000008_create_placement_attempts.js app/src/features/progress docs/PRODUCT.md docs/OBSERVABILITY.md docs/PODCAST_DOMAIN.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S-M (spike — design + prototype)
- **Risk**: MED (audit trail, level semantics, notification permission)
- **Depends on**: 033 (progress timestamps authoritative), 025 (library — not code-blocking, just velocity)
- **Category**: direction (retention)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`placement_routes.pb.js` enforces one `submitted` attempt per user (unique `user` index, `status==="submitted"` idempotent 200, `revision 409` on stale). `suggested_level` fossilizes while the learner completes episodes; no retake policy is stated — stated intent ("no CEFR certification; recommendation only" `PRODUCT.md:26`) without lifecycle. Progress is per-Variant `furthest_seconds` with "one compact level-scoped panel" (`PRODUCT.md`). No streak/notification exists; `OBSERVABILITY.md` beacon is OFF, no vendor SDK, low-noise funnel only. A re-placement window (≥N completed or ≥60d) + honest daily streak (derived from `lesson_progress.last_played_at`) gives a credible progress narrative without promising certification, lifting D7 for subscription renewal (monthly 299k vs quarterly 807.3k per `seeds/business/plans.json`).

## Current state

- **Placement attempt `server/pb_hooks/placement_routes.pb.js`:** `findRecordsByFilter(ATTEMPTS_C, "user={:uid}", "",1,0)` → if `submitted` then `buildResponse` (no new attempt); `checkEligibility` requires `account_status=active` + valid subscription; `question_snapshot_text`/`answers_text` Text JSON, server grading `scoreToLevel` A1 0-3 … C2 17-20; `suggested_level`/`selected_level` on `fep_users` separate (`PODCAST_DOMAIN.md` four level semantics: `suggested` vs `selected` vs `preferred` vs `browsingLevel`).
- **Progress `progress_routes.pb.js`:** `lesson_progress(user,lesson)` stores `furthest_seconds/revision/completed/last_played_at` per Variant independent; `streak` not present.
- **Non-goals `PRODUCT.md:26`:** no SMS OTP/email verify/password recovery (support recovery only) — so streak notification must be PWA `showNotification` only after explicit grant, not SMS.
- **Open HUMAN INPUT:** 20 reviewed placement questions not yet promoted (demo `seeds/placement/demo-bank.v1.json` guarded `allow-demo`); `support_contact` singleton canonical.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Placement smokes | `bash scripts/smoke-placement.sh node scripts/smoke-placement.mjs` | 40+ scenarios green (no 409 on existing one-shot) |
| Race smoke | `bash scripts/smoke-placement-race.sh node scripts/smoke-placement-race.mjs` | pass (concurrent idempotency reference) |

## Scope

**In scope** (spike — design + prototype behind flag):

- Design `POST /api/fast-english/placement/attempts/re-take` gated (≥N completed variants or ≥60d since `submitted_at`, one active re-take at a time), server grading + `suggested_level` update but `preferredLevel` preserved until user explicitly adopts.
- Prototype streak counter in `app/src/features/progress/` (`last_played_at` client-derived first), Account "Level journey" timeline draft.

**Out of scope** (do NOT ship):

- No PB migration for `re-take` yet (design only, no new collection).
- No `placement_attempts` audit deletion — historical rows retained.
- No auto-change of `selected_level`.

## Git workflow

- Branch: `spike/dir-replacement-window`
- Commits: doc + prototype, do NOT merge to `main`. Record open questions in `docs/adr/ADR-replacement-window.md`.

## Steps

### Step 1: Design `re-take` eligibility + audit rule

1. Read `server/pb_hooks/placement_routes.pb.js` unique `user` constraint + `revision` guard + subscription window checks.
2. Design:
   - `POST /api/fast-english/placement/attempts/re-take` body: none (or `{force?:boolean}` for staff).
   - Server checks:
     ```js
     var attempt = txApp.findFirstRecordByFilter(ATTEMPTS_C, "user={:uid} && status='submitted'", {uid});
     if (!attempt) return 404; // no original placement yet
     var submittedAt = new Date(String(attempt.get("submitted_at")||attempt.get("updated"))).getTime();
     var daysSince = (Date.now() - submittedAt)/86400000;
     var completedCount = countCompletedVariants(userId, "LESSONS_C", "lesson_progress"); // via txApp
     var eligible = (daysSince >= 60) || (completedCount >= N); // N=5 or 10 — choose and document
     if (!eligible) return e.json(403, {code:"retake_not_eligible", message:"Retry after 60 days or 5 completions."});
     // one active re-take: if txApp.findFirstRecordByFilter(ATTEMPTS_C, "user={:uid} && status='in_progress'") then idempotent return it
     // else create new attempt with `status='in_progress'`, `attempt_number = previous.attempt_number+1`, same `question_snapshot` version but new `id`
     ```
   - Keep `suggested_level` update on `submit` but never auto-change `selected_level` (user adopts via `POST /api/fast-english/placement/level` explicit as today). Preserve `preferredLevel` until adoption.
   - `N` choice: document trade-off (5 → faster re-take, more grading load; 10 → slower but credible). Recommend N=5 for launch (catalog small).

Deliverable: `docs/adr/ADR-replacement-window.md` with eligibility rule + code sketch + notification opt-in (`showNotification` only after `Notification.requestPermission()==='granted'`).

**Verify**: doc exists; cites `unique user`, `revision 409`, `60d`, `N=5/10`, `suggested` vs `selected` preservation, `support_contact` unchanged.

### Step 2: Prototype streak + journey timeline (client-only first)

- Derive streak from `lesson_progress.last_played_at` timestamps: sorted, consecutive day check (local `fa-IR` day boundary vs UTC? Document — prefer UTC midnight for deterministic, mention `fa-IR` follow-up).
- Prototype in `app/src/features/progress/` a `useStreak` hook (read-only, no new endpoint) + Home streak badge (no color-only, 44px, RTL correct) + Account "Level journey" timeline (suggested→selected→completions history). Keep behind a dev flag `VITE_CATALOG` or `localStorage fep_streak_preview`.

**Verify**: `pnpm verify:fast` green; no `pnpm verify:feature` regression (progress summary still `completionPercent` as before).

### Step 3: Spike concurrent re-take idempotency

Design extension for `smoke:placement-race` — two concurrent `POST .../re-take` with same user → exactly one `in_progress` attempt, second 200 idempotent (like `smoke-placement-race` for answer save). Do not implement migration yet; just document.

**Verify**: doc mentions idempotency via `txApp.findFirstRecordByFilter(... status='in_progress')` check inside transaction.

## Test plan (spike)

- **Placement placement-race extension:** concurrent `re-take` → one active (design, not executed).
- **Regression:** existing one-shot flow unchanged (idempotent 200 on duplicate `submitted` GET/POST not regressed).
- **Browser journey:** Home streak badge, Account timeline — no color-only (icon+text), 44px.

## Done criteria (spike)

- [ ] `test -f docs/adr/ADR-replacement-window.md` citing unique `user`, `revision 409`, `60d`/`N=5` gating, one active re-take, `suggested` vs `selected` preservation, no SMS, explicit notification grant
- [ ] Prototype `app/src/features/progress/useStreak.ts` (or doc-only if no prototype) exists or ADR references client-derived streak via `last_played_at`
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` on spike branch shows only `docs/adr/*` + prototype flag file

## STOP conditions

Stop and report back if:

- Historical `placement_attempts` rows would be deleted/invalidated by re-take (violates audit) — then report retention design required.
- `suggested_level` auto-change would cascade to `preferred`/`selected` without user action (violates four-level semantics `PODCAST_DOMAIN.md`) — report.
- SMS would be needed for streak notification (violates non-goal) — strictly PWA `showNotification` after grant, report if not feasible.
- Re-take eligibility counting `completed` needs a new index on `lesson_progress(completed,user)` that PB does not support efficiently at scale — report.

## Maintenance notes

- `N` (completions) vs `60d` trade-off must be re-measured after catalog grows beyond `typical-workday-sample` (currently DEMO only; final Episode library HUMAN INPUT REQUIRED blocking launch).
- Reviewers: streak is honest (derived, not gamed) — do not add "2× bonus" claims per `DESIGN.md` honest copy.
- If a streak notification is added, keep `VITE_TELEMETRY_ENDPOINT` OFF by default (`OBSERVABILITY.md`) — do not beacon streak events without explicit opt-in.

