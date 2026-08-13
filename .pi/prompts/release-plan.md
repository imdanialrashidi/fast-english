---
description: Build an evidence-gated path from current product state to staged production release
argument-hint: "[release outcome or milestone]"
---

Plan the path to production for:

${ARGUMENTS:-the product contract}

Do not deploy, publish, commit, or change production.

Read `docs/PRODUCT.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/QUALITY.md`, and current repository evidence.

Update `docs/PLAN.md` with only applicable stages: discovery proof, walking skeleton, vertical MVP, internal alpha, external beta, release candidate, staged production, and learning loop. For each stage define user-visible scope, entry assumptions, exit evidence, quality/security/visual/performance/operational gates, telemetry, rollback/recovery, owner or decision-maker, and explicit non-goals.

Prefer thin end-to-end slices. Dates without evidence gates are not a release plan. Mark every prerequisite as confirmed, assumed, blocked, or not yet measured.

Return current stage, next gate, critical path, top three risks, required evidence, and the smallest next action.
