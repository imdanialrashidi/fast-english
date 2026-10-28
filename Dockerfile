# S9a production image for Coolify (private repo). Owner performs the deploy.
# Local proof only: no push/tag/deploy here. Pi workflow retired 2026-10-14
# (Dockerfile.pi removed; recoverable in .artifacts/migration-backup-2026-10-14/).
#
# Stages:
#  1. vendor: Composer installs --no-dev --optimize-autoloader on PHP 8.4.26.
#  2. assets: Node 22.23.2 builds Vite assets. It needs `vendor/` and
#     `app/`: the Filament admin theme is a Vite input that @imports the
#     framework's shipped CSS, and its Tailwind @source globs scan
#     `app/Filament`. Without both the production build fails (or silently
#     ships an admin theme missing app classes).
#  3. runtime: PHP 8.4.26 + pdo_pgsql/gd/exif/intl/opcache + nginx +
#     supervisord (nginx, php-fpm, schedule:work, queue:work).
# Migrations NEVER run on container start; release runs one explicit
# `php artisan migrate --force` after a backup (RUNBOOK section 1).

# --- 1. PHP vendor (pinned PHP CLI + Composer) ---
FROM php:8.4.26-cli-bookworm AS vendor
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libpq-dev libicu-dev libpng-dev libjpeg-dev libwebp-dev libzip-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_pgsql gd exif intl opcache zip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress --no-scripts

# --- 2. Vite assets (pinned Node) ---
FROM node:22.23.2 AS assets
WORKDIR /app
# Optional npm registry mirror for build hosts that cannot reach
# registry.npmjs.org (the Iranian production server cannot; npmmirror can).
# Empty means the npm default. Passed by compose.prod.yml as NPM_REGISTRY.
ARG NPM_REGISTRY=
COPY package.json package-lock.json vite.config.js ./
COPY resources ./resources
# Tailwind @source roots inside the Filament admin theme.
COPY app ./app
COPY public ./public
# The Filament theme.css is a Vite input and @imports this shipped CSS.
# vendor/ is excluded from the build context, so take the already-installed
# tree from the vendor stage (stage order matters: vendor is built first).
COPY --from=vendor /app/vendor ./vendor
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi \
    && npm ci --ignore-scripts \
    && npm run build

# --- 3. Runtime (pinned PHP-FPM) ---
FROM php:8.4.26-fpm-bookworm
ENV DEBIAN_FRONTEND=noninteractive

# System deps: nginx, supervisor, curl (healthcheck), pg client 17 for
# `pg_dump` drills, plus build libs for the PHP extensions (zip is required
# by openspout/Filament; the four mandated ones are pdo_pgsql/gd/exif/intl
# plus opcache).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gnupg lsb-release curl ca-certificates \
    && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nginx supervisor curl unzip git \
        postgresql-client-17 \
        libpq-dev libicu-dev libpng-dev libjpeg-dev libwebp-dev libzip-dev \
        libpq5 libjpeg62-turbo libpng16-16 libwebp7 libzip4 \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_pgsql gd exif intl opcache zip \
    && apt-mark manual libpq5 libjpeg62-turbo libpng16-16 libwebp7 libzip4 \
    && apt-get purge -y libpq-dev libicu-dev libpng-dev libjpeg-dev libwebp-dev libzip-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# App source (vendor/node_modules/tests excluded via .dockerignore).
COPY . ./
# Vendor + built assets from the two builder stages.
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

# Runtime configs.
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/app.conf
COPY docker/php-fpm-www.conf /usr/local/etc/php-fpm.d/zz-s9a.conf
COPY docker/php-production.ini /usr/local/etc/php/conf.d/zz-s9a-production.ini
COPY docker/entrypoint.sh /usr/local/bin/s9a-entrypoint.sh
RUN chmod +x /usr/local/bin/s9a-entrypoint.sh \
    && mkdir -p storage/app/private storage/app/public storage/logs bootstrap/cache \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
    && mkdir -p /var/log/nginx /var/log/supervisor /tmp/nginx-body /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi \
    && chown -R www-data:www-data storage bootstrap/cache public/build /tmp/nginx-body /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi \
    && chown -R www-data:www-data /var/log/nginx \
    && chmod -R a+rX app bootstrap config database lang public resources routes \
    && chmod -R 775 storage bootstrap/cache

# Production defaults (Coolify overrides with real values at runtime).
# Logs go to stderr; never file. APP_URL/DB/SMTP/APP_KEY come from Coolify.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    LOG_STACK=stderr \
    SESSION_SECURE_COOKIE=true \
    FILESYSTEM_DISK=local \
    QUEUE_CONNECTION=database \
    CACHE_STORE=database \
    SESSION_DRIVER=database

# Build-time caches with DUMMY env so no real secret lands in the image.
# Runtime entrypoint re-caches config with the REAL env (see entrypoint).
ENV APP_KEY="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" \
    DB_CONNECTION=pgsql \
    DB_HOST=127.0.0.1 \
    DB_PORT=5432 \
    DB_DATABASE=dummy \
    DB_USERNAME=dummy \
    DB_PASSWORD=dummy
RUN php artisan storage:link --force || true \
    && php artisan package:discover \
    && php artisan config:cache \
    && php artisan route:cache \
    && php artisan view:cache \
    && php artisan event:cache \
    && php artisan filament:optimize \
    && echo "--- build-time cache proof ---" \
    && test ! -f .env && echo "no .env in image" \
    && test -f bootstrap/cache/config.php && echo "config cache present" \
    && test -f bootstrap/cache/routes-v7.php && echo "route cache present" \
    && (! grep -R "fe-secret" bootstrap/cache/ || echo "config cache clean of fe-secret marker") \
    && ls -lh bootstrap/cache/ public/build/manifest.json

# Non-root runtime. Port 8080 (not 80) so www-data can bind.
USER www-data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/up || exit 1

ENTRYPOINT ["/usr/local/bin/s9a-entrypoint.sh"]
