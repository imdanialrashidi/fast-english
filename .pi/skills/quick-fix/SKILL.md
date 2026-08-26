---
name: quick-fix
description: Execute an explicitly small, obvious, low-risk repository change with minimal ceremony and one targeted proof. Use for typos, copy or label edits, one-value configuration tweaks, local styling adjustments, a single-file bug whose owner and expected behavior are already clear, or requests such as quick fix, tiny change, تغییر ریز, سریع درستش کن, فقط همین را عوض کن, or الکی پیچیده نکن. Do not use for security or auth, money, data or schema changes, dependencies, public APIs, deployment, or cross-module ambiguity.
---

# Localized Fast Path

## Admit or escalate

Use this path only when all are true:

- the requested outcome and owning location are obvious;
- one low-risk behavior changes, normally in one or two production files;
- no architecture, dependency, lockfile, public contract, migration, generated artifact, or external system is involved;
- no auth/access, money, secrets/privacy, upload/callback, destructive, concurrency, infrastructure, release, or deployment boundary is involved;
- one cheap targeted check can convincingly falsify the change.

Routine scoped PR handoff is delivery, not a new product-risk boundary; it does not disqualify a small change from this fast path.

If any condition is false, state the reason in one sentence and switch to the Standard `/build` path. Do not continue under the fast-path label.

## Execute

1. Inspect `git status --short`, the exact target, and the nearest relevant test or validation interface. Use exact search and focused reads; stop as soon as ownership is confirmed.
2. State the intended observable result in one sentence. Do not create a formal acceptance matrix, plan, ExecPlan, todo list, or subagent task. Do not load another workflow skill unless escalation requires it.
3. Prepare the existing `ai-changes` lane under `docs/GIT_POLICY.md` before editing (unless local-only); then make the smallest direct patch. Preserve surrounding behavior and user changes; skip unrelated cleanup, abstractions, dependency changes, and documentation churn.
4. Run the narrowest behavior-sensitive check that can fail for this change. For content-only edits, an exact content assertion or parser can be sufficient. Do not run broad suites, builds, browser matrices, or the full repository gate unless project policy requires them, the harness itself changed, or targeted proof cannot establish the result.
5. Inspect the scoped diff and run `git diff --check`. When proven, finish the scoped PR handoff through `scripts/ai-pr.mjs`; this adds no broad gate, reviewer, or security ceremony to a qualifying Localized change.

Escalate to `/build` if ownership becomes unclear, scope expands beyond one behavior, more than two production files need coordinated changes, the targeted check fails twice, or any excluded boundary appears.

## Report

Keep the response compact: result, changed file(s), exact check and observed outcome, and Git state/action. Do not emit a large criterion matrix for a qualifying quick fix. Report the automatically created/updated PR URL or precise delivery blocker. No per-task branch, main write, or auto-merge; local-only/read-only work never publishes. Other external actions retain the authorization required by `docs/GIT_POLICY.md`.
