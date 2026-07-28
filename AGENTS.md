# Project Operating Rules

## Mission
Ship the smallest correct, secure, maintainable change that satisfies the accepted requirement. Production-worthy means verified critical behavior and explicit trade-offs—not maximal architecture.

## Source of truth
Use this order when information conflicts:
1. Current user request and accepted acceptance criteria
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. Existing code and tests
5. Clearly stated assumptions

Read only the files needed for the task. Never copy confidential client material into public docs, issues, logs, fixtures, prompts, or commits. Keep private specifications under ignored `docs/private/`.

## Model routing
- **plan / architecture model:** architecture, cross-cutting design, data model, public APIs, migrations, auth, authorization, payments, secrets, uploads, cryptography, concurrency, backups, deployment, large performance work, and release review.
- **build / main model:** normal feature implementation, refactors with bounded scope, tests, integration, and fixes.
- **fast subagent:** searches, inventory, repetitive low-risk edits, test scaffolding, documentation cleanup, formatting, and simple isolated UI changes.

The fast subagent must never decide or modify security boundaries, payment behavior, permissions, schemas/migrations, public API contracts, destructive operations, deployment, or performance-critical algorithms. Escalate uncertainty instead of guessing.

## Work protocol
For a non-trivial task:
1. Restate the acceptance target in at most three lines.
2. Inspect the smallest relevant surface and identify existing patterns to reuse.
3. Write a short plan before editing when the change crosses modules or trust boundaries.
4. Implement one coherent vertical slice; avoid unrelated cleanup.
5. Run the narrowest relevant checks, then `scripts/verify.sh` before claiming completion.
6. Report changed behavior, verification performed, remaining risk, and assumptions.

Do not claim a command passed unless it was run successfully. Never hide failures, weaken checks, delete tests to make CI pass, or fabricate output.

## YAGNI / Ponytail decision ladder
Before adding code, abstraction, dependency, service, agent, tool, cache, queue, or configuration, ask in order:
1. Does this need to exist for an accepted requirement or proven risk?
2. Can an existing project pattern be reused?
3. Can the language standard library do it clearly?
4. Can the platform/framework do it natively?
5. Is an already-installed dependency sufficient?
6. Can one clear local implementation solve it?
7. What is the minimum working design with a reversible path?

Do not use this ladder to remove validation, authorization, accessibility, observability required for critical flows, backup/recovery, or necessary tests.

## Code and architecture
- Prefer boring, explicit code and cohesive modules over clever abstractions.
- Do not create a generic abstraction before two real use cases, unless a security boundary requires centralization.
- Preserve current architecture unless the accepted requirement cannot fit it safely.
- No new dependency without stating why existing code, standard library, and platform APIs are insufficient.
- Keep public interfaces small and stable. Validate at boundaries and keep domain logic independent of transport/UI.
- Keep diffs reviewable. Do not reformat unrelated files.

## Security invariants
- Treat client input, headers, cookies, URLs, files, callbacks, and external API data as untrusted.
- Authentication identifies a principal; authorization is checked server-side for every protected action and object.
- Never trust client-supplied role, ownership, price, discount, payment status, subscription status, or permission.
- Keep secrets out of source, client bundles, logs, errors, analytics, and fixtures.
- Use parameterized data access or the framework ORM safely; never concatenate untrusted input into queries or commands.
- Make money movement and external callbacks authenticated where possible, verified server-side, idempotent, replay-safe, and auditable.
- Constrain uploads by type, size, name, storage location, and authorization; do not execute uploaded content.
- Use least privilege, secure defaults, generic user-facing errors, and useful non-sensitive logs.
- For auth, access control, payments, secrets, uploads, migrations, or backup changes, require `/review` before `/ship`.

## Performance
- Define the user-visible budget or bottleneck before optimizing.
- Measure the touched critical path when practical; do not add caching, concurrency, denormalization, or background infrastructure speculatively.
- Avoid unbounded reads, N+1 queries, repeated network calls, oversized bundles, blocking work, and loading data the UI does not use.
- Prefer pagination, indexes justified by real queries, lazy loading, bounded concurrency, and simple cache headers.
- Record evidence before and after meaningful optimization.

## UI quality
- Reuse the existing design system, tokens, components, spacing, and interaction patterns.
- Design mobile-first when the product requires it.
- Every user flow must define loading, empty, error, disabled, success, and permission-denied states where applicable.
- Preserve keyboard access, semantic elements, visible focus, labels, contrast, touch targets, and reduced-motion behavior.
- Do not redesign unrelated screens during feature work.

## Testing and release
- Test behavior and risk, not implementation trivia.
- Add a regression test for every fixed bug when feasible.
- Critical auth, authorization, payment, subscription, destructive-action, and migration paths need positive, negative, tampering, retry/idempotency, and failure-path coverage.
- Use a small test pyramid appropriate to the repository; do not pursue arbitrary 100% coverage.
- A task is done only when acceptance criteria are met, relevant checks pass, no known blocker remains, and behavior/architecture docs are updated when necessary.

## Autonomous execution policy

The build agent owns routine implementation decisions.

- Continue working until the requested scope and acceptance criteria are complete.
- Do not ask for approval between slices, files, test fixes, dependency
  installations, refactors, or reversible implementation choices.
- When several reasonable options exist, choose the smallest, safest,
  most reversible option consistent with the existing architecture.
- Record the decision briefly and continue.
- After each slice, run the relevant checks, update the current plan, and
  continue to the next requested slice without waiting for user confirmation.
- Do not stop merely to provide a progress report.
- A test-environment limitation is not a reason to stop. Use the smallest
  honest test layer capable of verifying the behavior.
- Do not modify production behavior only to satisfy an inaccurate test harness.
- Do not weaken, skip, delete, or falsify tests to obtain a green result.
- If a browser/framework behavior cannot be verified reliably in jsdom,
  keep structural tests in jsdom and verify the actual behavior in a real
  browser test.

Stop only when one of these hard blockers exists:

1. A required credential, secret, external account, or unavailable service is missing.
2. The next action would affect production, real users, real money, or external infrastructure.
3. The next action is destructive or practically irreversible.
4. Accepted requirements directly contradict each other and no reversible
   interpretation is possible.
5. A security boundary cannot be implemented safely with the available information.

When stopped by a hard blocker, report the exact blocker and the minimum user
action required. Do not present routine engineering choices for approval.
