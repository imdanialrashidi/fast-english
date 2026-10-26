# Security Policy

## Reporting a vulnerability

Do not open a public issue containing an exploitable vulnerability, secret, private log, or user data. Use the repository's private **Security → Report a vulnerability** flow when available. If private reporting is unavailable, contact the repository owner through a private channel and share only the minimum reproduction needed.

Include the affected version/commit, impact, prerequisites, a minimal reproduction, and any known mitigation. Remove credentials and personal data from evidence.

## Execution boundary

DSH runs with the operating-system permissions of the account that starts it. Project workflow files (`AGENTS.md`, `.dsh/skills/`, `scripts/pr-deliver.mjs`, `docs/`) are defense in depth; they are not a sandbox. Real isolation must come from the operating system, container, or VM.

Solo default: leave the proven change in the working tree and report its state. The only routine delivery exception is a direct invocation of the reviewed `scripts/pr-deliver.mjs` helper on the fixed `ai-changes` lane, and only when the current request explicitly asks for team delivery. Main writes, PR merge, and other external actions still need exact owner authorization. Read-only inspection remains available. `PR_DELIVERY=off` opts out. See `docs/GIT_POLICY.md` and `AGENTS.md`.

For an untrusted repository, unreviewed third-party instructions, or work exposed to meaningful credentials/private data:

1. Prefer an OS/container/VM boundary with only the required workspace and credentials.
2. Pass only the provider keys required for the task.
3. Review the repository workflow files (`AGENTS.md`, `.dsh/skills/`, `scripts/pr-deliver.mjs`, `docs/WORKFLOW.md`, `docs/REVIEW-POLICY.md`, `docs/GIT_POLICY.md`) before trusting them.
4. Review diffs and outputs before copying or deploying them to a trusted/production environment.

DSH does not expose a browser tool in this project. Browser proof runs through the project's Playwright lane against a local or staging application; navigating untrusted applications is not a network security boundary, so use network policy or container isolation when egress matters.

## Third-party packages

DSH is a Node.js CLI; this repository adds no workflow packages, MCP servers, or launcher. Before adding a product dependency, review the upstream repository, ownership, release diff, install scripts, and dependencies, and test it in a disposable copy/container. Product pins stay exact in `composer.lock` + `package-lock.json` (PHP `^8.4`, Node `22.23.2`); majors are never auto-bumped per session.

## Supported versions

Security fixes are applied to the current `main` branch. The repository does not currently publish versioned releases; once releases begin, list supported release lines here.
