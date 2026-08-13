// app/src/lib/auth.test.ts
import { describe, expect, it } from 'vitest';
import { decideRoute, type FepUser, requireAuthRecord, toFepUser } from './auth';

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
describe('auth record mapping (server-authoritative profile)', () => {
  const serverRecord = {
    id: 'rec_123',
    email: '+989121234567@fep.local',
    name: 'دانشجوی ماندگار',
    phone: '+989121234567',
    role: 'student',
    account_status: 'pending_payment',
    placement_completed: false,
    selected_level: '',
    suggested_level: null,
    suspended_reason: '',
  };

  it('maps every authoritative field from the server record', () => {
    expect(toFepUser(serverRecord)).toEqual({
      id: 'rec_123',
      email: '+989121234567@fep.local',
      name: 'دانشجوی ماندگار',
      phone: '+989121234567',
      role: 'student',
      account_status: 'pending_payment',
      placement_completed: false,
      selected_level: '',
      suggested_level: null,
      expanded: serverRecord,
    });
  });

  it('rejects a missing/malformed auth record (never render an empty profile)', () => {
    expect(() => toFepUser(null)).toThrow();
    expect(() => toFepUser(undefined)).toThrow();
    expect(() => toFepUser('not-an-object')).toThrow();
    expect(() => requireAuthRecord([1, 2])).toThrow();
    // A record without an id cannot be authoritative either.
    expect(() => toFepUser({ name: 'بدون شناسه' })).toThrow();
    expect(() => toFepUser({ id: '' })).toThrow();
  });

  it('rejects an authenticated record that is not the record just created', () => {
    // Signup must never fall back to the create response: if the server
    // returns a different authenticated record the session is unreliable
    // and must not be rendered as the signed-up user.
    expect(() => requireAuthRecord({ id: 'rec_other' }, 'rec_123')).toThrow();
    expect(() => requireAuthRecord({ id: 'rec_123' }, 'rec_123')).not.toThrow();
  });
});

describe('decideRoute', () => {
  it('public route always allows', () => {
    expect(decideRoute('public', null, false)).toEqual({ kind: 'allow' });
  });

  it('guest-only redirects authenticated active user without completed placement to /placement', () => {
    const d = decideRoute('guest-only', active, true);
    expect(d).toEqual({ kind: 'redirect', to: '/placement' });
  });

  it('guest-only redirects authenticated active user with completed placement to the Home route', () => {
    const completed: FepUser = { ...active, placement_completed: true, selected_level: 'B1' };
    const d = decideRoute('guest-only', completed, true);
    expect(d).toEqual({ kind: 'redirect', to: '/' });
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

  it('pending-only redirects active user to the Home route', () => {
    const d = decideRoute('pending-only', active, true);
    expect(d).toEqual({ kind: 'redirect', to: '/' });
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
});
