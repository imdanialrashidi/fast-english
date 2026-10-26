#!/bin/sh
# S9a entrypoint: prepare runtime caches with REAL env, never migrate.
# Build-time caches (config/route/view/event/Filament/storage link) prove
# caching works with dummy env; here config is re-cached with the real
# Coolify env so runtime secrets take effect. Migrations NEVER run on
# container start; release runs one explicit `php artisan migrate --force`
# after a fresh backup (docs/ops/RUNBOOK.md section 1 step 4).
set -e

# storage/app/private + storage/app/public are persistent Coolify mounts;
# ensure the public symlink exists even when a mount hides build-time state.
# Only create it when it is missing: unconditional `storage:link --force`
# unlinks first, and the image ships public/ owned by root, so a redeploy
# logged "symlink(): File exists" at ERROR level on every boot.
if [ ! -L public/storage ]; then
    php artisan storage:link 2>/dev/null \
        || echo "WARN: public/storage is missing and cannot be created (covers will 404); run it as root once." >&2
fi

# Re-cache config with runtime env (real APP_KEY/DB/MAIL). Route/view/event
# caches from the build do not contain env and are kept as-is.
php artisan config:cache

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/app.conf
