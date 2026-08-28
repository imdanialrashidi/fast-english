---
name: accessibility-audit
description: Audit a user-facing route or journey for WCAG 2.2 AA keyboard, focus, semantics, contrast, reflow, target-size, motion, and error-state regressions. Use when an accessibility acceptance criterion exists or a UI change touches an assistive-technology surface; do not use for generic code review.
---

# Accessibility audit

Use this as a focused evidence pass, not as a replacement for OMP's native
browser, designer, reviewer, or test tooling. Keep the scope to the changed
route/journey and the acceptance criteria that could regress.

## Procedure

1. Read the accepted product/design/quality contract and identify the route,
   critical journey, supported input modes, locales, and required states.
2. Inspect semantics and interaction with OMP's native browser (`ariaSnapshot`,
   `observe`, keyboard interaction, focus state, console/network evidence). Use
   the repository's existing browser test framework when it already exists; do
   not install axe, Playwright MCP, or a second accessibility framework merely
   for this audit.
3. Check the smallest representative set: heading/landmark and name/role/value
   structure; keyboard order and visible focus; dialog/menu/focus return;
   labels, descriptions, errors and status announcements; contrast for text
   and meaningful non-text state; 320 CSS px reflow and 200% text zoom;
   target size (WCAG 2.2 AA's 24 CSS px minimum unless an exception applies);
   reduced motion; and information that is not conveyed by color alone.
4. Include a negative path (invalid form, empty/error state, or permission
   denial) whenever that state is in scope. Check direction/locale behavior when
   the route supports RTL or translated content.

## Evidence contract

Return a table with criterion, exact route/state/viewport, observation, and one
of `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED`. DOM/ARIA and keyboard evidence are
not pixel evidence; a screenshot path or source inspection alone cannot prove
visual accessibility. Record the browser/runtime version and fixture used when
the result may be reproduced.

If a defect is found, propose the smallest fix and load `test-design` only when
an automated regression would add a distinct failure signal. Do not redesign a
surface or add dependencies as part of an audit. If the browser or product
prerequisite is unavailable, preserve the failure and mark the affected
criterion `BLOCKED` or `UNPROVEN` rather than inferring a pass.

Use the version-matched [WCAG 2.2](https://www.w3.org/TR/WCAG22/) text for an
ambiguous success criterion. Cite the relevant criterion in the report, but do
not treat a standards citation as evidence that the product satisfies it.
