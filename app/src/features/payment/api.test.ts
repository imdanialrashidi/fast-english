// app/src/features/payment/api.test.ts
// Focused tests for the payment API client. The PB SDK is mocked so
// we can assert what the client sends to the wire without requiring
// a live PB instance.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_REQUEST_PATH, PAYMENT_REQUEST_PATH, receiptDownloadPath } from './constants';

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
  buildURL: ReturnType<typeof vi.fn>;
  authStore: { token: string };
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
  buildURL: vi.fn(),
  authStore: { token: 'test-auth-token' },
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
  activateFreePlan,
  createPaymentRequest,
  fetchReceiptBlob,
  loadActiveDestination,
  loadActivePlans,
  loadCurrentRequest,
} from './api';

function minimalFreeSubscription() {
  return {
    id: 's1',
    planId: 'fp1',
    planName: 'رایگان',
    durationDays: 30,
    amountToman: 0,
    startsAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-31T00:00:00.000Z',
    status: 'active',
    source: 'free',
  };
}

import { FREE_ACTIVATE_PATH } from './constants';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pbMock.send.mockReset();
  collectionMocks.plans.getFullList.mockReset();
  collectionMocks.plans.getList.mockReset();
  collectionMocks.payment_destination.getFullList.mockReset();
  collectionMocks.payment_destination.getList.mockReset();
  pbMock.files.getToken.mockReset();
  pbMock.files.getURL.mockReset();
  pbMock.buildURL.mockReset();
  pbMock.buildURL.mockImplementation((path: string) => `http://test.local${path}`);
  pbMock.authStore.token = 'test-auth-token';
  fetchSpy = vi.spyOn(globalThis, 'fetch');
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

describe('activateFreePlan', () => {
  it('sends ONLY plan_id to the free-activate route and maps both response kinds', async () => {
    pbMock.send.mockResolvedValueOnce({
      kind: 'activated',
      subscription: minimalFreeSubscription(),
    });
    await activateFreePlan({ planId: 'fp1' });
    const call = pbMock.send.mock.calls[0];
    if (!call) throw new Error('expected at least one call');
    const [path, opts] = call;
    expect(path).toBe(FREE_ACTIVATE_PATH);
    expect(opts.method).toBe('POST');
    // Only the plan id travels to the server — never a client price or
    // a free flag (the server reads the canonical plan record).
    expect(opts.body).toEqual({ plan_id: 'fp1' });

    pbMock.send.mockResolvedValueOnce({
      kind: 'already_entitled',
      subscription: minimalFreeSubscription(),
    });
    const res = await activateFreePlan({ planId: 'fp1' });
    expect(res.kind).toBe('already_entitled');
  });

  it('maps server errors through toPaymentError', async () => {
    pbMock.send.mockRejectedValueOnce(
      Object.assign(new Error('not free'), {
        response: { status: 409, data: { code: 'not_free_plan', message: 'x' } },
      }),
    );
    await expect(activateFreePlan({ planId: 'fp1' })).rejects.toMatchObject({
      code: 'not_free_plan',
    });
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

describe('fetchReceiptBlob', () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  function mockFetchOk(body: Blob): void {
    fetchSpy.mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': body.type },
      }),
    );
  }

  function mockFetchStatus(status: number, body: unknown = {}): void {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('uses native fetch (not pb.send) for the binary receipt', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1');
    // pb.send must NOT be called
    expect(pbMock.send).not.toHaveBeenCalled();
    // native fetch must be called once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('builds the URL through pb.buildURL', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1');
    expect(pbMock.buildURL).toHaveBeenCalledWith(receiptDownloadPath('r1'));
  });

  it('sends the auth token in the Authorization header', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    const [, opts] = call;
    expect(opts?.headers).toMatchObject({ Authorization: 'test-auth-token' });
  });

  it('does not put the token in the URL', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    const [url] = call;
    expect(url).not.toContain('token');
    expect(url).not.toContain('Authorization');
    expect(url).not.toContain('auth');
  });

  it('sets cache: no-store on the fetch', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    const [, opts] = call;
    expect(opts).toMatchObject({ cache: 'no-store' });
  });

  it('sets Accept header to the allowed image MIME types', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    const [, opts] = call;
    expect(opts?.headers).toMatchObject({ Accept: 'image/jpeg, image/png, image/webp' });
  });

  it('returns a Blob for a JPEG response', async () => {
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    const { blob, contentType } = await fetchReceiptBlob('r1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(jpegBytes.length);
    expect(contentType).toBe('image/jpeg');
  });

  it('returns a Blob for a PNG response', async () => {
    mockFetchOk(new Blob([pngBytes], { type: 'image/png' }));
    const { blob, contentType } = await fetchReceiptBlob('r1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(pngBytes.length);
    expect(contentType).toBe('image/png');
  });

  it('returns a Blob for a WebP response', async () => {
    mockFetchOk(new Blob([webpBytes], { type: 'image/webp' }));
    const { blob, contentType } = await fetchReceiptBlob('r1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(webpBytes.length);
    expect(contentType).toBe('image/webp');
  });

  it('rejects an unexpected application/json Content-Type', async () => {
    // A JSON body with 200 is still invalid — Content-Type check runs
    // before Blob read.
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'invalid_receipt' });
  });

  it('rejects an empty Blob', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(new Blob([], { type: 'image/jpeg' }), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    );
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'receipt_unavailable' });
  });

  it('maps a 401 to unauthorized', async () => {
    mockFetchStatus(401);
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('maps a 403 to account_not_eligible', async () => {
    mockFetchStatus(403, { code: 'account_not_eligible' });
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'account_not_eligible' });
  });

  it('maps a 404 to receipt_unavailable', async () => {
    mockFetchStatus(404, { code: 'not_found' });
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'receipt_unavailable' });
  });

  it('maps a 413 to receipt_too_large', async () => {
    mockFetchStatus(413, { code: 'receipt_too_large' });
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'receipt_too_large' });
  });

  it('maps a 429 to rate_limited', async () => {
    mockFetchStatus(429, { code: 'rate_limited' });
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('maps a network error to unavailable', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('maps an AbortError safely (caller-driven cancel → unexpected)', async () => {
    // The error mapper rejects AbortError as a network error and
    // falls through to the generic 'unexpected' code, which is safe
    // (no information leak) because the hook suppresses the error
    // on unmount via the `cancelled` gate.
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchSpy.mockRejectedValueOnce(abortError);
    await expect(fetchReceiptBlob('r1')).rejects.toMatchObject({ code: 'unexpected' });
  });

  it('preserves AbortSignal by forwarding to native fetch', async () => {
    const controller = new AbortController();
    mockFetchOk(new Blob([jpegBytes], { type: 'image/jpeg' }));
    await fetchReceiptBlob('r1', controller.signal);
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    const [, opts] = call;
    expect(opts?.signal).toBe(controller.signal);
  });

  it('encodes non-trivial record ids so the URL is safe', () => {
    // receiptDownloadPath is exported as a pure helper. We assert
    // the id is percent-encoded so a malicious or malformed id
    // cannot escape the path segment.
    const p = receiptDownloadPath('a/b c');
    expect(p).toBe('/api/fast-english/payment-requests/a%2Fb%20c/receipt');
  });
});
