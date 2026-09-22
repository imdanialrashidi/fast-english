---
description: Prepare a clean context/session handoff for unfinished complex work
argument-hint: "<active execution plan path or task>"
---

Prepare a structured handoff for unfinished work:

$ARGUMENTS

This command is for a deliberate context/session reset, not for hiding incomplete work.

1. Read `docs/HARNESS.md` and the relevant active execution plan. If no execution plan exists and the task genuinely needs multi-session continuity, create a concise one under `docs/exec-plans/active/`.
2. Inspect the actual working tree and relevant verification evidence. The repository state overrides stale chat assumptions.
3. Update the plan with:
   - current accepted goal/non-goals;
   - acceptance criterion status with exact evidence;
   - what is actually implemented;
   - relevant files/modules changed;
   - decisions and rationale that must survive the reset;
   - exact failed/passed commands or browser/API evidence;
   - unresolved hypotheses clearly labeled as hypotheses;
   - user-owned/unrelated work that must not be overwritten;
   - the smallest first action for the fresh session.
4. Remove stale next steps and transcript-like noise from the plan.
5. Do not change product code merely to make the handoff look cleaner.

End with the exact plan path and this instruction:

`Start a fresh Pi session and run /resume <plan-path>.`
