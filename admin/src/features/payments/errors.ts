// admin/src/features/payments/errors.ts
// Map any thrown value (ApiError, fetch network error, arbitrary JS) into a
// safe Persian OperatorError. Mirrors the payment error mapper: raw server
// text, PocketBase internals, stack traces and storage paths never reach
// the UI. An optional `requestId` is carried as a support code and may only
// be rendered inside safe error-details surfaces.

import { ApiError } from './api';

export class OperatorError extends Error {
  constructor(
    message: string,
    /** Stable machine-readable code the UI can switch on. */
    public code: string,
    /** Numeric HTTP status when known; never rendered to the user. */
    public status: number,
    /** Optional support code; display only inside safe error details. */
    public requestId?: string,
  ) {
    super(message);
    this.name = 'OperatorError';
  }
}

// Stable codes the UI may switch on.
export const OP_ERROR = {
  unavailable: 'unavailable',
  timeout: 'timeout',
  rateLimited: 'rate_limited',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  requestNotFound: 'request_not_found',
  receiptUnavailable: 'receipt_unavailable',
  alreadyDecided: 'already_decided',
  studentSuspended: 'student_suspended',
  rejectionReasonRequired: 'rejection_reason_required',
  unexpected: 'unexpected',
} as const;

export type OperatorErrorCode = (typeof OP_ERROR)[keyof typeof OP_ERROR];

const PERSIAN_MESSAGES: Record<string, string> = {
  unavailable: 'سرویس در دسترس نیست. اتصال اینترنت را بررسی کنید.',
  timeout: 'پاسخ‌گویی سرور طولانی شد. دوباره تلاش کنید.',
  rate_limited: 'تعداد عملیات زیاد است. کمی بعد تلاش کنید.',
  unauthorized: 'نشست شما منقضی شده است. دوباره وارد شوید.',
  forbidden: 'دسترسی به این بخش فقط برای مدیریت مجاز است.',
  request_not_found: 'درخواست موردنظر یافت نشد. ممکن است حذف شده باشد.',
  receipt_unavailable: 'رسید برای این درخواست در دسترس نیست.',
  already_decided: 'این درخواست قبلاً بررسی شده است. وضعیت به‌روزرسانی شد.',
  student_suspended: 'حساب دانشجو معلق است و امکان فعال‌سازی وجود ندارد.',
  rejection_reason_required: 'دلیل رد باید حداقل ۳ حرف باشد.',
  unexpected: 'خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.',
};

/** True when the error means the request was decided by another operator
 * (or a duplicate decision attempt). The UI must refresh authoritative
 * state and never present the stale action as successful. */
export function isStaleConflict(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status !== 409) return false;
  return (
    err.code === 'request_not_pending' ||
    err.code === 'approval_conflict' ||
    err.code === 'subscription_conflict'
  );
}
/** True for 404s from the protected receipt route: the request exists but
 * has no readable receipt (missing/malformed). A normal state, not an
 * error — the receipt inspector shows its "no receipt" surface. */
export function isMissingReceipt(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

interface Extracted {
  status: number;
  code: string;
}

function extract(err: unknown): Extracted {
  if (err instanceof ApiError) {
    return { status: err.status, code: err.code ?? '' };
  }
  if (!err || typeof err !== 'object') return { status: 500, code: '' };
  const e = err as Record<string, unknown> & {
    response?: { status?: number; data?: { code?: string } };
    status?: number;
    code?: string;
    cause?: { code?: string };
  };
  let status = 500;
  const resp = e.response;
  if (typeof e.status === 'number') status = e.status;
  else if (resp && typeof resp === 'object' && typeof resp.status === 'number') {
    status = resp.status;
  }
  const code = String(resp?.data?.code ?? (e.code as string) ?? (e.cause?.code as string) ?? '');
  return { status, code };
}

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string; cause?: { code?: string } };
  if (e.name === 'AbortError') return false; // caller-driven
  if (e.cause?.code === 'ECONNRESET' || e.cause?.code === 'ENETUNREACH') return true;
  if (typeof e.message === 'string') {
    return /network|fetch|failed to fetch|networkerror/i.test(e.message);
  }
  return false;
}

function chooseCode(extracted: Extracted, network: boolean): OperatorErrorCode {
  if (network || extracted.status === 0) return OP_ERROR.unavailable;
  if (extracted.status === 408 || extracted.status === 504) return OP_ERROR.timeout;
  if (extracted.status === 429) return OP_ERROR.rateLimited;
  if (extracted.status === 401) return OP_ERROR.unauthorized;
  if (extracted.status === 403) return OP_ERROR.forbidden;
  if (extracted.status === 404) {
    if (extracted.code === 'request_not_found') return OP_ERROR.requestNotFound;
    return OP_ERROR.receiptUnavailable;
  }
  if (extracted.status === 409) {
    if (extracted.code === 'student_suspended') return OP_ERROR.studentSuspended;
    return OP_ERROR.alreadyDecided;
  }
  if (extracted.status === 400 && extracted.code === 'rejection_reason_required') {
    return OP_ERROR.rejectionReasonRequired;
  }
  if (extracted.status === 502 || extracted.status === 503) return OP_ERROR.unavailable;
  return OP_ERROR.unexpected;
}

/**
 * Convert any thrown value into a safe Persian OperatorError.
 * `requestId` (when known) is attached as a support code and must only be
 * rendered inside safe error details — never in generic messages.
 */
export function toOperatorError(err: unknown, requestId?: string): OperatorError {
  if (err instanceof OperatorError) return err;
  const network = isNetworkError(err);
  const extracted = extract(err);
  const code = chooseCode(extracted, network);
  return new OperatorError(
    PERSIAN_MESSAGES[code] ?? PERSIAN_MESSAGES.unexpected,
    code,
    extracted.status,
    requestId,
  );
}
