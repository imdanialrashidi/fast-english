# syntax=docker/dockerfile:1
# Fast English Podcast — Landing production image.
#
# Contract:
#   * deterministic multi-stage build (pinned Node + pnpm --frozen-lockfile,
#     immutable output); NO Node development server in production;
#   * runtime = pinned nginx serving the static multi-page Landing with the
#     exact cache/redirect/security semantics of the retired Caddyfile;
#   * prerendered/indexable output preserved (pnpm build:landing includes
#     scripts/prerender-landing.mjs); canonical/sitemap/robots/APK contracts
#     unchanged;
#   * no PocketBase SDK/backend code pulled into the runtime bundle beyond
#     the existing public-settings fetch (same-origin /api/... request);
#   * no secrets; immutable version identity via OCI labels + the
#     data-landing-version marker Vite embeds in the served HTML;
#   * non-root: nginx master runs as the `nginx` unprivileged user,
#     listening on 8080 (Coolify health checks target that port).
#
# Build context: repository root. Required build args:
#   GIT_SHA, FEP_VERSION; optional VITE_WEB_APP_URL / VITE_ANDROID_APK_URL /
#   VITE_ANDROID_APK_VERSION (default to the production contract).

FROM node:24.13.0-bookworm-slim AS build

WORKDIR /build

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CI=1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

# Build-time configuration (production contract by default).
ARG VITE_WEB_APP_URL=https://app.fastenglishpodcast.com
ENV VITE_WEB_APP_URL=$VITE_WEB_APP_URL
ARG VITE_ANDROID_APK_URL=
ENV VITE_ANDROID_APK_URL=$VITE_ANDROID_APK_URL
ARG VITE_ANDROID_APK_VERSION=
ENV VITE_ANDROID_APK_VERSION=$VITE_ANDROID_APK_VERSION

COPY . .

# Optional npm registry override (e.g. a local mirror for offline builds).
# Unset/empty = official registry (npmjs.org), used by CI and GHCR builds.
ARG NPM_REGISTRY=""
RUN if [ -n "$NPM_REGISTRY" ]; then pnpm config set registry "$NPM_REGISTRY"; fi
# Robust fetch settings so slow/unstable registries do not abort the build.
RUN pnpm install --frozen-lockfile --fetch-retries=5 --fetch-timeout=120000 --network-concurrency=4
RUN pnpm build:landing

# ---- runtime ----------------------------------------------------------------
FROM nginx:1.27.5-alpine

ARG GIT_SHA="dev"
ARG FEP_VERSION="0.0.0"

COPY --from=build /build/dist-landing/ /usr/share/nginx/html/
COPY docker/landing/nginx.conf /etc/nginx/nginx.conf

# Public APK + release metadata live on the HOST at
# /opt/fast-english/shared/releases and are mounted read-only here (Coolify
# persistent storage). The directory exists in the image so the mount point
# is well-formed; content always comes from the host volume.
RUN mkdir -p /srv/releases

# The runtime user must be able to read the site and the release volume.
RUN chown root:root /usr/share/nginx/html /srv/releases \
 && find /usr/share/nginx/html /srv/releases -type d -exec chmod a+rX {} + \
 && find /usr/share/nginx/html /srv/releases -type f -exec chmod a+r {} + \
 && chmod 0644 /etc/nginx/nginx.conf \
 && chown nginx:nginx /var/cache/nginx

USER nginx

EXPOSE 8080

LABEL org.opencontainers.image.source="https://github.com/imdanialrashidi/fast-english"
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.version="${FEP_VERSION}"
LABEL com.fastenglish.image="landing"
LABEL com.fastenglish.rootdir="/usr/share/nginx/html"

# Direct entrypoint: the official docker-entrypoint.d templating is not
# needed (our nginx.conf is complete) and would run scripts against /etc/nginx
# as root. nginx master runs as the unprivileged `nginx` user (USER above).
ENTRYPOINT ["nginx", "-g", "daemon off;"]