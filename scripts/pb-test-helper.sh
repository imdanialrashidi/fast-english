#!/usr/bin/env bash
# scripts/pb-test-helper.sh
# Shared helpers for test wrappers that start disposable PocketBase instances.
# Source this file, then call the function.
set -Eeuo pipefail

# pb_create_superuser DATA_DIR
# Creates one disposable test superuser in the given fresh pb_data directory
# so PocketBase does not auto-open the browser for the installer wizard.
# Uses a fixed non-production email and a random password.
# Suppresses command output containing the credentials.
# Exports PB_TEST_SU_EMAIL and PB_TEST_SU_PASSWORD so Node smoke scripts
# can authenticate via the API without calling superuser upsert.
pb_create_superuser() {
  local data_dir="$1"
  local pb_bin="${PB_BIN:-server/pocketbase}"
  local email="${PB_TEST_SU_EMAIL:-pbtest@fep-smoke.invalid}"
  local password
  password="pbtest-$(date +%s)-$$-${RANDOM}"

  "${pb_bin}" superuser upsert "${email}" "${password}" \
    --dir="${data_dir}" \
    >/dev/null 2>&1

  export PB_TEST_SU_EMAIL="$email"
  export PB_TEST_SU_PASSWORD="$password"
}
