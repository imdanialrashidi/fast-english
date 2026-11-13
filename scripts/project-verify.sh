#!/usr/bin/env bash
# Project verification gate: Pint + Pest (PostgreSQL) + typecheck + build + affected Playwright spec.
# Canonical entry point; scripts/verify.sh delegates here when executable.
#
# PHP runs on the host when it is installed. On a host without PHP (the
# pinned local setup) the same steps run inside the fe-php image on the
# docker network that carries PostgreSQL, so the gate is one command
# either way. Overrides: FE_PHP_IMAGE, FE_PHP_NETWORK, FE_PHP_INI, BASE_URL.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-http://127.0.0.1:8111}"
PHP_IMAGE="${FE_PHP_IMAGE:-fe-php:8.4.26}"
PHP_NETWORK="${FE_PHP_NETWORK:-s0-net}"
PHP_INI="${FE_PHP_INI:-$ROOT_DIR/scripts/php-test.ini}"

PHP_MODE="host"
if ! command -v php >/dev/null 2>&1; then
  PHP_MODE="docker"
  if ! command -v docker >/dev/null 2>&1; then
    echo "BLOCKED: no host php and no docker" >&2
    exit 3
  fi
  if ! docker image inspect "$PHP_IMAGE" >/dev/null 2>&1; then
    echo "BLOCKED: docker image $PHP_IMAGE is missing (build scripts/dev-php.Dockerfile)" >&2
    exit 3
  fi
  if [[ ! -f "$PHP_INI" ]]; then
    echo "BLOCKED: $PHP_INI is missing" >&2
    exit 3
  fi
fi

php_run() {
  if [[ "$PHP_MODE" == "docker" ]]; then
    # The read-only ini raises memory_limit for the whole container: the
    # stock 128M CLI limit aborts the receipt-upload suite, and `artisan
    # test` starts phpunit as a child that would otherwise keep it.
    docker run --rm --network "$PHP_NETWORK" \
      -v "$ROOT_DIR:/repo" -w /repo --user "$(id -u):$(id -g)" \
      -v "$PHP_INI:/usr/local/etc/php/conf.d/zz-project-verify.ini:ro" \
      "$PHP_IMAGE" php "$@"
  else
    php "$@"
  fi
}

# Fail fast when the database the suite will use is unreachable. The suite
# runs with APP_ENV=testing, so check that connection (not the dev database).
if php_run artisan --env=testing db:show >/dev/null 2>&1; then
  :
elif command -v pg_isready >/dev/null 2>&1 && pg_isready -q; then
  :
else
  echo "BLOCKED: PostgreSQL unreachable (host and $PHP_MODE runner)" >&2
  exit 3
fi

php_run vendor/bin/pint --test
php_run artisan test
npm run typecheck
npm run build

# Browser lane only when the app server answers on BASE_URL.
if curl -fsS -o /dev/null --max-time 5 "$BASE_URL" >/dev/null 2>&1; then
  npx playwright test m0-inertia --project=chromium
else
  echo "SKIP: browser lane (no server on $BASE_URL)"
fi
