# Workflow

This repository uses [DSH Workflow v0.1](https://github.com/imdanialrashidi/dsh-workflow) (upstream commit `93c9281`, verified against DSH `0.2.1-rc.2`) as its agent operating model. The workflow is installed project-locally: `AGENTS.md` is the always-loaded entry point, `.dsh/skills/` holds the runtime skills, and this file plus `docs/REVIEW-POLICY.md` owns the execution model. No global `$DSH_HOME` installation is required. See [`docs/adr/0003-dsh-workflow.md`](adr/0003-dsh-workflow.md) for the migration decision and rollback.

## Principles

1. **One primary writer.** A change has one writer responsible for the working tree. Delegated agents are for independent work such as fresh-context review or bounded investigation, not parallel edits to the same files.
2. **Plan only as much as needed.** Planning is a tool for complexity and risk, not a mandatory stage.
3. **Small, coherent changes.** Tie every change to explicit acceptance criteria and keep unrelated refactors out.
4. **Evidence over confidence.** Completion depends on executed checks and inspectable output, not a plausible narrative.
5. **Independent review where it adds value.** Review is risk-based and evidence-driven, not a ceremony.
6. **Repository-local context.** Instructions and project knowledge live with the code, stay concise, and have one owner per fact.
7. **Native DSH first.** Use DSH's instruction loading, skills, tools, permissions, and optional subagents. Do not build parallel orchestration.
8. **No silent authorization.** Workflow text never grants permission, bypasses an approval policy, or makes a sensitive action look routine.
9. **Repository independence.** Discover the project's real commands; do not assume another project's toolchain.

## Decision model

| Situation | Path | Required evidence | Independent review |
| --- | --- | --- | --- |
| Small, clear, low risk | `quick-fix`: inspect → implement → targeted verification → diff review | A real check for the changed behavior and the inspected diff | Not required |
| Normal feature | Brief acceptance criteria → implement → verify → review | Criteria mapped to checks; diff self-review | Optional |
| Complex change | Inspect dependencies and architecture → concise plan → implement in bounded steps → verify each stage → review | Staged evidence; integration or contract checks where relevant | Recommended |
| High-risk change | Spec → implement with negative-path tests → verify → security review → independent review | Negative paths, failure/rollback evidence, security review | Required when a reviewer is available |
| Existing change review | Inspect the actual diff and context → review only | Findings with scenarios; no edits during review | Optional second reviewer |

Risk is set by the change, not by the author's confidence. A small diff in authentication, billing, migrations, CI, installers, or data deletion is still high risk.

### Small and low risk

Use `quick-fix`. Locate the cause, make the smallest fix, run the narrowest real check, and inspect the diff. Do not create a specification or plan for a one-line correction.

### Normal feature

Use `spec` only when the request leaves a real decision open. Otherwise state acceptance criteria in the response or task, then use `build`, `verify`, and `review`. The criteria need not be a separate file.

### Complex change

Inspect the relevant architecture, dependencies, and callers before editing. Write a concise plan with bounded steps and a verification point for each step. Use `build`; verify each meaningful stage instead of waiting until the end. Keep the plan in the conversation unless the repository already treats plans as artifacts. This repository keeps durable multi-session state in `docs/exec-plans/active/`; do not add process files speculatively.

### High risk

High risk includes authentication or authorization, secrets, payments, personal data, destructive operations, migrations, public API or schema changes, concurrency, dependency/runtime upgrades, CI or release automation, installers, and sandbox or approval behavior.

For these changes:

- state the threat or failure being prevented;
- test the denied, invalid, cancelled, and rollback paths, not only the happy path;
- perform a security-focused review using `review`;
- obtain independent review with a fresh-context `subagent` when available; otherwise report it as unexecuted;
- record accepted risks and their owners explicitly.

## Verification and statuses

`verify` discovers and runs the project's actual commands. In this repository those commands are listed in `AGENTS.md`; the canonical gate is `bash scripts/project-verify.sh`. Every check records the exact command, working directory, exit code, and the output that supports the conclusion.

The upstream status names are **passed**, **failed**, **blocked**, **unproven**, and **unexecuted**. Project acceptance records use the equivalent uppercase labels:

| Project label | Meaning |
| --- | --- |
| `PASS` | The check executed and succeeded. |
| `FAIL` | The check executed and failed. |
| `BLOCKED` | A missing tool, service, credential, platform, or permission prevented execution. Name the blocker. |
| `UNPROVEN` | A claim rests on inspection or reasoning rather than execution. |
| `NOT EXECUTED` | A check was available or planned but did not run, was skipped, or was cancelled. |

A skipped test is `NOT EXECUTED`, not `PASS`. A test suite that was never discovered is not a pass. A failure in an unrelated check is still a failure to report until it is shown to be pre-existing and irrelevant.

## Review and repair

Review looks for actionable defects with a concrete failure scenario and location. It is not a style pass. The finding standard and the bounded repair loop are in [`docs/REVIEW-POLICY.md`](REVIEW-POLICY.md) and the `review` skill.

Use `subagent` for fresh-context independence. `subagent_fork` inherits completed history, so treat its output as assisted self-review, not independent review. Repair is capped at two rounds; if unresolved findings remain, stop and reassess. Never weaken tests or suppress a valid finding to get a clean report.

## Context and project knowledge

A short entry point plus focused documents beats a giant instruction file.

| Document | Owns |
| --- | --- |
| `AGENTS.md` | Standing instructions, commands, boundaries, and links to deeper documents |
| `docs/WORKFLOW.md` | Execution model, evidence, review/repair, context, DSH integration |
| `docs/REVIEW-POLICY.md` | Finding admissibility, severity, independence, convergence |
| `docs/QUALITY.md` | Acceptance criteria, project invariants, proof map, definition of done |
| `docs/PRODUCT.md` | Problem, users, outcomes, non-goals, and success signals |
| `docs/ARCHITECTURE.md` | System map, components, boundaries, invariants, and failure modes |
| `docs/DESIGN.md` | Interfaces, states, error behavior, compatibility, and design decisions |
| `docs/GIT_POLICY.md` | Opt-in scoped delivery |
| `docs/exec-plans/active/` | Durable state for work that crosses sessions |

Update the owning document in the same change when behavior, contracts, commands, or architecture change. Keep the entry point short and link to detail instead of duplicating it. Delete stale sections rather than letting them mislead the next agent.

## DSH integration in this repository

- **Project instructions:** DSH loads the root `AGENTS.md` down to the working directory. This repository deliberately does not install a `$DSH_HOME/AGENTS.md`; the project file is self-contained.
- **Skills:** `.dsh/skills/<name>/SKILL.md` is discovered at project rank 100, ahead of user and `.agents` roots. Directory names and frontmatter `name` values are kebab-case and must match. DSH loads the `SKILL.md` body; keep each body self-contained because auxiliary files are not injected.
- **Invocation:** DSH injects a skill catalog and exposes the `skill` tool. A user-invocable skill can also be invoked with a whitespace-bounded `/name` token. There are no generated slash-command files.
- **Reload:** skill edits can reach the next catalog without a restart. A new session is the safe default after changing `AGENTS.md` because global and project instructions are not watched continuously.
- **Tools:** the current DSH surface provides filesystem, shell, search, web, todo, goal, schedule, presentation, skill, and subagent tools. This project has no LSP, eval, or browser tool; use `grep`/`glob` for references and Playwright for browser proof. Do not claim a capability the session does not expose.
- **Approvals:** DSH approval and sandbox controls remain authoritative. Under the `never` policy an action that needs approval is rejected, not silently allowed. Report denied work as blocked; do not route around it.

## Workflow completion

A change is ready to report when:

- every acceptance criterion is met or explicitly reported as unmet;
- the actual checks have been run and their statuses are recorded;
- the diff has been reviewed and actionable findings are resolved or explicitly accepted;
- documentation owned by the change is updated;
- no known blocker is hidden behind a success summary.

## Upstream and scope

The upstream repository documents the generic model in its `README.md`, `docs/WORKFLOW.md`, `docs/QUALITY-POLICY.md`, `docs/REVIEW-POLICY.md`, and `docs/SECURITY.md`. This repository adapts that model to its own contracts; `docs/QUALITY.md` remains the binding acceptance contract, and `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` v1.0 remains the product baseline seen through `docs/PRODUCT.md`.
