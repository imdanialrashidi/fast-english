// app/src/app/copy/productCopy.ts
// Podcast Slice 5 — canonical Student Product vocabulary.
//
// This module centralizes the *repeated* Product labels, actions, status
// words and state copy that several Student surfaces share. Page-specific
// prose stays next to its page (see copy-guidelines.md); nothing here is
// an i18n framework.
//
// Canonical entity terms (see docs + copy-guidelines.md):
//   اپیزود / کتابخانه / سطح پیشنهادی / سطح پیشفرض / ادامه گوشدادن /
//   شروع گوشدادن / مرور دوباره / کلمات کلیدی / متن اپیزود / پیشرفت
//
// Outdated synonyms (the legacy lesson word, فایل, مطلب, پادکست, جلسه)
// must not be used for the same Episode entity in redesigned Podcast-facing
// components; the static copy scanner (podcast-slice-5.quality.test.ts)
// enforces this.

export const productCopy = {
  nav: {
    home: 'خانه',
    library: 'کتابخانه',
    progress: 'پیشرفت',
    account: 'حساب',
  },

  episode: {
    entity: 'اپیزود',
    episodes: 'اپیزودها',
  },

  levels: {
    recommended: 'سطح پیشنهادی',
    preferred: 'سطح پیش‌فرض',
    browsing: 'در حال مرور',
  },

  sections: {
    continueListening: 'ادامه گوش‌دادن',
    recommended: 'مناسب سطح شما',
    latest: 'تازه منتشر شده',
    progress: 'پیشرفت',
  },

  actions: {
    startListening: 'شروع گوش‌دادن',
    reviewAgain: 'مرور دوباره',
    findEpisode: 'پیدا کردن اپیزود',
    goToLibrary: 'رفتن به کتابخانه',
    goToEpisodes: 'رفتن به اپیزودها',
    retry: 'تلاش مجدد',
    continueFrom: (clock: string) => `ادامه از ${clock}`,
  },

  cardStatus: {
    notStarted: 'شروع نشده',
    inProgress: 'در حال گوش‌دادن',
    completed: 'کامل شده',
  },

  subscription: {
    label: 'اشتراک',
    active: 'فعال',
    plan: 'طرح',
    expiresAt: 'تاریخ انقضا',
    daysRemaining: 'روزهای باقی‌مانده',
  },

  empty: {
    noEpisodesForLevel:
      'هنوز اپیزود تازه‌ای برای این سطح منتشر نشده است. می‌توانی نسخه‌های سطح‌های دیگر را هم ببینی.',
    noEpisodesYet: 'هنوز اپیزودی منتشر نشده است. به‌زودی اپیزودهای جدید اضافه می‌شوند.',
  },

  errors: {
    episodesFailed: 'اپیزودها بارگیری نشدند.',
    checkConnection: 'اتصال اینترنت را بررسی کن و دوباره تلاش کن.',
    progressFailed: 'پیشرفت بارگیری نشد.',
  },
} as const;

export type ProductCopy = typeof productCopy;
