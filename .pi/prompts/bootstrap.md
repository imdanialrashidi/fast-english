---
description: Adapt the generic Pi harness to the current repository stack
argument-hint: "[project constraints]"
---

Bootstrap this repository for reliable Pi-assisted development.

Additional constraints:

${ARGUMENTS:-none}

Do not change product behavior.

Read `AGENTS.md`, `docs/HARNESS.md`, and inspect the real package manager, languages, workspaces, architecture, test frameworks, browser/E2E setup, databases, local services, CI, deployment scripts, runtime diagnostics, and existing verification commands.

Then:

1. Fill `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, project-level `docs/PLAN.md`, and `docs/DESIGN.md` for an existing user-facing product only with confirmed project-specific facts or clearly marked unknowns/placeholders.
2. Keep `AGENTS.md` as a map. Put detailed project knowledge in the appropriate docs instead of expanding always-loaded instructions.
3. Identify the exact agent-legible development interfaces: install command, local start command, health/readiness signal, relevant logs/diagnostics, test entrypoints, browser entrypoints, database/test-state setup, and rollback/recovery mechanism where present.
4. Create stack-specific targeted/fast, feature, and full verification lanes without weakening the canonical gate. Configure `.pi/verification.json` with evidence-backed file/dependency routes and argv-array commands for `scripts/verify-affected.mjs`; every unmatched change must fall back to the canonical full gate.
5. For Playwright, create a low-resource local lane with no CI mode, video, trace, or automatic screenshots; reuse servers and run the narrowest spec. Keep deterministic committed tests separate from interactive MCP exploration.
6. Identify important confirmed architecture/quality invariants that recur across the codebase. When practical, encode them mechanically with existing types, schemas, lint rules, structural tests, or CI checks instead of prose. Do not invent architectural rules merely to create a check.
7. Preserve existing tests and CI requirements. Do not add a second test/E2E framework when the existing one is usable.
8. Make failure evidence easy for an agent to inspect without exposing secrets: concise test output, local logs, browser console/network evidence, or existing health endpoints where available.
9. Update project documentation with exact commands and relevant file/service pointers so later agents can retrieve context just in time.
10. Identify how a new regression test will prove defect sensitivity (pre-fix/red, mutation, or equivalent) and how flaky tests are isolated without normalizing retries.
11. Run static validation plus the cheapest available smoke checks and report exact outcomes.

For an existing frontend, also inventory the real token/component system, type/font licensing, supported viewports/locales/directions, critical screen states, current visual-regression evidence, and accepted performance/accessibility targets. Do not invent a new visual direction during bootstrap; use `/design` for that decision.

Do not expose secrets, create commits, deploy, install speculative infrastructure, or modify Pi harness-policy files (`AGENTS.md`, `docs/HARNESS.md`, `.pi/**`, `.mcp.json`, launcher/safety/doctor files) unless the user explicitly requested harness maintenance.
