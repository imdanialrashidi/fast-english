// app/src/features/payment/api.ts
// Typed wrappers around the P1-S1 custom payment routes. Returns
// parsed/validated data; throws PaymentError on any failure.
//
// CRITICAL: the receipt POST sends only the documented fields. Never
// include user, status, amount, duration, plan_name_snapshot, or any
// review/subscription/account field in the FormData. The server
// ignores them anyway, but keeping the client surface minimal is the
// security posture this slice exists to preserve.

import { getPocketBase } from '../../lib/pocketbase';
import {
  CURRENT_REQUEST_PATH,
  DESTINATION_COLLECTION,
  PAYMENT_REQUEST_PATH,
  PLANS_COLLECTION,
  receiptDownloadPath,
} from './constants';
import { toPaymentError } from './errors';
import { currentRequestResponseSchema, paymentDestinationSchema, planListSchema } from './schemas';
import type {
  CreateRequestInput,
  CreateRequestResponse,
  CurrentRequestResponse,
  PaymentDestination,
  Plan,
} from './types';

interface LoadedPlanRecord {
  id: string;
  name: string;
  slug: string;
  duration_days: number;
  price_toman: number;
  is_active: boolean;
  display_order: number;
  description: string;
}

function isLoadedPlanRecord(value: unknown): value is LoadedPlanRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.slug === 'string' &&
    typeof r.duration_days === 'number' &&
    typeof r.price_toman === 'number' &&
    typeof r.is_active === 'boolean'
  );
}

function planFromPbRecord(record: unknown): Plan | null {
  if (!isLoadedPlanRecord(record)) return null;
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    durationDays: record.duration_days,
    priceToman: record.price_toman,
    isActive: record.is_active,
    displayOrder: record.display_order ?? 0,
    description: record.description ?? '',
  };
}

function destinationFromPbRecord(record: unknown): PaymentDestination | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  if (
    typeof r.card_number !== 'string' ||
    typeof r.card_holder_name !== 'string' ||
    typeof r.bank_name !== 'string'
  ) {
    return null;
  }
  return {
    cardNumber: r.card_number,
    cardHolderName: r.card_holder_name,
    bankName: r.bank_name,
    instructions: typeof r.instructions === 'string' ? r.instructions : '',
    supportContact: typeof r.support_contact === 'string' ? r.support_contact : '',
    reviewSlaText: typeof r.review_sla_text === 'string' ? r.review_sla_text : '',
  };
}

/**
 * Load all currently active plans. The PB list rule is the
 * authoritative filter (`is_active = true`); we still pass the same
 * filter for clarity. Throws PaymentError on any failure.
 */
export async function loadActivePlans(signal?: AbortSignal): Promise<Plan[]> {
  const pb = getPocketBase();
  try {
    const records = await pb.collection(PLANS_COLLECTION).getFullList({
      filter: 'is_active = true',
      sort: 'display_order,price_toman',
      signal,
    });
    const mapped: Plan[] = [];
    for (const rec of records) {
      const p = planFromPbRecord(rec);
      if (p) mapped.push(p);
    }
    const parsed = planListSchema.safeParse(mapped);
    if (!parsed.success) return mapped;
    return parsed.data;
  } catch (err) {
    throw toPaymentError(err);
  }
}

/**
 * Load the active payment destination. The collection holds at most
 * one active row; we ask PB for one record. If none is active the
 * call returns an empty list and we surface a structured
 * "unavailable" error.
 */
export async function loadActiveDestination(signal?: AbortSignal): Promise<PaymentDestination> {
  const pb = getPocketBase();
  try {
    const records = await pb.collection(DESTINATION_COLLECTION).getList(1, 1, {
      filter: 'is_active = true',
      signal,
    });
    if (!records.items || records.items.length === 0) {
      throw destinationUnavailable();
    }
    const dest = destinationFromPbRecord(records.items[0]);
    if (!dest) {
      throw destinationUnavailable();
    }
    const parsed = paymentDestinationSchema.safeParse(dest);
    if (!parsed.success) {
      // Server schema drift; do not leak raw data.
      throw destinationUnavailable();
    }
    return parsed.data;
  } catch (err) {
    throw toPaymentError(err);
  }
}

function destinationUnavailable(): Error {
  const err = new Error('payment_destination_unavailable');
  // Shape like a PB 404 with the canonical code so the error
  // mapper's normal status-based path lands on the right Persian
  // message.
  (err as Error & { response?: { status: number; data: { code: string } } }).response = {
    status: 404,
    data: { code: 'payment_destination_unavailable' },
  };
  return err;
}

/**
 * Load the current request for the authenticated user. Returns
 * { kind: 'none' } if the user has no current request.
 */
export async function loadCurrentRequest(signal?: AbortSignal): Promise<CurrentRequestResponse> {
  const pb = getPocketBase();
  try {
    const res = await pb.send(CURRENT_REQUEST_PATH, {
      method: 'GET',
      signal,
    });
    const parsed = currentRequestResponseSchema.safeParse(res);
    if (!parsed.success) {
      throw new Error('unexpected');
    }
    return parsed.data;
  } catch (err) {
    throw toPaymentError(err);
  }
}

/**
 * Submit a new payment request. Sends only the documented fields in
 * multipart/form-data. The browser generates the boundary; we do
 * NOT set a Content-Type header.
 */
export async function createPaymentRequest(
  input: CreateRequestInput,
  signal?: AbortSignal,
): Promise<CreateRequestResponse> {
  const form = new FormData();
  // Permitted fields only (in this exact order for diff stability):
  form.set('plan_id', input.planId);
  form.set('receipt_file', input.receiptFile, input.receiptFile.name);
  if (input.bankReference?.trim()) {
    form.set('bank_reference', input.bankReference.trim());
  }
  if (input.senderCardLast4 && normalizeLastFour(input.senderCardLast4)) {
    form.set('sender_card_last4', normalizeLastFour(input.senderCardLast4));
  }
  if (input.transferAt?.trim()) {
    form.set('transfer_at', input.transferAt.trim());
  }

  const pb = getPocketBase();
  try {
    const res = await pb.send(PAYMENT_REQUEST_PATH, {
      method: 'POST',
      body: form,
      // No explicit Content-Type — the browser generates the
      // boundary. The PB SDK will set the right header from `body`.
      signal,
    });
    const parsed = currentRequestResponseSchema.safeParse(res);
    if (!parsed.success) {
      throw new Error('unexpected');
    }
    return parsed.data;
  } catch (err) {
    throw toPaymentError(err);
  }
}

function normalizeLastFour(raw: string): string {
  // Mirror the form-schema transform: latin digits only, no spaces.
  return raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '');
}

/**
 * Fetch the owner's protected receipt as a Blob. The route is the
 * dedicated `GET /api/fast-english/payment-requests/{id}/receipt`
 * custom endpoint that requires `fep_users` auth.
 *
 * IMPORTANT: this function uses native `fetch()` because the
 * PocketBase JS SDK 0.27.0 `Client.send()` always calls
 * `response.json()` and cannot return binary data. The auth token
 * is forwarded via the Authorization header. The token is never
 * stored, logged, or put in the URL.
 *
 * The returned Blob is local to the caller — the caller is
 * responsible for `URL.createObjectURL(blob)` and the matching
 * `URL.revokeObjectURL()` when the URL is no longer needed.
 *
 * Errors map through the standard `toPaymentError` pipeline so the
 * UI can show a stable Persian message.
 */
export async function fetchReceiptBlob(
  recordId: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; contentType: string }> {
  const pb = getPocketBase();
  const url = pb.buildURL(receiptDownloadPath(recordId));

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: pb.authStore.token,
        Accept: 'image/jpeg, image/png, image/webp',
      },
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    // Network errors, abort, etc.
    throw toPaymentError(err);
  }

  if (!response.ok) {
    // Try to extract a structured error body for the existing mapper.
    let body: unknown = {};
    try {
      body = await response.json();
    } catch {
      // ignore parse failure — mapper uses status only as fallback
    }
    throw toPaymentError({
      response: {
        status: response.status,
        data: body,
      },
    });
  }

  const contentType = response.headers.get('content-type') ?? '';

  // Reject unexpected Content-Type — the server always returns a
  // known image MIME type on success.
  if (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp') {
    throw toPaymentError({
      response: {
        status: 400,
        data: { code: 'invalid_receipt' },
      },
    });
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (err) {
    throw toPaymentError(err);
  }

  if (blob.size === 0) {
    throw toPaymentError({
      response: {
        status: 500,
        data: { code: 'receipt_unavailable' },
      },
    });
  }

  return { blob, contentType };
}
