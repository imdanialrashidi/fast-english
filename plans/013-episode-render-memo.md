# Plan 013: Memoize the episode page's per-render transcript split and edition rail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- app/src/features/lessons/routes/LessonDetailRoute.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf (client)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

`LessonDetailRoute` re-renders at the audio `timeupdate` rate (the player
context value from `usePlayer()` at `:66` updates ~4×/sec during
playback). Every render re-runs two pure computations that depend only on
stable inputs:

1. `splitParagraphs(transcript)` — a full transcript body split, called
   inline in the JSX at `:652`. Transcripts are long English articles; on
   mid-range Android (the primary audience) this is measurable main-thread
   work on every tick.
2. `buildEditionRail(...)` at `:339` — rebuilds the six-plate rail
   structure every render.

Both are deterministic functions of stable values (the loaded lesson
payload), so `useMemo` eliminates the repeated work with zero behavior
change.

## Current state

`app/src/features/lessons/routes/LessonDetailRoute.tsx`:

```tsx
  const transcript = phase === 'ready' ? (lesson?.variant?.transcript ?? '') : '';   // :354

  const entries: EditionRailEntry[] = buildEditionRail(                             // :339
    phase === 'switching'
      ? (cachedJacket?.availableLevels ?? lesson?.availableLevels)
      : lesson?.availableLevels,
  );
```

and in the JSX (`:652`):

```tsx
                {splitParagraphs(transcript).map((paragraph, i) => (
```

`transcript` is a stable string per lesson payload; `lesson?.availableLevels`
is a stable array reference per payload (same object until a new fetch);
`cachedJacket?.availableLevels` is stable per jacket. React's `useMemo`
therefore hits on every re-render triggered by the player context.

- **Repo conventions**: hooks rules (no conditional hooks), the file
  already uses `useCallback`/`useMemo` elsewhere (check imports), motion/
  token discipline untouched.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Episode e2e | `pnpm test:e2e:fast e2e/podcast-episode.spec.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `app/src/features/lessons/routes/LessonDetailRoute.tsx`

**Out of scope** (do NOT touch):
- `splitParagraphs` / `buildEditionRail` implementations, `VocabularyList`,
  `VariantDeck` (component memoization is a possible follow-up; not this
  plan), the player, or any behavior.

## Git workflow

- Branch: `advisor/013-episode-render-memo` (repo convention: `topic-slug`).
- Commit style: conventional (`perf(episode): memoize transcript split and edition rail per render`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Memoize the transcript paragraphs

Where `transcript` is defined (`:354`), add:

```tsx
  const transcript = phase === 'ready' ? (lesson?.variant?.transcript ?? '') : '';
  const paragraphs = useMemo(() => splitParagraphs(transcript), [transcript]);
```

and replace the JSX call (`:652`) with `paragraphs.map(...)`.

### Step 2: Memoize the edition rail

Extract the rail input to a stable variable and memoize:

```tsx
  const railLevels =
    phase === 'switching'
      ? (cachedJacket?.availableLevels ?? lesson?.availableLevels)
      : lesson?.availableLevels;
  const entries: EditionRailEntry[] = useMemo(() => buildEditionRail(railLevels), [railLevels]);
```

(`railLevels` is the same expression the inline call used; `lesson`/
`cachedJacket` objects are stable between fetches, so the dependency
reference only changes when the payload changes.)

**Verify**: `npx tsc --noEmit` exits 0; `pnpm verify:fast` exits 0.

### Step 3: Behavior regression

**Verify**: `pnpm test:e2e:fast e2e/podcast-episode.spec.ts` all pass —
this spec pins the edition-switch atomicity, rail states, transcript
rendering, and resume behavior that the memoization must not disturb.

## Test plan

- No new tests: pure memoization of deterministic functions; the e2e spec
  is the behavior net. If a transcript/rail value could change while the
  dependency reference stays equal (it cannot — payloads are immutable
  snapshots), that would be the only failure mode; report if you find one.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "splitParagraphs(transcript)" app/src/features/lessons/routes/LessonDetailRoute.tsx` → no matches (the call site is gone; only the memoized `paragraphs` is used)
- [ ] `buildEditionRail` is called inside `useMemo` (read the file)
- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm test:e2e:fast e2e/podcast-episode.spec.ts` all pass
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `transcript` or the rail inputs are not stable references (e.g. derived
  fresh per render from a selector) — then the memo deps change every
  render and the memo is dead weight; report where the instability comes
  from instead of forcing it.
- An e2e assertion fails in a way that suggests a stale-value bug (the
  memo holding an old payload) — report; do not widen the memo scope
  blindly.

## Maintenance notes

- If the episode page ever derives transcript/rail data from URL state
  (per-variant params), include those in the memo deps.
- Component-level `React.memo` on `VocabularyList`/`VariantDeck` is the
  natural follow-up if profiled renders still show cascade cost (out of
  scope here).
