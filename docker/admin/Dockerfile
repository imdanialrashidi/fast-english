# syntax=docker/dockerfile:1
# Fast English Podcast — Admin Console production image.
#
# Contract:
#   * deterministic multi-stage static build; NO dev server, no secrets;
#   * runtime = pinned nginx serving the separate Staff Admin SPA with
#     fallback to index.html; /operator and all Admin routes behave per the
#     accepted contract (root / -> 308 -> /operator handled by nginx);
#   * Admin never ships the Student PWA artifacts (no sw.js / manifest);
#   * /api/* routed by the edge proxy (Coolify Traefik) to PocketBase;
#     nginx refuses /api and /_/ directly (defence in depth);
#   * health endpoint; immutable version identity (OCI labels +
#     data-admin-version marker in index.html);
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
RUN pnpm build:admin

# ---- runtime ----------------------------------------------------------------
FROM nginx:1.27.5-alpine

ARG GIT_SHA="dev"
ARG FEP_VERSION="0.0.0"

COPY --from=build /build/dist-admin/ /usr/share/nginx/html/
COPY docker/admin/nginx.conf /etc/nginx/nginx.conf

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
LABEL com.fastenglish.image="admin"
LABEL com.fastenglish.rootdir="/usr/share/nginx/html"

# Direct entrypoint: the official docker-entrypoint.d templating is not
# needed (our nginx.conf is complete) and would run scripts against /etc/nginx
# as root. nginx master runs as the unprivileged `nginx` user (USER above).
ENTRYPOINT ["nginx", "-g", "daemon off;"]