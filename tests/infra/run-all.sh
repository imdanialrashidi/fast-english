#!/usr/bin/env bash
# tests/infra/run-all.sh
# Fast English Podcast — Coolify-era infrastructure verification (local).
#
#   pnpm test:infra:coolify        (alias)
#   bash tests/infra/run-all.sh
#
# Orchestrates the disposable verification suite:
#   01 build the four production images (commit-tagged)
#   02 runtime/identity/non-root/health/SPA/PWA/admin contract on the images
#   03 image secret scan
#   04 PocketBase persistence across container deletion + recreation
#   05 backup -> clean restore into a brand-new empty directory
#   06 migration lifecycle + rollback non-reversal
#   twin (compose) up + 07 routing contract
#   08 log token-redaction proof (nginx/edge logging path)
#   09 Coolify integration contract validation
#
# Safety: everything runs in disposable docker containers and mktemp
# directories under /tmp/fep-infra.*; production paths (/opt/fast-english,
# server/pb_data) are explicitly refused by the shared lib. Fail closed on
# the first failure; containers are always removed.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

INFRA_DIR="$ROOT_DIR/tests/infra"
source "$INFRA_DIR/lib.sh"

require_cmd docker

# Pre-flight: remove any leftover disposable test containers from a previous
# interrupted run so host ports (18099-182xx) are never occupied by strays.
LEFT=$(docker ps -aq --filter name=fep-verify --filter name=fep-persist --filter name=fep-restore --filter name=fep-mig --filter name=fep-redact 2>/dev/null || true)
if [[ -n "$LEFT" ]]; then
  docker rm -f $LEFT >/dev/null 2>&1 || true
  echo "infra: removed $(echo $LEFT | wc -w) leftover test container(s)"
fi

# A single disposable base for the entire run (cleaned up by the OS under
# /tmp; never deleted by us — see AGENTS safety rules).
export FEP_INFRA_TMPDIR
FEP_INFRA_TMPDIR="$(mktemp -d /tmp/fep-infra.XXXXXX)"
echo "infra: disposable workspace $FEP_INFRA_TMPDIR"
echo "infra: runtime user uid=$CURRENT_UID gid=$CURRENT_GID (pb runtime ${PB_RUNTIME_UID}:${PB_RUNTIME_GID})"

# Matrix of suites; each must exist and exit 0.
SUITES=(
  "01-build-images.sh"
  "02-image-verify.sh"
  "03-secret-scan.sh"
  "04-pb-persistence.sh"
  "05-pb-restore.sh"
  "06-pb-migration.sh"
)
PASSED=(); FAILED=()
twin_up=0

for s in "${SUITES[@]}"; do
  echo
  echo "############################################################"
  echo "### suite: $s"
  echo "############################################################"
  if bash "$INFRA_DIR/$s"; then PASSED+=("$s"); else FAILED+=("$s"); fi
done

# --- twin (compose) + routing + redaction + contract --------------------------
infra_echo "starting the disposable Coolify-equivalent twin"
PB_DATA="$(mktemp -d "$FEP_INFRA_TMPDIR/twin-pb.XXXXXX")"
RELEASES="$(mktemp -d "$FEP_INFRA_TMPDIR/twin-releases.XXXXXX")"
guard_never_touch "$PB_DATA" "$RELEASES"
mkdir -p "$PB_DATA" "$RELEASES"
# mktemp creates 0700 dirs; the container users must be able to traverse
# them (nginx reads the releases volume as uid 101; PocketBase writes as
# the runtime uid). This mirrors the production modes (0755 / 0770).
chmod 0755 "$RELEASES"
chmod 0770 "$PB_DATA"
if [[ "$CURRENT_UID" == "0" ]]; then
  chown "${PB_RUNTIME_UID}:${PB_RUNTIME_GID}" "$PB_DATA"
  chmod 0770 "$PB_DATA"
fi
# synthetic release fixture (fake APK + metadata; no real artifacts)
printf 'PK\x03\x04 fake apk fixture\n' > "$RELEASES/fast-english-podcast-v0.0.0-infra.apk"
FIX_APK_SHA="$(sha256sum "$RELEASES/fast-english-podcast-v0.0.0-infra.apk" | awk '{print $1}')"
cat > "$RELEASES/release-metadata.json" <<EOF
{"fileName":"fast-english-podcast-v0.0.0-infra.apk","versionName":"0.0.0","sizeBytes":$(stat -c%s "$RELEASES/fast-english-podcast-v0.0.0-infra.apk"),"sha256":"$FIX_APK_SHA"}
EOF
printf '# Fast English — infra fixture release notes\nsha256: %s\n' "$FIX_APK_SHA" > "$RELEASES/RELEASE-NOTES.md"

export FEP_INFRA_PB_DATA="$PB_DATA"
export FEP_INFRA_RELEASES="$RELEASES"
export FEP_INFRA_PB_UID="$PB_RUNTIME_UID"
export FEP_INFRA_PB_GID="$PB_RUNTIME_GID"
export FEP_INFRA_EDGE_PORT="18150"

docker compose -f "$ROOT_DIR/infra/compose.yaml" up -d --build --force-recreate --pull never 2>&1 | tail -5
trap 'docker compose -f "$ROOT_DIR/infra/compose.yaml" down --remove-orphans >/dev/null 2>&1 || true' EXIT

# wait for pocketbase inside the twin to become healthy (via its loopback port)
for t in $(seq 1 90); do
  if curl -fsS -o /dev/null http://127.0.0.1:18140/api/health 2>/dev/null; then break; fi
  sleep 1
done
curl -fsS -o /dev/null http://127.0.0.1:18140/api/health \
  || { echo "twin pocketbase not healthy:" >&2; docker compose -f "$ROOT_DIR/infra/compose.yaml" logs pocketbase 2>&1 | tail -20 >&2; exit 1; }
echo "  PASS  twin pocketbase healthy on the loopback port"

# Settle + pre-verify the landing /releases volume before the routing suite
# (guards against a stale container mount or cold-start race).
sleep 3
REL_OK=0
for t in $(seq 1 15); do
  if curl -s --resolve "fastenglishpodcast.com:18150:127.0.0.1" \
      "http://fastenglishpodcast.com:18150/releases/release-metadata.json" 2>/dev/null | grep -q '"fileName"'; then
    REL_OK=1; break
  fi
  sleep 1
done
[[ "$REL_OK" -eq 1 ]] || { echo "twin landing /releases volume not serving metadata:" >&2; docker compose -f "$ROOT_DIR/infra/compose.yaml" logs landing 2>&1 | tail -10 >&2; exit 1; }
echo "  PASS  twin landing serves the /releases host volume"

if bash "$INFRA_DIR/07-routing-contract.sh"; then PASSED+=("07-routing-contract.sh"); else FAILED+=("07-routing-contract.sh"); fi
if bash "$INFRA_DIR/08-nginx-redaction.sh"; then PASSED+=("08-nginx-redaction.sh"); else FAILED+=("08-nginx-redaction.sh"); fi
if bash "$INFRA_DIR/09-coolify-contract.sh"; then PASSED+=("09-coolify-contract.sh"); else FAILED+=("09-coolify-contract.sh"); fi

docker compose -f "$ROOT_DIR/infra/compose.yaml" down --remove-orphans >/dev/null 2>&1 || true
trap - EXIT

# --- summary -------------------------------------------------------------------
echo
echo "====================== INFRA VERIFICATION SUMMARY ======================"
for s in "${PASSED[@]}"; do echo "  PASS  $s"; done
if [[ ${#FAILED[@]} -gt 0 ]]; then
  for s in "${FAILED[@]}"; do echo "  FAIL  $s" >&2; done
  echo "INFRA: ${#PASSED[@]} passed, ${#FAILED[@]} failed" >&2
  exit 1
fi
echo "INFRA: all ${#PASSED[@]} suites passed"
echo "workspace (left for inspection, OS-cleaned): $FEP_INFRA_TMPDIR"
exit 0