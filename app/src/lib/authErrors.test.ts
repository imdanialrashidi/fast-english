// app/src/lib/authErrors.test.ts
import { describe, expect, it } from 'vitest';
import { AuthError, mapAuthError } from './authErrors';

describe('mapAuthError', () => {
  it('returns a Persian error for invalid credentials (400)', () => {
    const err = mapAuthError({ status: 400, message: 'Failed to authenticate.' });
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe('invalid_credentials');
    expect(err.message).toMatch(/اشتباه/);
  });

  it('returns rate-limited message for 429', () => {
    const err = mapAuthError({ status: 429, message: 'Too many requests' });
    expect(err.code).toBe('rate_limited');
    expect(err.message).toMatch(/زیاد/);
  });

  it('returns unavailable for 503', () => {
    const err = mapAuthError({ status: 503, message: 'Service Unavailable' });
    expect(err.code).toBe('unavailable');
  });

  it('maps phone field validation to invalid_phone', () => {
    const err = mapAuthError({
      status: 400,
      response: {
        status: 400,
        data: { data: { phone: { code: 'validation_min_text_constraint' } } },
      },
    });
    expect(err.code).toBe('invalid_phone');
  });

  it('maps password field to password_short', () => {
    const err = mapAuthError({
      status: 400,
      response: {
        status: 400,
        data: { data: { password: { code: 'validation_min_text_constraint' } } },
      },
    });
    expect(err.code).toBe('password_short');
  });

  it('maps account_suspended code to Persian message', () => {
    const err = mapAuthError({ status: 400, code: 'account_suspended' });
    expect(err.code).toBe('account_suspended');
    expect(err.message).toMatch(/تعلیق/);
  });

  it('falls back to unexpected for unknown status', () => {
    const err = mapAuthError({ status: 418 });
    expect(err.code).toBe('unexpected');
  });

  it('does not expose internal server fields in the message', () => {
    const err = mapAuthError({
      status: 500,
      message: 'database column fep_users violates not-null constraint at /pb/hooks',
    });
    // The message should be a generic Persian message, not the raw server error.
    expect(err.message).not.toContain('database');
    expect(err.message).not.toContain('fep_users');
    expect(err.message).not.toContain('/pb/hooks');
  });
});
