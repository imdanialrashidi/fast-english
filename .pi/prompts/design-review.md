---
description: Independently score a rendered interface for product-specific visual quality and production readiness
argument-hint: "[route, flow, design contract, or diff scope]"
---

Independently review the rendered design. Scope:

${ARGUMENTS:-current user-facing working-tree change}

Do not edit files.

1. Read `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/QUALITY.md`, the accepted criteria, and the relevant diff.
2. Load `frontend-design` and its visual-quality rubric, then load `browser-qa`.
3. Exercise the critical journey. Inspect accessibility structure, keyboard/focus behavior, console/network evidence, responsive transformation, required states, and realistic content.
4. Follow `browser-qa`'s pixel-inspection loop: check current image capability, receive/open actual images, and inspect the minimum named routes/states/viewports in this reviewer context. Compare against the accepted thesis/reference—not trends or personal taste or the writer's summary. Use a focused crop for ambiguous fine detail.
5. Grade every hard gate and score the eight craft dimensions from 0–4 only where evidence permits. Mark uninspectable dimensions `UNPROVEN`, do not fabricate an average, and return `NOT READY` for required evidence gaps. Do not reward novelty that harms clarity or usability.
6. Identify the strongest product-specific decision and the most interchangeable/generic decision.
7. Report only evidence-backed findings with severity, route/state/viewport, consequence, smallest coherent fix, and closing proof.

Return hard-gate status, dimension table, average score, findings, evidence gaps, and exactly one verdict: `READY`, `READY WITH FIXES`, or `NOT READY`.
