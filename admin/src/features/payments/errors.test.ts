// admin/src/features/payments/errors.test.ts
// Regression gates for the safe operator error mapping: every failure
// class maps to a stable Persian message; raw server text / PB internals
// never reach the UI; stale-conflict detection drives the refresh flow.

import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { isMissingReceipt, isStaleConflict, OP_ERROR, toOperatorError } from './errors';

describe('operator error mapping', () => {
  it('maps unauthorized to a stable Persian session message', () => {
    const err = toOperatorError(new ApiError(401, 'unauthorized', 'Authentication required.'));
    expect(err.code).toBe(OP_ERROR.unauthorized);
    expect(err.message).toContain('نشست شما منقضی شده');
    expect(err.message).not.toContain('Authentication');
  });

  it('maps forbidden to an operator-only message and never leaks details', () => {
    const err = toOperatorError(new ApiError(403, 'operator_access_denied', 'Access denied.'));
    expect(err.code).toBe(OP_ERROR.forbidden);
    expect(err.message).toContain('مدیریت');
    expect(err.message).not.toContain('Access denied');
  });

  it('maps request-not-found to a safe not-found message', () => {
    const err = toOperatorError(new ApiError(404, 'request_not_found', 'Not found.'));
    expect(err.code).toBe(OP_ERROR.requestNotFound);
    expect(err.message).not.toContain('Not found');
  });

  it('maps any other 404 (receipt route) to receipt-unavailable', () => {
    const err = toOperatorError(new ApiError(404, 'not_found', 'Not found.'));
    expect(err.code).toBe(OP_ERROR.receiptUnavailable);
  });

  it('maps stale 409 conflicts to already-decided and flags them', () => {
    for (const code of ['request_not_pending', 'approval_conflict', 'subscription_conflict']) {
      const err = new ApiError(409, code, 'Conflict');
      expect(isStaleConflict(err), code).toBe(true);
      const mapped = toOperatorError(err);
      expect(mapped.code).toBe(OP_ERROR.alreadyDecided);
      expect(mapped.message).toContain('قبلاً بررسی شده');
      expect(mapped.message).not.toContain('Conflict');
    }
  });

  it('keeps student-suspended distinct from a stale decision', () => {
    const err = new ApiError(409, 'student_suspended', 'Student suspended');
    expect(isStaleConflict(err)).toBe(false);
    const mapped = toOperatorError(err);
    expect(mapped.code).toBe(OP_ERROR.studentSuspended);
    expect(mapped.message).toContain('معلق');
  });

  it('maps rate limiting, timeout and network failures', () => {
    expect(toOperatorError(new ApiError(429, 'rate_limited', 'Too many')).code).toBe(
      OP_ERROR.rateLimited,
    );
    expect(toOperatorError(new ApiError(408, 'timeout', 't')).code).toBe(OP_ERROR.timeout);
    expect(toOperatorError(new ApiError(504, 'timeout', 't')).code).toBe(OP_ERROR.timeout);
    const network = new TypeError('Failed to fetch');
    expect(toOperatorError(network).code).toBe(OP_ERROR.unavailable);
  });

  it('maps unknown errors to a generic message without leaking input', () => {
    const weird = {
      response: { data: { code: 'internal_error', message: 'sqlite: table locked' } },
    };
    const mapped = toOperatorError(weird);
    expect(mapped.code).toBe(OP_ERROR.unexpected);
    expect(mapped.message).not.toContain('sqlite');
  });

  it('carries the requestId as a support code only', () => {
    const err = toOperatorError(new ApiError(404, 'request_not_found', 'nf'), 'req-123');
    expect(err.requestId).toBe('req-123');
    // The support code must never be embedded into the visible message.
    expect(err.message).not.toContain('req-123');
  });

  it('detects missing receipts (404) as a normal state, not an error', () => {
    expect(isMissingReceipt(new ApiError(404, 'not_found', 'nf'))).toBe(true);
    expect(isMissingReceipt(new ApiError(500, 'unexpected_error', 'x'))).toBe(false);
    expect(isMissingReceipt(new TypeError('Failed to fetch'))).toBe(false);
  });
});
