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

# Re-cache config with runtime env (real APP_KEY/DB/MAIL). The route cache
# is rebuilt too: Livewire's asset-route prefix is derived from the vendor
# tree, and a build-time cache can carry a prefix that no longer matches the
# URL the rendered page asks for (the Filament panel then 404s its own JS).
# Rebuilding here costs about a second and removes that class of mismatch.
php artisan config:cache
php artisan route:cache

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/app.conf
