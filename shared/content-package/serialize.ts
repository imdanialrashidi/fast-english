// shared/content-package/serialize.ts
// Podcast Slice 3 — bounded, sanitized diagnostic serialization.
//
// Audit records and API responses must never contain secrets (tokens,
// passwords), storage paths or unbounded payloads. `sanitizeDiagnostics`
// is the single gate applied before diagnostics are written into
// content_imports.error_json or returned by the CLI/API.

import type { ContentDiagnostic } from './types.ts';

const SECRET_PATTERNS: readonly RegExp[] = [
  /password/i,
  /authorization/i,
  /bearer\s+[a-z0-9._-]{8,}/i,
  /token/i,
  /pocketbase_encryption_key/i,
];

const PATH_PATTERNS: readonly RegExp[] = [
  /\/var\//,
  /\/tmp\//,
  /\/home\//,
  /storage\//,
  /pb_data/,
  /[A-Za-z]:\\/,
];

const MAX_DIAGNOSTICS = 50;
const MAX_MESSAGE_CHARS = 500;

/**
 * Returns a copy of the diagnostics that is safe to persist or expose:
 *   - bounded count and message length;
 *   - values that look like secrets (password/authorization/token
 *     contexts) or filesystem paths are replaced with a fixed marker;
 *   - every entry is a plain object with only {code, severity, path,
 *     message, suggestion}.
 */
export function sanitizeDiagnostics(
  diagnostics: readonly ContentDiagnostic[],
): ContentDiagnostic[] {
  return diagnostics.slice(0, MAX_DIAGNOSTICS).map((entry) => {
    const clean = (value: string | undefined): string | undefined => {
      if (!value) return value;
      let out = value.slice(0, MAX_MESSAGE_CHARS);
      if (SECRET_PATTERNS.some((p) => p.test(out)) || PATH_PATTERNS.some((p) => p.test(out))) {
        out = '[REDACTED]';
      }
      return out;
    };
    return {
      code: String(entry.code).slice(0, 80),
      severity:
        entry.severity === 'warning' || entry.severity === 'info' ? entry.severity : 'error',
      path: clean(entry.path) ?? '',
      message: clean(entry.message) ?? '',
      ...(entry.suggestion ? { suggestion: clean(entry.suggestion) } : {}),
    };
  });
}
