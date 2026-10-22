#!/usr/bin/env bash
# Local Chromium browser lane (owner follow-up 2026-10-22).
#
# The lane runs the real app on a localhost secure-context origin against
# the dedicated fe_browser database, with built assets and the TEST sales
# fixtures. It never touches fe_dev, fe_test, or production.
#
#   scripts/browser-lane.sh start    # start/replace the container
#   scripts/browser-lane.sh seed     # plain migrate + S2BrowserSeeder
#   scripts/browser-lane.sh status   # container + HTTP health
#   scripts/browser-lane.sh stop     # remove the container
#   scripts/browser-lane.sh reset    # stop, start, seed
#   scripts/browser-lane.sh test ... # BASE_URL=<lane> npx playwright test ...
#
# Requires Docker, the fe-php image, the s0-net network, and untracked
# .env + .env.browser (DB overrides). Secrets are never printed.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONTAINER="${BROWSER_LANE_CONTAINER:-fe-browser-lane}"
IMAGE="${BROWSER_LANE_IMAGE:-fe-php:8.4.26}"
NETWORK="${BROWSER_LANE_NETWORK:-s0-net}"
PORT="${BROWSER_LANE_PORT:-8112}"
URL="http://127.0.0.1:${PORT}"

require_files() {
    [[ -f .env ]] || { echo "browser-lane: .env is missing" >&2; exit 2; }
    [[ -f .env.browser ]] || { echo "browser-lane: .env.browser is missing" >&2; exit 2; }
}

wait_ready() {
    for _ in $(seq 1 30); do
        if curl -fsS -o /dev/null --max-time 2 "$URL/" 2>/dev/null; then
            echo "browser-lane ready: $URL"
            return 0
        fi
        sleep 1
    done
    echo "browser-lane: app did not answer on $URL" >&2
    docker logs "$CONTAINER" 2>&1 | tail -20 >&2 || true
    exit 1
}

start() {
    require_files
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$CONTAINER" \
        --network "$NETWORK" \
        -p "127.0.0.1:${PORT}:8001" \
        -v "$ROOT:/repo" -w /repo \
        --env-file .env --env-file .env.browser \
        -e APP_ENV=staging -e APP_DEBUG=false \
        -e "APP_URL=$URL" -e SALES_ENABLED=true \
        "$IMAGE" sh -lc 'cd public && php -d max_execution_time=0 -S 0.0.0.0:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php' >/dev/null
    wait_ready
}

seed() {
    docker exec "$CONTAINER" php artisan migrate --force --seed --seeder=S2BrowserSeeder
}

stop() {
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    echo "browser-lane stopped"
}

status() {
    docker ps --filter "name=^/${CONTAINER}$" --format 'container={{.Names}} status={{.Status}} ports={{.Ports}}' || true
    curl -fsS -o /dev/null --max-time 2 "$URL/" && echo "http=$URL ok" || echo "http=$URL down"
}

case "${1:-start}" in
    start) start ;;
    seed) seed ;;
    stop) stop ;;
    status) status ;;
    reset) stop; start; seed ;;
    test)
        shift
        BASE_URL="$URL" npx playwright test "$@"
        ;;
    *)
        echo "usage: $0 {start|seed|status|stop|reset|test [playwright args]}" >&2
        exit 2
        ;;
esac
