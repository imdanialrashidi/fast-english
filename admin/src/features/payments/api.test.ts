// admin/src/features/payments/api.test.ts
// Wire-level contract tests for the operator API client: what the client
// sends (URL, params, JSON bodies) and how errors surface. Public and
// internal notes must travel in separate fields — a regression gate for
// the Student-visibility separation.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, approveRequest, fetchDetail, fetchQueue, rejectRequest } from './api';

vi.mock('../../auth/pocketbase', () => ({
  getPocketBase: () => ({ baseUrl: 'http://pb.test' }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('operator API client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchQueue sends page/perPage/status/search as query params', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ page: 1, perPage: 20, totalItems: 0, totalPages: 1, items: [] }),
    );
    await fetchQueue('tok', { page: 2, perPage: 20, status: 'pending', search: 'QA-PEND' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://pb.test/api/fast-english/operator/payment-requests?page=2&perPage=20&status=pending&search=QA-PEND',
    );
    expect(init.headers.authorization).toBe('tok');
  });

  it('fetchQueue omits default status and empty search', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ page: 1, perPage: 20, totalItems: 0, totalPages: 1, items: [] }),
    );
    await fetchQueue('tok', { page: 1, perPage: 20 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://pb.test/api/fast-english/operator/payment-requests?page=1&perPage=20');
  });

  it('rejectRequest sends public reason and internal note as separate fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ kind: 'rejected', paymentRequestId: 'r1' }));
    await rejectRequest('tok', 'r1', 'رسید نامشخص است', 'نکتهٔ داخلی');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/payment-requests/r1/reject');
    const body = JSON.parse(init.body as string);
    // The Student-visible field and the internal note must never merge.
    expect(body.public_rejection_reason).toBe('رسید نامشخص است');
    expect(body.internal_note).toBe('نکتهٔ داخلی');
    expect(Object.keys(body).sort()).toEqual(['internal_note', 'public_rejection_reason']);
  });

  it('approveRequest sends only the internal note', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ kind: 'approved', startsAt: 's', expiresAt: 'e', paymentRequestId: 'r1' }),
    );
    await approveRequest('tok', 'r1', 'نکتهٔ داخلی');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ internal_note: 'نکتهٔ داخلی' });
  });

  it('maps non-ok responses to ApiError with status + code, never raw text', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'request_not_pending', message: 'Conflict!' }, 409),
    );
    try {
      await approveRequest('tok', 'r1');
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('request_not_pending');
    }
  });

  it('fetchDetail hits the detail route', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'r1' }));
    await fetchDetail('tok', 'r1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://pb.test/api/fast-english/operator/payment-requests/r1');
  });
});
