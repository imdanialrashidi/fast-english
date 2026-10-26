---
name: verify
description: "Discover and run the project's real checks, then report inspectable evidence without inventing commands."
whenToUse: "A change is ready for validation, a user asks whether it works, or existing evidence must be checked before completion."
---

# Verify

Verification is execution plus evidence. A plausible explanation is not a passed check.

## Discover the real commands

Read the project's closest `AGENTS.md`, README, contributor guide, CI workflow, task runner, and manifests. Use the commands those files define. Do not assume a language, package manager, framework, or test layout from another project.

If the repository defines no verification command, report that and state what you inspected. Do not invent a command and present it as the project's standard.

## Select checks

Choose the smallest set that covers the change, then widen for risk:

- **Focused:** unit tests for changed behavior, type checks, lint, formatting, schema validation.
- **Integration:** tests across the changed boundary, database or API contract tests, build.
- **Negative paths:** invalid input, denial, cancellation, timeout, empty state, permission failure.
- **Security-sensitive:** secret handling, authorization checks, injection surfaces, destructive operations.
- **Manual/runtime:** start the application, reproduce the user flow, inspect logs or output. Mark it unproven if you did not actually do it.

## Execute and record

For every check, retain the exact command, working directory, exit code, and the part of the output that supports the conclusion. Do not pipe a command through something that hides its exit status; use the project's normal invocation and preserve failures.

Do not modify source code while acting as the verifier. If a check exposes a defect, return to `build` and rerun the affected checks afterward.

## Classify every check

- **passed** — the command ran and succeeded, with inspectable evidence.
- **failed** — the command ran and reported failure.
- **blocked** — a prerequisite (tool, service, credential, platform) prevented execution. Name it.
- **unproven** — a claim is supported only by inspection or reasoning, not by execution.
- **unexecuted** — the check was available or planned but did not run, was skipped, or was cancelled.

One check may be passed while another is blocked. Do not collapse the result into a single "all good" claim. A missing tool is not a pass. A skipped test is not a pass.

## Map evidence to acceptance

For each acceptance criterion, cite the check that covers it. If no check covers a criterion, say so. Distinguish a regression test that actually exercises the behavior from a test that merely imports the module.

## Report

```text
Verdict: <pass | fail | incomplete>

Checks:
| Check | Command | cwd | Exit | Result |
| --- | --- | --- | --- | --- |

Acceptance criteria:
- <criterion> — <evidence or gap>

Not executed / blocked:
- <check> — <reason>

Unproven:
- <claim> — <why inspection is insufficient>
```
