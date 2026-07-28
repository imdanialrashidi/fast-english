---
description: Run the final local release gate without deploying
agent: build
---

Prepare the current change for handoff. Do not add features, deploy, push, or rewrite unrelated code.

1. Re-read the accepted goal and inspect the full diff.
2. Confirm no secret, private spec, generated artifact, debug bypass, or unrelated change is included.
3. Run `scripts/verify.sh`.
4. For high-risk changes, require a completed `/review` with no BLOCKER or unresolved MAJOR issue.
5. Return: release summary, checks run, known limitations, rollback note, and manual verification steps.
