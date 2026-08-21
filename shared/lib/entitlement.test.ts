import { describe, expect, it } from 'vitest';
import {
  isStudentEntitled,
  maskPhone,
  scoreToLevel,
  TOTAL_Q,
  validateOptions,
} from './entitlement';

describe('isStudentEntitled', () => {
  const now = Date.now();
  const validSub = [
    {
      starts_at: new Date(now - 1000).toISOString(),
      expires_at: new Date(now + 86400000).toISOString(),
      status: 'active',
    },
  ];
  const expiredSub = [
    {
      starts_at: new Date(now - 86400000 * 2).toISOString(),
      expires_at: new Date(now - 1000).toISOString(),
      status: 'active',
    },
  ];

  it('suspended → account_suspended', () => {
    expect(
      isStudentEntitled(
        { account_status: 'suspended', placement_completed: true, selected_level: 'B1' },
        now,
        validSub,
      ).code,
    ).toBe('account_suspended');
  });

  it('pending_payment → subscription_required', () => {
    expect(
      isStudentEntitled(
        { account_status: 'pending_payment', placement_completed: true, selected_level: 'B1' },
        now,
        validSub,
      ).code,
    ).toBe('subscription_required');
  });

  it('active no sub → subscription_required', () => {
    expect(
      isStudentEntitled(
        { account_status: 'active', placement_completed: true, selected_level: 'B1' },
        now,
        [],
      ).code,
    ).toBe('subscription_required');
  });

  it('active expired sub → subscription_required', () => {
    expect(
      isStudentEntitled(
        { account_status: 'active', placement_completed: true, selected_level: 'B1' },
        now,
        expiredSub,
      ).code,
    ).toBe('subscription_required');
  });

  it('active valid sub but placement incomplete → placement_incomplete', () => {
    expect(
      isStudentEntitled(
        { account_status: 'active', placement_completed: false, selected_level: 'B1' },
        now,
        validSub,
      ).code,
    ).toBe('placement_incomplete');
    expect(
      isStudentEntitled(
        { account_status: 'active', placement_completed: true, selected_level: '' },
        now,
        validSub,
      ).code,
    ).toBe('placement_incomplete');
  });

  it('happy path → ok', () => {
    expect(
      isStudentEntitled(
        { account_status: 'active', placement_completed: true, selected_level: 'A2' },
        now,
        validSub,
      ).ok,
    ).toBe(true);
  });

  it('inactive sub status → not entitled', () => {
    const inactive = [
      {
        starts_at: new Date(now - 1000).toISOString(),
        expires_at: new Date(now + 86400000).toISOString(),
        status: 'expired',
      },
    ];
    expect(
      isStudentEntitled(
        { account_status: 'active', placement_completed: true, selected_level: 'B1' },
        now,
        inactive,
      ).ok,
    ).toBe(false);
  });
});

describe('maskPhone', () => {
  it('masks correctly', () => {
    expect(maskPhone('09123456789')).toBe('09123****9');
    expect(maskPhone('123')).toBe('123');
  });
});

describe('scoreToLevel', () => {
  it('0→A1 … 20→C2', () => {
    expect(scoreToLevel(0)).toBe('A1');
    expect(scoreToLevel(3)).toBe('A1');
    expect(scoreToLevel(4)).toBe('A2');
    expect(scoreToLevel(7)).toBe('A2');
    expect(scoreToLevel(8)).toBe('B1');
    expect(scoreToLevel(11)).toBe('B1');
    expect(scoreToLevel(12)).toBe('B2');
    expect(scoreToLevel(15)).toBe('B2');
    expect(scoreToLevel(16)).toBe('C1');
    expect(scoreToLevel(17)).toBe('C1');
    expect(scoreToLevel(18)).toBe('C2');
    expect(scoreToLevel(20)).toBe('C2');
  });
  it('TOTAL_Q=20', () => {
    expect(TOTAL_Q).toBe(20);
  });
});

describe('validateOptions', () => {
  it('rejects HTML', () => {
    expect(
      validateOptions([
        { id: 'a', text: '<b>hi</b>' },
        { id: 'b', text: 'ok' },
      ]).ok,
    ).toBe(false);
  });
  it('rejects duplicate IDs', () => {
    expect(
      validateOptions([
        { id: 'a', text: '1' },
        { id: 'a', text: '2' },
      ]).ok,
    ).toBe(false);
  });
  it('rejects >6 options', () => {
    const opts = Array.from({ length: 7 }, (_, i) => ({ id: `id${i}`, text: 't' }));
    expect(validateOptions(opts).ok).toBe(false);
  });
  it('accepts valid', () => {
    expect(
      validateOptions([
        { id: 'a', text: '1' },
        { id: 'b', text: '2' },
      ]).ok,
    ).toBe(true);
  });
});
