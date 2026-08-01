// landing/src/content/siteContent.ts
// Content constants for the static landing surface. Only supported
// business information is used; unknown identity/legal details are
// explicit, clearly marked placeholders — never invented facts.

export const SITE_NAME = 'فست انگلیش پادکست';
export const SITE_NAME_EN = 'Fast English Podcast';

/**
 * Business identity details that are not yet defined by the owners.
 * These constants are rendered on the About page as explicit
 * "to be announced" placeholders instead of fabricated facts.
 */
export const BUSINESS_IDENTITY_PLACEHOLDERS = {
  founders: 'اطلاعات بنیان‌گذاران — به‌زودی',
  registration: 'اطلاعات ثبت شرکت — به‌زودی',
  teachingCredentials: 'اعتبارنامه‌های آموزشی تیم — به‌زودی',
  officeAddress: 'آدرس دفتر — به‌زودی',
  userCount: 'تعداد کاربران — به‌زودی',
  awards: 'افتخارات و جوایز — به‌زودی',
} as const;

/** Marker used to detect unreviewed legal copy before Production release. */
export const LEGAL_REVIEW_MARKER = 'data-legal-status="needs-review"';
export const LEGAL_REVIEW_TEXT = 'نیاز به تأیید مالک/حقوقی پیش از انتشار';

export const FAQ_ITEMS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'فست انگلیش پادکست چیست؟',
    answer:
      'یک محصول یادگیری انگلیسی برای فارسی‌زبانان است: هر موضوع در شش سطح CEFR (A1 تا C2) با متن کوتاه و صوت همان متن ارائه می‌شود و پیشرفت شما ذخیره می‌شود.',
  },
  {
    question: 'چطور ثبت‌نام کنم؟',
    answer:
      'در داخل اپلیکیشن وب با شمارهٔ موبایل ایرانی، نام و رمز عبور ثبت‌نام می‌کنید. ایمیل اختیاری است.',
  },
  {
    question: 'پرداخت چگونه انجام می‌شود؟',
    answer:
      'پرداخت به‌صورت دستی کارت‌به‌کارت است: طرح موردنظر را انتخاب می‌کنید، رسید انتقال را بارگذاری می‌کنید و پس از بررسی اپراتور، اشتراک شما فعال می‌شود. پرداخت آنلاین خودکار وجود ندارد.',
  },
  {
    question: 'آزمون تعیین سطح چیست؟',
    answer:
      'یک آزمون بیست‌سؤالی که سطح پیشنهادی شما را مشخص می‌کند. نتیجه صرفاً یک پیشنهاد است و شما می‌توانید سطح دیگری انتخاب کنید.',
  },
  {
    question: 'آیا گواهی CEFR می‌گیرم؟',
    answer:
      'خیر. آزمون تعیین سطح فقط یک پیشنهاد است و فست انگلیش پادکست هیچ گواهی یا مدرک رسمی ارائه نمی‌دهد و نتیجهٔ یادگیری را تضمین نمی‌کند.',
  },
  {
    question: 'روی چه دستگاه‌هایی کار می‌کند؟',
    answer:
      'وب‌اپ در مرورگر موبایل و دسکتاپ کار می‌کند. نسخهٔ اندروید به‌صورت فایل APK مستقیم ارائه می‌شود؛ این محصول در فروشگاه‌های اپلیکیشن رسمی در دسترس نیست.',
  },
  {
    question: 'آیا صوت درس‌ها آفلاین در دسترس است؟',
    answer:
      'خیر. در حال حاضر پخش صوت به اتصال اینترنت نیاز دارد و دانلود آفلاین درس‌ها هنوز ارائه نشده است.',
  },
];
