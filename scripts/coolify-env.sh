#!/usr/bin/env bash
# Generate the secret values a fresh Fast English deployment needs.
#
# It prints an env block meant for the Coolify UI (Environment Variables) or
# a root-owned file outside the repository. It never writes into the repo.
#
#   scripts/coolify-env.sh --domain https://fastenglish.ir
#   scripts/coolify-env.sh --domain https://staging.example.com --out /tmp/fe.env
#
# Values produced:
#   APP_KEY     Laravel encryption key (base64:32 bytes). Generate once,
#               keep forever: rotating it logs everyone out and breaks
#               encrypted columns.
#   DB_PASSWORD PostgreSQL application-role password (hex, no shell quoting).
#   DB_DATABASE / DB_USERNAME  Safe defaults for a fresh stack.
#   APP_URL     The public HTTPS origin; must match the Coolify domain.
set -Eeuo pipefail

usage() {
    cat <<'USAGE'
usage: scripts/coolify-env.sh [--domain https://host] [--out /path/outside/repo]

  --domain URL   public HTTPS origin (default: https://fastenglish.ir)
  --out PATH     write the block to PATH instead of stdout.
                 PATH must be outside the repository.
  -h, --help     show this help.
USAGE
}

domain="https://fastenglish.ir"
out=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) domain="${2:-}"; shift 2 ;;
        --out) out="${2:-}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "coolify-env: unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
done

if [[ ! "$domain" =~ ^https://[^/]+$ ]]; then
    echo "coolify-env: --domain must be an https origin without a path (got: $domain)" >&2
    exit 2
fi

command -v openssl >/dev/null 2>&1 || { echo "coolify-env: openssl is required" >&2; exit 1; }

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -n "$out" ]]; then
    out_dir="$(cd -- "$(dirname -- "$out")" 2>/dev/null && pwd)" || {
        echo "coolify-env: output directory does not exist: $(dirname -- "$out")" >&2
        exit 2
    }
    out_abs="$out_dir/$(basename -- "$out")"
    case "$out_abs" in
        "$repo_root"/*)
            echo "coolify-env: refusing to write secrets inside the repository ($out_abs)" >&2
            echo "coolify-env: use a path outside the worktree, e.g. /tmp/fe.env" >&2
            exit 2
            ;;
    esac
fi

key="base64:$(openssl rand -base64 32 | tr -d '\n')"
db_password="$(openssl rand -hex 24)"

block="# Fast English — generated $(date -u +%Y-%m-%dT%H:%M:%SZ).
# Keep this file private (chmod 600) and out of version control.
# APP_KEY must never be regenerated for an existing deployment.
APP_KEY=$key
APP_URL=$domain
DB_DATABASE=fast_english
DB_USERNAME=fast_english
DB_PASSWORD=$db_password
"

if [[ -n "$out" ]]; then
    umask 077
    printf '%s' "$block" > "$out_abs"
    echo "coolify-env: wrote $out_abs (mode 600). Paste the variables into Coolify, then delete or archive it safely." >&2
else
    printf '%s' "$block"
fi
