#!/usr/bin/env bash
# tests/infra/06-pb-migration.sh
# PROVES the migration lifecycle under container replacement and the
# documented rollback limitation:
#   1. fresh data + production image -> migrations apply once (first and
#      last migration collections exist; container healthy);
#   2. data is created; container replaced (delete + recreate, same dir) ->
#      migrations do NOT re-run (startup stays healthy) and data survives;
#   3. rollback simulation: a PREVIOUS image (same binary, older
#      hooks/migrations — implemented by running the production image with
#      --migrationsDir/--hooksDir pointing at a staged previous-release
#      snapshot) on the SAME data dir stays healthy and — critically —
#      does NOT reverse the already-applied migration 0030
#      (payment_destination rules stay the tightened ones);
#   4. control: the previous release on a FRESH empty dir produces the OLD
#      rules -> proves the difference comes from the persisted schema state,
#      i.e. "rolling back the image never rolls back the database";
#   5. recovery from a bad migration release = pre-deploy backup restore
#      (proven by 05-pb-restore.sh; referenced here).
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker require_cmd curl require_cmd python3

PB_VER="$(tr -d '[:space:]' < "$REPO_ROOT/server/VERSION")"
PORT=18131; PORT_CTRL=18132; PORT_RB=18133
ENC_KEY="5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c"
EMAIL="mig-$(date +%s | tail -c 6)@migrate-fep.invalid"
PW="Migrate$(date +%s | tail -c 6)!"
PHONE="+989$(printf '%09d' $((RANDOM % 1000000000)))"

su_token() { # port
  curl -fsS -X POST "http://127.0.0.1:$1/api/collections/_superusers/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PW\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}
payment_rules() { # port
  curl -fsS "http://127.0.0.1:$1/api/collections/payment_destination" \
    -H "Authorization: $(su_token "$1")"
}

ROOT_DIR="$(new_disposable_dir)"
MIG_COUNT="$(ls "$REPO_ROOT"/server/pb_migrations/*.js | wc -l)"
echo "migration: $MIG_COUNT migration files, PocketBase $PB_VER"

# --- 1. fresh start: migrations apply once -------------------------------------
DATA="$ROOT_DIR/pb_data"
mkdir -p "$DATA"
if [[ "$CURRENT_UID" == "0" ]]; then chown 10001:10001 "$DATA"; chmod 0770 "$DATA"; fi
C1="fep-mig-a-$$"
fep_run "$C1" -d \
  -v "$DATA:/pb/pb_data" -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT:8090" "${PB_DOCKER_USER[@]}" "$FEP_IMG_PB" >/dev/null
fep_wait_health $PORT 60 || { echo "migration startup log:" >&2; docker logs "$C1" 2>&1 | tail -20 >&2; fep_infra_fail "fresh instance not healthy"; }
read -r SU_EMAIL SU_PW <<EOF
$(fep_create_superuser "$C1" /pb/pb_data --encryptionEnv=PB_ENCRYPTION_KEY)
EOF
TOKEN="$(su_token $PORT)"
# first-migration collection (fep_users) and last-migration collection
# (site_settings) must exist -> migrations truly applied.
for col in fep_users site_settings; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/collections/$col/records?perPage=1" -H "Authorization: $TOKEN")"
  assert_eq "200" "$code" "fresh instance has $col (migration applied)"
done
echo "  PASS  migrations applied on fresh start ($MIG_COUNT files present in image)"

# data
STUDENT="$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/collections/fep_users/records" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"Migration Lifecycle\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL\",\"password\":\"$PW\",\"passwordConfirm\":\"$PW\"}")"
STUDENT_ID="$(printf '%s' "$STUDENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
echo "  PASS  student created id=$STUDENT_ID"

# --- 2. container replacement: migrations do NOT re-run, data survives ---------
docker rm -f "$C1" >/dev/null
C2="fep-mig-b-$$"
fep_run "$C2" -d \
  -v "$DATA:/pb/pb_data" -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT:8090" "${PB_DOCKER_USER[@]}" "$FEP_IMG_PB" >/dev/null
fep_wait_health $PORT 60 || fep_infra_fail "recreated instance not healthy (migration re-run would fail loudly)"
LOGIN2="$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/collections/fep_users/auth-with-password" \
  -H 'Content-Type: application/json' --data "{\"identity\":\"$EMAIL\",\"password\":\"$PW\"}")"
ID2="$(printf '%s' "$LOGIN2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["record"]["id"])')"
assert_eq "$STUDENT_ID" "$ID2" "data survives container replacement (migrations not re-run, no data loss)"
echo "  PASS  migration lifecycle: apply-once + data survival under container replacement"
docker rm -f "$C2" >/dev/null 2>&1 || true

# --- 3. rollback simulation ------------------------------------------------------
# Build a PREVIOUS-release snapshot: the same binary/pinned version with the
# newest migration file and newest hook file removed (an older release would
# by definition not yet contain them). Staged read-only on the host.
PREV="$ROOT_DIR/previous-release"
mkdir -p "$PREV/pb_migrations" "$PREV/pb_hooks"
NEWEST_MIG="$(ls "$REPO_ROOT"/server/pb_migrations/*.js | sort | tail -1)"
NEWEST_HOOK="$(ls "$REPO_ROOT"/server/pb_hooks/*.js | sort | tail -1)"
for f in "$REPO_ROOT"/server/pb_migrations/*.js; do
  [[ "$f" == "$NEWEST_MIG" ]] || cp "$f" "$PREV/pb_migrations/"
done
for f in "$REPO_ROOT"/server/pb_hooks/*.js; do
  [[ "$f" == "$NEWEST_HOOK" ]] || cp "$f" "$PREV/pb_hooks/"
done
echo "  rollback snapshot: previous release = migrations minus $(basename "$NEWEST_MIG"), hooks minus $(basename "$NEWEST_HOOK")"

C3="fep-mig-rollback-$$"
docker rm -f "$C3" >/dev/null 2>&1 || true
docker run --name "$C3" -d \
  -v "$DATA:/pb/pb_data" \
  -v "$PREV/pb_migrations:/pb/prev/pb_migrations:ro" \
  -v "$PREV/pb_hooks:/pb/prev/pb_hooks:ro" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT_RB:8090" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" \
  serve --http=0.0.0.0:8090 --dir=/pb/pb_data \
    --migrationsDir=/pb/prev/pb_migrations --hooksDir=/pb/prev/pb_hooks \
    --hooksWatch=false --encryptionEnv=PB_ENCRYPTION_KEY \
    --origins=https://app.fastenglishpodcast.com,https://admin.fastenglishpodcast.com,https://localhost >/dev/null
fep_wait_health $PORT_RB 60 || { docker logs "$C3" 2>&1 | tail -15 >&2; fep_infra_fail "rolled-back image did not start against migrated data"; }
echo "  PASS  previous image starts against migrated data (no migration downgrade attempt)"

# The tightened payment_destination rules (migration 0030) MUST STILL be in
# force: rolling the image back does not roll back the database schema.
RB_RULES="$(payment_rules $PORT_RB)"
assert_contains "$RB_RULES" "@request.auth.id" "migration 0030 effect NOT reversed by the previous image"
assert_contains "$RB_RULES" "is_active = true" "original rule base intact"
# old hooks still functional
PUB="$(curl -fsS "http://127.0.0.1:$PORT_RB/api/fast-english/public/settings")"
assert_contains "$PUB" '"plans"' "previous-release hooks remain functional"
# data intact after rollback
LOGIN_RB="$(curl -fsS -X POST "http://127.0.0.1:$PORT_RB/api/collections/fep_users/auth-with-password" \
  -H 'Content-Type: application/json' --data "{\"identity\":\"$EMAIL\",\"password\":\"$PW\"}")"
ID_RB="$(printf '%s' "$LOGIN_RB" | python3 -c 'import json,sys; print(json.load(sys.stdin)["record"]["id"])')"
assert_eq "$STUDENT_ID" "$ID_RB" "data intact after image rollback"
echo "  PASS  documented limitation proven: image rollback does NOT reverse schema migrations"
docker rm -f "$C3" >/dev/null 2>&1 || true

# --- 4. control: previous release on a FRESH dir has the OLD rules --------------
DATA_CTRL="$ROOT_DIR/pb_data_ctrl"
mkdir -p "$DATA_CTRL"
if [[ "$CURRENT_UID" == "0" ]]; then chown 10001:10001 "$DATA_CTRL"; chmod 0770 "$DATA_CTRL"; fi
C4="fep-mig-ctrl-$$"
docker rm -f "$C4" >/dev/null 2>&1 || true
docker run --name "$C4" -d \
  -v "$DATA_CTRL:/pb/pb_data" \
  -v "$PREV/pb_migrations:/pb/prev/pb_migrations:ro" \
  -v "$PREV/pb_hooks:/pb/prev/pb_hooks:ro" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT_CTRL:8090" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" \
  serve --http=0.0.0.0:8090 --dir=/pb/pb_data \
    --migrationsDir=/pb/prev/pb_migrations --hooksDir=/pb/prev/pb_hooks \
    --hooksWatch=false --encryptionEnv=PB_ENCRYPTION_KEY \
    --origins=https://app.fastenglishpodcast.com,https://admin.fastenglishpodcast.com,https://localhost >/dev/null
fep_wait_health $PORT_CTRL 60 || fep_infra_fail "control instance not healthy"
read -r SU_EMAIL SU_PW <<EOF
$(fep_create_superuser "$C4" /pb/pb_data --encryptionEnv=PB_ENCRYPTION_KEY)
EOF
CTRL_RULES="$(payment_rules $PORT_CTRL)"
if [[ "$CTRL_RULES" == *"@request.auth.id"* ]]; then
  fep_infra_fail "control (fresh dir, previous release) unexpectedly has tightened rules"
fi
echo "  PASS  control: previous release on a fresh dir yields the OLD rules (proves the schema persisted state drives the difference)"
docker rm -f "$C4" >/dev/null 2>&1 || true

fep_cleanup_containers
echo
echo "MIGRATION LIFECYCLE: ALL PASS"
echo "NOTE: recovering from a bad migration release = pre-deploy backup restore (proven in 05-pb-restore.sh);"
echo "      migrations are NEVER auto-reversed by an image rollback (documented contract)."