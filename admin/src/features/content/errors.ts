// admin/src/features/content/errors.ts
// Podcast Slice 4 — shared safe Admin errors for the Content Studio.
//
// Known server codes are mapped to clear Persian copy; unknown codes get
// a safe generic message. Nothing internal (stack traces, SQL, storage
// paths, tokens) is ever exposed. `details` is a deliberately technical
// support-details area the UI may show collapsed.

export interface ApiErrorDetails {
  issues?: string[];
  errorJson?: string;
  auditId?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Persian copy for known content-error codes (operational, non-technical). */
const COPY: Record<string, string> = {
  // Common
  unauthorized: 'نشست شما منقضی شده است. دوباره وارد شوید.',
  staff_access_denied: 'دسترسی به این بخش برای حساب شما ممکن نیست.',
  not_found: 'مورد درخواستی پیدا نشد.',
  rate_limited: 'درخواستهای زیادی ارسال شده است؛ کمی بعد دوباره تلاش کنید.',
  invalid_request: 'درخواست نادرست است.',
  unexpected_error: 'خطایی رخ داد؛ دوباره تلاش کنید.',
  not_ready: 'این مورد هنوز آماده انتشار نیست. موارد زیر را تکمیل کنید:',
  parent_not_published: 'برای انتشار این نسخه، ابتدا دستهبندی و اپیزود والد را منتشر کنید.',
  published_media_locked: 'حذف رسانه از محتوای منتشرشده ممکن نیست.',

  // Categories
  TITLE_FA_REQUIRED: 'عنوان فارسی الزامی است.',
  SLUG_INVALID: 'شناسه انگلیسی فقط حروف کوچک لاتین، عدد و خط تیره میپذیرد.',
  CATEGORY_SLUG_TAKEN: 'این شناسه انگلیسی قبلاً استفاده شده است.',
  invalid_category: 'ذخیره دستهبندی ممکن نشد.',

  // Episodes
  CATEGORY_REQUIRED: 'دستهبندی اپیزود را انتخاب کنید.',
  EPISODE_KEY_TAKEN: 'این شناسه انگلیسی قبلاً برای اپیزود دیگری استفاده شده است.',
  EPISODE_SLUG_TAKEN: 'این شناسه انگلیسی قبلاً برای اپیزود دیگری استفاده شده است.',
  invalid_episode: 'ذخیره اپیزود ممکن نشد.',

  // Media
  IMAGE_REQUIRED: 'فایل تصویر انتخاب نشده است.',
  IMAGE_TOO_LARGE: 'حجم تصویر بیش از ۵ مگابایت است.',
  IMAGE_UNSUPPORTED_TYPE: 'فرمت تصویر پشتیبانینشده است (JPEG، PNG یا WebP بپذیرید).',
  IMAGE_EXTENSION_MISMATCH: 'پسوند تصویر با محتوای آن هماهنگ نیست.',
  AUDIO_TOO_LARGE: 'حجم فایل صوتی بیش از ۱۰ مگابایت است.',
  AUDIO_UNSUPPORTED_TYPE: 'فرمت صوتی پشتیبانینشده است (MP3 یا M4A بپذیرید).',
  AUDIO_DURATION_UNREADABLE: 'مدت فایل صوتی قابل تشخیص نیست؛ از MP3 یا M4A معتبر استفاده کنید.',
  PRONUNCIATION_TOO_LARGE: 'حجم فایل تلفظ بیش از ۲ مگابایت است.',
  ASSET_SIZE_EXCEEDED: 'حجم فایل بیش از حد مجاز است.',
  ASSET_MISSING: 'فایل موردنیاز پیدا نشد.',

  // Variants
  LEVEL_INVALID: 'سطح باید یکی از A1 تا C2 باشد.',
  VARIANT_EXISTS: 'این سطح قبلاً برای این اپیزود ساخته شده است.',
  invalid_variant: 'ذخیره نسخه سطح ممکن نشد.',
  TRANSCRIPT_TOO_LONG: 'متن اپیزود از ۵۰٬۰۰۰ نویسه بلندتر است.',
  VARIANT_TRANSCRIPT_REQUIRED: 'نسخه منتشرشده باید متن اپیزود داشته باشد.',

  // Vocabulary
  VOCAB_COUNT_INVALID: 'حداکثر ۱۰۰ واژه در هر نسخه مجاز است.',
  VOCAB_FIELDS_INVALID: 'واژه، معنی فارسی و توضیح انگلیسی الزامی هستند.',
  VOCAB_TERM_DUPLICATE: 'این واژه قبلاً در این نسخه ثبت شده است.',
  invalid_vocabulary: 'ذخیره واژه ممکن نشد.',

  // Import pipeline
  plan_state_required: 'برنامه ورود وجود ندارد؛ ابتدا بسته را بررسی کنید.',
  plan_stale: 'محتوا از زمان بررسی تغییر کرده است. قبل از ادامه، تغییرات را دوباره بررسی کنید.',
  import_conflict: 'نسخه بسته با محتوای فعلی در تعارض است؛ شماره نسخه بسته را افزایش دهید.',
  import_stale: 'نسخه بسته قدیمیتر از محتوای فعلی است.',
  category_not_found: 'دستهبندی بسته در سیستم وجود ندارد.',
  upload_invalid: 'فایلهای بسته اعتبارسنجی نشدند.',
  import_failed: 'ورود محتوا ناموفق بود و هیچ تغییر جزئی اعمال نشد.',
  manifest_invalid: 'بسته محتوا معتبر نیست.',
  MANIFEST_INVALID_JSON: 'فایل episode.json معتبر نیست.',
  SCHEMA_VERSION_UNSUPPORTED: 'نسخه قالب بسته پشتیبانینشده است.',
  ASSET_NOT_DECLARED: 'فایلی در بسته هست که در episode.json معرفی نشده است.',
  ASSET_DUPLICATE: 'فایلی بیش از یک بار در بسته ارسال شده است.',
  ASSET_CHECKSUM_INVALID: 'شناسه فایل نادرست است.',
  ASSET_MIME_MISMATCH: 'نوع فایل با محتوای آن هماهنگ نیست.',
  AUDIO_PATH_REUSED: 'یک فایل صوتی برای بیش از یک نسخه استفاده شده است.',
};

/** Maps a known code to Persian copy; falls back to the server message. */
export function contentErrorCopy(code: string, serverMessage: string): string {
  const known = COPY[code];
  if (known) return known;
  if (code === 'unexpected_error') return 'خطایی رخ داد؛ دوباره تلاش کنید.';
  return serverMessage || 'خطایی رخ داد؛ دوباره تلاش کنید.';
}

/** Persian copy for shared package-diagnostic codes (validation report). */
const DIAG_COPY: Record<string, string> = {
  MANIFEST_NOT_FOUND: 'فایل episode.json در بسته پیدا نشد.',
  MANIFEST_AMBIGUOUS: 'بیش از یک فایل episode.json در بسته وجود دارد.',
  MANIFEST_INVALID_JSON: 'فایل episode.json معتبر نیست.',
  MANIFEST_UNREADABLE: 'فایل episode.json خوانده نشد.',
  SCHEMA_VERSION_UNSUPPORTED: 'نسخه قالب بسته پشتیبانینشده است.',
  SCHEMA_UNKNOWN_PROPERTY: 'بسته شامل فیلد ناشناخته است.',
  CONTENT_KEY_MISMATCH: 'کلید محتوا با «دستهبندی.شناسه» هماهنگ نیست.',
  ASSET_PATH_UNSAFE: 'مسیر یک فایل ناامن است.',
  ASSET_MISSING: 'یک فایل معرفیشده در بسته پیدا نشد.',
  ASSET_MIME_MISMATCH: 'نوع فایل با محتوای آن هماهنگ نیست.',
  AUDIO_PATH_REUSED: 'یک فایل صوتی برای بیش از یک نسخه استفاده شده است.',
  AUDIO_UNSUPPORTED_TYPE: 'فایل صوتی باید MP3 یا M4A باشد.',
  IMAGE_EXTENSION_MISMATCH: 'پسوند تصویر با محتوای آن هماهنگ نیست.',
  TRANSCRIPT_TOO_LONG: 'متن اپیزود از ۵۰٬۰۰۰ نویسه بلندتر است.',
  TRANSCRIPT_EMPTY: 'متن اپیزود خالی است.',
  TRANSCRIPT_ONLY_HEADINGS: 'متن اپیزود فقط شامل عنوان است.',
  TRANSCRIPT_EMBEDDED_SCRIPT: 'متن اپیزود شامل ساختار غیرمجاز است.',
  TRANSCRIPT_UNSAFE_LINK: 'متن اپیزود شامل پیوند غیرمجاز است.',
  PLACEHOLDER_VALUE: 'مقدار هنوز جایگزین نشده است (متن پیشنویس باقی مانده).',
  TITLE_EN_EMPTY: 'عنوان انگلیسی خالی است.',
  TITLE_FA_EMPTY: 'عنوان فارسی خالی است.',
  DESCRIPTION_FA_EMPTY: 'توضیح فارسی خالی است.',
  ARTWORK_ALT_EMPTY: 'متن جایگزین تصویر خالی است.',
  SUMMARY_FA_EMPTY: 'خلاصه فارسی نسخه خالی است.',
  VOCAB_TERM_EMPTY: 'واژهای با عنوان خالی وجود دارد.',
  VOCAB_MEANING_EMPTY: 'معنی فارسی یک واژه خالی است.',
  VOCAB_DEFINITION_EMPTY: 'توضیح انگلیسی یک واژه خالی است.',
  DUPLICATE_VOCABULARY_TERM: 'واژه تکراری در یک نسخه وجود دارد.',
  DUPLICATE_VARIANT_LEVEL: 'سطح تکراری در بسته وجود دارد.',
};

/** Persian copy for a shared package diagnostic (validation report). */
export function contentDiagnosticCopy(code: string, message: string): string {
  return DIAG_COPY[code] ?? message;
}

/** Safe display string for an unknown thrown value. */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return contentErrorCopy(err.code, err.message);
  }
  if (err instanceof Error) return 'خطایی رخ داد؛ دوباره تلاش کنید.';
  return 'خطایی رخ داد؛ دوباره تلاش کنید.';
}

export interface ResolvedError {
  message: string;
  /** Internal code kept for a deliberately technical support-details area. */
  code?: string;
  issues?: string[];
  auditId?: string;
}

export function resolveContentError(err: unknown): ResolvedError {
  if (err instanceof ApiError) {
    const issues =
      err.details?.issues && err.details.issues.length > 0 ? err.details.issues : undefined;
    return {
      message: contentErrorCopy(err.code, err.message),
      code: err.code,
      issues,
      auditId: err.details?.auditId,
    };
  }
  return { message: 'خطایی رخ داد؛ دوباره تلاش کنید.' };
}
