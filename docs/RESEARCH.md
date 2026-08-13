# Research Basis and Workflow Optimization Record

This document connects primary research to concrete Pi workflow decisions. It is an engineering evidence record, not a claim that one paper or benchmark guarantees results in every repository.

## Executive findings

1. **The repository interface matters as much as the model.** Agent-facing maps, focused tools, executable feedback, and mechanical constraints repeatedly improve software-task performance.
2. **Simple staged execution is a strong default.** Localize → repair → validate is easier to measure and often more cost-effective than adding agents or critique loops by default.
3. **Generated tests need filters.** A test that builds and passes may still add no defect-detection signal. Keep tests only when they are behavior-oriented, reliable, and demonstrably sensitive to the missing/pre-fix behavior when practical.
4. **Run the smallest faithful evidence first.** Exact tests and conservative affected-test selection reduce feedback latency; unmatched changes must fall back to a broader gate.
5. **Harness changes require outcome evals.** Representative cases, deterministic checks, trace/cost metrics, repeated trials, and a predeclared promotion rule are stronger than reading prompt text and judging it by intuition.
6. **Always-loaded context should be a map.** Repeated detailed instructions consume attention and can bury relevant evidence; retrieve details just in time.
7. **Autonomy and isolation are separate controls.** Pi intentionally avoids permission popups; trusted work can execute directly, while untrusted code or sensitive credentials need an OS/container/VM boundary rather than dozens of in-process confirmation gates.

## Primary-source evidence → workflow decision

| Primary source / lab | Finding used here | Workflow decision | Important limitation |
|---|---|---|---|
| Pi, [official product principles](https://pi.dev/) | Pi intentionally has no permission popups, supports in-place harness self-modification, and treats confirmation/sandbox policy as environment-specific extensions. | Default the trusted repository launcher to `--approve` and autonomous completion; do not require a special flag for workflow maintenance. | Trusting repository resources grants them the Pi process's permissions; this is appropriate only for a working copy the operator intends to trust. |
| Pi, [official security model](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md) | Project trust is an input-loading decision, not a sandbox; Pi has no built-in sandbox, and real isolation must come from an OS/container/VM boundary. | Keep direct execution as the normal trusted path, narrow the in-process guard to high-blast-radius accidents, and reserve strict/container mode for untrusted or sensitive environments. | A regex-based extension cannot contain indirect commands, subprocesses, prompt injection, or network egress; strict mode is still defense in depth, not isolation. |
| OpenAI, [Harness engineering](https://openai.com/index/harness-engineering/) | Repository knowledge, agent-legible interfaces, mechanical invariants, and feedback loops are core harness work; the top-level agent guide should be a map rather than a manual. | Keep `AGENTS.md` short, enforce a combined context budget, and turn recurring failures into tests/tools rather than more prompt prose. | This is an experience report from a specific agent-first project, not a controlled comparison of every individual practice. |
| Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | Start with the simplest composable workflow and add agentic complexity only when it creates measurable value. | One primary writer; optional scout/reviewer/security roles only for demonstrated ambiguity or risk; bounded repair loops. | The guidance spans many agent tasks, not only repository coding. |
| Anthropic, [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Planner/builder/evaluator contracts can help long work, but components and rounds add cost and should be ablated with eval evidence. | Durable plans only for work that must cross contexts; at most two evaluator/repair rounds; promotion data must justify extra orchestration. | Results depend on task horizon, model, and evaluator capability. |
| OpenAI, [Testing agent skills systematically with evals](https://developers.openai.com/blog/eval-skills) | A useful eval maps prompt → trace/artifact → small checks → comparable score and includes efficiency/thrashing measures. | Eval schema v2 stores deterministic assertions, command checks, trace metrics, aggregate scores, and baseline comparisons. | Deterministic checks cannot judge all product, visual, or architectural quality. |
| OpenAI, [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | Use eval-driven development, task-specific distributions, automated scoring, logging, and continuous evaluation; avoid vibe-based evaluation. | Predeclare promotion thresholds, repeat stochastic trials, keep raw traces, and never auto-promote while qualitative rubrics remain unscored. | A representative task distribution must be maintained with real project failures over time. |
| Princeton, [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793) | Purpose-built interfaces for navigation, editing, and execution materially change repository-task performance. | Prefer exact searches, semantic lookup, concise output, deterministic edit/test interfaces, and structured trace metrics. | Published benchmark results reflect the paper's models, repositories, and snapshot; they are not a current universal model ranking. |
| UIUC, [Agentless: Demystifying LLM-based Software Engineering Agents](https://arxiv.org/abs/2407.01489) | A relatively simple localization → repair → patch-validation pipeline can be competitive at low cost. | Make that three-stage path the default for ordinary code changes; orchestration must earn its cost. | SWE-bench Lite performance does not cover every greenfield, UI, or high-risk production task. |
| Microsoft Research, [CodePlan](https://arxiv.org/abs/2309.12499) | Repository-wide change requires dependency/impact analysis and plans that adapt as dependent edits are discovered. | `/build` first maps behavior → symbols/contracts → dependents → tests; affected verification routes encode known dependency surfaces. | Static dependency analysis is incomplete for reflection, runtime wiring, generated code, and external systems. |
| Meta, [TestGen-LLM](https://arxiv.org/abs/2402.09171) | In the reported deployment, many generated tests built and passed, but a much smaller fraction produced measurable coverage improvement; generation needs build/reliability/improvement filters. | `test-design` rejects tests that merely parse/pass and requires meaningful incremental signal. | Coverage improvement is still an imperfect proxy for defect detection, and the reported numbers are system/project specific. |
| UMass Amherst, [CoverUp](https://arxiv.org/abs/2403.16218) | Coverage-guided iterative test generation improves when the model receives code, coverage gaps, and execution errors across iterations. | Feed exact test failures and focused coverage/boundary gaps back into a bounded edit loop; do not regenerate blindly. | Coverage-guided success does not imply semantic correctness, maintainability, or absence of flaky tests. |
| Princeton/Chicago, [SWE-bench](https://arxiv.org/abs/2310.06770) | Real issue resolution requires repository-scale context, execution environments, and multi-file reasoning. | Add executable repository fixtures and progressively replace generic eval prompts with anonymized real failures. | Benchmark contamination, environment drift, and issue selection can affect results; use it as task-shape evidence, not a sole production score. |
| Stanford/UC Berkeley, [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/) | Long-context systems can underuse relevant evidence placed in the middle of large inputs. | Reduce duplicate always-loaded policy and retrieve focused sources just in time. | The study is not a coding-agent harness ablation; this workflow applies the finding as a conservative context-design principle. |
| Google, [Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html) | A test pyramid with many focused tests and few broad E2E tests generally gives faster, less flaky feedback; fixed ratios are only a starting heuristic. | Choose the cheapest faithful layer, keep browser E2E narrow, and reserve full E2E for behavior lower layers cannot represent. | The correct test mix depends on architecture and observed defect distribution. |
| Meta, [Predictive test selection](https://research.facebook.com/publications/predictive-test-selection/) | Change-aware test selection can reduce infrastructure cost while retaining high fault-detection probability at large scale. | Provide explicit affected-file routes and measure latency/tool calls. | Meta's learned production system is not reproduced here; this template uses deterministic, reviewable routes. |
| University of Illinois/UT Austin, [Ekstazi](https://users.ece.utexas.edu/~gligoric/papers/GligoricETAL15EkstaziTool.pdf) | File-dependency-based regression-test selection can safely avoid unaffected tests when dependency evidence is available. | Route known file/dependency groups to focused commands; unknown files always use the full fallback. | Manual route maps can become stale and do not have Ekstazi's runtime dependency collection. |
| Pi, [official RPC mode documentation](https://pi.dev/docs/latest/rpc) | RPC exposes structured tool start/end, errors, retries, compactions, session tokens, and cost. | Derive tool/error/duplicate/verification/repair metrics from official events instead of scraping prose output. | Event schemas are version-sensitive; keep the reviewed Pi version pin and rerun compatibility tests on upgrades. |

## Repository audit and fixes

| Severity | Observed problem | Why it mattered | Implemented control |
|---|---|---|---|
| P0 | The launcher could stop for project trust while the guard blocked routine Git delivery, workflow maintenance, public browser QA, and page evaluation. | The agent could implement code but still require a person to approve reversible steps or finish delivery, contradicting the workflow's autonomy goal and Pi's permissionless design. | `./p` now passes `--approve`; autonomous guard mode allows routine work and task-branch delivery; strict/container mode remains opt-in; behavioral tests exercise both modes. |
| P0 | The eval runner stored traces and a prose `grade` list but produced no automatic outcome. | Harness changes could be accepted by intuition even when the documentation demanded measurable promotion evidence. | Eval schema v2: deterministic mutation/check assertions, `PASS/FAIL`, trace metrics, per-case medians, Markdown report, `--baseline`, and regression thresholds. |
| P0 | Test guidance said “assert behavior” but did not require defect sensitivity or reliability evidence. | A generated test could mirror the implementation and pass without detecting the bug. | `test-design`, `/test`, `/build` red/pre-fix guidance, and an executable tier-boundary fixture whose post-check restores the pre-fix source and requires the new test to fail. |
| P1 | Targeted/feature/full lanes existed only as prose. | Agents had no deterministic change-to-command interface and could either run everything repeatedly or skip too much. | `scripts/verify-affected.mjs` plus `.pi/verification.json`: argv-only reviewed commands, route union/deduplication, dry planning, and conservative full fallback for unmatched files. |
| P1 | `AGENTS.md` plus `.pi/APPEND_SYSTEM.md` consumed 15,264 bytes/248 lines and repeated routing details. | Duplicate always-loaded policy spends context before task evidence appears. | Compressed the append policy and added a combined 12,000-byte/220-line doctor budget. Baseline and after sizes are measured in verification. |
| P2 | The starter suite had 15 prompts but no real code+test repair with executable acceptance. | It could not detect whether the workflow writes meaningful tests or only talks about them. | Added `tiered-pricing-regression` with a safe disposable fixture, mutation-scope assertions, final green check, and pre-fix red proof. |

## Optimized coding loop

Use this default until project evidence justifies something more complex:

1. **Contract:** state 3–7 observable criteria and proof.
2. **Localize:** map behavior to entry symbols/contracts, dependents, nearest tests, and exact commands.
3. **Expose the gap:** reproduce the bug, create a failing behavioral test, or record why that proof is impractical.
4. **Repair narrowly:** implement one coherent vertical slice in existing architecture.
5. **Exact proof:** run the new/nearest test first.
6. **Affected proof:** run `node scripts/verify-affected.mjs --file <path>`; unmatched files invoke the full fallback.
7. **Feature proof:** once after the slice, run static/unit/integration/build/browser smoke evidence appropriate to the feature.
8. **Independent review:** only for the task classes that justify it; at most two evidence-driven repair rounds.
9. **Full proof:** once at final delivery or for required risk classes.
10. **Report:** criterion → exact evidence, including failed/skipped/blocked/not-executed distinctions.

## Test acceptance filter

A generated test is retained only when all applicable gates pass:

- normal parse/build;
- final green result;
- pre-fix red, focused mutation kill, or equivalent independent defect-sensitivity evidence when practical;
- reliable repeat result when time/randomness/concurrency/browser state creates flake risk;
- behavior/public-contract assertion rather than private call-order mirroring;
- meaningful incremental signal not already supplied by an existing test;
- isolated state and useful failure output.

Coverage is a gap detector. For critical logic, boundary/property/mutation evidence is stronger than a line-percentage increase alone.

## Eval promotion protocol

Run baseline and candidate with the same case set, grader schema, model, thinking level, trial count, timeout, credentials, and comparable repository starting state. The runner stores a suite fingerprint and rejects mismatched benchmark contracts or run metadata. The v2 runner enforces:

- 100% deterministic pass rate by default;
- zero protected-workflow-file mutations;
- no per-case deterministic pass-rate regression;
- no median duration regression over 25%;
- no median tool-call or token regression over 20%;
- raw trace, command-check, diff, token, cost, and duration retention.

Passing those gates returns the schema-v2-compatible `QUALITATIVE_REVIEW_REQUIRED`, never automatic promotion. A blinded independent evaluator must still score product/visual/architecture rubric items against raw artifacts; human adjudication is optional for disputed or high-stakes promotion, not an ordinary execution dependency. New safety or data-integrity violations always reject the candidate.

## Local before/after measurement

Measured on this template repository with Node 24.14.0 using five warm local trials per command (median reported):

| Signal | Before | After | Interpretation |
|---|---:|---:|---|
| Always-loaded `AGENTS.md` + system append | 15,264 bytes / 248 lines | 11,747 bytes / 179 lines | 3,517 fewer bytes (23.0%) before task-specific context. |
| Canonical full gate | 616 ms | 1,026 ms | Intentionally slower: the full gate now executes 25 behavior tests, including launcher/guard autonomy and isolated green/pre-fix-red proof, instead of 8 safety tests. Run it once at delivery. |
| Narrow eval-runner affected route | unavailable | 599 ms | 41.6% below the new full gate while still running eval grader tests and 17-case suite dry validation. |
| Narrow verification-router route | unavailable | 165 ms | 83.9% below the new full gate; runs only routing contract tests. |
| Autonomy-core affected route | unavailable | 978 ms | Exercises launcher, guard, browser policy, and static contract checks without silently skipping any changed autonomy surface. |

Samples are recorded from one small repository and are not universal performance claims. On this template, process startup and the isolated Git fixture dominate runtime; in a large product repository, measure route recall and wall time again before setting thresholds. Faster targeted feedback does not justify weakening the final gate.

Autonomy behavior is also tested directly: seven representative reversible actions that the previous guard blocked (temporary/artifact writes, workflow maintenance, task-branch commit/push, public navigation, and page evaluation) are now allowed in autonomous mode; twelve destructive host/Git/integration examples remain blocked. The suite adds an unattended case whose required artifact and executable check fail if the agent pauses for clarification instead of completing the reversible task.

## What remains project-specific

`/bootstrap` must replace template routes and generic cases with evidence from the real repository:

- actual dependency/workspace boundaries and canonical commands;
- recent production bugs and rejected patches;
- realistic API/database/browser fixtures;
- current flake and runtime distributions;
- product-specific security, accessibility, performance, and recovery gates.

Route maps must be reviewed when architecture changes. If dependency evidence is uncertain, widen the route or use the full fallback; optimization must never rely on silent omission.
