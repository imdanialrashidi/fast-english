---
name: browser-qa
description: Efficient browser and visual QA for user-facing changes. Use when layout, interaction, accessibility, responsive behavior, visual regression, or browser-only behavior matters.
---

# Browser QA

Use real browser evidence only where browser behavior matters.

## Browser tool roles

Use Playwright MCP through the `mcp` proxy for interactive exploration:

- navigation;
- accessibility snapshots and focused snapshot search;
- click, type, form, keyboard, dialog, resize, and tab interactions;
- console inspection;
- network request inspection;
- focused page evaluation when snapshots and normal interactions cannot expose the required state;
- screenshots when appearance materially matters.

Use repository-local Playwright Test or the project's browser-test scripts for durable regression coverage and CI evidence.

Do not treat a successful MCP interaction as a replacement for a committed deterministic test.

Autonomous mode exposes `browser_evaluate`; keep it focused, read-oriented, and justified by an evidence gap. Local file upload, drag-and-drop file injection, and MCP scripting are intentionally unavailable. Strict mode additionally blocks page evaluation and public navigation; do not work around those boundaries.

## Order of operations

1. Start or reuse the narrowest relevant local server, or identify the exact public HTTP(S) page needed for external evidence.
2. Reproduce the affected journey with Playwright MCP or the narrowest existing browser test.
3. Prefer `browser_find` or `browser_snapshot` for locating controls and understanding state.
4. Inspect console errors, failed requests, accessibility semantics, and visible state.
5. Capture screenshots only when layout or appearance is materially relevant.
6. With a text-only primary model, use `describe_image` on a saved screenshot with a focused question when visual interpretation is needed; with a multimodal primary, reference the screenshot directly.
7. Fix the smallest confirmed defect.
8. Add or update a deterministic regression test.
9. Rerun the affected spec or last failed tests.
10. Run the feature lane once at completion.

## MCP usage pattern

Use the single `mcp` proxy tool:

1. search for the required Playwright capability;
2. describe the selected tool before first use when its arguments are unclear;
3. call only the narrowest tool needed;
4. keep large snapshots focused by using `browser_find`, target refs, depth, or saved files;
5. close the browser when the exploration is complete.

Use screenshots as visual evidence, not as the primary interaction mechanism. Accessibility snapshots are preferred for actions.

## Local resource policy

- Never set `CI=1`.
- Use one relevant browser project and one worker.
- Use zero retries and fail fast.
- Keep video, trace, and automatic screenshots off.
- Reuse running servers.
- Do not build unrelated applications.
- Avoid fixed sleeps; use locator assertions, events, or response conditions.
- Avoid `networkidle` as a general readiness signal.
- Prepare server state through fixtures or APIs rather than repeated UI setup.
- Default to no more than two vision-model calls per affected user flow.

## Visual quality

Check:

- a named mobile and desktop critical viewport; add a middle breakpoint only when composition changes there;
- RTL/LTR where applicable;
- overflow, clipping, spacing, hierarchy, and typography;
- loading, empty, error, disabled, success, and permission states;
- keyboard navigation, focus, labels, semantics, contrast, touch targets, and reduced motion;
- long text and realistic data.

For a material visual change, read `docs/DESIGN.md`, load `frontend-design`, and separate two passes:

1. **Product pass:** real journey, semantics, input modes, required states, console/network evidence, responsive behavior, and measurable budgets.
2. **Studio pass:** screenshots judged against the accepted thesis, signature element, anti-template check, and visual-quality rubric.

Capture the smallest reproducible evidence set:

- route and named state/fixture;
- exact viewport;
- theme and locale/direction;
- desktop, narrow mobile, and one demanding state when relevant.

Use the same deterministic state when comparing iterations. Do not use a screenshot from an unspecified or transient state as release proof. If appearance cannot be rendered, mark visual acceptance `UNPROVEN`.

Do not create decorative copy merely to explain obvious UI. Supporting text must prevent ambiguity or error and must add information.

## Test placement

Use unit/integration tests instead of browser E2E for pure sorting, filtering, mapping, formatting, validation, reducers, calculations, or state transitions.
