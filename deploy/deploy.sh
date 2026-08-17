#!/usr/bin/env bash
# ===========================================================================
# LEGACY FALLBACK — Caddy + systemd + release-symlink deployment script.
#
# Status: LEGACY FALLBACK. The accepted production release path is the
# Coolify-era pipeline (GitHub -> GHCR -> Coolify -> Traefik -> containers),
# orchestrated by .github/workflows/release-deploy.yml with the immutable
# images in docker/*. This script is preserved for historical fallback and
# is NOT part of new production installs (see docs/COOLIFY_DEPLOYMENT.md).
# ===========================================================================
!/usr/bin/env bash
# Fast English Podcast — repeatable atomic release deployment.
#
# Runs on the production server as root. Verifies the release bundle,
# snapshots a pre-deployment backup, installs the bundle into an immutable
# release directory, flips the `current` symlink atomically, restarts
# PocketBase (normal migration startup), reloads Caddy, runs the production
# smoke tests, and rolls back automatically when a mandatory check fails.
#
# Database migrations are NOT automatically reversible: a migration that has
# already been applied stays applied after a rollback. Rollback restores the
# previous static release and service configuration only. See
# docs/BACKUP_RESTORE.md for the migration rollback limitation.
#
# Rollback coverage: any failure AFTER the `current` symlink switch (PocketBase
# restart, health, Caddy reload, mandatory smoke) triggers an automatic
# rollback to the previous release via an EXIT trap. Failures BEFORE the
# switch (bundle verification, disk, backup) abort without touching anything.
#
# Public release artifacts (APK + release-metadata.json + RELEASE-NOTES.md)
# are published to shared/releases (served at /releases/* by the Caddyfile)
# before the smoke tests so the smoke suite verifies the real public URLs.
#
# Usage:
#   bash deploy/deploy.sh <bundle-dir> [--skip-backup] [--skip-smoke] [--dry-run]
#   bundle-dir   directory containing landing/ app/ server/ android/ (+RELEASE.json)
#   --dry-run    print every step without changing anything
#
# Exit codes: 0 deployed; 1 verification/build failure; 2 deploy failed and
# rolled back; 3 rollback also failed (manual intervention required).
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
RELEASES_DIR="$FEP_ROOT/releases"
CURRENT="$FEP_ROOT/current"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
PB_SERVICE=fast-english-pocketbase.service
SMOKE="$(dirname -- "${BASH_SOURCE[0]}")/smoke-prod.sh"

DRY_RUN=0
DO_BACKUP=1
DO_SMOKE=1

args=()
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    --skip-backup) DO_BACKUP=0 ;;
    --skip-smoke) DO_SMOKE=0 ;;
    --*) echo "unknown option: $a" >&2; exit 64 ;;
    *) args+=("$a") ;;
  esac
done
[[ "${#args[@]}" -eq 1 ]] || { echo "usage: deploy.sh <bundle-dir> [--skip-backup] [--skip-smoke] [--dry-run]" >&2; exit 64; }
BUNDLE="${args[0]}"

run() { # run [--dry] cmd...
  local d=0
  if [[ "$1" == "--dry" ]]; then d=1; shift; fi
  if [[ "$DRY_RUN" -eq 1 || "$d" -eq 1 ]]; then
    echo "[dry-run] $*"
    return 0
  fi
  echo "[run] $*"
  "$@"
}

die() { echo "deploy: $*" >&2; exit 1; }

# Rollback state: SWITCHED=1 once `current` points at the new release;
# ROLLED_BACK prevents double rollback; DEPLOY_OK=1 at the very end.
SWITCHED=0; ROLLED_BACK=0; DEPLOY_OK=0
# In-flight publish temp files (removed on any exit).
PUB_TMPS=()

# Automatic rollback on any post-switch failure (installed as an EXIT trap so
# `die` / set -e exits after the switch also roll back). Migrations already
# applied are NOT reverted (documented limitation in docs/BACKUP_RESTORE.md).
rollback() {
  [[ "$SWITCHED" -eq 1 && "$ROLLED_BACK" -eq 0 && "$DEPLOY_OK" -eq 0 ]] || return 0
  ROLLED_BACK=1
  echo "deploy: ROLLBACK — restoring previous release: ${OLD_TARGET:-<none>}" >&2
  if [[ -z "$OLD_TARGET" ]]; then
    echo "deploy: no previous release to roll back to — manual intervention required" >&2
    exit 3
  fi
  if ln -sfn "$OLD_TARGET" "$CURRENT.tmp" && mv -Tf "$CURRENT.tmp" "$CURRENT"; then
    echo "deploy: rollback — symlink restored to $OLD_TARGET" >&2
  else
    echo "deploy: ROLLBACK FAILED (symlink) — manual intervention required" >&2
    exit 3
  fi
  if ! systemctl restart "$PB_SERVICE"; then
    echo "deploy: ROLLBACK FAILED (restart) — manual intervention required" >&2
    exit 3
  fi
  ok=0
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then ok=1; break; fi
    sleep 1
  done
  if [[ "$ok" -eq 1 ]]; then
    systemctl reload caddy || systemctl restart caddy || true
    echo "deploy: rolled back to $OLD_TARGET" >&2
    exit 2
  fi
  echo "deploy: ROLLBACK FAILED (health) — manual intervention required" >&2
  exit 3
}
# Combined EXIT handler: drop in-flight publish temp files, then roll back
# the release when the symlink switch already happened.
trap 'if [[ ${#PUB_TMPS[@]} -gt 0 ]]; then rm -f -- "${PUB_TMPS[@]}" 2>/dev/null || true; fi; rollback' EXIT

[[ "$DRY_RUN" -eq 1 || "$(id -u)" -eq 0 ]] || die "must run as root (or use --dry-run)"
[[ -d "$BUNDLE" ]] || die "bundle directory not found: $BUNDLE"

# ---------------------------------------------------------------------------
# 1. Verify source and artifacts
# ---------------------------------------------------------------------------
echo "=== deploy: verifying bundle $BUNDLE ==="
for d in landing app admin server/pb_migrations server/pb_hooks android; do
  [[ -d "$BUNDLE/$d" ]] || die "bundle missing $d/"
done
[[ -f "$BUNDLE/app/index.html" && -f "$BUNDLE/landing/index.html" && -f "$BUNDLE/admin/index.html" ]] || die "bundle missing index.html surfaces"
[[ -f "$BUNDLE/server/VERSION" ]] || die "bundle missing server/VERSION"
[[ -f "$BUNDLE/android/release-metadata.json" ]] || die "bundle missing android/release-metadata.json"
[[ -f "$BUNDLE/android/RELEASE-NOTES.md" ]] || die "bundle missing android/RELEASE-NOTES.md"
APK="$(python3 -c 'import json;print(json.load(open("'"$BUNDLE"'/android/release-metadata.json"))["fileName"])')"
[[ -f "$BUNDLE/android/$APK" ]] || die "bundle APK $APK missing"

# APK checksum vs metadata (never ship an unverified APK).
META_SHA="$(python3 -c 'import json;print(json.load(open("'"$BUNDLE"'/android/release-metadata.json"))["sha256"])')"
ACTUAL_SHA="$(sha256sum "$BUNDLE/android/$APK" | cut -d' ' -f1)"
[[ "$META_SHA" == "$ACTUAL_SHA" ]] || die "APK sha256 mismatch: metadata=$META_SHA actual=$ACTUAL_SHA"
echo "deploy: APK $APK sha256 OK ($ACTUAL_SHA)"

# No forbidden strings in the static surfaces (defense in depth).
if grep -rIlE "10\.0\.2\.2|192\.168\.|:5173|:4173|:5175|:4175" "$BUNDLE/app" "$BUNDLE/landing" "$BUNDLE/admin" 2>/dev/null | grep -qvE '\.(png|svg|woff2|ico)$'; then
  die "bundle contains development addresses (see files above)"
fi

# The Admin Console must not ship the Student PWA artifacts (no Service
# Worker, no Student manifest). The Student bundle must not contain the
# Admin login surface marker.
if [[ -f "$BUNDLE/admin/sw.js" || -f "$BUNDLE/admin/manifest.webmanifest" ]]; then
  die "admin bundle must not contain a Service Worker or manifest"
fi
grep -q 'admin-surface' "$BUNDLE/admin/index.html" || die "admin-surface marker missing in admin/index.html"

# ---------------------------------------------------------------------------
# 2. Create the immutable release directory
# ---------------------------------------------------------------------------
RELEASE_ID="$(basename "$BUNDLE")"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
if [[ -e "$RELEASE_DIR" ]]; then die "release $RELEASE_ID already exists (immutable): $RELEASE_DIR"; fi
if [[ -L "$CURRENT" ]]; then OLD_TARGET="$(readlink "$CURRENT")"; else OLD_TARGET=""; fi
echo "deploy: release-id=$RELEASE_ID previous-current=$OLD_TARGET"

# ---------------------------------------------------------------------------
# 3. Disk space
# ---------------------------------------------------------------------------
NEEDED_KB="$(du -sk "$BUNDLE" | cut -f1)"
AVAIL_KB="$(df -kP "$FEP_ROOT" | awk 'NR==2{print $4}')"
if [[ "$DRY_RUN" -eq 0 ]] && (( AVAIL_KB < NEEDED_KB * 2 )); then
  die "insufficient disk space: need ~$((NEEDED_KB*2))KB, avail ${AVAIL_KB}KB"
fi
echo "deploy: disk ok (need ~$((NEEDED_KB * 2))KB, avail ${AVAIL_KB}KB)"

# ---------------------------------------------------------------------------
# 4. Pre-deployment backup (before any change; migrations may alter data)
# ---------------------------------------------------------------------------
if [[ "$DO_BACKUP" -eq 1 ]]; then
  if [[ -r "$SECRETS" ]]; then
    run bash "$(dirname -- "${BASH_SOURCE[0]}")/backup.sh" "fep-backup-predeploy-$(date -u +%Y%m%d%H%M%S).zip"
  else
    echo "deploy: WARNING — secrets file missing; pre-deployment backup skipped"
  fi
else
  echo "deploy: pre-deployment backup skipped (--skip-backup)"
fi

# ---------------------------------------------------------------------------
# 5. Install the release (immutable copy)
# ---------------------------------------------------------------------------
run mkdir -p "$RELEASES_DIR"
run cp -a "$BUNDLE" "$RELEASE_DIR"
run chmod -R a-w "$RELEASE_DIR"            # immutable once installed
run chown -R root:root "$RELEASE_DIR"
echo "deploy: release installed at $RELEASE_DIR"

# ---------------------------------------------------------------------------
# 6. Atomic symlink switch
# ---------------------------------------------------------------------------
run ln -sfn "$RELEASE_ID" "$CURRENT.tmp"
run mv -Tf "$CURRENT.tmp" "$CURRENT"       # atomic rename
if [[ "$DRY_RUN" -eq 0 ]]; then
  SWITCHED=1
  # Record the previous target for the documented manual rollback
  # (docs/DEPLOYMENT.md §6).
  printf '%s\n' "$OLD_TARGET" > "$FEP_ROOT/.current.previous"
fi
echo "deploy: current -> $RELEASE_ID"

# ---------------------------------------------------------------------------
# 7. Restart PocketBase (loads the release's hooks + migrations)
# ---------------------------------------------------------------------------
if [[ "$DRY_RUN" -eq 1 ]]; then
  run systemctl restart "$PB_SERVICE"
  run systemctl is-active "$PB_SERVICE"
else
  systemctl restart "$PB_SERVICE" || die "PocketBase restart failed"
  systemctl is-active --quiet "$PB_SERVICE" || die "PocketBase not active after restart"
  # Wait for health + migrations (poll up to 90s).
  ok=0
  for _ in $(seq 1 90); do
    if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then ok=1; break; fi
    sleep 1
  done
  [[ "$ok" -eq 1 ]] || { journalctl -u "$PB_SERVICE" -n 30 --no-pager >&2; die "PocketBase health check failed"; }
  echo "deploy: PocketBase healthy (migrations applied on startup)"
fi

# ---------------------------------------------------------------------------
# 8. Reload Caddy (serves the new release via the symlink)
# ---------------------------------------------------------------------------
run systemctl reload caddy || run systemctl restart caddy

# ---------------------------------------------------------------------------
# 8b. Publish public release artifacts (APK + metadata + notes)
# ---------------------------------------------------------------------------
# Caddy serves /releases/* from shared/releases (deploy/Caddyfile); the
# landing's download CTA (VITE_ANDROID_APK_URL) points at exactly these
# files. Each file is moved into place atomically. A deploy that fails after
# publishing leaves the newer verified APK on the server — harmless, because
# the rolled-back release's landing CTA points at the older APK, which is
# never deleted.
PUB_DIR="$FEP_ROOT/shared/releases"
run mkdir -p "$PUB_DIR"
for f in "$APK" release-metadata.json RELEASE-NOTES.md; do
  PUB_TMPS+=("$PUB_DIR/.$f.tmp.$$")
  run cp -a "$BUNDLE/android/$f" "$PUB_DIR/.$f.tmp.$$"
  run mv -Tf "$PUB_DIR/.$f.tmp.$$" "$PUB_DIR/$f"
  run chmod 0644 "$PUB_DIR/$f"
  run chown root:root "$PUB_DIR/$f"
done
echo "deploy: published APK + metadata + notes to $PUB_DIR"

# ---------------------------------------------------------------------------
# 9. Production smoke tests (mandatory)
# ---------------------------------------------------------------------------
if [[ "$DO_SMOKE" -eq 1 ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    run bash "$SMOKE" --quick
  else
    echo "deploy: running production smoke tests"
    if ! bash "$SMOKE" --quick; then
      echo "deploy: MANDATORY SMOKE FAILURE — rolling back" >&2
      rollback # exits 2 (rolled back) or 3 (rollback failed)
      exit 2   # unreachable safety net
    fi
  fi
else
  echo "deploy: smoke tests skipped (--skip-smoke)"
fi

DEPLOY_OK=1
echo "deploy: OK — release $RELEASE_ID is live. Previous release $OLD_TARGET preserved."