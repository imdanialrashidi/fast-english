---
name: web-performance
description: Measure and improve a web route when a change affects loading, interaction latency, layout stability, JavaScript, images, fonts, or network work. Use for an accepted performance criterion or a suspected regression; do not use for generic refactoring or unmeasured optimization.
---

# Web performance

Use OMP's native browser and the repository's existing performance/build tools.
This skill defines an evidence contract; it does not add Lighthouse, a RUM
vendor, or a profiling dependency when the project has no such tool.

## Procedure

1. Read `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/QUALITY.md`, and the change
   contract. Identify route, device/viewport, locale, network profile, budget,
   and the user-visible journey that matters.
2. Capture a repeatable baseline before editing when one is available. Record
   commit, browser/runtime, device emulation, network/CPU profile, cache state,
   sample count, and whether each result is lab or field/RUM evidence. Do not
   compare an arbitrary warm run with a cold run.
3. Use native browser performance entries/marks and existing project commands
   to inspect navigation timing, LCP candidate, INP-relevant interaction,
   CLS shifts, long tasks, request waterfalls, image/font transfer, and
   JavaScript work. Avoid `networkidle`, fixed sleeps, or a single lucky sample
   as a readiness gate.
4. Test the critical route plus one demanding state (long content, slow
   connection, image/font failure, or the largest supported data set). Keep
   desktop/mobile results separate and do not turn lab results into a field
   claim.

## Evidence contract

Report the exact command/route/profile and a before → after table, marking each
criterion `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED`. Use the
accepted project budget when present; otherwise use current Core Web Vitals
`good` targets at p75 as a provisional reference: LCP ≤ 2.5 s, INP ≤ 200 ms,
and CLS ≤ 0.1. Label a provisional target as an assumption and ask
`/wf-bootstrap` to record a confirmed project budget. A missing field/RUM
instrumentation path is `UNPROVEN`, not a passing performance result.

Prefer one high-leverage fix supported by the measurement (for example image
dimensions/compression, render-blocking work, font loading, or an avoidable
request). Re-measure the same profile after the fix. Do not add speculative
budgets, caching infrastructure, or a new benchmark framework. If the page or
required tooling cannot run, report `BLOCKED` with the smallest discriminating
next action.

Reference [web.dev Web Vitals](https://web.dev/articles/vitals) for definitions;
the citation is not a measurement.
