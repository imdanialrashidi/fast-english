// app/src/lib/pocketbase.ts
// Single PocketBase client singleton. Imported by the AuthProvider and
// any feature that needs direct PB access. Never instantiated elsewhere.
import PocketBase from 'pocketbase';
import { resolveApiOrigin } from '../../../shared/lib/apiOrigin';

let cachedClient: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (cachedClient) return cachedClient;
  const { origin } = resolveApiOrigin();
  // The SDK accepts an origin (scheme + host [+ port]) and builds its own
  // `/api/...` paths from it. Do not pass a path like `/api`.
  cachedClient = new PocketBase(origin);
  return cachedClient;
}

// For tests: reset the cached client.
export function _resetPocketBaseForTests(): void {
  cachedClient = null;
}
