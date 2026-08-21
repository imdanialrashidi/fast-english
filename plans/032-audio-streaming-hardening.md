# Plan 032: Stream premium audio via chunked reads (remove full-file buffering)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/lesson_routes.pb.js server/pb_hooks/content_admin_core.pb.js scripts/smoke-lessons.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH (entitlement re-validation per range request must survive streaming; Caddy `token=[REDACTED]` coupling; suffix-range and multi-range semantics)
- **Depends on**: 025 (library/queue scans — same heap concern, do separately; no code overlap), 031 (test pyramid — optional, not blocking)
- **Category**: perf (heap per concurrent audio play)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

The premium/public audio proxy (`lesson_routes.pb.js` list/detail/audio + sample audio + `content_admin_core.pb.js` hero/vocab/pron) buffers the entire file per request via `$os.readFile(absNorm)` → JS string/array copy loop `for bi ... chunk.push(bytes[bi])` → `e.response.write(chunk)`. With `MAX_AUDIO_BYTES 10MiB` and concurrent plays this is `O(concurrent × fileSize)` heap + poor TTFB on Slow-4G. The last audit deferred this as HIGH-risk because the file token travels as `?token=` and every Range request must still re-validate live entitlement (`active` + `placement_completed` + not suspended + valid subscription window). A correct streaming fix must keep those checks and Caddy's `token=[REDACTED]` redaction.

## Current state

- **Buffered read (premium audio handler, `server/pb_hooks/lesson_routes.pb.js:980-1035`):**
```js
var MAX_AUDIO_BYTES = 10 * 1024 * 1024;
var raw = $os.readFile(absNormalized); // Go []byte → JS via $os
var bytes = [];
if (typeof raw === "string") { for (var si=0; si<raw.length; si++) arr.push(raw.charCodeAt(si)&0xff); }
else if (Array.isArray(raw)) { bytes = raw; }
if (bytes.length > MAX_AUDIO_BYTES) return e.json(413, ...);
var rangeHeader = String(e.request.header.get("Range")||"").trim();
if (rangeHeader.indexOf("bytes=")===0) {
  // parse single range, 416 on suffix "-0" / multi-range / malformed
  var chunk = [];
  for (var bi=rangeStart; bi<=rangeEnd && bi<bytes.length; bi++) chunk.push(bytes[bi]);
  header.set("Content-Range", "bytes "+rangeStart+"-"+rangeEnd+"/"+fileSize);
  e.response.writeHeader(206); e.response.write(chunk);
} else { header.set("Content-Length", String(fileSize)); e.response.write(bytes); }
```
  Same pattern in public sample audio `~1320-1340`, content admin hero `580-595`, and `podcast_domain.pb.js` `serveArtworkBytes`.

- **Entitlement before read:** manual `$app.findAuthRecordByToken(token,"file")` or `Bearer` → `student` → `account_status` + `placement_completed` + `subscriptions` scan with `starts_at/expires_at` window. Rate-limited per `__fepPremiumAudio` (30/5min).

- **Caddy redaction:** `deploy/Caddyfile` `request>uri` query filter replaces `token` → `[REDACTED]`; `deploy/test-log-redaction.sh` proves it. Streaming must not log tokens.

- **Risk note from last plan:** `plans/README.md` "Full-file audio/receipt reads per request — deferred as HIGH-risk perf plan; needs audio-proxy invariants preserved." This plan is that deferred work, scoped as an investigate + prototype spike, not a forced ship.

- **Conventions:** Hooks ES5 only, `biome.json` excludes `server/pb_hooks`. Smokes: `scripts/smoke-lessons.mjs` 60+ scenarios incl. `Range: bytes=0-1023` → 206 and `free_plan_not_payable` etc.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Lessons smokes | `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` | 206/416 + entitlement denials green |
| Podcast domain | `bash scripts/smoke-podcast-domain.sh node scripts/smoke-podcast-domain.mjs` | pass |
| Manual Range probe | `bash scripts/smoke-lessons.sh node -e "require('./scripts/smoke-common.mjs') /* small Range 206 probe */"` | 206 with correct `Content-Range` |
| Caddy redaction drill | `bash deploy/test-log-redaction.sh` (if caddy present) | `token=[REDACTED]` marker present |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/lesson_routes.pb.js` — premium audio handler (and optionally public sample audio handler if same pattern — but keep it minimal; one handler first)
- `scripts/smoke-lessons.mjs` — add a streaming-specific Range scenario (suffix range + 206 length exactness)
- `tests/audio-streaming.test.mjs` (optional structural guard — see Steps)

**Out of scope** (do NOT touch, even though they look related):
- Receipt binary routes (`payment_routes.pb.js` 5 MB) — different entitlement model, different file type; out of this plan.
- `server/pb_hooks/podcast_domain.pb.js` artwork serving — large refactor, separate.
- `server/pb_hooks/content_admin_core.pb.js` hero/vocab/pron — defer; prove premium audio first.
- Caddyfile `token` redaction — must not change; just preserve.
- Client `PlayerProvider.tsx` / `VariantDeck.tsx` — no client changes.

## Git workflow

- Branch: `advisor/032-audio-streaming-hardening`
- Commits: 1) spike probe 2) chunked read 3) regression (if separate).
- Do NOT push unless instructed.

## Steps

### Step 1: Spike — can we stream without buffering? (no code change, report)

Before coding, probe goja's `$os` capabilities on this PB 0.39.9 build:

1. Is `$os.readFile` the only file read? Grep `$os.` in hooks — likely `readFile` only.
2. Does `e.response.write()` support chunked incremental writes? Find if any hook today calls `e.response.write(chunk1); e.response.write(chunk2);` — today none.
3. Can we `require('fs')` or use `$os.open`/`$os.stat` inside a hook to get a stream? Try in a disposable PB hook snippet via a temporary test hook `server/pb_hooks/_spike.pb.js` that on `GET /api/fast-english/_spike` does `try{ var f=$os.open(absNorm,"r"); ... }catch(e){ e.json(500,{code:e.message}) }`. Do not commit the spike hook — just report.

Deliverable for this step: a 10-line report in the commit message whether streaming via `copyN` + `seek` exists or whether chunked `readFile` with offset is the only viable increment. If no streaming API exists, the alternative is: keep buffering but cap concurrency via stricter rate limit (30/5min → 20/1min) as a stopgap — report instead of forcing a non-existent API.

**Verify (no code):** written spike note in commit body; `git status` clean (spike file removed).

### Step 2: Implement 64KiB-chunked streaming (if spike says feasible)

If spike proves a chunked path (e.g. `io.CopyN` + `Seek` or `fs.createReadStream` via goja `os` module), edit the premium audio handler `GET /api/fast-english/lessons/{lessonId}/audio` only:

1. Keep entitlement check **identical and before any file open** — do not move it after open.
2. Keep containment check (`$filepath.clean` + `prefixOk`) identical.
3. Replace:
   ```js
   var raw = $os.readFile(absNormalized);
   var bytes = /* string→array copy */;
   // ... range slicing via for loop ...
   e.response.write(chunk);
   ```
   With chunked writer:
   ```js
   var stat = $os.stat(absNormalized); // if available; otherwise raw.length after read is fine for Content-Length header, but stream body
   var fileSize = Number(stat.size);
   // header negotiation: parse Range as today, then for the requested range:
   var chunkSize = 64 * 1024;
   var offset = rangeStart; // or 0 for full
   var remain = rangeEnd - rangeStart + 1; // or fileSize for full
   while (remain > 0) {
     var toRead = Math.min(chunkSize, remain);
     var buf = $os.readFileRange(absNormalized, offset, toRead); // hypothetical — map to actual goja API found in spike
     if (!buf || buf.length === 0) break;
     try { e.response.write(buf); } catch (_) { break; } // client closed
     offset += buf.length;
     remain -= buf.length;
   }
   ```
   Adapt `readFileRange` to the actual goja API (`$os.readFile` with `offset` param? or `os.Open` + `Seek` + `Read`). If the API is `file, err := os.Open(path); defer file.Close(); file.Seek(offset,0); io.CopyN(e.response, file, remain)` but goja exposes it as `$os.open`, use that.

4. Keep Range semantics exactly as today: suffix `-N`, open-ended `N-`, single-range only → 416 for multi-range/comma/malformed; `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` identical. Do not add `ETag`.

5. Keep `MAX_AUDIO_BYTES` guard: reject if `stat.size > 10*1024*1024` with 413 before opening.

If the spike found no streaming API, keep buffering but reduce per-user burst: change `__fepPremiumAudio` `RATE_MAX` from 30 → 20 and window from 300000 → 60000 (less concurrent long-lived streams) — document in commit.

**Verify**: `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` → existing 206/416 smoke scenarios still green. Add one new assertion: `Range: bytes=100-199` returns `206`, `Content-Length: 100`, `Content-Range: bytes 100-199/<fileSize>`, body length 100 (not full file).

### Step 3: Preserve entitlement per range + token redaction

Add a new smoke scenario:

- Student entitled → `GET /api/fast-english/lessons/{id}/audio?token=<valid>` with `Range: bytes=0-1023` → 206 and 1024 bytes, correct headers.
- Same `id` after subscription expires (or after `account_status` set to pending via helper) → same `?token=` request → 403 (entitlement re-validated per request, leaked token grants nothing). This scenario already exists in `smoke-lessons.mjs` for non-range — extend it to Range.

Also verify suffix range: `Range: bytes=-500` → last 500 bytes, 206.

**Verify**: new scenarios green; `bash deploy/test-log-redaction.sh` (if caddy present) still shows `token=[REDACTED]` (no regression).

### Step 4: Final regression (single handler only)

Run `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs`, `bash scripts/smoke-podcast-domain.sh node scripts/smoke-podcast-domain.mjs`, `pnpm verify:fast`. Do NOT widen to all 18 smokes unless streaming touched more than one handler.

**Verify**: all three green; `pnpm verify:fast` green.

## Test plan

- **Spike report**: written commit body stating goja streaming capability on PB 0.39.9.
- **Behavioral smoke (new):** `Range: bytes=0-1023` → 206/1024 + correct `Content-Range`; `Range: bytes=100-199` length exactness; `Range: bytes=-500` suffix; multi-range `bytes=0-10,20-30` → 416.
- **Regression**: full `smoke-lessons` suite (entitlement deny/allow, expired denial, old file token after entitlement loss deny, suffix 416, no raw media errors).
- **Redaction**: Caddy log `token=[REDACTED]` still holds (if caddy present, else structural grep that handler never logs `absNormalized`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "\\$os.readFile(absNormalized)" server/pb_hooks/lesson_routes.pb.js` no longer appears in the premium audio handler (streaming path) OR a follow-up commit documents "no streaming API — rate-limit tightening only" and code reflects that tightening
- [ ] `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` exits 0 and the new Range 206/length assertion passes
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- Spike finds no chunked/streaming API in goja (`$os.open`/`ReadAt`/`Seek`/`CopyN` all absent) — then do not buffer-split alone (that still allocates full `bytes` to get `fileSize`); tighten rate limit as stopgap and report.
- Streaming would require `require('fs')` which is not available in JSVM sandbox (throws) — report actual error.
- Entitlement re-validation cannot be kept per-chunk without re-opening the file (would add per-chunk DB lookup) — report tradeoff.
- You need to change Caddyfile or receipt routes — out of scope.
- `Content-Range` byte math off-by-one (RFC 7233 inclusive) — if live `fileSize` via `stat.size` differs from `bytes.length` (sparse files, encoding), report.

## Maintenance notes

- If a streaming path is landed, the next handler to stream is public sample audio (same file type, no auth), then `podcast_domain` artwork — reuse the same `readFileRange` helper (extract to `shared` goja helper if feasible).
- Keep `MAX_AUDIO_BYTES 10MiB` as the cap even when streaming (reject before open). The chunk size 64KiB is a balance: smaller → more `write` syscalls, larger → heap spike.
- Reviewers: verify `416` handling for `Range: bytes=-0` and `Range: bytes=0-` (open-ended) still matches prior behavior — the spike's 416 contract must be exact.

