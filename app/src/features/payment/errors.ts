// app/src/features/payment/errors.ts
// Map any thrown value (PB ClientResponseError, fetch network error,
// arbitrary JS) into a safe Persian PaymentError. Never surfaces the
// raw response text, server paths, or PB rule details to the UI.

import { extractApiError } from '../../../../shared/lib/apiError';
import { apiErrorSchema } from './schemas';
import { PaymentError, type PaymentErrorShape } from './types';

// Centralized Persian copy. Keys are stable error codes that the UI
// may switch on; values are user-facing messages.
const PERSIAN_MESSAGES: Record<string, string> = {
  // Network / availability
  unavailable: 'سرویس در دسترس نیست. اتصال اینترنت را بررسی کنید.',
  timeout: 'پاسخ‌گویی سرور طولانی شد. دوباره تلاش کنید.',
  // Auth
  unauthorized: 'نشست شما منقضی شده است. دوباره وارد شوید.',
  account_suspended: 'حساب شما تعلیق شده است. با پشتیبانی تماس بگیرید.',
  account_not_eligible: 'حساب شما در حال حاضر اجازهٔ ارسال درخواست ندارد.',
  // Receipt
  invalid_receipt: 'رسید انتخاب‌شده معتبر نیست. فرمت یا حجم آن را بررسی کنید.',
  receipt_too_large: 'حجم رسید نباید بیشتر از ۵ مگابایت باشد.',
  receipt_unavailable: 'رسید شما در دسترس نیست. دوباره تلاش کنید.',
  // Plan / destination
  invalid_plan: 'طرح انتخاب‌شده در دسترس نیست.',
  payment_destination_unavailable: 'مقصد پرداخت فعال نیست. با پشتیبانی تماس بگیرید.',
  // Transfer details
  invalid_transfer_details: 'جزئیات انتقال (مانند چهار رقم کارت) نامعتبر است.',
  // Concurrency
  pending_request_exists: 'شما یک درخواست در حال بررسی دارید. تا اعلام نتیجه صبر کنید.',
  // Rate limiting
  rate_limited: 'تعداد درخواست‌ها زیاد است. کمی بعد تلاش کنید.',
  // Generic
  unexpected: 'خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.',
};

interface ExtractedErr {
  status: number;
  code: string;
  message: string;
}

function extractFromUnknown(err: unknown): ExtractedErr {
  // Shared envelope normalization (shared/lib/apiError.ts) — the single
  // home for the { status, data/response/body: { code, message } }
  // read. The feature keeps its own status/copy mapping below.
  const envelope = extractApiError(err);
  return {
    status: envelope.status ?? 500,
    code: envelope.code ?? '',
    message: envelope.message ?? '',
  };
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

function chooseCode(extracted: ExtractedErr, network: boolean): string {
  if (network) return 'unavailable';
  if (extracted.status === 0) return 'unavailable';
  if (extracted.status === 408 || extracted.status === 504) return 'timeout';
  if (extracted.status === 429) return 'rate_limited';
  if (extracted.status === 401) return 'unauthorized';
  if (extracted.status === 403) {
    if (extracted.code === 'account_suspended') return 'account_suspended';
    if (extracted.code === 'account_not_eligible') return 'account_not_eligible';
    return 'account_not_eligible';
  }
  if (extracted.status === 404) {
    if (extracted.code === 'invalid_plan') return 'invalid_plan';
    if (extracted.code === 'payment_destination_unavailable') {
      return 'payment_destination_unavailable';
    }
    if (extracted.code === 'not_found' || extracted.code === 'invalid_request') {
      // Receipt-preview route returns 404 not_found for both
      // missing records and cross-user access. Map to a generic
      // "receipt unavailable" so the UI can show a stable message
      // without leaking the distinction.
      return 'receipt_unavailable';
    }
    return 'invalid_plan';
  }
  if (extracted.status === 409) return 'pending_request_exists';
  if (extracted.status === 413) return 'receipt_too_large';
  if (extracted.status === 502 || extracted.status === 503) return 'unavailable';
  if (extracted.code && PERSIAN_MESSAGES[extracted.code]) return extracted.code;
  if (extracted.status >= 400 && extracted.status < 500) return 'unexpected';
  return 'unexpected';
}

/**
 * Validate the response body envelope from the wire against a known
 * Zod shape. Returns the parsed value, or null if the body is
 * structurally invalid. We do not throw on a malformed body — the
 * caller falls back to a generic Persian error.
 */
export function parseApiErrorBody(body: unknown): { code?: string; message?: string } | null {
  const result = apiErrorSchema.safeParse(body);
  if (!result.success) return null;
  return { code: result.data.code, message: result.data.message };
}

export function toPaymentError(err: unknown): PaymentError {
  if (err instanceof PaymentError) return err;
  const network = isNetworkError(err);
  const extracted = extractFromUnknown(err);
  // Try to parse a structured body if the error carried one. We do
  // this even when extractFromUnknown already found a code so a more
  // specific server-side code wins.
  const bodyEnvelope = parseApiErrorBody(
    (err as { response?: { data?: unknown } })?.response?.data,
  );
  if (bodyEnvelope?.code) {
    extracted.code = bodyEnvelope.code;
  }
  const code = chooseCode(extracted, network);
  const message = PERSIAN_MESSAGES[code] ?? PERSIAN_MESSAGES.unexpected ?? '';
  // Preserve the numeric status for tests/analytics; never leak it
  // to the UI message.
  return new PaymentError(message, code, extracted.status);
}

export function asPaymentErrorShape(err: unknown): PaymentErrorShape {
  return toPaymentError(err);
}
