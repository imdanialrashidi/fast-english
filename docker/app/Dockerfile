# syntax=docker/dockerfile:1
# Fast English Podcast — Student App (PWA) production image.
#
# Contract:
#   * deterministic multi-stage build (pinned Node + pnpm --frozen-lockfile);
#     NO development server, no dev endpoints, no secrets;
#   * runtime = pinned nginx serving the built SPA with fallback to
#     index.html; correct PWA/service-worker behaviour and cache headers
#     (hashed assets immutable; index.html / sw.js / manifest no-cache);
#   * API contract unchanged: the browser calls the same origin
#     (https://app.fastenglishpodcast.com/api/*); in production the edge
#     proxy (Coolify Traefik) routes /api/* to PocketBase and nginx refuses
#     /api directly (defence in depth); /_/ is never served;
#   * health endpoint (/healthz) for Coolify; immutable release identity via
#     OCI labels + the data-app-version marker Vite embeds in index.html;
#   * non-root: nginx master runs as the unprivileged `nginx` user on 8080.
#
# Build context: repository root. Required build args: GIT_SHA, FEP_VERSION.

FROM node:24.13.0-bookworm-slim AS build

WORKDIR /build

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CI=1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

COPY . .

# Optional npm registry override (e.g. a local mirror for offline builds).
# Unset/empty = official registry (npmjs.org), used by CI and GHCR builds.
ARG NPM_REGISTRY=""
RUN if [ -n "$NPM_REGISTRY" ]; then pnpm config set registry "$NPM_REGISTRY"; fi
# Robust fetch settings so slow/unstable registries do not abort the build.
RUN pnpm install --frozen-lockfile --fetch-retries=5 --fetch-timeout=120000 --network-concurrency=4
RUN pnpm build:app

# ---- runtime ----------------------------------------------------------------
FROM nginx:1.27.5-alpine

ARG GIT_SHA="dev"
ARG FEP_VERSION="0.0.0"

COPY --from=build /build/dist-app/ /usr/share/nginx/html/
COPY docker/app/nginx.conf /etc/nginx/nginx.conf

RUN chown root:root /usr/share/nginx/html \
 && find /usr/share/nginx/html -type d -exec chmod a+rX {} + \
 && find /usr/share/nginx/html -type f -exec chmod a+r {} + \
 && chmod 0644 /etc/nginx/nginx.conf \
 && chown nginx:nginx /var/cache/nginx

USER nginx

EXPOSE 8080

LABEL org.opencontainers.image.source="https://github.com/imdanialrashidi/fast-english"
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.version="${FEP_VERSION}"
LABEL com.fastenglish.image="app"
LABEL com.fastenglish.rootdir="/usr/share/nginx/html"

# Direct entrypoint: the official docker-entrypoint.d templating is not
# needed (our nginx.conf is complete) and would run scripts against /etc/nginx
# as root. nginx master runs as the unprivileged `nginx` user (USER above).
ENTRYPOINT ["nginx", "-g", "daemon off;"]