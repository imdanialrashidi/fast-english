// admin/src/auth/staffAuth.test.ts
// Staff auth model + guard decisions + AuthStore isolation (Podcast Slice 1).

import { describe, expect, it } from 'vitest';
import { decideStaffRoute, toStaffAdmin } from './staffAuth';

describe('toStaffAdmin', () => {
  it('maps the staff_admins record model', () => {
    const user = toStaffAdmin({
      id: 'rec1',
      email: 'staff@example.com',
      display_name: 'مدیر',
      is_active: true,
      verified: true,
    });
    expect(user).toEqual({
      id: 'rec1',
      email: 'staff@example.com',
      displayName: 'مدیر',
      isActive: true,
      verified: true,
    });
  });

  it('defaults missing fields safely', () => {
    const user = toStaffAdmin({ id: 'rec1' });
    expect(user.isActive).toBe(false);
    expect(user.displayName).toBe('');
    expect(user.email).toBe('');
  });
});

describe('decideStaffRoute', () => {
  it('public always allows', () => {
    expect(decideStaffRoute('public', false)).toEqual({ kind: 'allow' });
    expect(decideStaffRoute('public', true)).toEqual({ kind: 'allow' });
  });

  it('guest-only redirects authenticated Staff to the dashboard', () => {
    expect(decideStaffRoute('guest-only', true)).toEqual({ kind: 'redirect', to: '/' });
    expect(decideStaffRoute('guest-only', false)).toEqual({ kind: 'allow' });
  });

  it('staff-only redirects unauthenticated to the Admin login', () => {
    expect(decideStaffRoute('staff-only', false)).toEqual({ kind: 'redirect', to: '/login' });
    expect(decideStaffRoute('staff-only', true)).toEqual({ kind: 'allow' });
  });
});
