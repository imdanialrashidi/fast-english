#!/usr/bin/env bash
# scripts/verify-smokes-parallel.sh
# Run all 17 real-PocketBase smoke suites concurrently for the CI backend
# lane. Every suite gets its OWN disposable PocketBase on a UNIQUE port,
# so no suite can observe another suite's fixtures or data (the wrappers
# already clean up their own PB process and data dir on exit).
#
# This is the CI-only orchestration. The canonical serial model
# (scripts/project-verify.sh, `pnpm verify:full`) is unchanged for local
# use; this script exists solely so the CI backend lane can overlap
# independent suites instead of serializing them.
#
# Usage: FEP_SMOKE_JOBS=4 bash scripts/verify-smokes-parallel.sh
# Fails (nonzero) if any suite fails and prints the failing suite log tail.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

test -x server/pocketbase || {
  echo 'server/pocketbase missing — run scripts/setup-pocketbase.sh first' >&2
  exit 1
}

JOBS="${FEP_SMOKE_JOBS:-4}"
LOG_DIR="$(mktemp -d -t fep-smokes-XXXXXX)"
RESULT_FILE="$LOG_DIR/results.txt"
: >"$RESULT_FILE"

# suite_id|wrapper|smoke script|port env var
# Ports are assigned per suite (BASE_PORT + index) so concurrent suites
# never share a port; the wrapper reads its family's env var.
SUITES=(
  "auth|scripts/smoke-auth.sh|scripts/smoke-auth.mjs|PB_SMOKE_PORT"
  "payment|scripts/smoke-payment.sh|scripts/smoke-payment.mjs|PB_SMOKE_PAY_PORT"
  "payment-preview|scripts/smoke-payment.sh|scripts/smoke-payment-preview.mjs|PB_SMOKE_PAY_PORT"
  "operator|scripts/smoke-payment.sh|scripts/smoke-operator.mjs|PB_SMOKE_PAY_PORT"
  "staff|scripts/smoke-payment.sh|scripts/smoke-staff.mjs|PB_SMOKE_PAY_PORT"
  "placement|scripts/smoke-placement.sh|scripts/smoke-placement.mjs|PB_SMOKE_PLACEMENT_PORT"
  "placement-levels|scripts/smoke-placement.sh|scripts/smoke-placement-levels.mjs|PB_SMOKE_PLACEMENT_PORT"
  "placement-race|scripts/smoke-placement.sh|scripts/smoke-placement-race.mjs|PB_SMOKE_PLACEMENT_PORT"
  "placement-capacity|scripts/smoke-placement.sh|scripts/smoke-placement-capacity.mjs|PB_SMOKE_PLACEMENT_PORT"
  "lessons|scripts/smoke-placement.sh|scripts/smoke-lessons.mjs|PB_SMOKE_PLACEMENT_PORT"
  "episode|scripts/smoke-placement.sh|scripts/smoke-episode.mjs|PB_SMOKE_PLACEMENT_PORT"
  "progress|scripts/smoke-placement.sh|scripts/smoke-progress.mjs|PB_SMOKE_PLACEMENT_PORT"
  "podcast-domain|scripts/smoke-placement.sh|scripts/smoke-podcast-domain.mjs|PB_SMOKE_PLACEMENT_PORT"
  "content-import|scripts/smoke-placement.sh|scripts/smoke-content-import.mjs|PB_SMOKE_PLACEMENT_PORT"
  "content-admin|scripts/smoke-placement.sh|scripts/smoke-content-admin.mjs|PB_SMOKE_PLACEMENT_PORT"
  "library|scripts/smoke-placement.sh|scripts/smoke-library.mjs|PB_SMOKE_PLACEMENT_PORT"
  "business-settings|scripts/smoke-placement.sh|scripts/smoke-business-settings.mjs|PB_SMOKE_PLACEMENT_PORT"
)

export LOG_DIR RESULT_FILE

run_one() {
  local id="$1" wrapper="$2" script="$3" port_var="$4" port="$5"
  local start end log="$LOG_DIR/$id.log"
  start="$(date +%s)"
  if env "$port_var=$port" bash "$wrapper" node "$script" >"$log" 2>&1; then
    end="$(date +%s)"
    printf 'PASS %-20s %4ds\n' "$id" "$((end - start))"
    printf '%s:PASS\n' "$id" >>"$RESULT_FILE"
  else
    end="$(date +%s)"
    printf 'FAIL %-20s %4ds\n' "$id" "$((end - start))"
    printf '%s:FAIL\n' "$id" >>"$RESULT_FILE"
  fi
}
export -f run_one

BASE_PORT=18200
i=0
for suite in "${SUITES[@]}"; do
  IFS='|' read -r id wrapper script port_var <<<"$suite"
  printf '%s %s %s %s %d\n' "$id" "$wrapper" "$script" "$port_var" "$((BASE_PORT + i))"
  i=$((i + 1))
done | xargs -P "$JOBS" -n 5 bash -c 'run_one "$@"' _ 

echo
printf '=== smoke suites (parallel, %s at a time) ===\n' "$JOBS"
# Stable suite-order report.
for suite in "${SUITES[@]}"; do
  id="${suite%%|*}"
  grep "^${id}:" "$RESULT_FILE" | sed "s/^${id}:/${id} /" || true
done

failures="$(grep -c ':FAIL' "$RESULT_FILE" || true)"
if [[ "$failures" -gt 0 ]]; then
  echo >&2
  echo "$failures suite(s) FAILED:" >&2
  for suite in "${SUITES[@]}"; do
    id="${suite%%|*}"
    if grep -q "^${id}:FAIL" "$RESULT_FILE"; then
      echo "--- $id log tail:" >&2
      tail -n 30 "$LOG_DIR/$id.log" >&2
    fi
  done
  rm -rf "$LOG_DIR"
  exit 1
fi

rm -rf "$LOG_DIR"
echo "All ${#SUITES[@]} smoke suites passed in parallel."
