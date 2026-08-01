#!/usr/bin/env bash
# Fast English Podcast — executable access-log token-redaction test.
#
# Proves that the production access-log query filter removes the `token`
# query parameter before it reaches the log, that a redaction marker is
# present, that Authorization/Cookie stay redacted by Caddy defaults, and
# that ordinary request metadata (method, host, path, status) remains.
#
# Runs Caddy locally on an ephemeral port with a Caddyfile that uses the
# EXACT same log block as deploy/Caddyfile (only the path changes), then
# inspects the written log.
#
# Usage: bash deploy/test-log-redaction.sh
#        CADDY_BIN=/path/to/caddy  (default: `caddy` on PATH)
# Exit: 0 redaction proven; 1 otherwise.
set -Eeuo pipefail

CADDY_BIN="${CADDY_BIN:-$(command -v caddy || true)}"
if [[ -z "$CADDY_BIN" ]]; then
  echo "test-log-redaction: caddy binary not found (set CADDY_BIN)" >&2
  exit 1
fi

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORT="${FEP_LOG_TEST_PORT:-18097}"
WORK="$(mktemp -d /tmp/fep-log-test.XXXXXX)"
LOG="$WORK/access.log"
trap 'kill "${CADDY_PID:-}" 2>/dev/null || true; rm -rf -- "$WORK"' EXIT

# --- build the test Caddyfile from the production one -----------------------
# Extract the landing site's log block verbatim (same directives as the app
# and admin sites) and serve a trivial response so a request can be logged.
TESTFILE="$WORK/caddyfile"
python3 - "$HERE/Caddyfile" "$LOG" "$PORT" "$TESTFILE" <<'PYEOF'
import re, sys
src = open(sys.argv[1]).read()
log_path, port, out = sys.argv[2], sys.argv[3], sys.argv[4]
m = re.search(r'\tlog \{\n(?:.*?\n)*?\t\}', src)
if not m:
    print("no log block found in Caddyfile", file=sys.stderr); sys.exit(1)
block = m.group(0).replace('/opt/fast-english/shared/logs/access-landing.log', log_path)
open(out, "w").write(f":{port} {{\n{block}\n\trespond \"ok\"\n}}\n")
PYEOF

# --- start caddy, fire requests with fake tokens, inspect the log ----------
"$CADDY_BIN" validate --config "$TESTFILE" >/dev/null 2>&1 || { echo "test config invalid" >&2; exit 1; }
"$CADDY_BIN" run --config "$TESTFILE" >"$WORK/caddy.log" 2>&1 &
CADDY_PID=$!
sleep 1.5

FAKE_TOKEN_1="SUPERSECRET_TOKEN_ABC123"
FAKE_TOKEN_2="SECOND_TOKEN_456XYZ"
FAKE_AUTH="Bearer SUPERSECRET_AUTH_XYZ"
FAKE_COOKIE="pb_auth=SUPERSECRET_COOKIE_ABC"

curl -fsS "http://127.0.0.1:$PORT/api/audio?token=$FAKE_TOKEN_1" >/dev/null 2>&1 || true
curl -fsS -H "Authorization: $FAKE_AUTH" -H "Cookie: $FAKE_COOKIE" \
  "http://127.0.0.1:$PORT/api/lessons/x/audio?token=$FAKE_TOKEN_2" >/dev/null 2>&1 || true
sleep 1

LOG_TEXT="$(cat "$LOG" || true)"
fail=0
[[ -n "$LOG_TEXT" ]] || { echo "FAIL: access log is empty" >&2; exit 1; }

echo "$LOG_TEXT" | grep -q "$FAKE_TOKEN_1" && { echo "FAIL: token 1 value found in the access log" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q "$FAKE_TOKEN_2" && { echo "FAIL: token 2 value found in the access log" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q "REDACTED" || { echo "FAIL: no [REDACTED] marker in the access log" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q "$FAKE_AUTH" && { echo "FAIL: Authorization value found in the access log" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q "SUPERSECRET_COOKIE_ABC" && { echo "FAIL: Cookie value found in the access log" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q '/api/audio' || { echo "FAIL: ordinary path metadata missing" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q '"status":200' || { echo "FAIL: status metadata missing" >&2; fail=1; }
echo "$LOG_TEXT" | grep -q '"method":"GET"' || { echo "FAIL: method metadata missing" >&2; fail=1; }

if [[ "$fail" -eq 0 ]]; then
  echo "PASS: token query values absent, [REDACTED] marker present,"
  echo "      Authorization/Cookie redacted, request metadata retained."
  echo "log sample:"
  grep -o '"uri":"[^"]*"' "$LOG" | head -2
else
  echo "FAIL: redaction test failed" >&2
  exit 1
fi
