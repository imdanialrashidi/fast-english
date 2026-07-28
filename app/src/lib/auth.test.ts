// app/src/lib/auth.test.ts
import { describe, expect, it } from 'vitest';
import { decideRoute, type FepUser } from './auth';

const active: FepUser = {
  id: '1',
  email: '+989123456789@fep.local',
  name: 'a',
  phone: '+989123456789',
  role: 'student',
  account_status: 'active',
  placement_completed: false,
};
const pending: FepUser = { ...active, account_status: 'pending_payment' };
const suspended: FepUser = { ...active, account_status: 'suspended' };
const operator: FepUser = { ...active, role: 'operator' };

describe('decideRoute', () => {
  it('public route always allows', () => {
    expect(decideRoute('public', null, false)).toEqual({ kind: 'allow' });
  });

  it('guest-only redirects authenticated active user to /dashboard', () => {
    const d = decideRoute('guest-only', active, true);
    expect(d).toEqual({ kind: 'redirect', to: '/dashboard' });
  });

  it('guest-only redirects authenticated pending user to /payment', () => {
    const d = decideRoute('guest-only', pending, true);
    expect(d).toEqual({ kind: 'redirect', to: '/payment' });
  });

  it('guest-only allows unauthenticated visitor', () => {
    const d = decideRoute('guest-only', null, false);
    expect(d).toEqual({ kind: 'allow' });
  });

  it('pending-only redirects unauthenticated to /login', () => {
    expect(decideRoute('pending-only', null, false)).toEqual({
      kind: 'redirect',
      to: '/login',
    });
  });

  it('pending-only allows pending user', () => {
    expect(decideRoute('pending-only', pending, true)).toEqual({ kind: 'allow' });
  });

  it('pending-only allows expired user', () => {
    const expired: FepUser = { ...active, account_status: 'expired' };
    expect(decideRoute('pending-only', expired, true)).toEqual({ kind: 'allow' });
  });

  it('pending-only denies active user', () => {
    const d = decideRoute('pending-only', active, true);
    expect(d).toEqual({ kind: 'redirect', to: '/dashboard' });
  });

  it('active-only redirects unauthenticated to /login', () => {
    expect(decideRoute('active-only', null, false)).toEqual({
      kind: 'redirect',
      to: '/login',
    });
  });

  it('active-only allows active user', () => {
    expect(decideRoute('active-only', active, true)).toEqual({ kind: 'allow' });
  });

  it('active-only redirects pending user to /payment', () => {
    const d = decideRoute('active-only', pending, true);
    expect(d).toEqual({ kind: 'redirect', to: '/payment' });
  });

  it('active-only redirects suspended user to /payment', () => {
    const d = decideRoute('active-only', suspended, true);
    expect(d).toEqual({ kind: 'redirect', to: '/payment' });
  });

  it('operator-only denies unauthenticated', () => {
    expect(decideRoute('operator-only', null, false)).toEqual({
      kind: 'redirect',
      to: '/login',
    });
  });

  it('operator-only denies student', () => {
    const d = decideRoute('operator-only', active, true);
    expect(d).toEqual({ kind: 'deny' });
  });

  it('operator-only allows operator', () => {
    expect(decideRoute('operator-only', operator, true)).toEqual({ kind: 'allow' });
  });

  it('operator-only allows content_manager', () => {
    const cm: FepUser = { ...active, role: 'content_manager' };
    expect(decideRoute('operator-only', cm, true)).toEqual({ kind: 'allow' });
  });
});
