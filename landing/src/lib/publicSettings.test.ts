// landing/src/lib/publicSettings.test.ts
// Business Configuration slice — public settings parse/validate contract.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPublicSettings,
  isContactUrl,
  parsePublicSettings,
  resetPublicSettingsCache,
} from './publicSettings';

const validPayload = {
  plans: [
    {
      id: 'r1',
      name: 'ماهانه',
      slug: 'monthly',
      durationDays: 30,
      priceToman: 299000,
      displayOrder: 1,
      description: '',
    },
    {
      id: 'r2',
      name: 'سه ماهه',
      slug: 'quarterly',
      durationDays: 90,
      priceToman: 807300,
      displayOrder: 2,
      description: 'معادل ۱۰٪ تخفیف',
    },
  ],
  support: { supportContact: 'https://t.me/fep' },
  payment: { cardTransferEnabled: true },
};

describe('parsePublicSettings', () => {
  it('parses the canonical payload', () => {
    const parsed = parsePublicSettings(validPayload);
    expect(parsed).not.toBeNull();
    expect(parsed?.plans).toHaveLength(2);
    expect(parsed?.plans[0].priceToman).toBe(299000);
    expect(parsed?.support.supportContact).toBe('https://t.me/fep');
    expect(parsed?.payment.cardTransferEnabled).toBe(true);
  });

  it('card transfer is DISABLED when the payment object is absent, malformed or false', () => {
    // Absent (older/partial payload): the Landing must never claim
    // card-to-card works when the endpoint does not confirm it.
    expect(parsePublicSettings({ plans: [], support: {} })?.payment.cardTransferEnabled).toBe(
      false,
    );
    expect(
      parsePublicSettings({ plans: [], support: {}, payment: { cardTransferEnabled: false } })
        ?.payment.cardTransferEnabled,
    ).toBe(false);
    expect(
      parsePublicSettings({ plans: [], support: {}, payment: { cardTransferEnabled: 'yes' } })
        ?.payment.cardTransferEnabled,
    ).toBe(false);
    expect(
      parsePublicSettings({ plans: [], support: {}, payment: {} })?.payment.cardTransferEnabled,
    ).toBe(false);
  });

  it('accepts an empty support contact (honest unset state)', () => {
    const parsed = parsePublicSettings({
      plans: [],
      support: { supportContact: '' },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.support.supportContact).toBe('');
  });

  it('rejects malformed payloads', () => {
    expect(parsePublicSettings(null)).toBeNull();
    expect(parsePublicSettings({})).toBeNull();
    expect(parsePublicSettings({ plans: 'nope', support: {} })).toBeNull();
    expect(parsePublicSettings({ plans: [{ name: 'x' }], support: {} })).toBeNull();
    expect(
      parsePublicSettings({
        plans: [{ name: 'x', slug: 's', durationDays: '30', priceToman: 1, displayOrder: 1 }],
        support: {},
      }),
    ).toBeNull();
  });
});

describe('isContactUrl', () => {
  it('accepts http(s)/mailto/tel', () => {
    expect(isContactUrl('https://t.me/fep')).toBe(true);
    expect(isContactUrl('mailto:support@example.com')).toBe(true);
    expect(isContactUrl('tel:+989120000000')).toBe(true);
  });
  it('rejects free text and empty values', () => {
    expect(isContactUrl('')).toBe(false);
    expect(isContactUrl(null)).toBe(false);
    expect(isContactUrl('0912 345 6789')).toBe(false);
    expect(isContactUrl('t.me/fep')).toBe(false);
  });
});

describe('fetchPublicSettings', () => {
  beforeEach(() => {
    resetPublicSettingsCache();
    vi.unstubAllGlobals();
  });

  it('returns parsed settings on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => validPayload,
      }),
    );
    const settings = await fetchPublicSettings();
    expect(settings?.plans[0].priceToman).toBe(299000);
  });

  it('returns null on HTTP failure and on invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchPublicSettings()).toBeNull();
    resetPublicSettingsCache();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plans: 1 }) }),
    );
    expect(await fetchPublicSettings()).toBeNull();
  });

  it('returns null when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchPublicSettings()).toBeNull();
  });
});
