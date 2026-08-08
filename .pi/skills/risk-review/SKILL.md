---
name: risk-review
description: Evidence-based review for security, correctness, data integrity, performance, UX, migration, and operational release risk. Use for high-risk diffs and before release claims.
---

# Risk Review

Review only the requested scope and actual diff. Prefer a few high-confidence findings over a generic checklist.

## Method

1. Identify changed trust boundaries, data flows, state transitions, public contracts, dependencies, and operational behavior.
2. Trace attacker-controlled or failure-prone input to sensitive sinks.
3. Verify whether existing tests and controls address the concern.
4. Report a finding only with concrete repository evidence.

## Security and integrity

Check for:

- missing or client-only authorization, ownership checks, role escalation, or cross-tenant access;
- authentication/session lifecycle errors, unsafe token storage, weak recovery, or missing expiry/revocation;
- SQL/NoSQL/shell/template/path/URL/header/log injection;
- unsafe files, path traversal, SSRF, open redirect, XSS, CSRF, CORS, or CSP mistakes;
- secret exposure, sensitive logging, insecure defaults, or excessive privilege;
- payment, callback, subscription, entitlement, replay, idempotency, or amount-verification failures;
- realistic dependency or build-script supply-chain risk.

## Correctness and reliability

Check for:

- broken invariants, race conditions, partial writes, stale state, timezone, rounding, or overflow errors;
- missing transaction boundaries, retries, timeout/cancellation, rollback, migration compatibility, or recovery;
- failure paths that report success or leave inconsistent state.

## Performance and UX

Check for:

- unbounded work, N+1 access, duplicate calls, full-table/full-file operations, memory growth, or blocking hot paths;
- missing loading, empty, error, disabled, retry, success, and permission states;
- keyboard, focus, label, semantic, contrast, touch target, or reduced-motion regressions.

## Tests and operations

Check for:

- missing regression or negative tests for changed critical behavior;
- CI/build/config mismatch or hidden environment dependency;
- insufficient non-sensitive logs for critical transitions;
- rollback, backup, or release-readiness gaps.

## Severity

- **BLOCKER:** exploitable security issue, data loss/corruption, money/access violation, migration/deployment breakage, or a critical flow cannot work.
- **MAJOR:** likely user-visible correctness/reliability failure or substantial security/performance regression.
- **MINOR:** bounded defect or maintenance risk with low immediate impact.
- **NIT:** optional clarity improvement; never blocks release.

## Output

For each finding provide:

- severity and concise title;
- `file:line` or symbol;
- failure or attack scenario;
- why the current control is insufficient;
- smallest safe fix;
- test that proves the fix.

Then list verified strengths and finish with exactly one verdict:

`PASS`, `PASS WITH FIXES`, or `BLOCK`.
