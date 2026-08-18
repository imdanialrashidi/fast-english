#!/usr/bin/env bash
# scripts/release-classify.sh
# Deployment change classification (task §16). Derives the deploy surface
# impact of a release from its Git diff. NEVER makes assumptions about
# database migrations: a single changed file under server/pb_migrations is
# always classified TYPE C (migration) regardless of intent.
#
# Classes (union, e.g. "A C"):
#   A  Landing/Student/Admin only — no PocketBase restart; no database
#      backup required solely because UI/CSS changed.
#   B  PocketBase hooks/backend without migration — pre-deploy backup
#      required by policy; PocketBase redeploys.
#   C  Migrations — pre-deploy verified backup MANDATORY; migration
#      compatibility warning; rollback does NOT reverse the migration.
#   D  Config/secret — controlled runtime configuration update, restart
#      only the affected service.
#   E  Android — not deployed through the normal web-container workflow.
#
# Usage: bash scripts/release-classify.sh <base-ref-or-''> <head-sha>
#   base '' => treat as the whole tree (first release).
# Prints a single line with the union of matching classes. Exit 0.
set -Eeuo pipefail

BASE="${1:-}"
HEAD="${2:-HEAD}"

if [[ -n "$BASE" ]]; then
  RANGE="$BASE..$HEAD"
  CHANGED="$(git diff --name-only "$RANGE" 2>/dev/null || git diff --name-only "$BASE" "$HEAD")"
else
  CHANGED="$(git ls-tree -r --name-only "$HEAD" 2>/dev/null)"
fi

CLASSES=()

has() { # any changed path matching the pattern?
  local pat="$1"
  local hit
  hit="$(printf '%s\n' "$CHANGED" | grep -E "$pat" | head -1 || true)"
  [[ -n "$hit" ]]
}

if has '^server/pb_migrations/'; then
  CLASSES+=("C")
fi
if has '^server/pb_hooks/|^docker/pocketbase/|^server/VERSION$|^server/pocketbase\.sha256$|^server/VERSION'; then
  CLASSES+=("B")
fi
if has '^(landing|app|admin|shared)/|^vite\.(landing|app|admin)\.config\.ts$'; then
  CLASSES+=("A")
fi
if has '^deploy/|^(docker/|scripts/(release-classify|coolify-deploy|prod-health-check|verify-coolify-infra))' || has '^.github/workflows/'; then
  CLASSES+=("D")
fi
if has '^android/'; then
  CLASSES+=("E")
fi

if [[ ${#CLASSES[@]} -eq 0 ]]; then
  echo "NONE"
else
  echo "${CLASSES[@]}"
fi