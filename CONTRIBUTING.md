# Contributing

Contributions should improve representative task outcomes, reduce risk/cost, or make the workflow easier to operate. More prompt text or orchestration is not automatically an improvement.

## Setup

1. Use Node.js 22.23.2 (`.nvmrc` + `package.json` engines).
2. Install omp (`curl -fsSL https://omp.sh/install | sh`), then `/login` + `/model`.
3. Review project workflow files (`.omp/`, `scripts/omp-pr.mjs`) before trusting the repository.
4. Run `bash scripts/project-verify.sh` before and after a workflow change (full gate: Pint + Pest on PostgreSQL + typecheck + build + affected Playwright spec; requires PostgreSQL and an app server on `:8111`, else the browser lane prints `SKIP: browser lane (no server on :8111)`).
5. omp runs with your OS permissions; approval tiers apply. For an untrusted repository or meaningful credential/private-data exposure, use an OS/container/VM boundary as described in `SECURITY.md`.

## Change contract

For a non-trivial change, state:

- problem and accepted outcome;
- explicit non-goals;
- observable criteria and proof;
- compatibility, security, data, accessibility, performance, visual, and operational risk where relevant;
- rollback or targeted reversal.

Preserve unrelated work and keep one primary writer. Do not add dependencies without a concrete benefit over current/platform capabilities.

## Workflow-policy changes

Workflow maintenance is allowed in the default mode. Keep it explicitly scoped, update all affected source-of-truth documents and `CHANGELOG.md`, and rely on the tested diff/CI evidence rather than a startup flag.

Run:

```bash
bash scripts/project-verify.sh
```

Full gate: Pint + Pest on PostgreSQL + typecheck + build + affected Playwright spec. Requires PostgreSQL reachable and an app server on `:8111`; when no server answers, the browser lane prints `SKIP: browser lane (no server on :8111)`.

For a material harness change, compare baseline/candidate on representative cases. Do not publish artifacts containing repository content or credentials.

## Frontend contributions

- Follow the accepted `docs/DESIGN.md`; update it before introducing a new visual direction.
- Prove the critical journey and required states in the real browser.
- Include deterministic desktop/mobile/demanding-state evidence for a material visual change.
- Report `docs/DESIGN.md` hard gates and craft score; aesthetics never cancel a functional/accessibility/performance failure.
- Record third-party font/media/icon source and license.

## Pull request evidence

Complete the pull-request template. Link exact commands and outcomes, not “tests pass.” Include screenshots only when they are deterministic, non-sensitive, and materially help review.

Report vulnerabilities privately using `SECURITY.md`, not a public issue or pull request.
