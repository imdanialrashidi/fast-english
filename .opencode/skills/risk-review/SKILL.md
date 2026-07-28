---
name: risk-review
description: Evidence-based review for security, correctness, performance, UX, migration, and operational release risk.
---

# Risk Review

Review only the requested scope and actual diff. Prefer a few high-confidence findings over a long generic checklist.

## Method
1. Identify changed trust boundaries, data flows, state transitions, public contracts, dependencies, and operational behavior.
2. Trace attacker-controlled or failure-prone input to sensitive sinks.
3. Check the relevant categories below.
4. Verify whether tests and controls already address the concern.
5. Report a finding only when you can cite concrete repository evidence.

## Security and integrity
- Missing or client-only authorization, object ownership checks, role escalation, insecure direct object access
- Authentication/session lifecycle errors, unsafe token storage, weak reset/recovery, missing expiry/revocation
- Injection into SQL/NoSQL/shell/template/path/URL/header/log contexts
- Unsafe deserialization, file upload/download, path traversal, SSRF, open redirect, XSS/CSRF/CORS/CSP mistakes
- Secret exposure, sensitive logging, verbose errors, insecure defaults, excessive privilege
- Payment/callback/subscription tampering, missing server verification, replay, double-processing, non-idempotent retries, amount mismatch
- Dependency or build-script changes that create a realistic supply-chain risk

## Correctness and reliability
- Broken invariants, race conditions, partial writes, stale state, timezone/rounding/overflow errors
- Missing transaction boundaries, retry semantics, timeout/cancellation, rollback, migration compatibility, or backup/restore path
- Failure paths that incorrectly report success or leave irreversible inconsistent state

## Performance
- Unbounded work, N+1 access, avoidable repeated network calls, full-table/full-file operations, memory growth, blocking hot paths
- Optimization without evidence or complexity disproportionate to the stated budget

## UI and accessibility
- Missing loading/error/empty/disabled/permission states
- Keyboard, focus, label, semantic, contrast, touch target, or reduced-motion regressions in changed UI
- User-visible destructive action without confirmation/recovery appropriate to its risk

## Tests and operations
- Missing regression or negative tests for a changed critical behavior
- CI/build/config mismatch, hidden environment dependency, non-reproducible setup
- Insufficient logs/metrics for a critical state transition, or logs containing sensitive data

## Severity
- **BLOCKER:** exploitable security issue, data loss/corruption, money/access violation, migration/deployment breakage, or critical flow cannot work.
- **MAJOR:** likely user-visible correctness/reliability failure or substantial security/performance regression.
- **MINOR:** bounded defect or maintainability issue with low immediate risk.
- **NIT:** optional clarity/style improvement; never blocks release.

## Output
For each finding provide:
- Severity and concise title
- `file:line`
- Failure or attack scenario
- Why the current code/control is insufficient
- Smallest safe fix
- Test that would prove the fix

Then list verified strengths and finish with exactly one verdict: `PASS`, `PASS WITH FIXES`, or `BLOCK`.
