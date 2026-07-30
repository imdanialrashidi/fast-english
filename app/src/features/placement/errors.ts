// app/src/features/placement/errors.ts
// Safe Persian error mapper for placement API errors.
// Never leaks server internals.

export interface PlacementErrorInfo {
  code: string;
  message: string;
  retry?: boolean;
}

const errorMap: Record<string, PlacementErrorInfo> = {
  placement_auth_required: {
    code: 'placement_auth_required',
    message: 'لطفاً ابتدا وارد حساب خود شوید.',
    retry: false,
  },
  placement_access_denied: {
    code: 'placement_access_denied',
    message: 'شما دسترسی به آزمون تعیین سطح ندارید.',
    retry: false,
  },
  placement_subscription_required: {
    code: 'placement_subscription_required',
    message: 'برای شرکت در آزمون تعیین سطح نیاز به اشتراک فعال دارید.',
    retry: false,
  },
  placement_suspended: {
    code: 'placement_suspended',
    message: 'حساب شما مسدود شده است.',
    retry: false,
  },
  placement_unavailable: {
    code: 'placement_unavailable',
    message: 'آزمون تعیین سطح در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید.',
    retry: true,
  },
  placement_attempt_stale: {
    code: 'placement_attempt_stale',
    message: 'این تلاش در برگهٔ دیگری تغییر کرده است. لطفاً صفحه را بازنشانی کنید.',
    retry: true,
  },
  attempt_not_in_progress: {
    code: 'attempt_not_in_progress',
    message: 'این تلاش دیگر قابل ویرایش نیست.',
    retry: false,
  },
  incomplete_attempt: {
    code: 'incomplete_attempt',
    message: 'لطفاً ابتدا به همهٔ ۲۰ سؤال پاسخ دهید.',
    retry: true,
  },
  invalid_question: {
    code: 'invalid_question',
    message: 'سؤال نامعتبر است.',
    retry: false,
  },
  invalid_option: {
    code: 'invalid_option',
    message: 'گزینهٔ نامعتبر است.',
    retry: false,
  },
  rate_limited: {
    code: 'rate_limited',
    message: 'درخواست‌های زیادی ارسال کرده‌اید. لطفاً کمی صبر کنید.',
    retry: true,
  },
  // P2-S2 level errors
  no_attempt: {
    code: 'no_attempt',
    message: 'آزمون تعیین سطحی یافت نشد.',
    retry: false,
  },
  attempt_not_submitted: {
    code: 'attempt_not_submitted',
    message: 'ابتدا آزمون تعیین سطح را ثبت کنید.',
    retry: false,
  },
  invalid_level: {
    code: 'invalid_level',
    message: 'سطح انتخاب شده نامعتبر است.',
    retry: false,
  },
  level_mapping_integrity_error: {
    code: 'level_mapping_integrity_error',
    message: 'خطای یکپارچگی داده‌های سطح. لطفاً با پشتیبانی تماس بگیرید.',
    retry: false,
  },
  placement_incomplete: {
    code: 'placement_incomplete',
    message: 'لطفاً ابتدا تعیین سطح را کامل کنید.',
    retry: false,
  },
};

export function mapPlacementError(err: unknown): PlacementErrorInfo {
  if (!err) {
    return { code: 'unknown', message: 'خطای ناشناخته رخ داد.', retry: true };
  }

  // Handle structured API errors
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e.code === 'string' && e.code in errorMap) {
      return errorMap[e.code];
    }
    if (typeof e.status === 'number') {
      if (e.status === 401) return errorMap.placement_auth_required;
      if (e.status === 403) return errorMap.placement_access_denied;
      if (e.status === 404)
        return { code: 'not_found', message: 'اطلاعات یافت نشد.', retry: false };
      if (e.status === 409) return errorMap.placement_attempt_stale;
      if (e.status === 429) return errorMap.rate_limited;
      if (e.status >= 500) return errorMap.placement_unavailable;
    }
  }

  // Network errors
  const msg = String(err);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
    return {
      code: 'network',
      message: 'خطای اتصال به شبکه. لطفاً اتصال اینترنت خود را بررسی کنید.',
      retry: true,
    };
  }

  return { code: 'unknown', message: 'خطای ناشناخته رخ داد.', retry: true };
}
