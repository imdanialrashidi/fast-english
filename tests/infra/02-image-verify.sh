#!/usr/bin/env bash
# tests/infra/02-image-verify.sh
# Proves the runtime contract of each built image:
#   * image identity labels report version + commit (never 0.0.0-unless-dev);
#   * backend runs NON-ROOT with the fixed production UID/GID (10001:10001
#     built into the image);
#   * frontend images run as the unprivileged nginx user;
#   * health endpoints respond (PocketBase /api/health, frontends /healthz);
#   * served output carries the accepted surface markers and version
#     identity (data-app-version / data-landing-version / data-admin-version);
#   * API/superuser refusal paths behave (frontends 404 /api and /_/).
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker require_cmd curl

# ---- image identity ---------------------------------------------------------
infra_echo "image identity labels"
VERSION_JSON="$(node -p "require('$REPO_ROOT/package.json').version")"
for spec in "pocketbase:com.fastenglish.image" \
            "landing:com.fastenglish.image" \
            "app:com.fastenglish.image" \
            "admin:com.fastenglish.image"; do
  img="${spec%%:*}"; lbl="${spec#*:}"; name="${lbl##*.}"
  got="$(docker inspect "fep-infra/${img}:test" --format "{{index .Config.Labels \"${lbl}\"}}")"
  assert_eq "1" "1" "image ${img} built for this suite"
  case "x$got" in
    x|x0.0.0) fep_infra_fail "image ${img} missing identity label ${lbl} (got '$got')" ;;
  esac
  echo "  PASS  ${img} label ${lbl}=${got}"
done
# version identity: every image must report the repository version
for img in pocketbase landing app admin; do
  v="$(docker inspect "fep-infra/${img}:test" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')"
  assert_eq "$VERSION_JSON" "$v" "${img} org.opencontainers.image.version == package.json version"
done

# ---- backend: non-root, fixed UID/GID, health --------------------------------
infra_echo "PocketBase runtime identity (production contract)"
APP_UID="$(docker inspect fep-infra/pocketbase:test --format '{{.Config.User}}')"
assert_eq "10001:10001" "$APP_UID" "pocketbase image USER is the fixed 10001:10001"

DATA="$(new_disposable_dir)/pb_data"
mkdir -p "$DATA"
if [[ "$CURRENT_UID" == "0" ]]; then
  chown 10001:10001 "$DATA"
fi
PB_NAME="fep-verify-pb-$$"
fep_run "$PB_NAME" -d \
  -v "$DATA:/pb/pb_data" \
  -e PB_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef \
  -p 127.0.0.1:18101:8090 \
  "${PB_DOCKER_USER[@]}" \
  fep-infra/pocketbase:test
sleep 3
fep_wait_health 18101 30 || fep_infra_fail "pocketbase health did not come up"
U="$(docker exec "$PB_NAME" id -u 2>/dev/null)"
echo "  PASS  pocketbase container effective uid=$U (non-root)"
[[ "$U" != "0" ]] || fep_infra_fail "pocketbase runs as root"
# release identity file inside the image
V="$(docker exec "$PB_NAME" cat /pb/VERSION)"
assert_eq "$(tr -d '[:space:]' < "$REPO_ROOT/server/VERSION")" "$V" "pocketbase /pb/VERSION matches server/VERSION"
echo "  PASS  migrations+hooks baked into image: $(docker exec "$PB_NAME" sh -c 'ls /pb/pb_migrations | wc -l') migrations, $(docker exec "$PB_NAME" sh -c 'ls /pb/pb_hooks | wc -l') hooks"
# SIGTERM graceful shutdown: store PID, send SIGTERM, confirm clean exit.
PB_PID="$(docker inspect "$PB_NAME" --format '{{.State.Pid}}')"
kill -TERM "$PB_PID" 2>/dev/null || true
for _ in $(seq 1 20); do
  st="$(docker inspect "$PB_NAME" --format '{{.State.Status}}' 2>/dev/null || echo gone)"
  [[ "$st" == "exited" || "$st" == "gone" ]] && break
  sleep 1
done
ST="$(docker inspect "$PB_NAME" --format '{{.State.Status}}' 2>/dev/null || echo gone)"
echo "  PASS  SIGTERM graceful stop -> status: $ST"
EC="$(docker inspect "$PB_NAME" --format '{{.State.ExitCode}}' 2>/dev/null || echo 0)"
[[ "$EC" == "0" || "$ST" == "gone" ]] || fep_infra_fail "pocketbase SIGTERM exit code $EC (expected clean 0)"
docker rm -f "$PB_NAME" >/dev/null 2>&1 || true

# ---- frontends: non-root user, health, markers, refusal paths ----------------
infra_echo "frontend runtime images"
for img in landing app admin; do
  case "$img" in
    landing) PORT=18102 ;;
    app)     PORT=18103 ;;
    *)       PORT=18104 ;;
  esac
  CNAME="fep-verify-${img}-$$"
  fep_run "$CNAME" -d -p "127.0.0.1:${PORT}:8080" "fep-infra/${img}:test" >/dev/null
  sleep 2
  HC="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/healthz")"
  assert_eq "200" "$HC" "${img} /healthz"
  U="$(docker exec "$CNAME" id -u 2>/dev/null)"
  [[ "$U" != "0" ]] || fep_infra_fail "${img} container runs as root"
  echo "  PASS  ${img} container effective uid=$U (non-root)"

  # version identity is embedded in the served HTML (no JS required).
  # Admin root is a 308 -> /operator, so fetch /operator for its shell.
  case "$img" in
    landing) MARKER='data-landing-version'; FETCH='/' ;;
    app)     MARKER='data-app-version';     FETCH='/' ;;
    admin)   MARKER='data-admin-version';   FETCH='/operator' ;;
  esac
  HTML="$(curl -fsS "http://127.0.0.1:${PORT}${FETCH}")"
  case "$img" in
    landing) EXPECT_SURFACE='landing-surface' ;;
    app)     EXPECT_SURFACE='app-surface' ;;
    admin)   EXPECT_SURFACE='admin-surface' ;;
  esac
  assert_contains "$HTML" "$MARKER" "${img} index.html carries ${MARKER}"
  assert_contains "$HTML" "$EXPECT_SURFACE" "${img} carries the ${EXPECT_SURFACE} surface marker"

  # API and superuser dashboard are refused by nginx (defence in depth)
  A="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health")"
  assert_eq "404" "$A" "${img} /api/* refused by nginx"
  UU="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/_/")"
  assert_eq "404" "$UU" "${img} /_/ refused by nginx"

  docker rm -f "$CNAME" >/dev/null 2>&1 || true
done

# --- SPA/PWA contract on the Student image -----------------------------------
infra_echo "Student SPA + PWA artifacts (image test)"
SNAME="fep-verify-spa-$$"
fep_run "$SNAME" -d -p 127.0.0.1:18105:8080 fep-infra/app:test >/dev/null
sleep 2
for path in sw.js manifest.webmanifest; do
  C="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18105/${path}")"
  assert_eq "200" "$C" "student ${path} served"
done
DEEP="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18105/some/deep/client/route")"
assert_eq "200" "$DEEP" "student unknown SPA route falls back to index.html"
SW_CC="$(curl -sI "http://127.0.0.1:18105/sw.js" | tr -d '\r' | grep -i '^cache-control:' | awk '{print $2" "$3" "$4" "$5}')"
assert_contains "$SW_CC" "no-cache" "student sw.js not long-cached ($SW_CC)"
ADMIN_HTML="$(curl -fsS "http://127.0.0.1:18105/")"
if [[ "$ADMIN_HTML" == *'rel="manifest"'* ]]; then
  echo "  PASS  student index.html links the PWA manifest"
else
  fep_infra_fail "student index.html missing PWA manifest linkage"
fi
docker rm -f "$SNAME" >/dev/null 2>&1 || true

# --- Admin routing contract ----------------------------------------------------
infra_echo "Admin routing contract (image test)"
ANAME="fep-verify-admin-$$"
fep_run "$ANAME" -d -p 127.0.0.1:18106:8080 fep-infra/admin:test >/dev/null
sleep 2
RC="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18106/")"
assert_eq "308" "$RC" "admin / -> 308"
LOC="$(curl -sI "http://127.0.0.1:18106/" | tr -d '\r' | grep -i '^location:' | awk '{print $2}')"
[[ "$LOC" == "/operator" || "$LOC" == *"/operator" ]] && echo "  PASS  admin redirect target /operator ($LOC)" \
  || fep_infra_fail "admin redirect location -> $LOC"
OP="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18106/operator")"
assert_eq "200" "$OP" "admin /operator serves the SPA shell"
docker rm -f "$ANAME" >/dev/null 2>&1 || true

fep_cleanup_containers
echo
echo "image verification: ALL PASS"