// shared/lib/apiError.test.ts
// The envelope contract: every thrown value family (SDK error, raw
// fetch error, PB field error, garbage) normalizes to a safe envelope
// and never throws.

import { describe, expect, it } from 'vitest';
import { extractApiError, isErrorCode } from './apiError';

describe('extractApiError', () => {
  it('extracts the SDK error envelope ({ status, response: body, data: body })', () => {
    const err = {
      status: 409,
      response: { code: 'pending_request_exists', message: 'Already pending.' },
      data: { code: 'pending_request_exists', message: 'Already pending.' },
      cause: { url: 'http://x/api/...', status: 409, data: { code: 'pending_request_exists' } },
      name: 'ClientResponseError 409',
      message: 'Already pending.',
    };
    expect(extractApiError(err)).toEqual({
      status: 409,
      code: 'pending_request_exists',
      message: 'Already pending.',
    });
  });

  it('extracts the raw-fetch wrapper envelope ({ response: { status, data } })', () => {
    const err = { response: { status: 403, data: { code: 'forbidden', message: 'No' } } };
    expect(extractApiError(err)).toEqual({
      status: 403,
      code: 'forbidden',
      message: 'No',
    });
  });

  it('reads the top-level body envelope ({ status, body })', () => {
    const err = { status: 400, body: { code: 'invalid_request', message: 'Bad' } };
    expect(extractApiError(err)).toEqual({
      status: 400,
      code: 'invalid_request',
      message: 'Bad',
    });
  });

  it('tolerates a top-level body without a code', () => {
    const err = { status: 500, body: { message: 'Internal error.' } };
    expect(extractApiError(err).code).toBe('');
    expect(extractApiError(err).message).toBe('Internal error.');
  });

  it('tolerates a string data payload (no crash, empty code)', () => {
    const err = { status: 500, data: 'Internal Server Error' };
    const envelope = extractApiError(err);
    expect(envelope.status).toBe(500);
    expect(envelope.code).toBe('');
  });

  it('falls back to cause and top-level code/message', () => {
    const err = { cause: { code: 'network_down', data: { code: 'network_down' } } };
    expect(extractApiError(err).code).toBe('network_down');
    const withMessage = { message: 'Something went wrong.' };
    expect(extractApiError(withMessage).message).toBe('Something went wrong.');
  });

  it('returns an empty envelope for thrown strings, null, undefined and plain objects', () => {
    expect(extractApiError('boom')).toEqual({});
    expect(extractApiError(null)).toEqual({});
    expect(extractApiError(undefined)).toEqual({});
    expect(extractApiError(42)).toEqual({});
    // Error objects keep their message (matching the payment extractor).
    expect(extractApiError(new Error('plain'))).toEqual({ code: '', message: 'plain' });
  });

  it('never throws on weird shapes', () => {
    expect(() => extractApiError(Symbol('x'))).not.toThrow();
    expect(() => extractApiError({ response: 'not an object' })).not.toThrow();
  });
});

describe('isErrorCode', () => {
  it('matches the extracted code', () => {
    expect(
      isErrorCode(
        { response: { data: { code: 'subscription_required' } } },
        'subscription_required',
      ),
    ).toBe(true);
    expect(
      isErrorCode({ response: { data: { code: 'subscription_required' } } }, 'account_suspended'),
    ).toBe(false);
  });
});
