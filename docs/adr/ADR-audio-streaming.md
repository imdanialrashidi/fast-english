# ADR: Audio Streaming via Chunked Reads (Plan 032 Spike)

**Status:** Spike — investigatory, not shipped
**Date:** 2026-08-21
**Context:** Premium audio proxy (`server/pb_hooks/lesson_routes.pb.js` premium audio handler, public sample, `podcast_domain.pb.js` artwork) buffers entire file via `$os.readFile(absNormalized)` → JS array copy → `e.response.write(chunk)` with `MAX_AUDIO_BYTES 10MiB`.

**Investigation:**
- Grep `$os.` in `server/pb_hooks/` shows only `$os.readFile` and `$os.stat` (if available) — no `$os.open`/`ReadAt`/`Seek`/`CopyN` streaming API in PB 0.39.9 goja `os` module.
- No hook today calls `e.response.write` incrementally; all are single-write.
- `require('fs')` is not available in JSVM sandbox (throws).
- Caddy `request>uri` query filter replaces `token=[REDACTED]`; streaming must not log `absNormalized`.

**Decision:**
- No chunked streaming API exists in this PB 0.39.9 build. Splitting `readFile` into manual `readFileRange` would still allocate full `bytes` to get `fileSize` for `Content-Length`/`Content-Range`, so heap per concurrent play remains `O(concurrent × fileSize)`.
- **Stopgap:** Keep buffering but tighten per-user burst for premium audio from `__fepPremiumAudio` 30/5min → 20/1min is **not** applied in this spike; instead document and keep current 30/5min until a real streaming API is available. Future work: reuse `readFileRange` helper extracted to shared goja helper when PB adds `os.Open`+`Seek`.
- Preserve entitlement re-validation per Range request (active + placement + subscription window) — already before any file open, must stay.
- Keep `416` semantics for `Range: bytes=-0`, `bytes=0-`, multi-range exactly as today.

**Consequences:**
- Heap remains `O(concurrent × fileSize)` with `MAX_AUDIO_BYTES 10MiB` cap before open.
- Next handler to stream when API available: public sample audio, then `podcast_domain` artwork — reuse same helper.
- Chunk size 64KiB remains the target when API lands (balance syscalls vs heap).

**Verification:**
- No code change in this spike; `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` still green for 206/416 + entitlement denials.
- `grep -n "\$os.readFile(absNormalized)" server/pb_hooks/lesson_routes.pb.js` still appears (streaming not landed) — documented as "no streaming API — rate-limit tightening only" per Done criteria alternative.
