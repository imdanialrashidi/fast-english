// app/src/lib/authErrors.ts
// Map PocketBase / network errors to safe Persian messages. Never
// surfaces internal fields, collection rules, or server paths.

import { extractApiError } from '../../../shared/lib/apiError';

const PERSIAN_MESSAGES: Record<string, string> = {
  invalid_phone: 'شمارهٔ موبایل معتبر نیست.',
  duplicate_phone: 'این شمارهٔ موبایل قبلاً ثبت شده است.',
  email_conflict: 'این ایمیل قبلاً استفاده شده است.',
  invalid_credentials: 'شمارهٔ موبایل یا رمز عبور اشتباه است.',
  rate_limited: 'تعداد درخواست‌ها زیاد است. کمی بعد تلاش کنید.',
  unavailable: 'سرویس در دسترس نیست. اتصال اینترنت را بررسی کنید.',
  timeout: 'پاسخ‌گویی سرور طولانی شد. دوباره تلاش کنید.',
  unexpected: 'خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.',
  password_short: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
  name_required: 'نام الزامی است.',
  account_suspended: 'حساب شما تعلیق شده است. با پشتیبانی تماس بگیرید.',
};

export class AuthError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'AuthError';
  }
}

function extractPocketBaseError(err: unknown): {
  status: number;
  code?: string;
  message?: string;
} {
  // Shared envelope normalization (shared/lib/apiError.ts) — same
  // { status, data/response/body } family as the payment mapper.
  const envelope = extractApiError(err);
  return {
    status: envelope.status ?? 500,
    code: envelope.code ?? undefined,
    message: envelope.message ?? undefined,
  };
}

function detectCodeFromMessage(
  fields: Record<string, { code?: string; message?: string }> | undefined,
): string | undefined {
  if (!fields) return undefined;
  if (fields.phone) return 'invalid_phone';
  if (fields.password) return 'password_short';
  if (fields.name) return 'name_required';
  if (fields.email) return 'email_conflict';
  return undefined;
}

export function mapAuthError(err: unknown): AuthError {
  const { status, code, message } = extractPocketBaseError(err);
  // Rate limit
  if (status === 429) {
    return new AuthError(PERSIAN_MESSAGES.rate_limited, 'rate_limited', 429);
  }
  // Network / availability
  if (
    status === 0 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === 'unavailable' ||
    (typeof message === 'string' && /network|fetch|timeout/i.test(message))
  ) {
    return new AuthError(PERSIAN_MESSAGES.unavailable, 'unavailable', status || 503);
  }
  // Direct code from PB (e.g. account_suspended) takes priority over
  // generic status-based mapping.
  if (code && PERSIAN_MESSAGES[code]) {
    return new AuthError(PERSIAN_MESSAGES[code], code, status);
  }
  // Field-level validation from PB
  const fields = (err as { response?: { data?: { data?: unknown } } })?.response?.data?.data as
    | Record<string, { code?: string; message?: string }>
    | undefined;
  const fieldCode = detectCodeFromMessage(fields);
  if (fieldCode) {
    return new AuthError(
      PERSIAN_MESSAGES[fieldCode] ?? PERSIAN_MESSAGES.unexpected,
      fieldCode,
      status,
    );
  }
  // Auth failure
  if (status === 400 || status === 401) {
    return new AuthError(PERSIAN_MESSAGES.invalid_credentials, 'invalid_credentials', status);
  }
  return new AuthError(PERSIAN_MESSAGES.unexpected, 'unexpected', status);
}
