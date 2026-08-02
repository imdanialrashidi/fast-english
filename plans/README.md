# Implementation Plans — Fast English Podcast

Index for the `/improve` audit of commit `4b7caba` (branch `main`, clean tree).
Status column is updated by whoever executes a plan.

## Recommended execution order

| Order | Plan | Finding | Summary | Depends on | Status |
|---|---|---|---|---|---|
| 1 | [001-ci-pocketbase-verification-baseline.md](001-ci-pocketbase-verification-baseline.md) | #1 (BLOCKER) | CI cannot complete the canonical gate from a fresh checkout (PocketBase binary never provisioned) | — | DRAFT |
| 2 | [002-native-api-media-url-correctness.md](002-native-api-media-url-correctness.md) | #2 (MAJOR) | Android release media/sample requests hit the WebView origin instead of the production API | — | DRAFT |
| 3 | [003-renewal-entitlement-selection.md](003-renewal-entitlement-selection.md) | #3 (MAJOR) | Entitlement checks use an arbitrary first active subscription; renewals can lock users out and reject can mis-classify accounts | — | DRAFT |
| 4 | [004-progress-autosave-reliability.md](004-progress-autosave-reliability.md) | #4 (MAJOR) | Progress autosave drops the newest position on pause/seek/navigation | — | DRAFT |
| 5 | [005-deployment-process-arguments.md](005-deployment-process-arguments.md) | #5 (MAJOR) | Deployment scripts place credentials and auth tokens in process arguments | — | DRAFT |

## Dependency graph

```text
001  (none — CI baseline first; everything else is verified through it)
002  (none)      → must land before the physical-device Android release gate
003  (none)      → backend regression tests; do not refactor subscription access without it
004  (none)      → independent client fix
005  (none)      → must land before the first real production deployment
```

Notes:

- Plans are independent and can be executed in parallel after 001, but 001
  restores the only clean end-to-end verification path, so it should land
  first and every later plan must finish with `bash scripts/verify.sh` green.
- 003 is a prerequisite for any future subscription/access refactor; 005 is a
  prerequisite for any real deployment; 002 is a prerequisite for real-device
  Android acceptance.
- Findings not planned (recorded for the next audit, not rejected):
  #6 rollback does not restore shared/releases metadata; #7 operator queue
  full-load + missing phone/name search; #8 lesson-list N+1 progress requests;
  #9 PocketBase download has no checksum verification; #10 "singleton"
  destination/public-sample invariants are unenforced. Direction options
  (launch gates, operator throughput, content supply) were presented but not
  selected.

## Execution protocol for each plan

1. Drift check: `git rev-parse --short HEAD` must match the plan's stamped
   commit (`4b7caba`). If the tree has moved, verify each cited excerpt still
   matches before starting; stop and report on material drift.
2. Implement only the files listed in the plan's scope. Do not reformat
   unrelated files, do not add dependencies, do not change behavior outside
   the plan.
3. Run the plan's verification gates in order: narrowest first
   (`pnpm typecheck`, `pnpm check`, `pnpm test`, targeted smoke), then
   `bash scripts/verify.sh` before claiming completion.
4. Add the plan's required tests; never weaken, skip, or delete existing
   tests to obtain green.
5. Update this table's Status column (`DONE` / `BLOCKED` + reason) when
   finished.
