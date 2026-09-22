# Security Policy

## Reporting a vulnerability

Do not open a public issue containing an exploitable vulnerability, secret, private log, or user data. Use the repository's private **Security → Report a vulnerability** flow when available. If private reporting is unavailable, contact the repository owner through a private channel and share only the minimum reproduction needed.

Include the affected version/commit, impact, prerequisites, a minimal reproduction, and any known mitigation. Remove credentials and personal data from evidence.

## Execution boundary

Pi runs with the operating-system permissions of the account that starts it. Project trust, prompts, tool allowlists, and `.pi/extensions/safety-guard.js` are defense in depth; they are not a sandbox and cannot reliably parse every shell/interpreter behavior or redirect. This matches Pi's official security model: project trust controls repository-provided input, while real isolation must come from the operating system, container, or VM.

For a trusted working copy, `./p` is autonomous by default: it passes `--approve`, allows routine full-workspace and browser execution, and does not insert confirmation popups. Raw Git/GitHub mutation is independently denied by default; the owner-adopted policy permits only the reviewed `scripts/ai-pr.mjs` helper for scoped commit/push/PR delivery on `ai-changes`. Main writes, PR merge, and other external actions still need exact owner authorization. Read-only inspection remains available. The guard also blocks high-blast-radius patterns such as credential-store access, destructive deletion, publication/deployment, production mutation, and browser file upload. `PI_PROJECT_TRUST=ask|never` and `PI_GUARD_MODE=strict` remain explicit diagnostic/restriction overrides.

For an untrusted repository, unreviewed third-party instructions, or work exposed to meaningful credentials/private data:

1. Prefer an OS/container/VM boundary with only the required workspace and credentials.
2. Use `scripts/pi-sandbox.sh` for a simple local Docker boundary, or follow Pi's official [containerization guidance](https://pi.dev/docs/latest/containerization) for Gondolin/OpenShell alternatives.
3. Pass only the provider keys required for the task. The wrapper intentionally does not mount the host Pi home, SSH keys, cloud credentials, or Docker socket.
4. Review the repository, `.pi/settings.json`, packages, extensions, skills, prompts, and MCP configuration before trusting them.
5. Review diffs and outputs before copying or deploying them to a trusted/production environment.

The Docker build context is reduced by `.dockerignore` to the Dockerfile only. At runtime the wrapper bind-mounts this repository read/write, so the agent can still modify repository files. It uses a read-only container filesystem, drops Linux capabilities, disables privilege escalation, and applies process/resource limits. Model/API traffic still requires network access; use a policy-controlled sandbox when network/credential egress must be restricted.

Autonomous Playwright may navigate public HTTP(S) pages and use focused page evaluation. File upload/drop and MCP scripting stay unavailable; strict mode also makes navigation local-only and blocks page evaluation. None of these settings is a network security boundary or redirect containment. Use network policy/container isolation when browsing untrusted applications or when egress matters.

## Third-party packages

Pi packages and extensions execute with the Pi process's permissions. Versions in `.pi/settings.json` and `.mcp.json` are exact pins, but a pin is not a source review. Before updating:

- review the upstream repository, ownership, release diff, install scripts, dependencies, and published integrity;
- test the new pin in a disposable copy/container;
- update doctor assertions and the changelog;
- update `.pi/package-integrity.json` and run `node scripts/verify-package-integrity.mjs --online` against the npm registry;
- rerun `bash scripts/pi-doctor.sh --ci`.

## Supported versions

Security fixes are applied to the current `main` branch. The repository does not currently publish versioned releases; once releases begin, list supported release lines here.
