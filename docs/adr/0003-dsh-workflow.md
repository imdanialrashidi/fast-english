# ADR-0003: DSH Workflow replaces the omp production workflow

- Date: 2026-10-25
- Status: Accepted
- Supersedes: the omp production workflow adopted 2026-10-14 (`.omp/` commands, rules, skills, and config)
- Source: [imdanialrashidi/dsh-workflow](https://github.com/imdanialrashidi/dsh-workflow) at commit `93c9281a768e8ebf795b9e19108ab8934089ac76`, workflow version 0.1, verified against DSH `0.2.1-rc.2`

## Context

The repository's agent workflow was a set of omp-specific command files, sticky rules, project config, and skills under `.omp/`. omp supplied the instruction loader, slash-command dispatch, LSP, browser, eval, memory, and session tools those files assumed.

The repository now runs in DeepSeek Harness (DSH). DSH loads `AGENTS.md` as project instructions, discovers skills from `<project>/.dsh/skills` at rank 100, injects a skill catalog, exposes the `skill` tool and a `/name` user gesture, and provides optional fresh-context subagents. omp-only mechanisms (`/skill:` dispatch, command files, `.omp/config.yml`, LSP, eval, browser, memory tools) are not part of this session.

The owner asked to change the project workflow from omp to the DSH Workflow repository. The migration must preserve product code, contracts, tests, and the accepted uncommitted working tree.

## Decision

1. Adopt DSH Workflow v0.1 as the project operating model.
2. Install it **project-locally**, not globally:
   - `.dsh/skills/` contains `quick-fix`, `spec`, `build`, `verify`, `review`, `test-design`, and the project's existing `no-ai-slop` prose skill.
   - `AGENTS.md` is the DSH entry point and carries the project commands, boundaries, and links.
   - `docs/WORKFLOW.md` and `docs/REVIEW-POLICY.md` replace `docs/HARNESS.md` as the execution and review model.
   - `docs/QUALITY.md` remains the binding acceptance contract; its status vocabulary gains `NOT EXECUTED` so skipped checks are not reported as passes.
   - No `$DSH_HOME/AGENTS.md` or `$DSH_HOME/skills` writes are part of this change, so other projects and the user's global DSH configuration are unaffected.
3. Retire `.omp/` command files, rules, config, and the omp-branded skills. The project skill `no-ai-slop` is carried forward; the rest are replaced by the DSH workflow skills.
4. Retain the reviewed scoped delivery helper because it is project delivery infrastructure, not an omp runtime dependency. Rename `scripts/omp-pr.mjs` to `scripts/pr-deliver.mjs`, rename its markers, lock, receipt, and its former `OMP_PR_DELIVERY` environment variable to `PR_DELIVERY`, and keep its behavior unchanged. It remains opt-in under `docs/GIT_POLICY.md` and runs only on an explicit team-delivery request.
5. Keep solo work as the default: no commit, push, branch, PR, merge, release, or deployment without an explicit request.

## Consequences

- New DSH sessions load the rewritten `AGENTS.md` and the project skills. A new session is the safe default because instruction changes are not watched continuously; skill edits can reach the next catalog without a restart.
- No generated slash-command files exist. `/quick-fix`, `/spec`, `/build`, `/verify`, `/review`, `/test-design`, and `/no-ai-slop` are DSH skill names.
- The workflow no longer depends on omp LSP, eval, browser, memory, or `/skill:` dispatch. Reference work uses `grep`/`glob`; browser proof uses the project's Playwright lane and stays `BLOCKED` or `NOT EXECUTED` when it cannot run.
- The scoped PR helper still targets the fixed `ai-changes` → `main` lane and keeps its explicit-file, secret-scan, compare-and-swap, no-force, and no-auto-merge behavior. Only its names changed.
- Workflow self-checks now validate `.dsh/skills` frontmatter and `scripts/pr-deliver.mjs` syntax instead of `.omp` command files and `scripts/omp-pr.mjs`.
- The prior workflow files are recoverable from `.artifacts/migration-backup-2026-10-25-omp-to-dsh/` (ignored by git) and from the pre-migration commit in history.

## Evidence

- Upstream workflow README and capability map reviewed on 2026-10-25; DSH `0.2.1-rc.2` installed locally.
- A direct `FileSystemSkillProvider` check from `@deepseek-ai/dsh-skill-filesystem` listed all seven project skills at rank `project-dsh` (100) and loaded every body.
- A direct `loadBaselineInstructions` check from `@deepseek-ai/dsh-agent-instructions` rendered the root `AGENTS.md` for this checkout.
- `bash scripts/verify.sh --template-only` passed, validating skill frontmatter, required workflow files, helper syntax, and whitespace.
- `node --check scripts/pr-deliver.mjs` passed; import smoke tests covered the repository parser, option validation, and the `PR_DELIVERY=off` opt-out. End-to-end delivery was not executed.
- Product behavior and the Pest/Playwright suites are unchanged; the only acceptance-contract edit is the added `NOT EXECUTED` status in `docs/QUALITY.md`.
