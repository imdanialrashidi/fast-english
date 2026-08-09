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

  // Podcast Slice 6 — Library & Discovery surface copy.
  library: {
    subtitle: 'موضوع مورد علاقه‌ات را پیدا کن و اپیزود بعدی‌ات را انتخاب کن.',
    searchLabel: 'جستجو در اپیزودها',
    searchClear: 'پاک کردن جستجو',
    allTopics: 'همه موضوع‌ها',
    topicsLabel: 'موضوع‌ها',
    levelFilterLabel: 'سطح',
    suggestedForMe: 'پیشنهادی برای من',
    allLevels: 'همه سطح‌ها',
    progressFilterLabel: 'وضعیت پیشرفت',
    progressAll: 'همه',
    progressFilters: {
      all: 'همه',
      not_started: 'شروع‌نشده',
      in_progress: 'در حال گوش‌دادن',
      completed: 'کامل‌شده',
    },
    sortLabel: 'مرتب‌سازی',
    sortSuggested: 'پیشنهادی',
    sortLatest: 'تازه‌ترین',
    resultsCount: (n: number) => `${n} اپیزود`,
    loadMore: 'اپیزودهای بیشتر',
    availableLevels: (levels: string) => `سطح‌ها: ${levels}`,
    continueSection: 'ادامه گوش‌دادن',
    refreshing: 'در حال به‌روزرسانی کتابخانه…',
    empty: {
      libraryTitle: 'هنوز اپیزودی در کتابخانه منتشر نشده است.',
      libraryDescription: 'به‌زودی اپیزودهای جدید اضافه می‌شوند.',
      searchTitle: 'برای این جستجو اپیزودی پیدا نشد.',
      searchDescription: 'کلمات دیگری را امتحان کن یا جستجو را پاک کن.',
      categoryTitle: 'در این موضوع هنوز اپیزودی منتشر نشده است.',
      categoryDescription: 'موضوع دیگری را انتخاب کن یا همهٔ موضوع‌ها را ببین.',
      levelTitle: (level: string) => `برای سطح ${level} هنوز اپیزود منتشرشده‌ای وجود ندارد.`,
      levelDescription: 'سطح دیگری را انتخاب کن یا همهٔ سطح‌ها را ببین.',
      progressTitle: 'با این فیلتر اپیزودی پیدا نشد.',
      progressDescription: 'هیچ اپیزودی با این وضعیت پیشرفت وجود ندارد؛ فیلتر را به «همه» برگردان.',
    },
  },
} as const;

export type ProductCopy = typeof productCopy;
