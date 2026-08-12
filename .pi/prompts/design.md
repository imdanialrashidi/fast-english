---
description: Create or revise a distinctive product-specific visual and interaction direction
argument-hint: "<surface, journey, or redesign goal>"
---

Create the design direction for:

$ARGUMENTS

Do not implement application code unless the request explicitly includes implementation.

1. Read `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/QUALITY.md`, and the relevant existing UI.
2. Load `frontend-design`; load `browser-qa` when an existing rendered interface can be inspected.
3. Pin the audience, surface's single job, content/states, brand tensions, platform baseline, and material constraints.
4. Research only unresolved design questions. Prefer first-party products, official systems, and primary documentation; annotate `adopt`, `avoid`, and product fit. Do not clone.
5. Explore at least two materially different directions internally. Select one coherent direction and explain why it best serves the product; expose alternatives only when a user choice is genuinely required.
6. Define the thesis, signature element, one justified aesthetic risk, semantic tokens, type roles, composition, responsive transformation, component/state language, motion, content voice, and quality budgets.
7. Run the anti-template check from `frontend-design` and revise any interchangeable choice.
8. Update `docs/DESIGN.md`. Define screen-level visual acceptance and the screenshot/browser evidence required before implementation can ship.

Return the chosen direction, signature, rejected generic choice, major tokens, implementation constraints, proof plan, and exact document changes.
