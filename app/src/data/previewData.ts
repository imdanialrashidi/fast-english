// Local, deterministic preview data used only for layout and visual QA.
// Clearly marked and intentionally simple. These are NOT real product data
// and must not be wired into future API contracts.

import type { CefrLevel } from '../app/theme/tokens';

export interface PreviewLesson {
  readonly id: string;
  readonly title: string;
  readonly titleEn: string;
  readonly topic: string;
  readonly level: CefrLevel;
  readonly durationMin: number;
  readonly summary: string;
}

export interface PreviewProgress {
  readonly completed: number;
  readonly total: number;
  readonly streakDays: number;
}

export const previewGreeting = {
  name: 'کاربر نمایشی',
  level: 'B1' as CefrLevel,
  selectedAt: '۱۴۰۵/۰۵/۱۲',
};

export const previewProgress: PreviewProgress = {
  completed: 7,
  total: 24,
  streakDays: 3,
};

export const previewContinueLesson: PreviewLesson = {
  id: 'preview-1',
  title: 'یک روز کاری معمولی',
  titleEn: 'A Typical Workday',
  topic: 'زندگی روزمره',
  level: 'B1',
  durationMin: 8,
  summary: 'یک متن کوتاه دربارهٔ برنامهٔ روزانهٔ کاری و مکالمهٔ ساده.',
};

export const previewRecommendations: readonly PreviewLesson[] = [
  {
    id: 'preview-2',
    title: 'خرید از فروشگاه',
    titleEn: 'Shopping at the Store',
    topic: 'زندگی روزمره',
    level: 'A2',
    durationMin: 6,
    summary: 'مکالمهٔ کوتاه بین مشتری و فروشنده.',
  },
  {
    id: 'preview-3',
    title: 'سفر کوتاه',
    titleEn: 'A Short Trip',
    topic: 'سفر',
    level: 'B1',
    durationMin: 9,
    summary: 'دربارهٔ برنامه‌ریزی یک سفر کوتاه و مکالمه در فرودگاه.',
  },
  {
    id: 'preview-4',
    title: 'گفت‌وگوی کاری',
    titleEn: 'A Work Conversation',
    topic: 'محیط کار',
    level: 'B2',
    durationMin: 10,
    summary: 'مکالمهٔ حرفه‌ای در جلسهٔ کوتاه.',
  },
];
