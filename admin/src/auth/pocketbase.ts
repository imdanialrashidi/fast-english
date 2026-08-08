// admin/src/auth/pocketbase.ts
// Staff PocketBase client — a separate instance with its own AuthStore
// (Podcast Slice 1 auth-storage isolation).
//
// The Student and Admin applications run on different origins, so each
// origin maintains its own session anyway; this module makes the
// separation explicit and testable:
//   - a distinct client instance per build (never a shared singleton);
//   - a dedicated localStorage key (`fep_staff_auth`) so Admin never
//     reads or writes the Student `pocketbase_auth` storage;
//   - token refresh always targets the `staff_admins` collection via
//     `pb.collection(STAFF_COLLECTION).authRefresh()`.
import PocketBase, { LocalAuthStore } from 'pocketbase';
import { resolveApiOrigin } from '../../../shared/lib/apiOrigin';

export const STAFF_COLLECTION = 'staff_admins';
export const STAFF_AUTH_STORAGE_KEY = 'fep_staff_auth';

let cachedClient: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (cachedClient) return cachedClient;
  const { origin } = resolveApiOrigin();
  cachedClient = new PocketBase(origin, new LocalAuthStore(STAFF_AUTH_STORAGE_KEY));
  return cachedClient;
}

// For tests: reset the cached client.
export function _resetStaffPocketBaseForTests(): void {
  cachedClient = null;
}
