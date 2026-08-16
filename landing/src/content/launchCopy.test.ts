// landing/src/content/launchCopy.test.ts
// Business Configuration slice — landing copy invariants for the accepted
// launch model:
//   - no yearly/365-day plan is offered anywhere in landing copy;
//   - real prices are NOT hard-coded into landing source (they come from
//     the runtime public settings endpoint — PlanPricing renders them);
//   - a prominent iOS install path exists and links to /install#ios;
//   - no fake App Store / direct-install claim exists;
//   - support and collaboration pages consume the SAME configurable
//     contact component (no duplicated env values).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { quarterlySavingPercent } from '../components/PlanPricing';

const root = resolve(__dirname, '..', '..');

const sources = [
  'src/pages/HomePage.tsx',
  'src/pages/InstallPage.tsx',
  'src/pages/HowItWorksPage.tsx',
  'src/pages/TermsPage.tsx',
  'src/pages/SamplePage.tsx',
  'src/pages/ContactPage.tsx',
  'src/pages/CollaborationPage.tsx',
  'src/pages/PrivacyPage.tsx',
  'src/pages/AboutPage.tsx',
  'src/sections/Hero.tsx',
  'src/sections/WhyLevelsSection.tsx',
  'src/sections/HowItWorks.tsx',
  'src/sections/ExperienceSection.tsx',
  'src/sections/CefrSection.tsx',
  'src/sections/SampleLesson.tsx',
  'src/sections/PaymentSection.tsx',
  'src/sections/InstallSection.tsx',
  'src/sections/FaqSection.tsx',
  'src/sections/FinalCta.tsx',
  'src/sections/Footer.tsx',
  'src/components/PlanPricing.tsx',
  'src/content/siteContent.ts',
  'src/content/sampleContent.ts',
].map((p) => resolve(root, p));

const copy = sources.map((p) => readFileSync(p, 'utf8')).join('\n');

describe('launch pricing copy', () => {
  it('never mentions a 365-day/yearly plan', () => {
    expect(copy).not.toMatch(/۳۶۵/);
    expect(copy).not.toMatch(/سالانه/);
  });

  it('never hard-codes a plan price in landing source', () => {
    // Prices must come from the runtime settings endpoint. Hard-coding
    // 299000/807300 here would silently drift from the `plans` collection.
    expect(copy).not.toMatch(/۲۹۹٬۰۰۰|299000|807300|۸۰۷٬۳۰۰/);
  });

  it('derives the quarterly saving from plan data, not literal copy', () => {
    // 807,300 = 10% off 3 × 299,000 → badge shows ۱۰٪.
    const plans = [
      {
        id: 'a',
        name: 'ماهانه',
        slug: 'monthly',
        durationDays: 30,
        priceToman: 299000,
        displayOrder: 1,
        description: '',
      },
      {
        id: 'b',
        name: 'سه ماهه',
        slug: 'quarterly',
        durationDays: 90,
        priceToman: 807300,
        displayOrder: 2,
        description: '',
      },
    ] as Parameters<typeof quarterlySavingPercent>[0];
    expect(quarterlySavingPercent(plans)).toBe(10);
    // A non-discounted quarterly (exactly 3x monthly) shows nothing.
    const flat = [{ ...plans[0] }, { ...plans[1], priceToman: 3 * 299000 }];
    expect(quarterlySavingPercent(flat)).toBeNull();
  });
});

describe('iOS install experience', () => {
  it('home install section offers an iOS CTA pointing at /install#ios', () => {
    const section = readFileSync(resolve(root, 'src/sections/InstallSection.tsx'), 'utf8');
    expect(section).toContain('/install#ios');
    expect(section).toContain('نصب روی iPhone / iPad');
  });

  it('install page has an anchored iOS section with the Safari flow', () => {
    const page = readFileSync(resolve(root, 'src/pages/InstallPage.tsx'), 'utf8');
    expect(page).toMatch(/id="ios"/);
    expect(page).toContain('نصب روی iPhone / iPad');
    expect(page).toContain('Add to Home Screen');
    expect(page).toContain('Share');
    expect(page).toContain('Open as Web App');
    // Honest: no App Store app and no direct-install link may be claimed.
    expect(page).toContain('فروشگاه اپل وجود ندارد');
    expect(page).toContain('لینک مستقیم نصب هم ارائه نشده است');
    expect(page).not.toMatch(/apps\.apple\.com|itunes\.apple\.com/);
  });
});

describe('support/collaboration single source', () => {
  it('contact and collaboration pages use the shared SupportContact component', () => {
    const contact = readFileSync(resolve(root, 'src/pages/ContactPage.tsx'), 'utf8');
    const collaboration = readFileSync(resolve(root, 'src/pages/CollaborationPage.tsx'), 'utf8');
    expect(contact).toContain('SupportContact');
    expect(collaboration).toContain('SupportContact');
  });

  it('no VITE_SUPPORT_URL environment duplication remains', () => {
    expect(copy).not.toMatch(/VITE_SUPPORT_URL/);
  });
});
