#!/usr/bin/env bash
# ===========================================================================
# LEGACY / RETIRED — first-time server bootstrap for the Caddy + systemd
# architecture.
#
# Status: RETIRED for new production installs. Server provisioning now
# follows docs/COOLIFY_DEPLOYMENT.md (self-hosted Coolify on owned VPS -> four
# Coolify Applications; host initialization is a short checklist, not this
# script). Preserved for historical fallback only.
# ===========================================================================
!/usr/bin/env bash
# Fast English Podcast — first-time production server bootstrap.
#
# Creates the dedicated non-root service account, the /opt/fast-english
# topology, installs the PocketBase binary (exact approved version), the
# secrets env file, the hardened systemd unit, the backup-copy timer, the
# Caddyfile, the superuser (non-interactively, from the secrets file) and
# starts everything. Run deploy.sh afterwards to place the first release.
#
# Usage: bash deploy/install.sh [--dry-run]
# Requires: root on a Debian/Ubuntu/Arch server, curl, python3, unzip.
# The secrets file MUST already exist at
# /opt/fast-english/shared/secrets/pocketbase.env (root:root 0600) — the
# script refuses to run without it and never reads credentials from stdin.
#
# Credential handling: the superuser password is sourced from the secrets
# file and NEVER printed (stdout, logs or --dry-run output — the upsert line
# is echoed redacted). The PocketBase 0.39.9 CLI requires the password as a
# positional argument (verified: no stdin/env alternative), so it is briefly
# present in the process argument list — the same root-only trust domain as
# the 0600 secrets file. It never reaches stdout, journals, or CI captures.
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then echo "[dry-run] $*"; else echo "[run] $*"; "$@"; fi
}

# Execute a command while printing only a redacted label (for invocations
# whose arguments contain credentials). The label is shown in both modes.
run_redacted() {
  local label="$1"; shift
  if [[ "$DRY_RUN" -eq 1 ]]; then echo "[dry-run] $label"; else echo "[run] $label"; "$@"; fi
}

die() { echo "install: $*" >&2; exit 1; }

[[ "$DRY_RUN" -eq 1 || "$(id -u)" -eq 0 ]] || die "must run as root (or use --dry-run)"
[[ -f "$HERE/Caddyfile" ]] || die "deploy/Caddyfile missing"
[[ -f "$HERE/systemd/fast-english-pocketbase.service" ]] || die "systemd unit missing"
[[ -f "$HERE/../server/pocketbase" ]] || die "server/pocketbase binary missing — run scripts/setup-pocketbase.sh first"

# The pinned binary prints "pocketbase version 0.39.9" on stderr; extract the
# x.y.z token from combined output regardless of stream or prefix.
PB_VER="$("$HERE/../server/pocketbase" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
[[ "$PB_VER" == "0.39.9" ]] || die "unexpected PocketBase version: $PB_VER (expected 0.39.9)"
[[ "$(uname -m)" == "x86_64" ]] || die "unsupported architecture: $(uname -m) (binary is linux amd64)"

echo "install: PocketBase $PB_VER, x86_64, Caddyfile + unit validated (run caddy validate + systemd-analyze verify on the server)"

# 1. Secrets file must already be in place (never prompted, never echoed).
[[ -f "$SECRETS" ]] || die "secrets file $SECRETS must exist before install (root:root 0600)"

# 2. Service account (dedicated non-root user, no shell, no home).
run id fastenglish 2>/dev/null || run useradd --system --no-create-home --shell /usr/sbin/nologin fastenglish

# 3. Directory topology with least-privilege ownership.
run mkdir -p "$FEP_ROOT/releases" "$FEP_ROOT/shared/pb_data" "$FEP_ROOT/shared/backups" \
  "$FEP_ROOT/shared/releases" "$FEP_ROOT/shared/logs" "$FEP_ROOT/shared/secrets" \
  "$FEP_ROOT/shared/scripts" "$FEP_ROOT/bin"
run chown -R root:root "$FEP_ROOT"
run chown -R fastenglish:fastenglish "$FEP_ROOT/shared/pb_data" "$FEP_ROOT/shared/backups" "$FEP_ROOT/shared/logs"
run chmod 750 "$FEP_ROOT/shared/pb_data" "$FEP_ROOT/shared/backups" "$FEP_ROOT/shared/logs"
run chmod 700 "$FEP_ROOT/shared/secrets"

# 4. PocketBase binary (root-owned; the service account cannot modify it).
run install -m 0755 -o root -g root "$HERE/../server/pocketbase" "$FEP_ROOT/bin/pocketbase"

# 5. Systemd unit + backup-copy timer + helper.
run install -m 0644 "$HERE/systemd/fast-english-pocketbase.service" /etc/systemd/system/fast-english-pocketbase.service
run install -m 0644 "$HERE/systemd/fast-english-backup-copy.service" /etc/systemd/system/fast-english-backup-copy.service
run install -m 0644 "$HERE/systemd/fast-english-backup-copy.timer" /etc/systemd/system/fast-english-backup-copy.timer
run install -m 0755 -o fastenglish -g fastenglish "$HERE/backup-copy.sh" "$FEP_ROOT/shared/scripts/fep-backup-copy.sh"

# 6. Caddyfile (back up any existing config before overwriting).
if [[ -f /etc/caddy/Caddyfile ]]; then
  run cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date -u +%Y%m%dT%H%M%SZ)"
fi
run install -m 0644 "$HERE/Caddyfile" /etc/caddy/Caddyfile

# 7. Create the superuser non-interactively (values come from the secrets
#    file, never from the shell history or stdout). The echoed command line
#    is redacted so the password never appears in output — including
#    --dry-run mode. When PB_ENCRYPTION_KEY is set, the upsert must pass
#    --encryptionEnv too: against an encrypted settings DB the CLI fails
#    with "invalid settings db data or missing encryption key" otherwise
#    (verified against 0.39.9).
set -a; # shellcheck disable=SC1090
source "$SECRETS"; set +a
: "${FEP_SUPERUSER_EMAIL:?FEP_SUPERUSER_EMAIL is required}"
: "${FEP_SUPERUSER_PASSWORD:?FEP_SUPERUSER_PASSWORD is required}"
ENCRYPTION_ARGS=()
if [[ -n "${PB_ENCRYPTION_KEY:-}" ]]; then ENCRYPTION_ARGS=(--encryptionEnv=PB_ENCRYPTION_KEY); fi
run_redacted "$FEP_ROOT/bin/pocketbase superuser upsert $FEP_SUPERUSER_EMAIL [REDACTED] (dir/migrationsDir/hooksDir${PB_ENCRYPTION_KEY:+ /encryptionEnv} flags)" \
  "$FEP_ROOT/bin/pocketbase" superuser upsert "$FEP_SUPERUSER_EMAIL" "$FEP_SUPERUSER_PASSWORD" \
  --dir="$FEP_ROOT/shared/pb_data" --migrationsDir="$HERE/../server/pb_migrations" \
  --hooksDir="$HERE/../server/pb_hooks" "${ENCRYPTION_ARGS[@]}"

# 8. Start PocketBase under systemd (migrations run on startup).
run systemctl daemon-reload
run systemctl enable --now fast-english-pocketbase
run systemctl enable --now fast-english-backup-copy.timer
run systemctl is-active fast-english-pocketbase

echo ""
echo "install: next steps (see docs/DEPLOYMENT.md):"
echo "  1. bash deploy/configure.sh        # production settings (backups cron, trustedProxy, ...)"
echo "  2. bash deploy/backup.sh           # initial verified backup before the first release"
echo "  3. bash deploy/deploy.sh <bundle>  # place the first release atomically"
echo "  4. systemctl enable --now caddy    # after installing the caddy package"
echo "  5. bash deploy/smoke-prod.sh       # public HTTPS smoke tests"