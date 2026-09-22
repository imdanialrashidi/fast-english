---
description: Diagnose a production incident and produce a safe recovery and learning record
argument-hint: "<symptom, impact, timeline, or incident reference>"
---

Handle this incident:

$ARGUMENTS

Do not mutate production, rotate credentials, contact users, deploy, or publish without explicit authorization.

1. Establish severity, affected users/data, start time, current status, and known safety/privacy impact.
2. Separate observations from hypotheses. Preserve timestamps, relevant non-sensitive evidence, and actions already taken.
3. Identify the safest containment and recovery options, their blast radius, rollback, and verification.
4. Use `risk-review` for security, money, data integrity, migrations, access, or privacy impact.
5. Define exact recovery checks, monitoring window, and stop conditions before proposing a change.
6. After stabilization, produce a blameless timeline, root cause with confidence, contributing conditions, detection gaps, customer/operational impact, and a small corrective-action set ordered by mechanical prevention.

Return current verdict, blocked actions requiring authorization, next observation, recovery proof, and durable follow-up items. Never call a hypothesis the root cause without evidence.
