#!/usr/bin/env bash
# tests/infra/01-build-images.sh
# Builds the four production images (Landing, Student App, Admin Console,
# PocketBase) from the repository at the current working tree, with the
# version identity of this exact commit. Images are tagged with the
# repository's commit SHA plus a fixed `:test` alias used by the rest of
# the suite — an executable equivalent (local) of the GHCR build workflow.
#
# Never pulls `latest`: every base/release is pinned by exact tag/version.
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker
require_cmd git

cd "$REPO_ROOT"

GIT_SHA="$(git rev-parse HEAD)"
GIT_SHA_SHORT="$(git rev-parse --short=12 HEAD)"
FEP_VERSION="$(node -p "require('./package.json').version")"
PB_VERSION="$(tr -d '[:space:]' < server/VERSION)"

infra_echo "building images — commit $GIT_SHA_SHORT, version $FEP_VERSION, PB $PB_VERSION"

build_one() {
  local name="$1" dockerfile="$2" extra=("${@:3}")
  infra_echo "image $name"
  docker build \
    --build-arg GIT_SHA="$GIT_SHA" \
    --build-arg FEP_VERSION="$FEP_VERSION" \
    "${extra[@]}" \
    -t "fep-infra/${name}:test" \
    -t "fep-infra/${name}:sha-${GIT_SHA_SHORT}" \
    -f "$dockerfile" \
    .
}

# Frontends honor the local npm registry (if one is configured) so local
# verification builds work behind mirrors; CI/GHCR builds use npmjs.org.
NPM_REGISTRY="${NPM_REGISTRY:-$(pnpm config get registry 2>/dev/null || true)}"
if [[ -n "$NPM_REGISTRY" ]]; then
  build_frontend() {
    local name="$1"
    docker build \
      --build-arg GIT_SHA="$GIT_SHA" \
      --build-arg FEP_VERSION="$FEP_VERSION" \
      --build-arg NPM_REGISTRY="$NPM_REGISTRY" \
      "${@:2}" \
      -t "fep-infra/${name}:test" \
      -t "fep-infra/${name}:sha-${GIT_SHA_SHORT}" \
      -f "docker/${name}/Dockerfile" .
  }
else
  build_frontend() {
    local name="$1"
    docker build \
      --build-arg GIT_SHA="$GIT_SHA" \
      --build-arg FEP_VERSION="$FEP_VERSION" \
      "${@:2}" \
      -t "fep-infra/${name}:test" \
      -t "fep-infra/${name}:sha-${GIT_SHA_SHORT}" \
      -f "docker/${name}/Dockerfile" .
  }
fi

build_one pocketbase docker/pocketbase/Dockerfile \
  --build-arg FEP_PB_VERSION="$PB_VERSION"
build_frontend landing \
  --build-arg VITE_WEB_APP_URL="${VITE_WEB_APP_URL:-https://app.fastenglishpodcast.com}"
build_frontend app
build_frontend admin

echo
echo "build complete:"
echo "  pocketbase -> ${FEP_IMG_PB}  (sha-$GIT_SHA_SHORT)"
echo "  landing    -> ${FEP_IMG_LANDING} (sha-$GIT_SHA_SHORT)"
echo "  app        -> ${FEP_IMG_APP} (sha-$GIT_SHA_SHORT)"
echo "  admin      -> ${FEP_IMG_ADMIN} (sha-$GIT_SHA_SHORT)"