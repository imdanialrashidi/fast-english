# Content upload pipeline (reference implementation)

These are the exact programs used for the 2026-11-15 Fast English content batch (15 episodes, 87 lessons). They implement the standard in [`docs/ops/CONTENT_PIPELINE_FA.md`](../../docs/ops/CONTENT_PIPELINE_FA.md). They are reference implementations, not a turnkey CLI: each batch edits the constants at the top of the files (episode metadata, categories, skipped levels, cover choices).

## Requirements

- Python 3.11+ with `requests`, `Pillow`
- `ffmpeg` / `ffprobe` with `libmp3lame`
- ImageMagick (`montage`) for contact sheets
- `faster-whisper` only for the optional ASR spot-check

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `FE_SOURCE` | `~/Documents/Projects/FastEnglish - Eps` | folder holding `<episode>/*.wav` and the transcript |
| `FE_WORK` | `~/.cache/fast-english-upload` | working area (`mp3/`, `covers/`, `json/`, `logs/`) |
| `FE_MCP_ENDPOINT` | `https://fastenglishpodcast.ir/mcp/content` | content MCP endpoint |
| `FE_MCP_TOKEN_FILE` | `~/.config/fast-english/mcp-agent-token` | bearer token file, mode 600 |
| `FE_HOST` | `root@185.226.119.68` | production host for SSH checks/artisan |
| `FE_KEY` | `~/.ssh/fe_fastenglishpodcast` | SSH key |
| `FE_APP_FILTER` / `FE_DB_FILTER` | Coolify app/db container name filters | used by `verify_upload.py` |
| `FE_EXTRA_TRANSCRIPT` | empty | optional `<path>|<episode folder>` transcript from outside the source folder |

## Order

1. `parse_transcripts.py` — parse the three transcript layouts into `json/<episode>.json`, with a flag report on stdout.
2. `build_glossary.py` — resolve every vocabulary meaning into Persian; unresolved entries are printed and must be added to `json/fa-meanings.json`.
3. `build_content.py` — apply paragraph rules, attach durations from `json/audio-manifest.json`, and write `json/content.json`. Edit `CATEGORIES` and `TOPICS` here.
4. `encode_audio.py` — two-pass loudness normalization and MP3 encoding into `mp3/`, then `json/audio-manifest.json`. Edit `SKIP` for levels with missing audio.
5. `fetch_covers_fast.py` → `make_sheets.sh` → visual review → `process_covers.py` — fetch CC0/PD candidates, build contact sheets, record the chosen index in `CHOICES`, and write `json/cover-final.json`.
6. `mcp_client.py` — shared MCP/HTTP client (proxy disabled, upload pacing, retries). Not run directly.
7. `upload_all.py` — idempotent upload and publish driven by `json/upload-state.json`; `--only <slug>` resumes one topic, `--skip-publish` stops at drafts.
8. `verify_upload.py` — MCP + database + SHA-256 + cover checks into `json/verify-report.json`.
9. `asr_check.py` — optional audio↔text spot-check into `json/asr-check-tail.json`.
10. `generate_status.py` — writes `_Upload-Status/` and per-episode `UPLOAD-STATUS.md` in the source folder. Edit `MISSING_REASON` for the gaps of the batch.

## Safety

- `upload_all.py` publishes only when `confirm_review=true` is reachable in its flow; run it with `--skip-publish` unless the owner explicitly authorized agent publishing.
- Never commit a token, a transcript dump, or audio to the repository.
- Revoke the MCP token after the batch; `verify_upload.py` and `upload_all.py` fail cleanly on `401`.
