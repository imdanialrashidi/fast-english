// app/src/features/payment/paymentService.ts
// Deep Payment module — owns the journey branching that was scattered
// across PaymentRoute + api + error handling.
//
// The seam is `loadPaymentJourney` + `submitPayment`. The route becomes
// a thin adapter that renders the journey; the module hides SDK/fetch
// mixing, the fake 404 for destination, free-vs-paid branching, and the
// idempotency substring checks. Two adapters already exist (Student App
// + landing public settings); this is the real seam per the design vocab.

import {
  activateFreePlan,
  createPaymentRequest,
  loadActiveDestination,
  loadActivePlans,
  loadCurrentRequest,
} from './api';
import { toPaymentError } from './errors';
import type {
  CreateRequestResponse,
  CurrentRequestResponse,
  FreeActivationResponse,
  PaymentDestination,
  Plan,
} from './types';

export interface PaymentJourney {
  plans: Plan[];
  destination: PaymentDestination | null;
  cardTransferEnabled: boolean;
  current: CurrentRequestResponse;
}

export type PaymentSubmitInput =
  | { kind: 'free'; planId: string }
  | {
      kind: 'paid';
      planId: string;
      receiptFile: File;
      bankReference?: string;
      senderCardLast4?: string;
      transferAt?: string;
    };

export type PaymentSubmitResult =
  | { kind: 'free'; result: FreeActivationResponse }
  | { kind: 'paid'; result: CreateRequestResponse };

/**
 * Load the full payment journey in one call. Mirrors the
 * Promise.allSettled branching that lived in PaymentRoute (fatal plans
 * error vs non-fatal destination unavailable).
 */
export async function loadPaymentJourney(signal?: AbortSignal): Promise<PaymentJourney> {
  const [plansRes, destRes, currentRes] = await Promise.allSettled([
    loadActivePlans(signal),
    loadActiveDestination(signal),
    loadCurrentRequest(signal),
  ]);

  if (plansRes.status === 'rejected') {
    throw toPaymentError(plansRes.reason);
  }
  const plans = plansRes.value;

  let destination: PaymentDestination | null = null;

  if (destRes.status === 'fulfilled') {
    destination = destRes.value;
  } else {
    const e = toPaymentError(destRes.reason);
    if (e.code === 'payment_destination_unavailable') {
      // Non-fatal: card transfer disabled. Free plans still work.
      destination = null;
    } else {
      // Fatal destination error (network / 500) — preserve previous
      // route behavior: show StatePanel error.
      throw e;
    }
  }

  const current: CurrentRequestResponse =
    currentRes.status === 'fulfilled' ? currentRes.value : { kind: 'none' };

  return {
    plans,
    destination,
    cardTransferEnabled: destination !== null,
    current,
  };
}

/**
 * Submit the journey (free vs paid branching + server-side re-check of
 * cardTransferEnabled is still enforced server-side; this only mirrors
 * the client decision).
 */
export async function submitPayment(
  input: PaymentSubmitInput,
  signal?: AbortSignal,
): Promise<PaymentSubmitResult> {
  if (input.kind === 'free') {
    const result = await activateFreePlan({ planId: input.planId }, signal);
    return { kind: 'free', result };
  }
  const result = await createPaymentRequest(
    {
      planId: input.planId,
      receiptFile: input.receiptFile,
      bankReference: input.bankReference,
      senderCardLast4: input.senderCardLast4,
      transferAt: input.transferAt,
    },
    signal,
  );
  return { kind: 'paid', result };
}

/** Pure helper: is the selected plan purchasable given the journey? */
export function isPlanPurchasableInJourney(plan: Plan | null, journey: PaymentJourney): boolean {
  if (!plan) return false;
  if (plan.priceToman === 0) return true;
  return journey.cardTransferEnabled;
}
