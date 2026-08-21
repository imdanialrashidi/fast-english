# ADR: Re-Placement Window + Honest Streak (Plan 038 Spike)

**Status:** Spike — design + prototype behind flag, not merged to main
**Date:** 2026-08-21
**Context:** `placement_routes.pb.js` enforces one `submitted` attempt per user (unique `user` index, `status==="submitted"` idempotent 200, `revision 409` on stale). `suggested_level` fossilizes while learner completes episodes; no retake policy. Progress is per-Variant `furthest_seconds` with no streak/notification; `OBSERVABILITY.md` beacon OFF, no vendor SDK. Re-placement window (≥N completed or ≥60d) + honest daily streak (derived from `lesson_progress.last_played_at`) gives credible retention without certification.

**Design — Re-take Eligibility:**
- `POST /api/fast-english/placement/attempts/re-take` (no body or `{force?:boolean}` for staff)
- Server checks inside transaction:
  ```js
  var attempt = txApp.findFirstRecordByFilter(ATTEMPTS_C, "user={:uid} && status='submitted'", {uid});
  if (!attempt) return 404;
  var submittedAt = new Date(String(attempt.get("submitted_at")||attempt.get("updated"))).getTime();
  var daysSince = (Date.now() - submittedAt)/86400000;
  var completedCount = countCompletedVariants(userId); // via txApp
  var eligible = (daysSince >= 60) || (completedCount >= 5); // N=5 for launch (catalog small), vs 10 slower
  if (!eligible) return 403 {code:"retake_not_eligible", message:"Retry after 60 days or 5 completions."};
  // one active re-take: if in_progress exists, idempotent return it
  // else create new attempt status='in_progress', attempt_number = previous.attempt_number+1
  ```
- Keep `suggested_level` update on `submit` but never auto-change `selected_level` (user adopts via `POST /api/fast-english/placement/level` explicit). Preserve `preferredLevel` until adoption. Unique `user` index remains, plus `status='in_progress'` check for idempotency.
- N trade-off: 5 → faster retake, more grading load; 10 → slower but credible. Recommend N=5 for launch.

**Design — Honest Streak:**
- Derive from `lesson_progress.last_played_at` timestamps: sorted, consecutive day check (UTC midnight deterministic, mention `fa-IR` follow-up).
- Prototype `app/src/features/progress/useStreak.ts` (read-only, no new endpoint) + Home streak badge (no color-only, 44px, RTL) + Account "Level journey" timeline (suggested→selected→completions). Behind `VITE_CATALOG` or `localStorage fep_streak_preview`.
- Notification opt-in: `showNotification` only after `Notification.requestPermission()==='granted'`; no SMS per `PRODUCT.md` non-goal.

**Verification (spike):**
- Doc exists citing `unique user`, `revision 409`, `60d`/`N=5`, one active re-take, `suggested` vs `selected` preservation, no SMS, explicit grant.
- `pnpm verify:fast` green; progress summary `completionPercent` unchanged.

**Open Questions:**
- Concurrent re-take idempotency via `txApp.findFirstRecordByFilter(... status='in_progress')` inside transaction (like `smoke-placement-race`).
- Historical `placement_attempts` rows retained (no deletion, audit).

**References:** `unique user`, `revision 409`, `60d`/`N=5` gating, `suggested` vs `selected`, PWA notification after grant.
