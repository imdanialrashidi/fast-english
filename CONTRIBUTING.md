# Contributing

Contributions should improve representative task outcomes, reduce risk/cost, or make the workflow easier to operate. More prompt text or orchestration is not automatically an improvement.

## Setup

1. Use Node.js 22.19.0 or newer.
2. Install the reviewed Pi pin from `README.md`.
3. Review project-local packages/extensions before trusting the repository.
4. Run `bash scripts/verify.sh` before and after a workflow change.
5. Use the direct autonomous launcher for trusted work. For an untrusted repository or meaningful credential/private-data exposure, use `bash scripts/pi-sandbox.sh` or another boundary described in `SECURITY.md`.

## Change contract

For a non-trivial change, state:

- problem and accepted outcome;
- explicit non-goals;
- observable criteria and proof;
- compatibility, security, data, accessibility, performance, visual, and operational risk where relevant;
- rollback or targeted reversal.

Preserve unrelated work and keep one primary writer. Do not add dependencies without a concrete benefit over current/platform capabilities.

## Workflow-policy changes

Workflow maintenance is allowed in the default autonomous mode. Keep it explicitly scoped, update all affected source-of-truth documents, doctor assertions, integrity records, eval cases, and `CHANGELOG.md`, and rely on the tested diff/CI evidence rather than a startup flag.

Run:

```bash
bash scripts/verify.sh
node scripts/verify-package-integrity.mjs --online  # when package pins change
node scripts/run-workflow-evals.mjs --dry-run       # when evals/runner change
```

For a material harness change, compare baseline/candidate on representative cases as described in `docs/EVALUATION.md`. Do not publish model-eval artifacts containing repository content or credentials.

## Frontend contributions

- Follow the accepted `docs/DESIGN.md`; update it before introducing a new visual direction.
- Prove the critical journey and required states in the real browser.
- Include deterministic desktop/mobile/demanding-state evidence for a material visual change.
- Report `frontend-design` hard gates and craft score; aesthetics never cancel a functional/accessibility/performance failure.
- Record third-party font/media/icon source and license.

## Pull request evidence

Complete the pull-request template. Link exact commands and outcomes, not “tests pass.” Include screenshots only when they are deterministic, non-sensitive, and materially help review.

Report vulnerabilities privately using `SECURITY.md`, not a public issue or pull request.
