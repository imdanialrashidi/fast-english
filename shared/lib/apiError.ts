// shared/lib/apiError.ts
// One API-error envelope extractor for every surface (Student app,
// Admin app, feature routes). The four pre-consolidation mappers each
// re-implemented the same PocketBase/fetch envelope read with different
// depth; this module is the single normalization, ported exactly from
// the most complete version (app/src/features/payment/errors.ts).
//
// The envelope is shared — the per-feature code→copy tables are not.
// New features should import `extractApiError` and keep their own
// vocabulary. Never throws: any input maps to a safe envelope.

export interface ApiErrorEnvelope {
  /** Numeric HTTP status when known; absent when undetermined. */
  status?: number;
  /** Stable machine-readable code; '' when absent. */
  code?: string;
  /** Raw server message; '' when absent. Never render directly — map it. */
  message?: string;
}

/**
 * Normalize any thrown value into a safe envelope:
 *
 * - SDK errors: `{ status, response: parsedBody }` and the mirror
 *   `{ status, data: parsedBody }` (PocketBase ClientResponseError);
 * - raw fetch responses: `{ response: { status, data: body } }` and
 *   `{ status, body: parsedBody }`;
 * - PocketBase-style field errors: `{ response: { data: { data: {...} } } }`
 *   (the `data` object is read as the body candidate and its `code`
 *   falls back to `e.code`);
 * - anything else (strings, undefined, unrelated objects) → `{}`.
 *
 * `code`/`message` are always strings ('' when absent) so callers can
 * switch on them safely; `status` is omitted when unknown.
 */
export function extractApiError(err: unknown): ApiErrorEnvelope {
  if (!err || typeof err !== 'object') return {};
  const e = err as Record<string, unknown> & {
    response?: { status?: number; data?: unknown; code?: string; message?: string };
    status?: number;
    data?: unknown;
    body?: unknown;
    code?: string;
    message?: string;
    cause?: { code?: string; data?: { code?: string } };
  };

  let status: number | undefined;
  const resp = e.response;
  if (typeof e.status === 'number') {
    status = e.status;
  } else if (resp && typeof resp === 'object' && typeof resp.status === 'number') {
    status = resp.status;
  }

  // Body candidates in priority order:
  //  1. response.data (raw-fetch wrapper nests the parsed body here);
  //  2. response itself when it IS the custom-route body ({ code, message });
  //  3. top-level data (SDK mirror of response);
  //  4. top-level body (raw fetch error).
  let body: Record<string, unknown> | null = null;
  if (resp && typeof resp === 'object') {
    if (resp.data && typeof resp.data === 'object') {
      body = resp.data as Record<string, unknown>;
    } else if (typeof resp.code === 'string') {
      body = resp as unknown as Record<string, unknown>;
    }
  }
  if (!body && e.data && typeof e.data === 'object') {
    body = e.data as Record<string, unknown>;
  }
  if (!body && e.body && typeof e.body === 'object') {
    body = e.body as Record<string, unknown>;
  }

  const code = String(
    (body?.code as string) ??
      (e.code as string) ??
      (e.cause?.code as string) ??
      (e.cause?.data?.code as string) ??
      '',
  );
  const message = String((body?.message as string) ?? (e.message as string) ?? '');

  const envelope: ApiErrorEnvelope = { code, message };
  if (status !== undefined) envelope.status = status;
  return envelope;
}

/**
 * True when the error's stable code equals `code`. Convenience for the
 * `code === '...'` switches the routes use.
 */
export function isErrorCode(err: unknown, code: string): boolean {
  return extractApiError(err).code === code;
}
