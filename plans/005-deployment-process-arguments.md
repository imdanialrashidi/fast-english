# 005 — Deployment credential handling (no secrets in process arguments)

- **Written against:** commit `4b7caba` (branch `main`, clean tree; `deploy/` is now tracked)
- **Status:** DRAFT
- **Effort:** S · **Fix risk:** Medium · **Finding:** #5 (MAJOR — credentials/tokens visible in process arguments)

## Why this matters

Production secrets are root-only files, but two deployment scripts push
credential material into **process arguments**, which are readable by any local
user via `ps`/`/proc/<pid>/cmdline`:

- `deploy/configure.sh` passes the entire settings patch — including SMTP
  password and S3 access key/secret when configured — as `sys.argv[1]` to
  `python3` for the redaction print (lines 64–81), then again as an argument to
  `printf` (line 90) before writing the temp file.
- `deploy/backup.sh` passes the superuser email and password into `python3`
  command arguments (line 46) to build the auth JSON, and stores the returned
  auth token in an argv array (`AUTH=(-H "Authorization: $token")`, lines 49,
  53–54, 58) which curl exposes in its command line.
- `deploy/install.sh` already documents the one unavoidable exception: the
  PocketBase 0.39.9 CLI requires the superuser password as a positional
  argument (lines 16–21, 99–102) — that exception is explicitly **out of
  scope**; this plan removes the avoidable ones.

The redaction tests (`deploy/test-install-redaction.sh`,
`deploy/test-configure-redaction.sh`) only capture stdout; they do not inspect
argv, so this exposure is currently unproven-by-test.

## Current state (evidence)

`deploy/configure.sh`:

- Lines 31–45: auth JSON is already written to a `0600` temp file via `python3`
  reading env vars (good pattern — reuse it).
- Line 49: `AUTH=(-H "Authorization: $token")` — the auth token is passed to
  curl as a command-line argument.
- Lines 52–62: `BACKUPS_JSON`/`SMTP_JSON` are built with **shell string
  interpolation** of secrets (line 55 embeds `$FEP_BACKUP_S3_ACCESS_KEY` and
  `$FEP_BACKUP_S3_SECRET_KEY`; line 61 embeds `$FEP_SMTP_PASSWORD`).
- Lines 64–81: the full `PATCH` (containing those secrets) is passed to
  `python3 - "$PATCH"` as `sys.argv[1]` for the redacted print.
- Line 90: `printf '%s' "$PATCH" > "$AUTH_JSON"` — the patch is an argument to
  `printf` (a shell builtin, but the value still lives in the shell's argument
  vector while `set -x`/strace would show it; the bigger issue is lines 64–81).
- Lines 91–92: PATCH is sent with `--data-binary @"$AUTH_JSON"` (good — keep).

`deploy/backup.sh`:

- Line 46: `--data-binary "{\"identity\":$(python3 ... "$FEP_SUPERUSER_EMAIL"),\"password\":$(python3 ... "$FEP_SUPERUSER_PASSWORD")}"` — both credentials appear as arguments to `python3` (and the composed JSON is an argument to `curl`).
- Line 49: `AUTH=(-H "Authorization: $token")`; used at lines 53–54 (create), 58 (list), and the token is then embedded in argv for every subsequent call.
- Lines 59–64: the backup name is interpolated into a `python3 -c` script argument (`b['key']=='$NAME'`) — this is also an **injection** surface if a name ever contained a quote (names default to a safe timestamp, but `backup.sh <name>` accepts arbitrary input); fix in the same pass by passing `NAME` via `sys.argv` (safe non-secret) or env with `json.dumps`.

`deploy/test-configure-redaction.sh`: runs `configure.sh --dry-run` and greps
captured stdout for sentinel strings (lines 36–48). It cannot detect argv
leaks.

## Repo conventions to follow

- Secrets are read from `/opt/fast-english/shared/secrets/pocketbase.env` (root:root 0600) — never change the location or names.
- The established good pattern is "temp file with `--data-binary @file`" (`configure.sh:31-45`, `restore-drill.sh:75-81`).
- Tests are executable shell proofs in `deploy/` wired into `scripts/project-verify.sh` (see lines 167–171 for the two existing redaction proofs).
- `set -Eeuo pipefail` everywhere; traps clean temp files on every exit path.

## Scope

**In scope:**

- `deploy/configure.sh`
- `deploy/backup.sh`
- New test `deploy/test-process-args-redaction.sh`
- `scripts/project-verify.sh` (wire the new test in, next to lines 167–171)
- Comments/docs inside the two scripts (update the header notes that claim credentials are handled safely)

**Out of scope:**

- `deploy/install.sh` (documented CLI exception stays; do not attempt a stdin/env workaround that the pinned binary does not support)
- `deploy/deploy.sh`, `deploy/backup-copy.sh`, `deploy/restore-drill.sh`, `deploy/smoke-prod.sh` (verify at the end whether they pass secrets as argv; if yes, report as a follow-up finding — do NOT expand this plan)
- Credential rotation, secrets manager, changing secret names/locations
- Production deployment execution (all scripts must only be run in disposable test harnesses by the executor)

## Steps (ordered)

### 1. `deploy/configure.sh`

1. Keep the existing auth-JSON temp file (lines 35–45).
2. Replace the auth token argv array. Curl can read a header from a file:
   - Create a second `0600` temp file `AUTH_HDR` containing `Authorization: <token>` (token written from the already-obtained variable — avoid echoing it to stdout).
   - Use `-H @<file>`? — **verify curl syntax**: curl supports `--header @file` (one header per line) in modern versions. Confirm on the target curl before committing to it; if `@file` headers are unsupported on the installed curl, use `--config <file>` (curl config file with `header = "Authorization: ..."`), which is widely supported. Either way, no token in argv. Document which mechanism was chosen and why.
3. Build the settings patch JSON without shell interpolation and without passing it as an argument:
   - Write a small `python3` heredoc that reads the needed variables from the environment (only inside the script, temp values never printed) and emits the complete patch JSON to a new `0600` temp file. This handles quoting of S3/SMTP values correctly (no hand-rolled `json.dumps`) and removes both the interpolation and the argv exposure.
   - The redaction print then reads the temp file path (not `sys.argv[1]` containing the patch): `python3 - "$PATCH_FILE"` where the argument is only a `/tmp/...` path — the print logic stays identical (pop `password`/`secret`/`accessKey`, print the rest).
4. Remove the `printf '%s' "$PATCH"` line (the Python step already wrote the file).
5. Trap must remove ALL temp files (auth JSON, patch JSON, header/config file) on EXIT, including the `--dry-run` early exit (lines 83–86).

### 2. `deploy/backup.sh`

1. Build the auth JSON in a `0600` temp file from env vars (same pattern as `configure.sh:35-41`); send with `--data-binary @file` (lines 44–47).
2. Store the token in a header/config temp file (same curl mechanism chosen in step 1.2) and pass that to curl for the create/list calls instead of `AUTH=(-H "Authorization: $token")`.
3. Fix the name-interpolation at lines 59–64: pass `NAME` to the verification `python3 -c` via `sys.argv` (non-secret) with `json.dumps` on the Python side, or via env. The backup name regex is `^[a-z0-9_-]+\.zip$` (lines 36–39 only lowercases/appends `.zip` — it does NOT enforce the charset). Add a hard validation of the name against `^[a-z0-9_-]+\.zip$` **before** any use, so an operator-supplied name cannot inject into the Python snippet; keep the automatic lowercasing.
4. Keep: verification of existence/size, ZIP `storage/` check, copy + retention via `backup-copy.sh` (unchanged).

### 3. New test `deploy/test-process-args-redaction.sh`

Executable proof that no sentinel credential appears in captured process
arguments. Approach (safe, disposable):

- Create `TMP/bin` with two wrapper scripts that log their arguments to
  `TMP/argv.log` and then `exec` the real binaries:
  - `python3` wrapper: `printf '%s\n' "$@" >> "$TMP/argv.log"; exec /usr/bin/python3 "$@"` (find the real path with `command -v python3`).
  - `curl` wrapper: `printf '%s\n' "$@" >> "$TMP/argv.log"; exec /usr/bin/curl "$@"`.
- Run `configure.sh --dry-run` (and, if feasible without a live PocketBase, the
  non-dry-run auth-building portion of `backup.sh` — if the real flow cannot
  run without the server, run `backup.sh` against an unreachable `PB_ADDR` and
  assert the failure path also contains no sentinel; the auth JSON is built
  before any network call, so the argv assertions still hold).
- Secrets file in `TMP/shared/secrets/pocketbase.env` with sentinel values
  (same style as `deploy/test-configure-redaction.sh:21-33`).
- Assert `argv.log` contains none of the sentinels (superuser password, S3
  access key, S3 secret, SMTP password) and no line starting with
  `Authorization:` containing a non-placeholder token.
- `chmod 600` everything; remove the whole `TMP` in a trap.
- The test must never print the sentinels itself (grep with `! grep -q`).

### 4. Wire-up + docs

- Add `run bash deploy/test-process-args-redaction.sh` to `scripts/project-verify.sh` right after the existing redaction proofs (lines 169–171).
- Update the header comments in `configure.sh` and `backup.sh` to state the new mechanism (temp files, no argv secrets) and note the `install.sh` CLI exception remains documented there.

## Verification gates (machine-checkable)

```bash
bash deploy/test-configure-redaction.sh
bash deploy/test-install-redaction.sh
bash deploy/test-process-args-redaction.sh
pnpm typecheck
pnpm check
pnpm test
bash scripts/verify.sh
git diff --check
```

Expected:

- All three redaction/argv tests print `PASS` (or the documented skip only for
  `test-install-redaction.sh` when the binary is absent — do not add new skips).
- `argv.log` contains no sentinel and no real token.
- `scripts/verify.sh` ends with `All project verification checks passed.`

**Never run** `deploy/install.sh`, `deploy/configure.sh` (non-dry-run), or
`deploy/backup.sh` against real infrastructure; the test harness is
disposable-only.

## Test plan

- New `deploy/test-process-args-redaction.sh` as described in Step 3.
- Existing `test-configure-redaction.sh` must keep passing (the dry-run path is
  exercised; its stdout assertions remain valid because the print logic is
  unchanged, only the transport changes).
- Manual sanity (disposable): run `bash deploy/configure.sh --dry-run` with a
  secrets file containing sentinels and confirm (a) stdout shows the redacted
  patch, (b) `ps`/`/proc` during execution shows no sentinel — the argv-log
  wrapper makes this deterministic without `strace`.

## Maintenance note

- Rule going forward: **deployment scripts never place credentials or tokens
  in argv** — protected temp files or curl `--config`/header files only.
  `install.sh`'s CLI positional password is the single documented exception.
- The argv test is the regression guard; any new deploy script that touches
  secrets must include a matching argv proof.
- If curl's `--header @file` syntax is unsupported on the deployment target,
  the chosen mechanism must be recorded in the script header so the next
  editor does not "simplify" it back to argv.

## Escape hatches

- If the installed curl on the test machine does not support either safe
  header mechanism, STOP and report the curl version; do not fall back to
  argv-embedded tokens.
- If `backup.sh`'s non-dry-run path cannot be exercised at all in the harness
  (network is attempted before assertions), restructure the test to run only
  the credential-building portion (or assert the pre-network argv only) and
  report the limitation.
- If `deploy/` files are missing or materially different from the excerpts
  above at execution time (drift from this plan's commit), STOP and report —
  do not reconstruct the deployment package from memory.

## Done criteria

- [ ] `configure.sh`: patch JSON built and redacted-printed via temp files; auth header via curl config/header file; no secret in argv
- [ ] `backup.sh`: auth JSON via temp file; token via header file; backup name validated against `^[a-z0-9_-]+\.zip$`; no interpolation injection
- [ ] `deploy/test-process-args-redaction.sh` added, green, and wired into `scripts/project-verify.sh`
- [ ] All redaction tests PASS; `scripts/verify.sh` green; `git diff --check` clean
- [ ] No real-infrastructure command executed
