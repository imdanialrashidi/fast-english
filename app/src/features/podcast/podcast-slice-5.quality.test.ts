// app/src/features/podcast/podcast-slice-5.quality.test.ts
// Podcast Slice 5 — static Product-copy and structure gates.
//
// 1. Product-copy scan: the redesigned Podcast-facing files must not use
//    outdated Student-facing terms for the Episode entity («درس»),
//    Staff terminology («اپراتور», «پنل», operator), or raw Backend
//    vocabulary (record, PocketBase). Legitimate exceptions are
//    documented in app/src/app/copy/copy-guidelines.md — older flows
//    (payment, placement, the current lessons list page) keep their own
//    copy and are NOT scanned.
// 2. Structure gates: the final Student navigation destinations, the
//    Home composition (ContentSection + EpisodeCard + dominant Continue
//    CTA) and the router topology (no Staff routes, /dashboard redirect).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const REDESIGNED_FILES = [
  'app/src/features/podcast/components/EpisodeArtwork.tsx',
  'app/src/features/podcast/components/EpisodeCard.tsx',
  'app/src/features/podcast/components/ContentSection.tsx',
  'app/src/features/home/api.ts',
  'app/src/features/home/logic.ts',
  'app/src/features/home/routes/HomeRoute.tsx',
  'app/src/features/library/routes/LibraryRoute.tsx',
  'app/src/features/library/api.ts',
  'app/src/features/library/types.ts',
  'app/src/features/library/logic.ts',
  'app/src/features/library/queryState.ts',
  'app/src/features/library/components/OptionChips.tsx',
  'app/src/features/library/components/SearchField.tsx',
  'app/src/features/library/components/ContinueStrip.tsx',
  'app/src/features/library/components/LibrarySkeleton.tsx',
  'app/src/features/library/components/EmptyPanel.tsx',
  'app/src/features/progress/routes/ProgressRoute.tsx',
  'app/src/app/copy/productCopy.ts',
  'app/src/features/episode/logic.ts',
  'app/src/features/episode/components/EditionRail.tsx',
  'app/src/features/episode/components/EpisodeJacket.tsx',
  'app/src/features/episode/components/VariantDeck.tsx',
  'app/src/features/episode/components/VocabularyList.tsx',
  'app/src/features/episode/components/PrevNextFooter.tsx',
  'app/src/features/lessons/routes/LessonDetailRoute.tsx',
];

const OUTDATED_TERMS = ['درس', 'اپراتور', 'پنل', 'record', 'PocketBase', 'operator'];

// Infrastructure identifiers that legitimately embed a backend term but
// are never user-facing copy (the SDK singleton import name). The guard
// still covers every other occurrence of the terms in the scanned files.
// Documented in app/src/app/copy/copy-guidelines.md.
const ALLOWED_IDENTIFIERS = ['getPocketBase'];

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('Podcast Slice 5 — Product copy and structure gates', () => {
  it('redesigned Podcast-facing files avoid outdated Student-facing terms', () => {
    const offenders: string[] = [];
    for (const file of REDESIGNED_FILES) {
      const content = read(file);
      for (const term of OUTDATED_TERMS) {
        if (!content.includes(term)) continue;
        for (const line of content.split('\n')) {
          if (!line.includes(term)) continue;
          if (ALLOWED_IDENTIFIERS.some((name) => new RegExp(`\\b${name}\\b`).test(line))) {
            continue;
          }
          offenders.push(`${file}: ${term}`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the Product copy module owns the canonical Student vocabulary', () => {
    const copy = read('app/src/app/copy/productCopy.ts');
    for (const term of [
      'اپیزود',
      'کتابخانه',
      'سطح پیشنهادی',
      'سطح پیش‌فرض',
      'ادامه گوش‌دادن',
      'شروع گوش‌دادن',
      'مرور دوباره',
      'کلمات کلیدی',
      'متن اپیزود',
      'پیشرفت',
      // Slice 7 canonical additions (Episode surface).
      'خلاصهٔ اپیزود',
      'اپیزود قبلی',
      'اپیزود بعدی',
      'تلفظ',
      'نسخهٔ سطح',
    ]) {
      expect(copy, term).toContain(term);
    }
  });

  it('the final Student navigation has exactly the four destinations', () => {
    const nav = read('app/src/app/shell/StudentBottomNav.tsx');
    const destinations = [...nav.matchAll(/value:\s*'\/[^']*'/g)].map((m) => m[0]);
    expect(destinations).toEqual([
      "value: '/'",
      "value: '/library'",
      "value: '/progress'",
      "value: '/account'",
    ]);
    for (const label of ['خانه', 'کتابخانه', 'پیشرفت', 'حساب']) {
      expect(nav, label).toContain(label);
    }
    expect(nav).not.toContain('درس‌ها');
  });

  it('the Home composes the reusable Podcast foundations', () => {
    const home = read('app/src/features/home/routes/HomeRoute.tsx');
    expect(home).toContain('ContentSection');
    expect(home).toContain('EpisodeCard');
    expect(home).toContain('EpisodeArtwork');
    expect(home).toContain('continue-cta');
    expect(home).toContain('سلام');
    expect(home).toContain('امروز چی گوش می‌دی؟');
    // One H1 greeting, section headings are h2.
    expect(home).toContain('component="h1"');
  });

  it('the router keeps the Student shell Staff-free with a /dashboard redirect', () => {
    const app = read('app/src/app/App.tsx');
    expect(app).toMatch(/path="\/dashboard"[^>]*<Navigate to="\/" replace \/>/);
    expect(app).toContain('path="/library"');
    expect(app).toContain('path="/progress"');
    expect(app).toContain('path="/account"');
    expect(app).not.toMatch(/path="\/operator/);
    expect(app).not.toMatch(/path="\/admin/);
    expect(app).not.toMatch(/path="\/staff/);
  });

  it('the Library route is the production discovery surface', () => {
    const lib = read('app/src/features/library/routes/LibraryRoute.tsx');
    // Server-side discovery: the UI never fetches the full Episode list
    // and filters in React.
    expect(lib).toContain('getLibrary');
    expect(lib).not.toContain('getLessonList');
    // Reuses the Slice 5 EpisodeCard foundation (no parallel card system).
    expect(lib).toContain('EpisodeCard');
    // URL-backed discovery state (refresh/back preserve the journey).
    expect(lib).toContain('useSearchParams');
    expect(lib).toContain('libraryQueryToSearch');
    // Browsing is read-only: no level mutation anywhere in the route.
    expect(lib).not.toContain('selected_level');
    expect(lib).not.toContain('suggested_level');
  });

  it('the Progress route stays level-aware (server-scoped summary)', () => {
    const progress = read('app/src/features/progress/routes/ProgressRoute.tsx');
    expect(progress).toContain('getProgressSummary');
    expect(progress).toContain('selectedLevel');
  });
});
