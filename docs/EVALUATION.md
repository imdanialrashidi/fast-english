# Workflow Evaluation

Treat harness changes like product changes: compare outcomes on representative tasks, not confidence in prompt wording.

## Benchmark shape

- Keep at least 15 project-representative cases across product discovery, frontend build/review, ordinary bugs, high-risk boundaries, long-running recovery, and tooling failure.
- Run each case at least three times because agent results are stochastic.
- Compare baseline and candidate with the same model, thinking level, credentials, timeouts, starting repository state, and evaluator rubric.
- Use a fresh disposable copy and session for every trial. Do not let one trial's files, chat, or expected answer leak into another.
- Keep benchmark prompts outcome-focused. Do not tell the agent which harness rule is being tested.

`evals/cases.json` is a v2 starter suite. Replace or extend generic cases with anonymized real failures and accepted product tasks as the repository matures. Every case has a qualitative `rubric` plus deterministic completion/change assertions; executable cases may also define argv-array post-checks.

## Evidence and graders

Prefer this order:

1. deterministic tests, builds, schema/static checks, and exact artifact assertions;
2. real browser/API/database journey evidence;
3. security/data/permission negative-path checks;
4. `frontend-design` hard gates and screenshot craft rubric;
5. blinded pairwise evaluator comparison against the same acceptance contract;
6. blinded independent-agent evaluation for visual/product judgment, with optional human adjudication only for disputed or high-stakes promotion.

Keep the implementation agent and final evaluator contexts separate. Give the evaluator the prompt, accepted contract, diff/artifacts, and raw evidence—not the candidate's self-assessment or the expected diagnosis.

For visual pairwise comparisons, randomize baseline/candidate order and use identical routes, fixtures, viewports, theme, locale/direction, fonts, and capture timing. Accessibility and functionality are hard gates; a prettier broken result loses.

## Metrics

Record per trial:

- required acceptance criteria passed/failed/unproven;
- deterministic verification and browser journey outcome;
- visual hard-gate status and eight craft scores for frontend cases;
- BLOCKER/MAJOR findings before handoff;
- tool calls/errors, repair rounds, user interventions, duration, tokens, and reported cost;
- changed-file count and accidental/unrelated changes;
- security, privacy, data-integrity, or deployment-policy violations.

Before running, define the promotion rule and material regression thresholds. The starter rule requires a 100% deterministic pass rate, no protected-file violation, and rejects per-case median duration regression above 25% or tool/token regression above 20%. Tune thresholds from real variance rather than weakening them after seeing a candidate. A required qualitative criterion hidden as `UNPROVEN` still cannot pass.

## Running

Review the suite without model calls:

```bash
node scripts/run-workflow-evals.mjs --dry-run
```

Run its deterministic grader/router unit tests:

```bash
node --test tests/workflow-evals.test.mjs tests/verify-affected.test.mjs
```

Run three isolated trials per selected case:

```bash
node scripts/run-workflow-evals.mjs \
  --model provider/model-id \
  --thinking high \
  --trials 3
```

Record the emitted baseline `summary.json`, then run the candidate from its branch/worktree with identical settings:

```bash
node scripts/run-workflow-evals.mjs \
  --model provider/model-id \
  --thinking high \
  --trials 3 \
  --baseline /absolute/path/to/baseline/summary.json
```

Filter while iterating:

```bash
node scripts/run-workflow-evals.mjs --model provider/model-id --filter frontend --trials 1
```

The runner uses Pi's official JSONL RPC mode, copies Git-tracked and non-ignored files into `.artifacts/evals/`, refuses common secret/private paths and external symlinks, and creates a fresh local Git baseline with no remote for each trial. It disables session persistence, captures raw events/stderr/session statistics, records a content-hash manifest, runs declared post-checks without a shell, and grades deterministic completion/mutation/safety evidence. Post-checks must leave the disposable workspace byte-for-byte unchanged.

It writes `summary.json` plus `summary.md` and returns exit code 2 for deterministic failure or rejected baseline comparison. A suite fingerprint plus model/thinking/trial/timeout/Pi/Node metadata prevents comparison across different benchmark contracts or run settings. Tool starts/ends are reduced to call/error/duplicate/verification/repair/retry/compaction metrics; official session stats supply tokens and cost. Qualitative rubric items remain explicitly `UNSCORED`, so a mechanically clean result is only `QUALITATIVE_REVIEW_REQUIRED`, never automatic promotion. That review may be performed by a separate blinded model/agent; ordinary workflow completion does not wait for a person.

Model calls can incur cost and may transmit copied repository content to the selected provider. Run only with an approved model/provider and suitable data classification. For stronger isolation, launch the evaluation from the container/VM policy described in `SECURITY.md`.

RPC reference: [Pi RPC mode](https://pi.dev/docs/latest/rpc).

The executable `tiered-pricing-regression` fixture validates test usefulness rather than test existence: the final test must pass, the same test must fail when the disposable workspace temporarily restores the committed pre-fix source, and that source is restored in a `finally` block.

## Promotion report

Summarize:

- baseline vs candidate by case and metric distribution;
- deterministic failures and visual hard-gate failures;
- wins, regressions, and ambiguous outcomes;
- cost/latency/resource change;
- evaluator disagreement and calibration/adjudication notes;
- decision: promote, revise, or reject;
- new real failure cases added to the suite.
