---
name: quick-fix
description: "Handle a small, clear, low-risk change without unnecessary planning."
whenToUse: "The task is narrow, the cause is easy to locate, acceptance is obvious, and the change has no security, data, API, or architecture impact."
---

# Quick fix

Use this for a localized defect, a small test addition, or an obvious correction. If the cause is uncertain, the change crosses a contract boundary, or the fix affects security, data, or public behavior, stop and use `spec` and `build` instead.

## Procedure

1. Read the closest `AGENTS.md` and any document that owns the affected area. Locate the relevant code and its callers before editing.
2. Confirm the failure or the requested behavior from code or an actual check. Do not guess the cause.
3. Implement the smallest coherent fix. Preserve unrelated behavior and do not refactor opportunistically.
4. Add or update a test only when it would detect the defect or protect the intended behavior.
5. Run the narrowest real check that exercises the change. Use the project's actual command; record the command, working directory, exit code, and meaningful output.
6. Inspect the final diff. Remove accidental edits, debug output, unused code, and unrelated formatting.
7. Report the change, the check result, and anything not verified.

## Guardrails

- Do not add dependencies, change public interfaces, or perform broad renames as part of a quick fix.
- Do not weaken, skip, or delete a failing test to make the result green.
- Do not claim a check passed unless it ran. If the necessary tool is missing, report it as blocked.
- If the fix expands beyond the original scope, switch to `build` and state why.

## Completion report

```text
Change: <what changed and where>
Checks: <command> (cwd, exit code) — <result>
Not verified: <unproven or unexecuted checks, or "none">
```
