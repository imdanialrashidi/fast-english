#!/usr/bin/env bash
# tests/infra/05-pb-restore.sh
# PROVES disaster recovery: a real PocketBase backup restores a COMPLETELY
# different, brand-new empty data directory into a working production-compatible
# instance with exact record IDs/fields and identical uploaded-file bytes.
#   running container + synthetic data -> PB-native backup (Backups API)
#   -> destroy disposable state (container + data dir)
#   -> fresh empty host directory -> unzip the backup (production restore path)
#   -> start a new container -> authenticate -> exact records -> file sha256
#   -> expected collections readable (counts only)
# Fail closed; explicit protection refuses production pb_data, dev pb_data
# and arbitrary unsafe root paths.
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker require_cmd curl require_cmd python3 require_cmd unzip require_cmd sha256sum

PORT_A=18121; PORT_B=18122
ENC_KEY="9f8e7d6c5b4a39281706f5e4d3c2b1a0"
EMAIL="restore-$(date +%s | tail -c 6)@restore-fep.invalid"
PW="Restore$(date +%s | tail -c 6)!"
PHONE="+989$(printf '%09d' $((RANDOM % 1000000000)))"

# -- 1. disposable source environment ------------------------------------------
ROOT_DIR="$(new_disposable_dir)"
DATA_A="$ROOT_DIR/pb_data_a"
DATA_B="$ROOT_DIR/pb_data_b"   # the BRAND-NEW empty recovery directory
mkdir -p "$DATA_A"
if [[ "$CURRENT_UID" == "0" ]]; then
  chown 10001:10001 "$DATA_A"
  chmod 0770 "$DATA_A"
fi
echo "restore: source data dir $DATA_A"

C1="fep-restore-a-$$"
fep_run "$C1" -d \
  -v "$DATA_A:/pb/pb_data" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT_A:8090" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" >/dev/null
fep_wait_health $PORT_A 60 || fep_infra_fail "source container did not become healthy"

read -r SU_EMAIL SU_PW <<EOF
$(fep_create_superuser "$C1" /pb/pb_data --encryptionEnv=PB_ENCRYPTION_KEY)
EOF
TOKEN_A="$(curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PW\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

# synthetic world (student + test collection + uploaded file)
STUDENT="$(curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections/fep_users/records" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"Restore Proof\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL\",\"password\":\"$PW\",\"passwordConfirm\":\"$PW\"}")"
STUDENT_ID="$(printf '%s' "$STUDENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
TEST_COL='fep_infra_restore'
curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections" \
  -H "Authorization: $TOKEN_A" -H 'Content-Type: application/json' \
  --data "{\"name\":\"$TEST_COL\",\"type\":\"base\",\"fields\":[{\"name\":\"title\",\"type\":\"text\",\"required\":true},{\"name\":\"payload\",\"type\":\"file\",\"maxSelect\":1,\"mimeTypes\":[\"text/plain\"]}]}" >/dev/null
printf 'restore-proof-file-content-%s\nline-2\nline-3\n' "$(date +%s)" > "$ROOT_DIR/upload.txt"
UPLOAD="$(curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/collections/$TEST_COL/records" \
  -H "Authorization: $TOKEN_A" \
  -F "title=restore-file" -F "payload=@$ROOT_DIR/upload.txt;type=text/plain")"
REC_ID="$(printf '%s' "$UPLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
FILE_NAME="$(printf '%s' "$UPLOAD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["payload"])')"
REC_TITLE="restore-file"
FILE_SHA="$(sha256sum "$ROOT_DIR/upload.txt" | awk '{print $1}')"
echo "  PASS  synthetic world ready: student=$STUDENT_ID record=$REC_ID file=$FILE_NAME sha=$FILE_SHA"

# -- 2. real PocketBase-native backup -------------------------------------------
BNAME="fep-infra-restore-$(date -u +%Y%m%d%H%M%S).zip"
curl -fsS -X POST "http://127.0.0.1:$PORT_A/api/backups" \
  -H "Authorization: $TOKEN_A" -H 'Content-Type: application/json' \
  --data "{\"name\":\"$BNAME\"}" >/dev/null
sleep 1
# verify: exists + size + contains the storage tree (uploaded files)
LIST="$(curl -fsS "http://127.0.0.1:$PORT_A/api/backups" -H "Authorization: $TOKEN_A")"
SIZE="$(printf '%s' "$LIST" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[b for b in d if b['key']=='$BNAME']
print(m[0]['size'] if m else '')")"
[[ -n "$SIZE" && "$SIZE" -gt 0 ]] || fep_infra_fail "backup missing or empty"
ZIP="$DATA_A/backups/$BNAME"
[[ -f "$ZIP" ]] || fep_infra_fail "backup zip not on the host mount: $ZIP"
unzip -l "$ZIP" | grep -q "storage/" || fep_infra_fail "backup zip lacks the storage/ uploads tree"
# copy the backup to a safe location BEFORE the disposable state is destroyed
SAFE_ZIP="$ROOT_DIR/backup.zip"
cp -p "$ZIP" "$SAFE_ZIP"
echo "  PASS  backup created and verified: $BNAME ($SIZE bytes, storage/ present)"

# -- 3. DESTROY the disposable state -------------------------------------------
docker rm -f "$C1" >/dev/null
# move the data dir away entirely (simulated loss); the DIR ITSELF is gone
mv "$DATA_A" "$DATA_A.destroyed-$(date +%s)"
echo "  PASS  disposable state destroyed (container removed + data directory removed)"

# -- 4. brand-new empty directory + restore -------------------------------------
mkdir -p "$DATA_B"
[[ -z "$(ls -A "$DATA_B")" ]] || fep_infra_fail "recovery directory is not empty — refusing"
if [[ "$CURRENT_UID" == "0" ]]; then
  chown 10001:10001 "$DATA_B"
  chmod 0770 "$DATA_B"
fi
unzip -q "$SAFE_ZIP" -d "$DATA_B"
# Restore ownership to the runtime identity: when the harness itself runs
# as root (CI), the unzip leaves root-owned files that UID 10001 cannot
# open for write — mirror the production runbook chown (DISASTER_RECOVERY §1).
if [[ "$CURRENT_UID" == "0" ]]; then
  chown -R 10001:10001 "$DATA_B"
fi
rm -f -- "$SAFE_ZIP"
echo "  PASS  backup restored into the brand-new empty directory $DATA_B"

# -- 5. start the recovery container --------------------------------------------
C2="fep-restore-b-$$"
fep_run "$C2" -d \
  -v "$DATA_B:/pb/pb_data" \
  -e "PB_ENCRYPTION_KEY=$ENC_KEY" \
  -p "127.0.0.1:$PORT_B:8090" \
  "${PB_DOCKER_USER[@]}" \
  "$FEP_IMG_PB" >/dev/null
fep_wait_health $PORT_B 60 || fep_infra_fail "recovery container did not become healthy"

# -- 6. verification --------------------------------------------------------------
# same superuser authenticates (the backup always contains the superuser)
TOKEN_B="$(curl -fsS -X POST "http://127.0.0.1:$PORT_B/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PW\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
echo "  PASS  superuser authenticates on the restored instance"

# same student authenticates with the same password
LOGIN_B="$(curl -fsS -X POST "http://127.0.0.1:$PORT_B/api/collections/fep_users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$EMAIL\",\"password\":\"$PW\"}")"
ID_B="$(printf '%s' "$LOGIN_B" | python3 -c 'import json,sys; print(json.load(sys.stdin)["record"]["id"])')"
assert_eq "$STUDENT_ID" "$ID_B" "same student authenticates after clean restore"

# exact record ID + fields
REC_B="$(curl -fsS "http://127.0.0.1:$PORT_B/api/collections/$TEST_COL/records/$REC_ID" \
  -H "Authorization: $TOKEN_B")"
T_B="$(printf '%s' "$REC_B" | python3 -c 'import json,sys; print(json.load(sys.stdin)["title"])')"
assert_eq "$REC_TITLE" "$T_B" "restored record exact ID + field value"
FN_B="$(printf '%s' "$REC_B" | python3 -c 'import json,sys; print(json.load(sys.stdin)["payload"])')"
assert_eq "$FILE_NAME" "$FN_B" "restored record file field name"

# uploaded file bytes identical after restore
curl -fsS "http://127.0.0.1:$PORT_B/api/files/$TEST_COL/$REC_ID/$FILE_NAME" \
  -H "Authorization: $TOKEN_B" -o "$ROOT_DIR/restored-file.txt"
RESTORED_SHA="$(sha256sum "$ROOT_DIR/restored-file.txt" | awk '{print $1}')"
assert_eq "$FILE_SHA" "$RESTORED_SHA" "uploaded file SHA256 identical after clean restore"

# expected collections readable with numeric counts (launch-critical contract)
echo "  PASS  expected collections (counts only):"
for col in _superusers fep_users plans payment_destination payment_requests subscriptions placement_questions placement_attempts topics lessons lesson_progress staff_admins categories lesson_vocabulary content_imports content_operations site_settings; do
  code="$(curl -s -o "$ROOT_DIR/count.json" -w '%{http_code}' \
    "http://127.0.0.1:$PORT_B/api/collections/$col/records?perPage=1" \
    -H "Authorization: $TOKEN_B")"
  [[ "$code" == "200" ]] || fep_infra_fail "collection $col not readable after restore (HTTP $code)"
  total="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["totalItems"])' "$ROOT_DIR/count.json")"
  [[ "$total" =~ ^[0-9]+$ ]] || fep_infra_fail "collection $col count unparseable"
  echo "    $col total=$total"
done

docker rm -f "$C2" >/dev/null 2>&1 || true
fep_cleanup_containers
echo
echo "BACKUP -> CLEAN RESTORE: ALL PASS (different empty directory, exact records, exact file SHA256, all collections)"