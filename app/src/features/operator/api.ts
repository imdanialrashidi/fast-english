// app/src/features/operator/api.ts
// P1-S2 — Operator API client functions.

import { getPocketBase } from '../../lib/pocketbase';
import type {
  ApproveResponse,
  QueueResponse,
  QueueStatusFilter,
  RejectResponse,
  RequestDetail,
} from './types';

function pbUrl(path: string): string {
  const pb = getPocketBase();
  const base = pb.baseUrl ?? '';
  return `${base}${path}`;
}

export async function fetchQueue(
  token: string,
  params: {
    page?: number;
    perPage?: number;
    status?: QueueStatusFilter;
    search?: string;
  } = {},
): Promise<QueueResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);

  const res = await fetch(
    `${pbUrl('/api/fast-english/operator/payment-requests')}?${qs.toString()}`,
    {
      headers: { authorization: token },
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Request failed',
    );
  }
  return res.json();
}

export async function fetchDetail(token: string, requestId: string): Promise<RequestDetail> {
  const res = await fetch(pbUrl(`/api/fast-english/operator/payment-requests/${requestId}`), {
    headers: { authorization: token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Request failed',
    );
  }
  return res.json();
}

export async function approveRequest(
  token: string,
  requestId: string,
  internalNote?: string,
): Promise<ApproveResponse> {
  const res = await fetch(
    pbUrl(`/api/fast-english/operator/payment-requests/${requestId}/approve`),
    {
      method: 'POST',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({ internal_note: internalNote ?? '' }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Request failed',
    );
  }
  return res.json();
}

export async function rejectRequest(
  token: string,
  requestId: string,
  publicRejectionReason: string,
  internalNote?: string,
): Promise<RejectResponse> {
  const res = await fetch(
    pbUrl(`/api/fast-english/operator/payment-requests/${requestId}/reject`),
    {
      method: 'POST',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({
        public_rejection_reason: publicRejectionReason,
        internal_note: internalNote ?? '',
      }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Request failed',
    );
  }
  return res.json();
}

export async function fetchReceiptBlob(token: string, requestId: string): Promise<Blob> {
  const res = await fetch(
    pbUrl(`/api/fast-english/operator/payment-requests/${requestId}/receipt`),
    {
      headers: { authorization: token },
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Failed to load receipt',
    );
  }
  return res.blob();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
