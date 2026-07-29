// app/src/features/payment/errors.test.ts
// Tests for the safe error mapper. Every code path must produce a
// stable, non-leaking Persian message.

import { describe, expect, it } from 'vitest';
import { toPaymentError } from './errors';
import { PaymentError } from './types';

function pbError(status: number, body: { code?: string; message?: string }): unknown {
  return {
    response: { status, data: body },
    status,
  };
}

describe('toPaymentError', () => {
  it('maps 401 to unauthorized', () => {
    const e = toPaymentError(pbError(401, {}));
    expect(e.code).toBe('unauthorized');
    expect(e.status).toBe(401);
  });

  it('maps 403 account_suspended to account_suspended', () => {
    const e = toPaymentError(pbError(403, { code: 'account_suspended' }));
    expect(e.code).toBe('account_suspended');
  });

  it('maps 403 account_not_eligible to account_not_eligible', () => {
    const e = toPaymentError(pbError(403, { code: 'account_not_eligible' }));
    expect(e.code).toBe('account_not_eligible');
  });

  it('maps 404 invalid_plan to invalid_plan', () => {
    const e = toPaymentError(pbError(404, { code: 'invalid_plan' }));
    expect(e.code).toBe('invalid_plan');
  });

  it('maps 404 payment_destination_unavailable', () => {
    const e = toPaymentError(pbError(404, { code: 'payment_destination_unavailable' }));
    expect(e.code).toBe('payment_destination_unavailable');
  });

  it('maps 409 to pending_request_exists', () => {
    const e = toPaymentError(pbError(409, { code: 'pending_request_exists' }));
    expect(e.code).toBe('pending_request_exists');
  });

  it('maps 413 to receipt_too_large', () => {
    const e = toPaymentError(pbError(413, {}));
    expect(e.code).toBe('receipt_too_large');
  });

  it('maps 429 to rate_limited', () => {
    const e = toPaymentError(pbError(429, {}));
    expect(e.code).toBe('rate_limited');
  });

  it('maps invalid_transfer_details on 400 to invalid_transfer_details', () => {
    const e = toPaymentError(pbError(400, { code: 'invalid_transfer_details' }));
    expect(e.code).toBe('invalid_transfer_details');
  });

  it('maps network failure to unavailable', () => {
    const e = toPaymentError(new TypeError('NetworkError when attempting to fetch resource.'));
    expect(e.code).toBe('unavailable');
  });

  it('maps unknown error to unexpected with a safe message', () => {
    const e = toPaymentError(new Error('some raw internal stack trace'));
    expect(e.code).toBe('unexpected');
    // The raw error message must NOT appear in the safe message.
    expect(e.message).not.toContain('raw internal stack trace');
  });

  it('never leaks a non-Persian message in the user-facing copy', () => {
    const e = toPaymentError(pbError(500, { message: 'database is on fire' }));
    expect(e.message).not.toContain('database is on fire');
  });

  it('returns the same instance when given a PaymentError', () => {
    const original = new PaymentError('test', 'invalid_plan', 404);
    expect(toPaymentError(original)).toBe(original);
  });
});
