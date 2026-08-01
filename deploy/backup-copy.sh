#!/usr/bin/env bash
# Fast English Podcast — copy automatic PocketBase backups off the live
# pb_data directory and enforce retention (keep newest 14, per the approved
# backup policy: daily 02:30 UTC, keep 14).
#
# Runs as the fastenglish system user via the
# fast-english-backup-copy.timer (02:40 UTC). Also used by backup.sh after
# an on-demand backup.
#
# Never touches credentials: it only copies files that PocketBase already
# wrote into pb_data/backups.
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SRC_DIR="$FEP_ROOT/shared/pb_data/backups"
DST_DIR="$FEP_ROOT/shared/backups"
KEEP="${FEP_BACKUP_KEEP:-14}"

[[ -d "$SRC_DIR" ]] || { echo "backup-copy: source $SRC_DIR missing" >&2; exit 1; }
mkdir -p "$DST_DIR"

copied=0
for zip in "$SRC_DIR"/*.zip; do
  [[ -e "$zip" ]] || continue
  name="$(basename "$zip")"
  if [[ ! -f "$DST_DIR/$name" ]] || ! cmp -s "$zip" "$DST_DIR/$name"; then
    cp -p "$zip" "$DST_DIR/$name"
    copied=$((copied + 1))
    echo "backup-copy: copied $name ($(stat -c%s "$DST_DIR/$name") bytes)"
  fi
done

# Retention: keep the KEEP newest files, drop older ones (policy-backed).
mapfile -t old < <(ls -1t "$DST_DIR"/*.zip 2>/dev/null | tail -n +$((KEEP + 1)))
if [[ "${#old[@]}" -gt 0 ]]; then
  for f in "${old[@]}"; do
    rm -f -- "$f"
    echo "backup-copy: pruned $f (retention ${KEEP})"
  done
fi

echo "backup-copy: done (copied=$copied, kept=$(( $(ls -1 "$DST_DIR"/*.zip 2>/dev/null | wc -l) )))"
