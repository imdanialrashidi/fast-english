// app/src/features/payment/types.ts
// Types for the manual payment feature. Mirrors the sanitized response
// shape produced by the custom P1-S1 backend routes. Never trusts the
// raw PB record directly; the runtime validators in `schemas.ts` are
// the source of truth for what comes off the wire.

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Plan {
  /** PocketBase record id of the plan. */
  id: string;
  /** Display name in Persian. */
  name: string;
  /** URL-safe unique slug (informational; not used for selection). */
  slug: string;
  /** Subscription length in days. Backend-managed. */
  durationDays: number;
  /** Subscription price in Toman. Backend-managed integer. */
  priceToman: number;
  /** Whether the plan is offered to students right now. */
  isActive: boolean;
  /** Stable visible order from the backend. */
  displayOrder: number;
  /** Optional marketing copy. */
  description: string;
}

export interface PaymentDestination {
  /** Card number exactly as configured. The student-facing page
   *  formats it for display; this field is the canonical form. */
  cardNumber: string;
  /** Cardholder name on the destination card. */
  cardHolderName: string;
  /** Bank name. */
  bankName: string;
  /** Operator-supplied transfer instructions (may be empty). */
  instructions: string;
  /** Optional support contact text. */
  supportContact: string;
  /** Optional review SLA text shown to the student. */
  reviewSlaText: string;
}

export interface PaymentRequestReceiptRef {
  /** PB record id of the owning payment_request. */
  recordId: string;
  /** Randomized storage filename, set by the server. */
  fileName: string;
  /** Always true: protected file access requires a short-lived token. */
  requiresToken: true;
}

export interface PaymentRequest {
  id: string;
  status: PaymentStatus;
  planId: string;
  planName: string;
  amountToman: number;
  durationDays: number;
  bankReference: string | null;
  senderCardLast4: string | null;
  transferAt: string | null;
  publicRejectionReason: string | null;
  receipt: PaymentRequestReceiptRef;
  created: string | null;
  updated: string | null;
}

export type CurrentRequestResponse =
  | { kind: 'none' }
  | { kind: 'request'; request: PaymentRequest };

export type CreateRequestResponse = CurrentRequestResponse;

export interface CreateRequestInput {
  planId: string;
  receiptFile: File;
  bankReference?: string;
  senderCardLast4?: string;
  transferAt?: string;
}

/**
 * The server-issued entitlement summary returned by the free-activation
 * route. `source === 'free'` is the server-authoritative marker; the
 * amount snapshot is always 0 toman.
 */
export interface FreeSubscription {
  id: string;
  planId: string;
  planName: string;
  durationDays: number;
  amountToman: number;
  startsAt: string;
  expiresAt: string;
  status: string;
  source: string;
}

/**
 * Free-activation response: `activated` when the server created the
 * entitlement in this call, `already_entitled` when the user already
 * held a VALID entitlement (repeated/concurrent calls — idempotent),
 * and `free_period_ended` when the user's one free period has already
 * been consumed and is no longer valid — a terminal honest state, never
 * a silent success.
 */
export type FreeActivationResponse =
  | { kind: 'activated'; subscription: FreeSubscription }
  | { kind: 'already_entitled'; subscription: FreeSubscription }
  | { kind: 'free_period_ended'; subscription: FreeSubscription };

export interface FreeActivationInput {
  planId: string;
}

// Internal error model surfaced to the UI. Always carries a Persian
// message that the UI can show directly; the raw error is never
// exposed. The numeric `status` is preserved only for test assertions
// and is not used as a UI control.
export interface PaymentErrorShape {
  code: string;
  message: string;
  status: number;
}

export class PaymentError extends Error implements PaymentErrorShape {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'PaymentError';
  }
}
