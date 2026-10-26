#!/bin/sh
# One explicit release step for the production image.
#
# The container entrypoint never migrates (docs/ops/RUNBOOK.md section 1):
# a release runs this once, after a fresh backup and after the new image is
# deployed, before traffic is switched over.
#
#   Coolify → Application → "Pre-deployment command":
#       sh /var/www/html/docker/release.sh
#   Manual inside the running container:
#       docker exec -it <container> sh /var/www/html/docker/release.sh
#   Dry run (shows pending migrations + ops status, changes nothing):
#       sh /var/www/html/docker/release.sh --check
#
# It refuses to run outside APP_ENV=production so a dev shell cannot migrate
# a production database by accident, and it refuses when APP_DEBUG is on.
set -eu

cd /var/www/html

check_only=false
for arg in "$@"; do
    case "$arg" in
        --check) check_only=true ;;
        *)
            echo "usage: $0 [--check]" >&2
            exit 2
            ;;
    esac
done

current_env="$(php -r 'echo (string) getenv("APP_ENV");')"
if [ -z "$current_env" ]; then
    current_env="$(php artisan env 2>/dev/null | sed -n 's/.*\[\(.*\)\].*/\1/p' | tail -1)"
fi
if [ "$current_env" != "production" ]; then
    echo "release: refusing to migrate: APP_ENV=${current_env:-unset} (expected production)" >&2
    exit 1
fi

if [ "$(php -r 'echo (int) filter_var(getenv("APP_DEBUG"), FILTER_VALIDATE_BOOLEAN);')" = "1" ]; then
    echo "release: refusing to migrate with APP_DEBUG=true" >&2
    exit 1
fi

echo "== release: environment=$current_env =="
# A brand-new database has no migrations table yet: migrate:status exits 1
# ("Migration table not found") and must not abort the first release. The
# real `migrate --force` below still fails loudly, because set -e applies.
php artisan migrate:status --no-ansi || echo "release: no migrations table yet (first release)"

if [ "$check_only" = true ]; then
    echo "== release: --check only, nothing migrated =="
    php artisan ops:status
    exit 0
fi

echo "== release: migrating =="
php artisan migrate --force --no-interaction

echo "== release: health =="
php artisan ops:status
echo "== release: done =="
