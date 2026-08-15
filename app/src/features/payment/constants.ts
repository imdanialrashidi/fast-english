// app/src/features/payment/constants.ts
// Constants shared across the payment feature. Server-side limits are
// mirrored here ONLY for client-side UX validation; the server remains
// authoritative.

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed MIME types for the receipt. The server also enforces the
// signature (first bytes of the file) — the client check is UX only.
export const ALLOWED_RECEIPT_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

// Custom route paths. Kept in one place so test code and components
// share the exact strings.
export const PAYMENT_REQUEST_PATH = '/api/fast-english/payment-requests';
export const CURRENT_REQUEST_PATH = '/api/fast-english/payment-requests/current';
// Server-authoritative FREE plan activation (price_toman === 0).
export const FREE_ACTIVATE_PATH = '/api/fast-english/subscriptions/free-activate';
// Secure owner-only receipt download. The path parameter is the
// payment_request record id. The route requires `fep_users` auth
// and an ownership check; cross-user access is rejected.
export const RECEIPT_DOWNLOAD_PATH_PREFIX = '/api/fast-english/payment-requests/';
export const RECEIPT_DOWNLOAD_PATH_SUFFIX = '/receipt';

export function receiptDownloadPath(recordId: string): string {
  return `${RECEIPT_DOWNLOAD_PATH_PREFIX}${encodeURIComponent(recordId)}${RECEIPT_DOWNLOAD_PATH_SUFFIX}`;
}

// Collection names. Used by the PB SDK to load plans and the active
// destination through the standard record-CRUD list endpoint. The
// server's `listRule = "is_active = true"` on both collections is
// the canonical filter; we still pass the same filter here so the
// SDK's expected query is explicit.
export const PLANS_COLLECTION = 'plans';
export const DESTINATION_COLLECTION = 'payment_destination';
