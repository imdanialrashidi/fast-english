# Plan 015: Cover the hero-artwork route (or prove it dead) with real smoke scenarios

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/lesson_routes.pb.js scripts/smoke-lessons.mjs scripts/smoke-episode.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests (coverage gap)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

`GET /api/fast-english/artwork/{lessonId}/hero`
(`server/pb_hooks/lesson_routes.pb.js`, routerAdd at ~:1403) is a
protected-file route with the same published-state gating as the square
artwork route, but it has ZERO smoke/e2e coverage and no direct client
consumer found. It is NOT dead: the lesson list/detail responses emit
`episode.heroImage` URLs pointing at it (server-computed via
`resolveHeroArtworkUrl`), so the route is part of the live API contract
(Slice 6) even if the current UI never renders the wide image. An
entitlement or containment regression on this route would ship silently.

The fix: add real-PocketBase smoke scenarios for the hero route,
mirroring the square-artwork scenarios' shape.

## Current state

- Route: `server/pb_hooks/lesson_routes.pb.js` — `routerAdd("GET",
  "/api/fast-english/artwork/{lessonId}/hero", ...)` (~:1403). Guards:
  per-IP rate limit (bounded `__fepHeroArt` window, 60/5min), requires
  published Variant + published Episode + published Category (same as the
  square route; read the handler to confirm the exact gate), serves
  `topic.hero_image_wide` bytes with `public, max-age=3600` + nosniff,
  404 when the topic has no wide image or content is unpublished.
- Smoke helpers (in `scripts/smoke-lessons.mjs`): `PNG_FIXTURE`,
  `uploadArtwork(su, topicId)` (uploads `artwork_square` via multipart
  PATCH on topics), `makeTopic(su, overrides)`, `makeLesson(su, ...)`,
  `createFullStudent`-style fixture helpers (find the local equivalent —
  the suite's entitled-student helper). The square-artwork scenarios exist
  somewhere in the file — find them (`grep -n "artwork/" scripts/smoke-lessons.mjs`)
  and mirror their structure for `/hero`.
- The suite's scenario style: `scenario(name, () => assert(...))` /
  `aScenario` with pre-built request results.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lessons smoke | `pnpm smoke:lessons` | all pass (71 + new scenarios) |
| Episode smoke (regression) | `pnpm smoke:episode` | all pass |
| Fast gate | `pnpm verify:fast` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `scripts/smoke-lessons.mjs` (new hero scenarios + a `uploadHeroImage`
  helper mirroring `uploadArtwork`)

**Out of scope** (do NOT touch):
- `server/pb_hooks/lesson_routes.pb.js` — unless a scenario FAILS, in
  which case that is a real finding to report (the route may be broken),
  not a license to change behavior in this plan.
- The response shapes (`heroImage` in list/detail payloads stay).

## Git workflow

- Branch: `advisor/015-hero-artwork-coverage` (repo convention: `topic-slug`).
- Commit style: conventional (`test(lessons): cover the hero-artwork route against real PocketBase`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the hero-image upload helper

Mirror `uploadArtwork` with the field name `hero_image_wide`:

```js
async function uploadHeroImage(su, topicId) {
  // identical multipart shape to uploadArtwork, field name hero_image_wide
}
```

(Reuse `PNG_FIXTURE`; verify the field name against the topics schema —
`hero_image_wide` — and the publish invariants: a topic that is already
published may require draft→PATCH→publish like the artwork path; follow
whatever `uploadArtwork` does.)

### Step 2: Add the hero scenarios

Find the existing square-artwork scenario block and add a matching hero
block (2-4 scenarios):

1. **Entitled student fetches the hero image → 200** with the fixture
   bytes, `content-type: image/png` (re-derive from on-disk signature —
   check the handler's Content-Type behavior and assert what it returns),
   and `Cache-Control: public` (the route's documented header).
2. **Lesson whose topic has NO hero_image_wide → 404** (same entitled
   student).
3. **Pending-payment student → 403/401** (whichever the route returns —
   assert the actual contract, mirroring the square-artwork denial
   scenario).
4. If the square block already covers archived/draft denial, mirror it for
   hero too (published-state gating is the route's core invariant).

Use fresh fixtures where the suite's helpers allow (unique slugs), reuse
the entitled/pending students the suite already creates. Keep the suite
deterministic (no sleeps).

**Verify**: `pnpm smoke:lessons` all pass (71 + N new); `pnpm smoke:episode` all pass.

### Step 3: Red-green proof

Temporarily change one scenario's expectation to the wrong value (e.g.
assert 404 where the route returns 200) and confirm the scenario FAILS;
restore. Record the red output in your report.

**Verify**: the temporary-break run fails, the restored run passes.

## Test plan

- This plan IS the test: 2-4 real-PocketBase scenarios for the hero route
  (happy path bytes, no-hero 404, entitlement denial, publication gating).
- Existing nets: `smoke:lessons` (71), `smoke:episode`, `pnpm verify:fast`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "artwork/" scripts/smoke-lessons.mjs` includes `/hero` scenarios (the new block)
- [ ] `pnpm smoke:lessons` exits 0 with the new scenarios passing
- [ ] `pnpm smoke:episode` exits 0
- [ ] `pnpm verify:fast` exits 0
- [ ] Red-green proven for at least one new scenario (recorded)
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- A new scenario FAILS against the real route (the route may be broken —
  report the exact response and headers as a finding; do NOT weaken the
  assertion or change the server in this plan).
- The hero route's gate differs from the square route (different
  entitlement conditions, headers, or 404 semantics) — assert what the
  route ACTUALLY does and note the difference.
- The suite's fixture helpers changed since this plan was written (drift).

## Maintenance notes

- When the client eventually renders `heroImage` (Slice 7's design shows
  wide artwork on the Episode jacket), these scenarios become the
  regression net for that feature — keep them green through the redesign.
- If the hero route is ever removed (field deprecation), delete these
  scenarios in the same commit as the route.
