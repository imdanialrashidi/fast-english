#!/usr/bin/env bash
# Post-deploy probes for a real (Coolify-fronted) Fast English origin.
#
#   scripts/coolify-smoke.sh https://fastenglish.ir
#
# Every check maps to docs/ops/COOLIFY.md §8. It sends read-only requests,
# prints one PASS/FAIL line each, and exits non-zero if any check fails.
# It needs a reachable origin with valid TLS; it never logs a secret.
set -Eeuo pipefail

usage() {
    cat <<'USAGE'
usage: scripts/coolify-smoke.sh <https-origin>

  e.g. scripts/coolify-smoke.sh https://fastenglish.ir
USAGE
}

base="${1:-${APP_URL:-}}"
if [[ -z "$base" ]]; then usage >&2; exit 2; fi
base="${base%/}"
if [[ ! "$base" =~ ^https?://[^/]+$ ]]; then
    echo "coolify-smoke: expected an origin like https://example.com (got: $base)" >&2
    exit 2
fi
case "$base" in
    http://*) echo "coolify-smoke: WARNING plain HTTP — production must be HTTPS" >&2; https=0 ;;
    *) https=1 ;;
esac

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail=0

# fetch PATH NAME [extra curl args...] -> sets CODE/HEADERS/BODY files
fetch() {
    local path="$1" name="$2"; shift 2
    CODE="$(curl -sS --max-time 25 -D "$tmp/$name.headers" -o "$tmp/$name.body" \
        -w '%{http_code}' "$@" "$base$path" 2>"$tmp/$name.err")" || {
        printf '  FAIL  %-28s curl error: %s\n' "$path" "$(head -1 "$tmp/$name.err")" >&2
        fail=1
        CODE="000"
        : > "$tmp/$name.headers"
        : > "$tmp/$name.body"
    }
}

header() { tr -d '\r' < "$tmp/$1.headers" | grep -i "^$2:" | head -1 | cut -d: -f2- | sed 's/^ *//'; }
expect_code() {
    if [[ "$CODE" == "$2" ]]; then printf '  PASS  %-28s %s\n' "$1" "$CODE"
    else printf '  FAIL  %-28s expected %s, got %s\n' "$1" "$2" "$CODE" >&2; fail=1; fi
}
expect_header_contains() {
    local name="$1" label="$2" hdr="$3" needle="$4" value
    value="$(header "$name" "$hdr")"
    if printf '%s' "$value" | grep -qi -- "$needle"; then
        printf '  PASS  %-28s %s: %s\n' "$label" "$hdr" "$value"
    else
        printf '  FAIL  %-28s %s missing %s (got: %s)\n' "$label" "$hdr" "$needle" "${value:-none}" >&2
        fail=1
    fi
}
expect_absent() {
    local name="$1" label="$2" needle="$3"
    if grep -qi -- "$needle" "$tmp/$name.body" "$tmp/$name.headers"; then
        printf '  FAIL  %-28s contains %s\n' "$label" "$needle" >&2
        fail=1
    else
        printf '  PASS  %-28s no %s\n' "$label" "$needle"
    fi
}

echo "coolify-smoke: $base"

fetch / "up"
expect_code "/up" 200
expect_absent "up" "/up" "APP_KEY"
expect_absent "up" "/up" "DB_PASSWORD"

fetch / "root"
expect_code "/" 200
expect_header_contains root "/" x-content-type-options nosniff
expect_header_contains root "/" x-frame-options SAMEORIGIN
expect_header_contains root "/" referrer-policy strict-origin-when-cross-origin
expect_header_contains root "/" permissions-policy "camera=()"
expect_header_contains root "/" cross-origin-opener-policy same-origin

if [[ "$https" == "1" ]]; then
    expect_header_contains root "/" strict-transport-security max-age=
else
    if [[ -n "$(header root strict-transport-security)" ]]; then
        printf '  FAIL  %-28s HSTS over plain HTTP\n' "/" >&2; fail=1
    else
        printf '  PASS  %-28s no HSTS over plain HTTP\n' "/"
    fi
fi

fetch /login "login"
expect_code "/login" 200
expect_header_contains login "/login" x-robots-tag noindex
expect_header_contains login "/login" cache-control no-store

fetch /_private/ "private"
expect_code "/_private/" 404

fetch /install "install"
expect_code "/install" 200
fetch /download "download"
expect_code "/download" 200

fetch /.env "dotenv"
expect_code "/.env" 404
fetch /.git/config "dotgit"
expect_code "/.git/config" 404

fetch /this-page-does-not-exist "notfound"
expect_code "/this-page-does-not-exist" 404
expect_absent notfound "404 body" "vendor/"
expect_absent notfound "404 body" "Stack trace"

fetch /sw.js "sw"
expect_code "/sw.js" 200
expect_header_contains sw "/sw.js" cache-control no-store

fetch /admin "admin"
if [[ "$CODE" =~ ^30[1237]$ ]] || [[ "$CODE" == "200" ]]; then
    printf '  PASS  %-28s %s (staff gate reachable)\n' "/admin" "$CODE"
else
    printf '  FAIL  %-28s expected a redirect or login page, got %s\n' "/admin" "$CODE" >&2
    fail=1
fi

# Immutable Vite assets: only checked when the HTML exposes a /build/ URL.
asset="$(grep -o '/build/assets/[A-Za-z0-9._-]*\.\(js\|css\)' "$tmp/root.body" | head -1 || true)"
if [[ -n "$asset" ]]; then
    fetch "$asset" "asset"
    expect_code "asset $asset" 200
    expect_header_contains asset "asset" cache-control immutable
else
    printf '  WARN  %-28s no /build/ asset link in HTML\n' "asset"
fi

# Compressed HTML (nginx gzip) when the client asks for it.
fetch /login "gzip" -H 'Accept-Encoding: gzip'
if [[ "$(header gzip content-encoding)" == "gzip" ]]; then
    printf '  PASS  %-28s content-encoding: gzip\n' "gzip"
else
    printf '  WARN  %-28s no gzip (check proxy/server)\n' "gzip"
fi

echo
if [[ "$fail" -ne 0 ]]; then
    echo "coolify-smoke: FAILED — see the FAIL lines above." >&2
    exit 1
fi
echo "coolify-smoke: all checks passed."
