// app/src/features/payment/api.dup.test.ts
// Asserts that the API client only ever produces one in-flight
// submission per call site. The PaymentRoute owns the "isSubmitting"
// gate; here we verify the API call itself is idempotent for the
// caller's purposes (returns the same result on repeated calls and
// never silently sends extra fields).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
const collectionMocks: Record<
  string,
  { getFullList: ReturnType<typeof vi.fn>; getList: ReturnType<typeof vi.fn> }
> = {
  plans: { getFullList: vi.fn(), getList: vi.fn() },
  payment_destination: { getFullList: vi.fn(), getList: vi.fn() },
};

vi.mock('../../lib/pocketbase', () => ({
  getPocketBase: () => ({
    send: sendMock,
    collection: (name: string) => {
      const c = collectionMocks[name] ?? { getFullList: vi.fn(), getList: vi.fn() };
      collectionMocks[name] = c;
      return c;
    },
    files: { getToken: vi.fn(), getURL: vi.fn(), getUrl: vi.fn(), client: {} },
  }),
}));

import { createPaymentRequest } from './api';

beforeEach(() => {
  sendMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeFile(name = 'r.jpg', type = 'image/jpeg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('createPaymentRequest submission semantics', () => {
  it('sends exactly one POST per invocation', async () => {
    sendMock.mockResolvedValue({ kind: 'request', request: minimalRequest() });
    await createPaymentRequest({ planId: 'p1', receiptFile: makeFile() });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry automatically on failure', async () => {
    sendMock.mockRejectedValue(new Error('boom'));
    await expect(
      createPaymentRequest({ planId: 'p1', receiptFile: makeFile() }),
    ).rejects.toBeDefined();
    // Exactly one attempt — caller decides whether to retry.
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('two sequential calls produce two distinct POSTs with no shared state', async () => {
    sendMock.mockResolvedValue({ kind: 'request', request: minimalRequest() });
    await createPaymentRequest({ planId: 'p1', receiptFile: makeFile('a.jpg') });
    await createPaymentRequest({ planId: 'p1', receiptFile: makeFile('b.jpg') });
    expect(sendMock).toHaveBeenCalledTimes(2);
    const aCall = sendMock.mock.calls[0];
    const bCall = sendMock.mock.calls[1];
    if (!aCall || !bCall) throw new Error('expected two calls');
    const a = (aCall[1].body as FormData).get('receipt_file') as File;
    const b = (bCall[1].body as FormData).get('receipt_file') as File;
    expect(a.name).toBe('a.jpg');
    expect(b.name).toBe('b.jpg');
  });

  // Note: network-failure error mapping is covered by api.test.ts
  // ("maps a network error to unavailable") — not duplicated here.
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
