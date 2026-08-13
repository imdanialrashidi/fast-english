// app/src/lib/pocketbase.ts
// Single PocketBase client singleton. Imported by the AuthProvider and
// any feature that needs direct PB access. Never instantiated elsewhere.
import PocketBase from 'pocketbase';
import { resolveApiOrigin } from '../../../shared/lib/apiOrigin';
import { reportApiFailure } from './telemetry';

let cachedClient: PocketBase | null = null;

/** Wrap the SDK's send() so important API/network failures are observable
 *  in production without touching request bodies, tokens or 4xx business
 *  errors (see docs/OBSERVABILITY.md). Never changes request behavior. */
export function instrumentSend(client: PocketBase): PocketBase {
  const originalSend = client.send.bind(client);
  client.send = async <T = unknown>(path: string, options?: Record<string, unknown>) => {
    try {
      return await originalSend<T>(path, options as Parameters<typeof originalSend>[1]);
    } catch (err: unknown) {
      // Defensive: the SDK always rejects with an object, but a nullish
      // rejection must never replace the caller's error (the progress 409
      // flow depends on the identical error being rethrown).
      const status =
        err && typeof err === 'object' ? (err as { status?: number }).status : undefined;
      const original = (err as { originalError?: unknown } | null)?.originalError;
      const isNetworkFailure =
        original instanceof TypeError ||
        (typeof original === 'object' && original !== null && 'cause' in original);
      if (isNetworkFailure || (typeof status === 'number' && (status >= 500 || status === 429))) {
        reportApiFailure(
          path,
          String((options as { method?: string } | undefined)?.method ?? 'GET'),
          typeof status === 'number' ? status : 0,
          isNetworkFailure ? 'network' : 'http',
        );
      }
      throw err;
    }
  };
  return client;
}

export function getPocketBase(): PocketBase {
  if (cachedClient) return cachedClient;
  const { origin } = resolveApiOrigin();
  // The SDK accepts an origin (scheme + host [+ port]) and builds its own
  // `/api/...` paths from it. Do not pass a path like `/api`.
  cachedClient = instrumentSend(new PocketBase(origin));
  return cachedClient;
}

// For tests: reset the cached client.
export function _resetPocketBaseForTests(): void {
  cachedClient = null;
}
