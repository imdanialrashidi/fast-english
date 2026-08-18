#!/usr/bin/env bash
# scripts/verify-coolify-infra.sh
# Repository-side Coolify infrastructure gate (alias for the infra suite).
# Run BEFORE a release workflow can deploy: verifies the four images, the
# persistence/restore/migration proofs, the routing contract, log
# redaction and the Coolify/deployment workflow contract on the exact
# release commit. `pnpm test:infra:coolify` is the documented entry point.
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$ROOT_DIR/tests/infra/run-all.sh"