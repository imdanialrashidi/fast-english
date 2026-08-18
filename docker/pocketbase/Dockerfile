# syntax=docker/dockerfile:1
# Fast English Podcast — PocketBase production image.
#
# Determinism contract:
#   * exact PocketBase version pinned (never `latest`); the single source of
#     truth is server/VERSION and server/pocketbase.sha256. Every build must
#     pass --build-arg FEP_PB_VERSION=$(cat server/VERSION); the build
#     verifies it matches the committed file and the official sha256.
#   * images are tagged immutably (sha-<commit>) plus an explicitly managed
#     `production` alias — `latest` is never the authoritative identity.
#   * pb_migrations, pb_hooks and VERSION are baked into the image from the
#     exact repository commit; there is NO mutable hooks/migrations bind
#     mount in production and hooksWatch is off.
#   * non-root runtime UID/GID 10001/10001 (fixed; never change without
#     updating the host `chown` contract and the runbook).
#   * pb_data is NEVER in the image filesystem (see entrypoint.sh — a
#     container without the /pb/pb_data storage mount refuses to start).
#   * no production secrets, no development database, no fixture/demo data,
#     no superuser credentials are baked into the image.
#
# Build context: repository root (see .dockerignore).

# ---- download stage (official release pinned by version + sha256) --------
FROM alpine:3.21.4 AS download

ARG TARGETARCH
# Required: the pinned version from server/VERSION (single source of truth).
ARG FEP_PB_VERSION

RUN apk add --no-cache ca-certificates curl unzip
WORKDIR /download
COPY server/VERSION ./VERSION
COPY server/pocketbase.sha256 ./sha256

RUN set -eu; \
    pinned="$(tr -d '[:space:]' < VERSION)"; \
    if [ -z "${FEP_PB_VERSION}" ]; then \
      echo "FATAL: --build-arg FEP_PB_VERSION is required (single source: server/VERSION)" >&2; exit 1; \
    fi; \
    if [ "${FEP_PB_VERSION}" != "${pinned}" ]; then \
      echo "FATAL: FEP_PB_VERSION=${FEP_PB_VERSION} does not match pinned server/VERSION=${pinned}" >&2; exit 1; \
    fi; \
    case "${TARGETARCH}" in \
      amd64) ASSET="pocketbase_${FEP_PB_VERSION}_linux_amd64.zip" ;; \
      arm64) ASSET="pocketbase_${FEP_PB_VERSION}_linux_arm64.zip" ;; \
      *) echo "FATAL: unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    echo "Fetching ${ASSET}"; \
    curl -fsSL --retry 3 -o "${ASSET}" \
      "https://github.com/pocketbase/pocketbase/releases/download/v${FEP_PB_VERSION}/${ASSET}"; \
    echo "Verifying sha256 ..."; \
    EXPECTED="$(awk -v a="$ASSET" '$2 == a {print $1}' sha256)"; \
    test -n "${EXPECTED}" || { echo "FATAL: no pinned checksum for ${ASSET}" >&2; exit 1; }; \
    printf '%s  %s\n' "${EXPECTED}" "${ASSET}" > expected.sha256; \
    sha256sum -c expected.sha256; \
    unzip -q "${ASSET}"; \
    test -x pocketbase || { echo "FATAL: archive does not contain the pocketbase binary" >&2; exit 1; }; \
    ./pocketbase --version 2>&1 | grep -q "${FEP_PB_VERSION}" \
      || { echo "FATAL: downloaded binary version mismatch" >&2; exit 1; }

# ---- runtime stage ----------------------------------------------------------
# Plan-pinned runtime: alpine 3.21.4 (musl, minimal). ca-certificates are
# required for PocketBase outbound TLS (S3-compatible backups, SMTP).
FROM alpine:3.21.4

# Backend release identity (build-time only, never secrets).
ARG GIT_SHA="dev"
ARG FEP_VERSION="0.0.0"
ARG FEP_PB_VERSION
RUN test -n "${FEP_PB_VERSION}" || { echo "FATAL: FEP_PB_VERSION build arg required" >&2; exit 1; }

# Fixed non-root runtime identity (plan D6).
ARG FEP_PB_UID=10001
ARG FEP_PB_GID=10001

RUN apk add --no-cache ca-certificates \
 && addgroup -g "${FEP_PB_GID}" pocketbase \
 && adduser -D -H -u "${FEP_PB_UID}" -G pocketbase pocketbase

WORKDIR /pb

COPY --from=download /download/pocketbase /pb/pocketbase
COPY server/pb_migrations /pb/pb_migrations
COPY server/pb_hooks /pb/pb_hooks
COPY server/VERSION /pb/VERSION
COPY docker/pocketbase/entrypoint.sh /pb/entrypoint.sh

# pb_data intentionally NOT created here: the entrypoint requires the
# storage mount (see entrypoint.sh) so no container-local database exists.
RUN chmod 0555 /pb/pocketbase /pb/entrypoint.sh \
 && chmod -R a+rX /pb/pb_migrations /pb/pb_hooks \
 && chmod 0444 /pb/VERSION \
 && test "$(tr -d '[:space:]' < /pb/VERSION)" = "${FEP_PB_VERSION}" \
    || { echo "FATAL: FEP_PB_VERSION arg does not match server/VERSION" >&2; exit 1; }

ENV PB_DATA_DIR=/pb/pb_data

# REQUIRED settings encryption: PB_ENCRYPTION_KEY must be set (the entrypoint
# fails closed without it) so app settings — incl. SMTP/S3 credentials — are
# stored encrypted in pb_data and in every backup ZIP. CORS allowlist unchanged.
# CORS allowlist: app + admin HTTPS origins and the Capacitor WebView origin
# (https://localhost). The superuser dashboard is only reached over the
# loopback / SSH tunnel (same-origin), so no CORS is needed for it.
CMD ["serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", \
     "--migrationsDir=/pb/pb_migrations", \
     "--hooksDir=/pb/pb_hooks", \
     "--hooksWatch=false", \
     "--encryptionEnv=PB_ENCRYPTION_KEY", \
     "--origins=https://app.fastenglishpodcast.com,https://admin.fastenglishpodcast.com,https://localhost"]

# PocketBase handles SIGTERM gracefully (SQLite WAL checkpoint + clean
# close); SIGTERM is the default stop signal — do not change it.
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8090/api/health || exit 1

ENTRYPOINT ["/pb/entrypoint.sh"]

USER ${FEP_PB_UID}:${FEP_PB_GID}

EXPOSE 8090

LABEL org.opencontainers.image.source="https://github.com/imdanialrashidi/fast-english"
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.version="${FEP_VERSION}"
LABEL com.fastenglish.image="pocketbase"
LABEL com.fastenglish.pb.version="${FEP_PB_VERSION}"
LABEL com.fastenglish.uid="${FEP_PB_UID}"
LABEL com.fastenglish.gid="${FEP_PB_GID}"