// app/src/features/placement/constants.ts
// Placement feature constants.

export const TOTAL_QUESTIONS = 20;
export const PLACEMENT_API_BASE = '/api/fast-english/placement';

// Text constants - never contain correct answers or grading keys
export const PLACEMENT_INTRO_TITLE = 'آزمون تعیین سطح';
export const PLACEMENT_INTRO_DESC =
  'این آزمون شامل ۲۰ سؤال چهارگزینه‌ای است. با پاسخ‌دادن به این سؤال‌ها، سطح مناسبی برای شروع یادگیری به شما پیشنهاد می‌شود.';
export const PLACEMENT_INTRO_NOTE =
  'پاسخ‌های شما به‌تدریج ذخیره می‌شود و می‌توانید در هر زمان ادامه دهید.';
export const PLACEMENT_LOADING = 'در حال بارگذاری آزمون…';
export const PLACEMENT_SAVING = 'در حال ذخیره…';
export const PLACEMENT_SAVED = 'ذخیره شد';
export const PLACEMENT_SAVE_FAILED = 'خطا در ذخیره';
export const PLACEMENT_RETRY = 'تلاش مجدد';
export const PLACEMENT_SUBMIT_CONFIRM_TITLE = 'ثبت نهایی آزمون';
export const PLACEMENT_SUBMIT_CONFIRM_TEXT = 'پس از ثبت نهایی، امکان ویرایش پاسخ‌ها وجود ندارد.';
export const PLACEMENT_SUBMIT_SUCCESS = 'آزمون با موفقیت ثبت شد.';
export const PLACEMENT_NEXT_STEP_NOTE = 'تعیین سطح نهایی در مرحلهٔ بعد انجام می‌شود.';
export const PLACEMENT_UNSAVED_WARNING = 'پاسخی که ذخیره نشده است از بین خواهد رفت.';

// P2-S2 Level-related constants

// Keep in sync with shared/podcast/domain.ts (tests/cefr-consistency.test.mjs).
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: 'مقدماتی',
  A2: 'پایه',
  B1: 'متوسط',
  B2: 'فوق متوسط',
  C1: 'پیشرفته',
  C2: 'فوق پیشرفته',
};

export const LEVEL_SELECTION_TITLE = 'انتخاب سطح';
export const LEVEL_SELECTION_DESC =
  'بر اساس نمرهٔ شما در آزمون تعیین سطح، سطح پیشنهادی مشخص شده است. شما می‌توانید سطح پیشنهادی را بپذیرید یا سطح دیگری را انتخاب کنید.';
export const LEVEL_SUGGESTED_LABEL = 'سطح پیشنهادی';
export const LEVEL_SELECTED_LABEL = 'سطح انتخابی';
export const LEVEL_ACCEPT_SUGGESTION = 'پذیرش سطح پیشنهادی';
export const LEVEL_CHOOSE_ANOTHER = 'انتخاب سطح دیگر';
export const LEVEL_CHANGE = 'تغییر سطح';
export const LEVEL_CONFIRM_TITLE = 'تأیید انتخاب سطح';
export const LEVEL_CONFIRM_DESC =
  'آیا از انتخاب سطح {level} اطمینان دارید؟ درس‌های شما بر اساس این سطح تنظیم خواهد شد.';
export const LEVEL_SAVING = 'در حال ذخیرهٔ سطح انتخابی…';
export const LEVEL_SAVE_SUCCESS = 'سطح انتخابی با موفقیت ذخیره شد.';
export const LEVEL_SAVE_FAILED = 'خطا در ذخیرهٔ سطح انتخابی. لطفاً دوباره تلاش کنید.';
export const LEVEL_LOADING = 'در حال بارگذاری اطلاعات سطح…';

export const DASHBOARD_LOADING = 'در حال بارگذاری داشبورد…';
export const DASHBOARD_UNAVAILABLE = 'داشبورد در دسترس نیست.';
export const DASHBOARD_WELCOME = 'خوش آمدید!';
export const DASHBOARD_PLACEMENT_SUMMARY = 'خلاصهٔ تعیین سطح';
export const DASHBOARD_SUBSCRIPTION = 'اشتراک';
export const DASHBOARD_LESSONS_SHELL = 'دروس آموزشی';
export const DASHBOARD_PROGRESS = 'پیشرفت آموزشی';
export const DASHBOARD_PROGRESS_PLACEHOLDER =
  'پس از انتشار درس‌ها، پیشرفت آموزشی شما در این بخش نمایش داده می‌شود.';
export const DASHBOARD_LESSONS_SOON = 'به‌زودی';
export const DASHBOARD_ACCOUNT = 'حساب کاربری';
export const DASHBOARD_LOGOUT = 'خروج';
export const DASHBOARD_SUPPORT = 'پشتیبانی';
export const DASHBOARD_NO_ENTITLEMENT = 'شما اشتراک فعالی ندارید.';
export const DASHBOARD_FUTURE_SUBSCRIPTION = 'اشتراک شما از تاریخ {date} فعال می‌شود.';
export const DASHBOARD_EXPIRED_SUBSCRIPTION = 'اشتراک شما منقضی شده است.';
export const DASHBOARD_SUSPENDED = 'حساب شما مسدود شده است.';
