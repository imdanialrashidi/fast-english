# 0004 — Agent content upload through a staff MCP server

- Status: Accepted
- Date: 2026-11-08
- Owner request: let agents upload lesson content over MCP instead of hand-editing the Filament panel.

## Context

Content work currently happens in `/admin`: create a category, create a topic, upload a cover, create one lesson per CEFR level, upload MP3 audio, record a review, then publish through `App\Actions\PublishLesson`. The production database still has no topics or lessons, and the owner wants agents to prepare and upload that content.

MCP tool arguments are JSON. A 30 MB MP3 does not belong in a model-authored JSON argument (base64 adds 33% and model/tool payload limits are much smaller). The app also has no public REST API, no Sanctum installation, and no API token table; adding a broad API surface would violate the one-origin/one-app architecture. Publishing has a real human-review control (`reviewed_by` + `reviewed_at`) that must not silently disappear.

## Decision

Add one remote MCP server, `Fast English Content`, using the official `laravel/mcp` package.

- Transport: Streamable HTTP at `POST /mcp/content`, registered in `routes/ai.php` outside the web/session/CSRF stack. A separate binary endpoint is `PUT /mcp/uploads/{upload}`.
- Identity: `mcp_tokens` rows bound to an active staff user. Only a SHA-256 hash is stored; the plain token is shown once by `php artisan mcp:token issue`. Tokens expire (default 90 days, max 365) and are revocable. Route middleware and per-tool checks both require an active staff owner.
- Abilities: `content:read`, `content:write`, `content:publish`. The default issue is read+write. Publishing and archive/to-draft transitions require `content:publish`, granted explicitly.
- Binary upload: `begin-upload` returns a short-lived (30 min), single-use, encrypted upload token bound to the MCP token and upload id. The agent PUTs raw bytes to the returned URL with `X-Upload-Token`; `save-lesson`/`save-topic` consume the staged file. MP3 signature/size and cover signature/dimension rules are the same as the panel. Abandoned files are removed by `mcp:cleanup-uploads`.
- Writes: `save-topic` and `save-lesson` are idempotent upserts by slug / (topic, level). They only write drafts; existing published or archived rows are refused. They reuse `PublishLesson` levels, `Glossary`, `AudioFile`, `CoverImage`, `TopicCover`, and `TopicLicense` rather than copying validation.
- Publishing: `transition-content` calls the existing `PublishLesson` action. Every draft-to-published lesson transition requires `confirm_review=true`, which records the token's staff owner as reviewer with the current UTC time. This is an explicit assertion the token owner makes about a human review; the tool never records it by default, and a content edit clears an earlier review. Publishing an already-published lesson is a no-op.
- Licensing: replacing a generated cover with a staff upload requires a new four-line license record; the generated record is rejected as a carry-over. Generated covers remain license-exempt.
- Audit: token `last_used_at`/`last_used_ip` and a structured `mcp.tool` log line (tool, token id, user id, success) without arguments or file bytes. Review fields remain the content audit trail.

## Rejected alternatives

- **Base64 arguments for audio/covers.** Fits neither the 30 MB product limit nor normal MCP client payload limits, and doubles memory pressure.
- **Server-side fetch from a URL.** Adds SSRF and third-party availability risk for no user benefit; the agent already has the bytes.
- **A local stdio server only.** The production app and content live on the server; agents run on the owner's machine, so a remote HTTP surface is required.
- **OAuth 2.1 via Passport.** Correct for many hosted MCP clients, but a large new dependency and dynamic-client surface for a single-owner content tool. A static bearer token with server-shell issuance is proportionate; clients that require OAuth can use a local `mcp-remote` bridge.
- **A public token-management UI.** Token issuance requires server shell access and a named staff owner; no extra unauthenticated or learner-facing surface.
- **Writing published content in place.** Would let a write-only token change live lessons without a review. Draft-only writes keep the existing publish gate meaningful.

## Consequences

- New migration `mcp_tokens`; release must run `sh docker/release.sh` before the endpoint is usable.
- New dependency `laravel/mcp` (official, first-party) and `routes/ai.php`; the route is outside `web`, so no session cookie or CSRF token is involved.
- An MCP token is equivalent to staff content authority, not a learner credential. It bypasses interactive staff 2FA by design; issuing or leaking one must be treated as granting that staff member's content access. Revocation is immediate.
- The server supports both the package's legacy initialize handshake and the current discovery handshake; clients that only speak OAuth cannot connect without a bridge.
- No tool deletes content, changes a level, moves a published row, or edits published/archived rows. Those remain panel/CLI operations.
- Rollback: remove the route registrations and tools, revoke tokens, run the migration down, and remove `laravel/mcp`. Staged files are private and disposable; no product content is migrated by this feature.

## Evidence

- Focused Pest suite `tests/Feature/McpContentTest.php` covers auth states, abilities, handshake, tool list, draft writes, idempotency, audio/cover validation, license carry-over, upload-token single use/tamper/expiry/kind, oversize, cleanup, CLI issuance/revocation, draft-only guards, publish review, and the public sample.
- Full Pest suite and the manual curl proof are recorded in the changelog entry.
