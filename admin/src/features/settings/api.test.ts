// admin/src/features/settings/api.test.ts
// Business Configuration slice — API client wire contract (paths,
// authorization header, payload shapes).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBusinessPlan,
  fetchBusinessSettings,
  saveBusinessDestination,
  saveBusinessSite,
  updateBusinessPlan,
} from './api';

vi.mock('../../auth/pocketbase', () => ({
  getPocketBase: () => ({ baseUrl: 'http://pb.test' }),
}));

const token = 'staff-token-1';

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchBusinessSettings', () => {
  it('GETs the staff settings endpoint with the staff token', async () => {
    stubFetch(200, { plans: [], destination: null, site: { supportContact: '' } });
    const result = await fetchBusinessSettings(token);
    expect(result).toEqual({ plans: [], destination: null, site: { supportContact: '' } });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/fast-english/staff/business-settings');
    expect(init.headers).toMatchObject({ authorization: token });
  });
});

describe('updateBusinessPlan', () => {
  it('PATCHes snake_case fields on the plan route', async () => {
    stubFetch(200, { plan: { id: 'p1' } });
    await updateBusinessPlan(token, 'p1', { priceToman: 310000, isActive: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/fast-english/staff/business-settings/plans/p1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ price_toman: 310000, is_active: true });
  });
});

describe('createBusinessPlan', () => {
  it('POSTs the full plan payload', async () => {
    stubFetch(200, { plan: { id: 'p2' } });
    await createBusinessPlan(token, {
      name: 'ماهانه',
      slug: 'monthly',
      durationDays: 30,
      priceToman: 299000,
      isActive: true,
      displayOrder: 1,
      description: '',
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/fast-english/staff/business-settings/plans');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ slug: 'monthly', price_toman: 299000, duration_days: 30 });
  });
});

describe('saveBusinessDestination', () => {
  it('PUTs the destination singleton payload', async () => {
    stubFetch(200, { destination: { id: 'd1' } });
    await saveBusinessDestination(token, {
      cardNumber: '6037991234567890',
      cardHolderName: 'T',
      bankName: 'B',
      instructions: 'مبلغ را دقیقاً واریز کنید.',
      reviewSlaText: 'حداکثر تا ۲۴ ساعت',
      supportContact: '',
      isActive: true,
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/fast-english/staff/business-settings/destination');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ card_number: '6037991234567890', is_active: true });
  });
});

describe('saveBusinessSite', () => {
  it('PATCHes the support contact', async () => {
    stubFetch(200, { site: { supportContact: 'https://t.me/fep' } });
    await saveBusinessSite(token, { supportContact: 'https://t.me/fep' });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/fast-english/staff/business-settings/site');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ support_contact: 'https://t.me/fep' });
  });
});

describe('error handling', () => {
  it('throws a structured error envelope on failure', async () => {
    stubFetch(400, { code: 'PRICE_INVALID', message: 'قیمت نامعتبر است.' });
    await expect(updateBusinessPlan(token, 'p1', { priceToman: -1 })).rejects.toThrow(
      /PRICE_INVALID/,
    );
  });
});
