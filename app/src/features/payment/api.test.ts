// app/src/features/payment/api.test.ts
// Focused tests for the payment API client. The PB SDK is mocked so
// we can assert what the client sends to the wire without requiring
// a live PB instance.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_REQUEST_PATH, PAYMENT_REQUEST_PATH } from './constants';

interface PbMockShape {
  send: ReturnType<typeof vi.fn>;
  collection: (name: string) => {
    getFullList: ReturnType<typeof vi.fn>;
    getList: ReturnType<typeof vi.fn>;
  };
  files: {
    getToken: ReturnType<typeof vi.fn>;
    getURL: ReturnType<typeof vi.fn>;
  };
}

const pbMock: PbMockShape = {
  send: vi.fn(),
  collection: () => ({
    getFullList: vi.fn(),
    getList: vi.fn(),
  }),
  files: {
    getToken: vi.fn(),
    getURL: vi.fn(),
  },
};

vi.mock('../../lib/pocketbase', () => ({
  getPocketBase: () => pbMock,
}));

// After mocking, make `collection()` return the SAME shared mock
// functions on every call so each test can `mockResolvedValueOnce`
// and observe them.
const collectionMocks: Record<
  string,
  { getFullList: ReturnType<typeof vi.fn>; getList: ReturnType<typeof vi.fn> }
> = {
  plans: { getFullList: vi.fn(), getList: vi.fn() },
  payment_destination: { getFullList: vi.fn(), getList: vi.fn() },
};
pbMock.collection = ((name: string) => {
  const c = collectionMocks[name] ?? { getFullList: vi.fn(), getList: vi.fn() };
  collectionMocks[name] = c;
  return c;
}) as PbMockShape['collection'];

function makeFile(name = 'r.jpg', type = 'image/jpeg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

import {
  createPaymentRequest,
  loadActiveDestination,
  loadActivePlans,
  loadCurrentRequest,
} from './api';

beforeEach(() => {
  pbMock.send.mockReset();
  collectionMocks.plans.getFullList.mockReset();
  collectionMocks.plans.getList.mockReset();
  collectionMocks.payment_destination.getFullList.mockReset();
  collectionMocks.payment_destination.getList.mockReset();
  pbMock.files.getToken.mockReset();
  pbMock.files.getURL.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadActivePlans', () => {
  it('parses a list of PB plan records', async () => {
    collectionMocks.plans.getFullList.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'ماهانه',
        slug: 'monthly',
        duration_days: 30,
        price_toman: 100000,
        is_active: true,
        display_order: 0,
        description: '',
      },
    ]);
    const plans = await loadActivePlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      id: 'p1',
      durationDays: 30,
      priceToman: 100000,
      isActive: true,
    });
  });

  it('passes the active filter to the SDK', async () => {
    collectionMocks.plans.getFullList.mockResolvedValueOnce([]);
    await loadActivePlans();
    const callArgs = collectionMocks.plans.getFullList.mock.calls[0];
    if (!callArgs) throw new Error('expected at least one call');
    expect(callArgs[0].filter).toBe('is_active = true');
  });
});

describe('loadActiveDestination', () => {
  it('returns the parsed destination when one is active', async () => {
    collectionMocks.payment_destination.getList.mockResolvedValueOnce({
      items: [
        {
          id: 'd1',
          card_number: '1234567812345678',
          card_holder_name: 'Ali',
          bank_name: 'Bank',
          instructions: '',
          support_contact: '',
          review_sla_text: '',
          is_active: true,
        },
      ],
      page: 1,
      perPage: 1,
      totalItems: 1,
      totalPages: 1,
    });
    const dest = await loadActiveDestination();
    expect(dest.cardNumber).toBe('1234567812345678');
    expect(dest.cardHolderName).toBe('Ali');
  });

  it('throws a structured PaymentError when no active destination exists', async () => {
    collectionMocks.payment_destination.getList.mockResolvedValueOnce({
      items: [],
      page: 1,
      perPage: 1,
      totalItems: 0,
      totalPages: 0,
    });
    await expect(loadActiveDestination()).rejects.toMatchObject({
      code: 'payment_destination_unavailable',
    });
  });
});

describe('loadCurrentRequest', () => {
  it('returns { kind: "none" } when no current request exists', async () => {
    pbMock.send.mockResolvedValueOnce({ kind: 'none' });
    const r = await loadCurrentRequest();
    expect(r).toEqual({ kind: 'none' });
  });

  it('returns the parsed request when one exists', async () => {
    pbMock.send.mockResolvedValueOnce({
      kind: 'request',
      request: {
        id: 'r1',
        status: 'pending',
        planId: 'p1',
        planName: 'Test',
        amountToman: 1000,
        durationDays: 30,
        bankReference: null,
        senderCardLast4: null,
        transferAt: null,
        publicRejectionReason: null,
        receipt: { recordId: 'r1', fileName: 'x.jpg', requiresToken: true },
        created: null,
        updated: null,
      },
    });
    const r = await loadCurrentRequest();
    expect(r.kind).toBe('request');
  });

  it('uses the documented current path', async () => {
    pbMock.send.mockResolvedValueOnce({ kind: 'none' });
    await loadCurrentRequest();
    const call = pbMock.send.mock.calls[0];
    if (!call) throw new Error('expected at least one call');
    const [path, opts] = call;
    expect(path).toBe(CURRENT_REQUEST_PATH);
    expect(opts.method).toBe('GET');
  });
});

describe('createPaymentRequest', () => {
  it('sends only the documented multipart fields', async () => {
    pbMock.send.mockResolvedValueOnce({ kind: 'request', request: minimalRequest() });
    const file = makeFile('receipt.jpg', 'image/jpeg', 1024);
    await createPaymentRequest({
      planId: 'p1',
      receiptFile: file,
      bankReference: 'REF-1',
      senderCardLast4: '۱۲۳۴',
      transferAt: '2025-01-01T00:00:00.000Z',
    });
    const call = pbMock.send.mock.calls[0];
    if (!call) throw new Error('expected at least one call');
    const [path, opts] = call;
    expect(path).toBe(PAYMENT_REQUEST_PATH);
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    const form = opts.body as FormData;
    // Permitted fields:
    expect(form.get('plan_id')).toBe('p1');
    expect(form.get('bank_reference')).toBe('REF-1');
    expect(form.get('sender_card_last4')).toBe('1234'); // normalised to Latin
    expect(form.get('transfer_at')).toBe('2025-01-01T00:00:00.000Z');
    expect(form.get('receipt_file')).toBeInstanceOf(File);
    // Forbidden fields must NOT be sent:
    for (const forbidden of [
      'user',
      'status',
      'amount',
      'duration',
      'plan_name_snapshot',
      'reviewed_by',
      'reviewed_at',
      'subscription',
      'public_rejection_reason',
      'internal_note',
      'account_status',
      'role',
    ]) {
      expect(form.has(forbidden)).toBe(false);
    }
  });

  it('omits optional empty fields', async () => {
    pbMock.send.mockResolvedValueOnce({ kind: 'request', request: minimalRequest() });
    await createPaymentRequest({
      planId: 'p1',
      receiptFile: makeFile(),
    });
    const call = pbMock.send.mock.calls[0];
    if (!call) throw new Error('expected at least one call');
    const [, opts] = call;
    const form = opts.body as FormData;
    expect(form.has('bank_reference')).toBe(false);
    expect(form.has('sender_card_last4')).toBe(false);
    expect(form.has('transfer_at')).toBe(false);
  });

  it('does not set a manual Content-Type header', async () => {
    pbMock.send.mockResolvedValueOnce({ kind: 'request', request: minimalRequest() });
    await createPaymentRequest({
      planId: 'p1',
      receiptFile: makeFile(),
    });
    const call = pbMock.send.mock.calls[0];
    if (!call) throw new Error('expected at least one call');
    const [, opts] = call;
    // The application code does NOT pin a Content-Type with a
    // hardcoded boundary; the SDK/browser generates it.
    const headers = (opts.headers ?? {}) as Record<string, string>;
    expect(headers['content-type']).toBeUndefined();
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('maps a 409 backend error to pending_request_exists', async () => {
    pbMock.send.mockRejectedValueOnce({
      response: { status: 409, data: { code: 'pending_request_exists' } },
    });
    await expect(
      createPaymentRequest({ planId: 'p1', receiptFile: makeFile() }),
    ).rejects.toMatchObject({ code: 'pending_request_exists' });
  });

  it('maps a 413 backend error to receipt_too_large', async () => {
    pbMock.send.mockRejectedValueOnce({
      response: { status: 413, data: { code: 'receipt_too_large' } },
    });
    await expect(
      createPaymentRequest({ planId: 'p1', receiptFile: makeFile() }),
    ).rejects.toMatchObject({ code: 'receipt_too_large' });
  });

  it('maps a 429 backend error to rate_limited', async () => {
    pbMock.send.mockRejectedValueOnce({
      response: { status: 429, data: { code: 'rate_limited' } },
    });
    await expect(
      createPaymentRequest({ planId: 'p1', receiptFile: makeFile() }),
    ).rejects.toMatchObject({ code: 'rate_limited' });
  });
});

function minimalRequest() {
  return {
    id: 'r1',
    status: 'pending' as const,
    planId: 'p1',
    planName: 'Test',
    amountToman: 1000,
    durationDays: 30,
    bankReference: null,
    senderCardLast4: null,
    transferAt: null,
    publicRejectionReason: null,
    receipt: { recordId: 'r1', fileName: 'x.jpg', requiresToken: true as const },
    created: null,
    updated: null,
  };
}
