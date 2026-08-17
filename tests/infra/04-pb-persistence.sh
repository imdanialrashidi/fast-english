#!/usr/bin/env bash
# tests/infra/04-pb-persistence.sh
# PROVES PocketBase persistence across a COMPLETE container deletion and
# recreation (not a mere restart):
#   1. clean persistent host directory with correct ownership
#   2. start the pinned production image with the bind mount
#   3. create a synthetic Student, representative records and an uploaded
#      file; record IDs + file sha256
#   4. REMOVE the container entirely (docker rm -f)
#   5. create a BRAND-NEW container on the SAME host directory
#   6. authenticate the same Student -> same IDs/fields -> same file bytes
# Additionally proves the wrong-UID/GID failure mode: a data directory the
# container user cannot write into produces a clear FATAL and a non-zero
# container exit. Fail closed; never touches real pb_data.
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker require_cmd curl require_cmd python3 require_cmd sha256sum

PORT_A=18111; PORT_B=18112
ENC_KEY="4f2a91c0e7b3d5a89b1c6d2e0f3a4b5c"
EMAIL="student-$(date +%s | tail -c 6)@persist-fep.invalid"
PW="Persist$(date +%s | tail -c 6)!"
PHONE="+989$(printf '%09d' $((RANDOM % 1000000000)))"

# -- 1. host directory with correct ownership ---------------------------------
ROOT_DIR="$(new_disposable_dir)"
DATA="$ROOT_DIR/pb_data"
mkdir -p "$DATA"
if [[ "$CURRENT_UID" == "0" ]]; then
  # Linux root: chown to the container runtime identity (production contract)
  chown 10001:10001 "$DATA"
  chmod 0770 "$DATA"
fi
echo "persistence: host data dir $DATA"

# -- 2. first container on the mount -------------------------------------------
C1="fep-persist-a-$$"
fep_run "$C1" -d \
  -v "$DATA:/pb/pb_data" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT_A:8090" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" >/dev/null
fep_wait_health $PORT_A 60 || fep_infra_fail "container A did not become healthy"
echo "  PASS  container A healthy on fresh directory"

read -r SU_EMAIL SU_PW <<EOF
$(fep_create_superuser "$C1" /pb/pb_data --encryptionEnv=PB_ENCRYPTION_KEY)
EOF
echo "  PASS  test superuser created in container A"

# API helper: auth and echo a token
su_token() { # $1=port
  curl -fsS -X POST "http://127.0.0.1:$1/api/collections/_superusers/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PW\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}
TOKEN_A="$(su_token $PORT_A)"
[[ -n "$TOKEN_A" ]] || fep_infra_fail "cannot authenticate superuser on A"
echo "  PASS  superuser auth on A"

# -- 3. synthetic world ---------------------------------------------------------
# 3a. Student signup (normal product path — no auth required)
STUDENT="$(curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections/fep_users/records" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"Infra Persistence\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL\",\"password\":\"$PW\",\"passwordConfirm\":\"$PW\"}")"
STUDENT_ID="$(printf '%s' "$STUDENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
[[ -n "$STUDENT_ID" ]] || fep_infra_fail "student signup failed on A"
echo "  PASS  synthetic student created id=$STUDENT_ID"

# 3b. representative records in a test-only collection with a file field
TEST_COL='fep_infra_proof'
curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections" \
  -H "Authorization: $TOKEN_A" -H 'Content-Type: application/json' \
  --data "{\"name\":\"$TEST_COL\",\"type\":\"base\",\"fields\":[{\"name\":\"title\",\"type\":\"text\",\"required\":true},{\"name\":\"note\",\"type\":\"text\"},{\"name\":\"payload\",\"type\":\"file\",\"maxSelect\":1,\"mimeTypes\":[\"text/plain\"]}]}" >/dev/null
REC1="$(curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections/$TEST_COL/records" \
  -H "Authorization: $TOKEN_A" -H 'Content-Type: application/json' \
  --data '{"title":"alpha-record","note":"first synthetic record"}')"
REC1_ID="$(printf '%s' "$REC1" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
# 3c. representative uploaded file (multipart through the real file API)
printf 'infra-persistence-file-%s\n2nd-line-with-content\n' "$(date +%s)" > "$ROOT_DIR/upload.txt"
UPLOAD="$(curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections/$TEST_COL/records" \
  -H "Authorization: $TOKEN_A" \
  -F "title=record-with-file" -F "note=file upload" \
  -F "payload=@$ROOT_DIR/upload.txt;type=text/plain")"
REC2_ID="$(printf '%s' "$UPLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
FILE_NAME="$(printf '%s' "$UPLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["payload"])')"
FILE_SHA="$(sha256sum "$ROOT_DIR/upload.txt" | awk '{print $1}')"
[[ -n "$REC2_ID" && -n "$FILE_NAME" ]] || fep_infra_fail "record/file upload failed on A"
echo "  PASS  representative records created: $REC1_ID, $REC2_ID"
echo "        uploaded file: $FILE_NAME (sha256 $FILE_SHA)"

# downloads currently stored bytes for later comparison
curl -fsS "http://127.0.0.1:$PORT_A/api/files/$TEST_COL/$REC2_ID/$FILE_NAME" \
  -H "Authorization: $TOKEN_A" -o "$ROOT_DIR/downloaded-before.txt"
BEFORE_SHA="$(sha256sum "$ROOT_DIR/downloaded-before.txt" | awk '{print $1}')"
assert_eq "$FILE_SHA" "$BEFORE_SHA" "uploaded file retrievable on A (sha256 match)"

# -- 4. REMOVE the container completely -----------------------------------------
docker rm -f "$C1" >/dev/null
echo "  PASS  container A removed completely (docker rm -f)"
# guard: the same host directory MUST still hold the data (not container-local)
if [[ ! -f "$DATA/data.db" && ! -f "$DATA/data.db.sqlite" ]]; then
  ls "$DATA" >&2
  fep_infra_fail "host data directory lost its content after container removal"
fi

# -- 5. brand-new container on the SAME host directory --------------------------
C2="fep-persist-b-$$"
fep_run "$C2" -d \
  -v "$DATA:/pb/pb_data" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT_B:8090" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" >/dev/null
fep_wait_health $PORT_B 60 || fep_infra_fail "container B did not become healthy"
echo "  PASS  brand-new container healthy on the same mount"

# -- 6. verify exact identity of the synthetic world ----------------------------
# 6a. the SAME student authenticates with the same password
STU_LOGIN="$(curl -fsS -X POST "http://127.0.0.1:$PORT_B/api/collections/fep_users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$EMAIL\",\"password\":\"$PW\"}")"
STU_ID2="$(printf '%s' "$STU_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["record"]["id"])')"
assert_eq "$STUDENT_ID" "$STU_ID2" "same student authenticates on B (id identical)"
STU_NAME2="$(printf '%s' "$STU_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["record"]["name"])')"
assert_eq "Infra Persistence" "$STU_NAME2" "student field name preserved"

# 6b. same record IDs and fields exist
TOKEN_B="$(su_token $PORT_B)"
GOT1="$(curl -fsS "http://127.0.0.1:$PORT_B/api/collections/$TEST_COL/records/$REC1_ID" \
  -H "Authorization: $TOKEN_B")"
T1="$(printf '%s' "$GOT1" | python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])')"
assert_eq "alpha-record" "$T1" "record $REC1_ID exact field value survives"
GOT2="$(curl -fsS "http://127.0.0.1:$PORT_B/api/collections/$TEST_COL/records/$REC2_ID" \
  -H "Authorization: $TOKEN_B")"
fn2="$(printf '%s' "$GOT2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["payload"])')"
assert_eq "$FILE_NAME" "$fn2" "record $REC2_ID file field name survives"

# 6c. same uploaded file bytes
curl -fsS "http://127.0.0.1:$PORT_B/api/files/$TEST_COL/$REC2_ID/$FILE_NAME" \
  -H "Authorization: $TOKEN_B" -o "$ROOT_DIR/downloaded-after.txt"
AFTER_SHA="$(sha256sum "$ROOT_DIR/downloaded-after.txt" | awk '{print $1}')"
assert_eq "$FILE_SHA" "$AFTER_SHA" "uploaded file bytes identical after container deletion/recreation"

# 6d. hooks from the image functional on B (business settings public route)
PUBLIC_B="$(curl -fsS "http://127.0.0.1:$PORT_B/api/fast-english/public/settings")"
assert_contains "$PUBLIC_B" '"plans"' "baked hooks work on the new container (public settings route)"
docker rm -f "$C2" >/dev/null 2>&1 || true

# -- wrong-UID/GID failure mode ------------------------------------------------
infra_echo "wrong-UID/GID failure proof"
BAD_DIR="$(new_disposable_dir)/pb_data"
mkdir -p "$BAD_DIR"
# A directory the runtime user cannot write to: root-owned mode 0555, or —
# where possible — owned by an explicitly different UID.
if [[ "$CURRENT_UID" == "0" ]]; then
  chown 10002:10002 "$BAD_DIR"   # deliberately wrong UID
  chmod 0700 "$BAD_DIR"
else
  chmod 0555 "$BAD_DIR"          # local non-root: read-only directory
fi
C3="fep-persist-bad-$$"
docker rm -f "$C3" >/dev/null 2>&1 || true
set +e
docker run --name "$C3" \
  -v "$BAD_DIR:/pb/pb_data" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" >"$ROOT_DIR/bad.log" 2>&1
BAD_RC=$?
set -e
sleep 1
# The container must have failed clearly (non-zero exit) with a FATAL message.
BAD_STATUS="$(docker inspect "$C3" --format '{{.State.Status}}' 2>/dev/null || echo gone)"
BAD_LOG="$(cat "$ROOT_DIR/bad.log")"
ls -la "$BAD_DIR" >/dev/null 2>&1  # restore readability for cleanup
chmod 0755 "$BAD_DIR" 2>/dev/null || true
[[ "$BAD_RC" != "0" ]] || fep_infra_fail "wrong-UID container unexpectedly started (exit 0)"
[[ "$BAD_STATUS" != "running" ]] || fep_infra_fail "wrong-UID container is running — MUST fail"
assert_contains "$BAD_LOG" "FATAL" "wrong-UID/GID directory produces a clear FATAL message"
echo "  PASS  wrong ownership -> clear failure, container refused to run"
docker rm -f "$C3" >/dev/null 2>&1 || true

fep_cleanup_containers
echo
echo "POCKETBASE PERSISTENCE: ALL PASS (container deletion/recreation, exact records, exact file bytes)"