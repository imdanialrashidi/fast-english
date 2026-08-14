// app/src/lib/telemetry/redact.ts
// Pure privacy-redaction helpers for the telemetry boundary.
//
// Contract: telemetry payloads must never contain passwords, auth tokens,
// receipt data, private lesson media URLs, phone numbers, names, emails or
// raw sensitive request payloads. Everything entering an event passes
// through these helpers; the tests in telemetry.test.ts enforce the
// contract mechanically.

/** Static path segments that are kept verbatim (anything else that looks
 *  like a record id is replaced with `:id`). */
const STATIC_SEGMENTS = new Set([
  'api',
  'fast-english',
  'collections',
  'records',
  'lessons',
  'lesson',
  'library',
  'progress',
  'account',
  'payment',
  'payment-requests',
  'payments',
  'placement',
  'attempts',
  'attempt',
  'answer',
  'answers',
  'submit',
  'start',
  'dashboard',
  'continue',
  'summary',
  'artwork',
  'hero',
  'sample',
  'demo',
  'vocabulary',
  'category',
  'categories',
  'topics',
  'topic',
  'episodes',
  'episode',
  'files',
  'auth-with-password',
  'auth-refresh',
  'health',
  'settings',
  'plans',
  'plan',
  'operator',
  'fep_users',
  'content-import',
  'content-imports',
  'plan',
  'execute',
  'selected-level',
  'request',
  'requests',
  'approve',
  'reject',
  'review',
  'batch',
  'oauth2',
  'level',
  'levels',
  'progress',
]);

/** Looks like a PocketBase record id (15-char lowercase alnum, or a
 *  short numeric id) without being a static route segment. */
function looksLikeId(segment: string): boolean {
  if (STATIC_SEGMENTS.has(segment)) return false;
  return /^[a-zA-Z0-9_-]{6,64}$/.test(segment);
}

/**
 * Redact an API path: strips the query string entirely (short-lived file
 * tokens and pagination live there) and replaces record-id-looking
 * segments with `:id`.
 */
export function redactPath(path: string): string {
  const withoutQuery = String(path).split('?')[0] ?? '';
  const segments = withoutQuery.split('/');
  const redacted = segments.map((seg) => (looksLikeId(seg) ? ':id' : seg));
  return redacted.join('/');
}

/** Replace credential-shaped fragments (tokens, Authorization values) in
 *  free-text messages and stacks. Personal-data shapes (Iranian mobile
 *  numbers, emails) are redacted too — error messages must never carry
 *  the user's phone/name/email into telemetry. */
export function sanitizeMessage(text: string): string {
  let out = String(text ?? '');
  // Token values: ?token=... / &token=... / bare token=... in free text.
  out = out.replace(
    /(?:token|authToken|access_token|refresh_token)=[^&\s"']+/gi,
    'token=[REDACTED]',
  );
  // Bearer tokens.
  out = out.replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._~-]+/gi, '$1[REDACTED]');
  // JWT-ish blobs.
  out = out.replace(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    '[REDACTED_TOKEN]',
  );
  // Filesystem paths (server error text, dev-machine stacks, storage
  // layout). Superset of the server sanitizer's PATH_PATTERNS
  // (content_import_core.pb.js): /var/, /tmp/, /home/, storage/,
  // pb_data, drive letters — plus the standard FHS prefixes, the
  // production layout /opt/fast-english, and bare data/ relative paths.
  // The tail stops at whitespace, quotes, angle brackets, parens or
  // square brackets (stack-trace safe).
  out = out.replace(
    /(?:\/opt|\/var|\/tmp|\/home|\/usr|\/etc|\/root|\/srv|\/app)(?:\/[^\s"'<>()[\]]*)?|\b(?:pb_data|storage|data)\/[^\s"'<>()[\]]*|[A-Za-z]:\\[^\s"'<>()[\]]*/g,
    '[REDACTED_PATH]',
  );
  // Iranian mobile numbers: compact ASCII, spaced/dashed ASCII, and
  // Persian/Arabic-digit forms (error copy can carry any shape).
  out = out.replace(/(?:\+98|0098|0)9\d{9}\b/g, '[REDACTED_PHONE]');
  out = out.replace(
    /(?:\+98|0098|0)[\s-]*9[\s-]*\d{2}[\s-]*\d{3}[\s-]*\d{4}\b/g,
    '[REDACTED_PHONE]',
  );
  out = out.replace(/[۰-۹٠-٩]{11}/g, '[REDACTED_PHONE]');
  // Emails.

  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');
  // Long random-looking strings that may be file tokens / nonces.
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[REDACTED]');
  return out;
}

/** Truncate long free text (stacks) to a bounded size. */
export function truncate(text: string, maxLength = 2000): string {
  const t = String(text ?? '');
  return t.length > maxLength ? `${t.slice(0, maxLength)}…` : t;
}
