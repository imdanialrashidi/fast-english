# Visual Quality Rubric

Use this rubric for `design-review`, final frontend evaluation, or a substantial redesign. Judge the rendered interface against the accepted product/design contract, not personal taste or trend conformity.

## Evidence set

Require, when the application can run:

- the critical journey exercised in the real browser;
- one representative desktop screenshot;
- one narrow mobile screenshot;
- one demanding state: long/dense content, loading, empty, error, permission, or RTL as relevant;
- console and failed-request inspection;
- deterministic regression coverage when practical.

Record viewport size, route, state/fixture, theme, locale/direction, and commit/diff scope. A screenshot without state provenance is weak evidence.

## Hard gates

Any required hard-gate failure makes the visual verdict `NOT READY`, regardless of craft score.

1. The critical journey is functional; no accepted control is decorative or display-only.
2. No material overflow, clipping, unreadable overlap, broken media, or unexpected layout shift appears in required states.
3. Keyboard order, visible focus, accessible names, semantic controls, and error identification work.
4. Color is not the only carrier of meaning; required WCAG 2.2 contrast/reflow/zoom target is met.
5. Motion respects `prefers-reduced-motion` and does not block input or understanding.
6. Loading, empty, error, success, disabled, selected, and permission states required by the flow are coherent.
7. No uncaught console error or failed critical request remains.
8. Accepted pre-release performance budgets are met. When no product field budget exists, use the current Core Web Vitals `good` thresholds as production targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile, segmented by mobile and desktop. Before field data exists, require a repeatable lab baseline/budget plus RUM instrumentation and a staged-rollout check; do not claim field performance from Lighthouse alone.

## Craft score

Score each dimension from 0 to 4:

- **0 — absent/broken:** no coherent decision or materially unusable.
- **1 — generic/weak:** default-looking, inconsistent, or clearly under-refined.
- **2 — competent:** usable and coherent but ordinary or uneven.
- **3 — strong:** deliberate, product-specific, polished, and well executed.
- **4 — exceptional:** memorable, precise, and unusually well integrated without harming usability.

### Dimensions

1. **Brief fidelity and specificity** — Visual choices arise from this product, audience, content, and job.
2. **Hierarchy and composition** — Attention, grouping, density, rhythm, whitespace, and responsive transformations make priority obvious.
3. **Typography** — Roles, scale, width, weight, leading, measure, numerals, and fallbacks are intentional and legible.
4. **Color and material** — Semantic palette, contrast, surfaces, borders, shadows, and media form one purposeful atmosphere.
5. **System coherence** — Tokens and components are consistent without making every section mechanically identical.
6. **Interaction and motion** — Affordances, feedback, transitions, and the signature moment clarify state and feel responsive.
7. **Content and state design** — Real copy/data, long content, zero/failure states, and action labels guide the user precisely.
8. **Finish and responsiveness** — Alignment, optical balance, icons/media, edge cases, mobile composition, and RTL/localization details hold up.

### Passing bar

For an ordinary production UI:

- all required hard gates pass;
- average craft score is at least 2.75;
- no dimension is below 2;
- brief fidelity, hierarchy, and system coherence are each at least 3.

For a flagship, launch, portfolio, or explicitly high-aesthetic surface:

- all required hard gates pass;
- average craft score is at least 3.25;
- no dimension is below 3;
- the signature element scores 3 or 4 for both specificity and execution.

Score signature specificity and execution separately using the same 0–4 scale.

Do not inflate scores to reach the threshold. A 4 should be rare.

## Anti-template review

Flag a choice when it is not justified by the brief, especially:

- interchangeable gradient blobs, neon glows, glass panels, or noise textures;
- a generic oversized headline plus statistic cards and accent gradient;
- a full page made from equally rounded floating cards;
- fashionable serif/sans pairings selected without subject rationale;
- arbitrary `01 / 02 / 03` labels, eyebrows, badges, or fake charts;
- excessive pills, radii, shadows, hover movement, or scroll reveals;
- decorative marketing copy that does not help a user decide or act;
- a desktop layout merely compressed into a narrow column;
- animation everywhere instead of one composed, meaningful moment.

These are not banned styles. They require product-specific justification.

## Finding format

For each evidence-backed issue include:

- severity: `BLOCKER`, `MAJOR`, `MINOR`, or `NIT`;
- route/state/viewport and screenshot or DOM evidence;
- violated contract/rubric dimension;
- user-visible consequence;
- smallest coherent fix;
- proof needed to close it.

End with hard-gate status, dimension scores, arithmetic average, strongest product-specific choice, most generic choice, and `READY`, `READY WITH FIXES`, or `NOT READY`.

## Primary reference basis

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) — contrast, reflow, focus, input, and motion accessibility.
- [Google Web Vitals](https://web.dev/articles/vitals) — user-centered loading, responsiveness, and visual-stability thresholds.
- [Material Design 3 foundations](https://m3.material.io/styles) and [design tokens](https://m3.material.io/foundations/design-tokens) — systematic color, type, shape, motion, and semantic tokens.
- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) — brief-specific direction, anti-template critique, and restrained signature design.

Use these as minimum principles and measurement references. The accepted product brief remains the source of visual identity.

Quantitative references were reviewed on 2026-08-08. Recheck official sources when updating the template or when a product accepts different standards/budgets.
