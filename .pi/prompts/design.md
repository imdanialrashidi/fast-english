---
description: Create or revise a distinctive product-specific visual and interaction direction
argument-hint: "<style, colors, references, or design goal>"
---

Create the design direction for:

$ARGUMENTS

Do not implement application code unless the request explicitly includes implementation.

1. Read `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/QUALITY.md`, and the relevant existing UI.
2. Load `frontend-design`; load `browser-qa` only when the requested design work needs rendered inspection, not for saving preferences.
3. Capture the user’s stated style, exact colors and their intended roles, theme, typography, constraints, and liked/disliked references in the Owner direction section of `docs/DESIGN.md`. Distinguish explicit choices from agent-proposed details. Preserve earlier decisions unless the current request changes them. A clear brief is enough: do not require a questionnaire, additional approval, or a separate setup command. If the request only asks to save preferences, update those fields and relevant token roles, summarize them and stop here.
4. Pin the audience, surface's single job, content/states, brand tensions, platform baseline, and material constraints.
5. Research only unresolved design questions. Prefer first-party products, official systems, and primary documentation; annotate `adopt`, `avoid`, and product fit. Do not clone.
6. When the user supplied a direction, refine that direction. Explore alternatives only for an unresolved choice; never replace an explicit palette with a fashionable default or force a redesign to look original.
7. Define the thesis, signature element or intentional restraint, semantic tokens with exact values and code-token mappings, type roles, composition, responsive transformation, component/state language, motion, content voice, and quality budgets.
8. Run the anti-template check from `frontend-design` on unresolved choices; preserve explicit owner constraints.
9. Update `docs/DESIGN.md` in place; summarize recorded owner choices and any assumptions. Define screen-level visual acceptance and the screenshot/browser evidence required before implementation can ship.

For full design work, return the chosen direction, signature, rejected generic choice, major tokens, implementation constraints, proof plan, and exact document changes.
