# Review policy

Review exists to catch defects before they ship and to create shared understanding. At agent speed, human attention is the scarce resource, so review must be targeted, evidence-driven, and convergent. This policy adapts the DSH Workflow review model and Anthropic's [layered review approach](https://claude.dev/blog/solving-code-review-at-anthropic/); it does not reproduce that team's tooling or claim its results.

This document owns the review policy. The `review` skill owns the execution procedure and restates the finding fields, severity names, and report shape because installed skills must be self-contained.

## When review is required

| Change | Review |
| --- | --- |
| Small, low risk | Self-review of the diff. |
| Normal feature | Self-review plus targeted review of the changed behavior. |
| Complex change | Review after the integrated change, with checks per stage. |
| High risk | Security-focused review, independent review when available, and validation of blocker or major findings. |
| Existing change | Review the actual diff and context without editing during the review phase. |

High-risk categories include authentication and authorization, secrets, payments, personal data, migrations or deletion, public API or schema changes, concurrency, dependency/runtime upgrades, CI and release automation, installers, and sandbox or approval behavior.

An independent reviewer is valuable when it has fresh context and the actual diff. A second agent that shares the author's assumptions and history is not independent review. In DSH, `subagent` starts a fresh child; `subagent_fork` inherits completed history and is therefore assisted self-review.

## Finding admissibility

A finding must include:

- a precise file and line or tight range;
- a concrete trigger, not a hypothetical;
- the resulting impact and who experiences it;
- a severity;
- the smallest actionable fix;
- evidence, such as a code path, test, or reproduction;
- whether the problem is pre-existing.

Severity:

- **blocker** — security flaw, data loss or corruption, broken core behavior, or an unrecoverable contract violation.
- **major** — a likely user-visible regression or a contract violation that should be fixed before merge.
- **minor** — a real defect with limited impact; may be deferred with an explicit decision.

Style, naming, formatting, diagnostic wording, and cleanup are out of scope unless an explicit repository rule makes them a contract or the issue causes a material failure. Do not manufacture findings to look thorough.

## Noise control

A review that reports many non-defects is not a better review. Noise is especially expensive when the author is an agent, because a weak finding creates another fix-and-review round.

- Deduplicate findings with one cause. Report the cause once and list the affected locations.
- Do not repeat a fixed finding or a finding already raised in the current cycle.
- Require a failing scenario. "Could be cleaner" is not a defect.
- Prefer one substantiated blocker over a list of speculative concerns.
- Report clean results plainly when the change is clean.
- When a finding class recurs, fix the source: the owning document, a test, or a lint rule. Do not add the same comment every time.

## Independence and validation

Use DSH's native subagents for independent work when they are available:

1. **Generation** — a fresh-context child reads the diff and surrounding code and returns findings in the required schema. It must not edit.
2. **Validation** — for high-risk changes or uncertain blocker/major findings, a separate fresh child, or a disciplined second read, attempts to falsify each finding against the code.

The validator answers whether the trigger is real, whether the line is correct, and whether the fix would address the cause. Validation is scoped to the findings; it is not a full second review. Record which findings were validated.

If subagents are unavailable, perform a disciplined self-review, report independent review as **unexecuted**, and do not imply that it happened.

## Convergence

Agent authors and agent reviewers can otherwise keep each other busy indefinitely.

- Repair findings in `build`, then rerun the affected verification.
- Re-review only the new diff and its immediate context after fixes.
- Start with a maximum of **two repair rounds**. If findings remain unresolved after two rounds, stop and reassess with the user: narrow the scope, change the approach, or accept the risk explicitly.
- Do not reopen a resolved finding unless the fix introduced a new, demonstrated problem.
- Do not expand a review into unrelated pre-existing code. Report adjacent pre-existing risks separately and do not let them block the change unless the change makes them exploitable or materially worse.

These limits are a starting policy, not a target. A change that repeatedly fails review is a signal to reconsider the design, not to start a third round by default.

## Prohibited review shortcuts

Never:

- weaken, skip, delete, or rewrite a test to make a finding disappear;
- suppress a finding, broaden an ignore rule, or narrow the review scope without the user's explicit decision;
- approve a change with an unresolved blocker and call the approval implicit;
- let an automated reviewer approve on behalf of a human where the project requires human approval;
- claim an independent review that did not occur.

Accepted risk belongs to the user or owner, with the reason recorded. Silence or an expired review round is not acceptance.

## Finding lifecycle

1. **Reported** — the finding meets the admissibility standard.
2. **Validated** — the evidence holds; optional for minor findings, expected for blockers.
3. **Fixed** — the cause is addressed, not just the reported line.
4. **Verified** — the affected checks pass and the fix is inspected.
5. **Re-reviewed** — only the new diff, and only when the fix could change behavior outside the original finding.
6. **Closed or accepted** — closed when verified; accepted only with an owner and reason.

## Review output

The reviewer reports scope, evidence reviewed, findings by severity, independent-review status, validation status, residual risks, and a verdict: ready, changes required, or blocked. Findings must be actionable without reading a transcript.

The operational procedure is in the `review` skill. The evidence standard for fixes is in [`docs/QUALITY.md`](QUALITY.md); delivery is in [`docs/GIT_POLICY.md`](GIT_POLICY.md).
