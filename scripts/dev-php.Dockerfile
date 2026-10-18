# Local development/test runner: stock PHP 8.4 CLI plus the pgsql driver,
# the GD/EXIF extensions the S3 cover pipeline needs (cover re-encode
# strips metadata; the stored-cover test reads EXIF markers), intl
# (Filament tables format numbers through Number::format), and zip
# (panel backup archives are ZIPs; production already ships ext-zip).
# Build once: docker build -f scripts/dev-php.Dockerfile -t fe-php:8.4.26 .
# Run tests:  docker run --rm -v "$PWD:/repo" -w /repo --network s0-net fe-php:8.4.26 vendor/bin/pest
# (The image is a local build artifact; the pinned runtime is PHP 8.4.26,
# recorded in composer.json config.platform.php and the active exec plan.
# Production PHP needs ext-gd (+ ext-exif for audits) and ext-intl for the
# same panel + pipeline behavior.)
FROM php:8.4-cli-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libpq5 libjpeg-dev libjpeg62-turbo libpng-dev libpng16-16 libwebp-dev libwebp7 libicu-dev libzip-dev git unzip \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_pgsql gd exif intl zip \
    && apt-mark manual libpq5 libjpeg62-turbo libpng16-16 libwebp7 libzip4 \
    && apt-get purge -y libpq-dev libjpeg-dev libpng-dev libwebp-dev libicu-dev libzip-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
