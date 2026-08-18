#!/bin/sh
# Fast English Podcast — PocketBase container entrypoint (runtime UID 10001).
#
# Safety contract (do not weaken):
#   * refuses to run as root — host permission problems are NEVER solved by
#     running PocketBase as root;
#   * requires the data directory to exist and be read/write/executable by
#     the runtime UID. Production MUST bind-mount the host directory
#     /opt/fast-english/shared/pb_data onto /pb/pb_data. Because the image
#     intentionally does NOT create /pb/pb_data, a container started without
#     the storage mount refuses to start instead of silently running with a
#     container-local database (which would be lost on redeploy).
#   * performs an actual write probe so filesystem-level permission failures
#     surface as a clear message with the exact remediation command;
#   * sets umask 0077 so uploaded files are not world-readable;
#   * execs PocketBase so signals (SIGTERM = graceful shutdown, SQLite WAL
#     checkpoint) reach the process directly.
set -eu

if [ "$(id -u)" = "0" ]; then
  echo "FATAL: the Fast English PocketBase image refuses to run as root." >&2
  echo "       Do NOT fix host permission errors by running the container as root." >&2
  exit 1
fi

DATA_DIR="${PB_DATA_DIR:-/pb/pb_data}"

if [ ! -d "$DATA_DIR" ]; then
  echo "FATAL: data directory '$DATA_DIR' does not exist." >&2
  echo "       Production REQUIRES the host bind mount (host:/opt/fast-english/shared/pb_data)." >&2
  echo "       A container without the storage mount would store data in a container-local" >&2
  echo "       directory and LOSE it on every redeploy — refusing instead." >&2
  exit 1
fi

if [ ! -r "$DATA_DIR" ] || [ ! -w "$DATA_DIR" ] || [ ! -x "$DATA_DIR" ]; then
  echo "FATAL: data directory '$DATA_DIR' is not readable/writable/executable by uid $(id -u)." >&2
  echo "       On the host, run:" >&2
  echo "         mkdir -p /opt/fast-english/shared/pb_data" >&2
  echo "         chown -R 10001:10001 /opt/fast-english/shared/pb_data" >&2
  echo "       then restart the PocketBase container." >&2
  exit 1
fi

# Some mounts report writable permissions yet fail on write (e.g. wrong
# group ownership with restrictive ACLs). Probe the actual write path.
PROBE="$DATA_DIR/.fep-write-probe-$$"
if ! touch "$PROBE" 2>/dev/null; then
  echo "FATAL: cannot write to data directory '$DATA_DIR' (uid $(id -u))." >&2
  echo "       Fix host ownership, e.g.: chown -R 10001:10001 /opt/fast-english/shared/pb_data" >&2
  exit 1
fi
rm -f "$PROBE"

umask 077
# Settings encryption is REQUIRED for production: without PB_ENCRYPTION_KEY
# PocketBase stores app settings (incl. SMTP/S3 credentials) in plaintext
# in pb_data — and therefore inside every backup ZIP. Fail closed.
if [ -z "${PB_ENCRYPTION_KEY:-}" ]; then
  echo "FATAL: PB_ENCRYPTION_KEY is required (settings encryption)." >&2
  echo "       Set it in the Coolify app env AND in the host secrets file" >&2
  echo "       (/opt/fast-english/shared/secrets/pocketbase.env); both must match." >&2
  exit 1
fi
# The image CMD is the full CLI argument list INCLUDING the `serve`
# subcommand (e.g. `serve --http=... --dir=...`), so exec the args as-is.
exec /pb/pocketbase "$@"