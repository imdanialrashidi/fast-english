# Plan 011: Harden telemetry redaction — filesystem paths and phone variants

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- app/src/lib/telemetry/redact.ts app/src/lib/telemetry/telemetry.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (privacy contract)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

`sanitizeMessage` is the last line of defense before anything reaches the
telemetry beacon (`VITE_TELEMETRY_ENDPOINT`, OFF by default). Its contract
(file header) promises payloads never contain "phones, emails, paths,
tokens". Two gaps remain:

1. **Filesystem paths are not redacted.** An error message containing
   `/opt/fast-english/shared/pb_data/...`, `/var/...`, `/tmp/...`,
   `storage/...` or a drive-letter path passes through verbatim. Server
   error text (e.g. from PB) routinely contains such paths, and
   `reportError` feeds arbitrary `err.message`/stacks through
   `sanitizeMessage` (`telemetry/index.ts:74-90`).
2. **Phone patterns cover only the compact ASCII form.**
   `(?:\+98|0098|0)9\d{9}\b` misses spaced/dashed forms
   (`+98 912 345 6789`, `+98-912-345-6789`) and Persian/Arabic-digit
   numbers (`۰۹۱۲۳۴۵۶۷۸۹`) — the file's own comment admits Persian digits
   "never match", which means a Persian-digit phone in an error string is
   shipped unredacted.

The repo's server-side sanitizer (`content_import_core.pb.js
sanitizeDiagnostics`) already has a `PATH_PATTERNS` list — port it.

## Current state

`app/src/lib/telemetry/redact.ts:95-120` — the tail of `sanitizeMessage`:

```ts
  // Iranian mobile numbers (ASCII digits; the UI copy uses Persian
  // digits, which never match).
  out = out.replace(/(?:\+98|0098|0)9\d{9}\b/g, '[REDACTED_PHONE]');
  // Emails.
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
  // Long random-looking strings that may be file tokens / nonces.
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[REDACTED]');
  return out;
```

`app/src/lib/telemetry/telemetry.test.ts:54-90` — `describe('sanitizeMessage')`
with token/Bearer/JWT/phone/email/long-blob cases (the pattern to extend).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Redaction unit tests | `npx vitest run app/src/lib/telemetry/telemetry.test.ts` | all pass, incl. new cases |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Full telemetry suite | `npx vitest run app/src/lib/telemetry app/src/lib/pocketbase.telemetry.test.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `app/src/lib/telemetry/redact.ts`
- `app/src/lib/telemetry/telemetry.test.ts`

**Out of scope** (do NOT touch):
- `content_import_core.pb.js` (the server's own sanitizer — different
  runtime, already has path patterns).
- Telemetry sinks, the facade, event names, or any other telemetry module.
- No behavioral change to what events are captured — only redaction.

## Git workflow

- Branch: `advisor/011-telemetry-redaction` (repo convention: `topic-slug`).
- Commit style: conventional (`fix(telemetry): redact filesystem paths and spaced/Persian-digit phones`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Port the path patterns

In `sanitizeMessage`, before the email rule (order matters: paths first —
a path can contain digits but never a phone), add:

```ts
  // Filesystem paths (server error text, dev-machine stacks). Mirrors the
  // server sanitizer's PATH_PATTERNS (content_import_core.pb.js).
  out = out.replace(
    /(?:\/(?:opt|var|tmp|home|usr|etc|root|srv|app)(?:\/[^\s"'<>()[\]]*)?|\b(?:pb_data|storage|data)\/[^\s"'<>()[\]]*|[A-Za-z]:\\[^\s"'<>()[\]]*)/g,
    '[REDACTED_PATH]',
  );
```

Requirements: (a) `/opt/...`, `/var/...`, `/tmp/...`, `/home/...`,
`/usr/...`, `/etc/...`, `/root/...`, `/srv/...`, `/app/...` prefixes with a
path tail; (b) bare `pb_data/...` / `storage/...` / `data/...` relative
paths (the PB storage layout); (c) Windows drive paths. The tail stops at
whitespace, quotes, angle brackets, parens, or square brackets (stack-trace
safety). Verify against the live server list in
`server/pb_hooks/content_import_core.pb.js` first and match it (add any
prefix it has that this list lacks — `report`, don't improvise, if the
server list is substantially different).

### Step 2: Broaden the phone rule

Replace the single ASCII phone regex with three passes (same marker):

```ts
  // Iranian mobile numbers: compact ASCII, spaced/dashed ASCII, and
  // Persian/Arabic-digit forms (the UI and error copy can carry any).
  out = out.replace(/(?:\+98|0098|0)9\d{9}\b/g, '[REDACTED_PHONE]');
  out = out.replace(/(?:\+98|0098|0)[\s-]*9[\s-]*\d{3}[\s-]*\d{3}[\s-]*\d{4}\b/g, '[REDACTED_PHONE]');
  out = out.replace(/[۰-۹٠-٩]{11}/g, '[REDACTED_PHONE]');
```

Note the Persian-digit rule targets an 11-digit run (the canonical
`+989XXXXXXXXX` shape in Persian digits); do NOT add a looser 10-digit rule
that would over-redact ordinary Persian text numbers.

### Step 3: Extend the unit tests

In `telemetry.test.ts`, inside `describe('sanitizeMessage')`, add cases
(each asserts the sensitive value is gone and the marker present):
- `/opt/fast-english/shared/pb_data/storage/xyz/abc.png` and
  `/var/log/caddy/access.log` and `/tmp/fep-e2e-123/x` → `[REDACTED_PATH]`
- `pb_data/storage/abc/rec/file` (relative) → `[REDACTED_PATH]`
- `C:\Users\danial\keys\release.jks` → `[REDACTED_PATH]`
- `+98 912 345 6789` and `+98-912-345-6789` → `[REDACTED_PHONE]`
- `۰۹۱۲۳۴۵۶۷۸۹` and `٠٩١٢٣٤٥٦٧٨٩` → `[REDACTED_PHONE]`
- A benign control: a sentence with a normal number `12345` and the word
  `storage capacity` stays UNREDACTED (no over-redaction).

**Verify**: `npx vitest run app/src/lib/telemetry/telemetry.test.ts` → all pass (existing + new).

## Test plan

- New unit cases in `telemetry.test.ts` (Step 3): paths (absolute,
  relative, Windows), phone variants (spaced/dashed/Persian/Arabic
  digits), over-redaction guard.
- Existing nets: `npx vitest run app/src/lib/telemetry app/src/lib/pocketbase.telemetry.test.ts`,
  `pnpm verify:fast`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `sanitizeMessage` replaces all three path forms and all three phone
      variant groups (read the final regexes)
- [ ] `npx vitest run app/src/lib/telemetry/telemetry.test.ts` passes with
      the new cases
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The server `PATH_PATTERNS` list differs materially from the prefixes in
  Step 1 (report the actual list).
- A new regex over-redacts an existing passing test (e.g. the Persian
  digit rule collides with a fixture) — report the collision instead of
  weakening the existing assertion.

## Maintenance notes

- Keep `redact.ts` in sync with the server's `sanitizeDiagnostics`
  (`content_import_core.pb.js`) — both encode the same privacy contract in
  different runtimes; a shared constants module is a future consolidation
  (out of scope).
- When the beacon is enabled in production, the redaction unit tests are
  the audit trail — any new personal-data shape (addresses, card numbers)
  should land here first.
