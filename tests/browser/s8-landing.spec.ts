import { expect, test } from '@playwright/test';

// Slice redesign: the landing is real copy with a hero, a working
// sample preview, the three-step method, the real sample, newest topics,
// the DB plan list (sales-on lane), FAQ, and a final CTA. No DRAFT
// badge, no fabricated claims. No horizontal scroll and every touch
// target is at least 44px.

async function checkLanding(page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'انگلیسی را با داستان‌های کوتاه بخوان و بشنو' })).toBeVisible();
  // No horizontal scroll.
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth);

  // Every visible link/button is at least 44px in both dimensions.
  const small = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, button'));
    return els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { text: (el.textContent ?? '').trim().slice(0, 30), w: r.width, h: r.height };
      })
      .filter((m) => m.w < 44 || m.h < 44);
  });
  expect(small).toEqual([]);

  expect(errors).toEqual([]);
}

test('S8 landing 360: hero, preview, sample, plans, download, faq', async ({ page }) => {
  await checkLanding(page, 360);
  await expect(page.getByText('DRAFT')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'شروع با نمونه رایگان' }).first()).toBeVisible();
  await expect(page.getByLabel('پیش‌نمایش روش یادگیری با نمونه واقعی')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تازه‌ترین مطالب' })).toBeVisible();
  // Sales-on lane state: DB plan names with durations (never amounts),
  // a registration CTA, and no preparing-state text.
  await expect(page.getByText('یک‌ماهه آزمایشی (TEST)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ساخت حساب و خرید' }).first()).toBeVisible();
  await expect(page.getByText('در دست آماده‌سازی')).toHaveCount(0);
  // No real APK is published in the lane, so the sample is primary and
  // the download entry is the honest status link.
  await expect(page.getByRole('link', { name: 'وضعیت نسخه اندروید' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'مشاهده همه پرسش‌ها' })).toBeVisible();
  // Landing/app separation: no guest-facing link may enter the app.
  const appLinks = await page.locator('a[href^="/app"]').count();
  expect(appLinks).toBe(0);
  const html = await page.content();
  expect(html).toContain('lang="fa"');
  await page.screenshot({ path: 'test-results/browser-shots/s8-landing-360.png' });
});

test('S8 landing 390: same states recomposed', async ({ page }) => {
  await checkLanding(page, 390);
  await expect(page.getByText('یک‌ماهه آزمایشی (TEST)')).toBeVisible();
  await page.screenshot({ path: 'test-results/browser-shots/s8-landing-390.png' });
});

test('S8 landing reduced-motion: content renders without animation', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'انگلیسی را با داستان‌های کوتاه بخوان و بشنو' })).toBeVisible();
  // M0 port (ADR-0002): the React landing renders statically with the
  // reduced-motion kill-switch in CSS — same oracle as the Blade
  // .fe-preview check, via the stable aria labels instead of fe-* classes.
  const preview = page.getByLabel('پیش‌نمایش روش یادگیری با نمونه واقعی');
  await expect(preview).toBeVisible();
  const opacity = await preview.evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
  await expect(page.locator('section[aria-label="پیش‌نمایش روش یادگیری با نمونه واقعی"] p[lang="en"]').first()).toBeVisible();
  await ctx.close();
});

test('S8 landing hero preview plays the real public sample', async ({ page }) => {
  await page.goto('/');
  const audio = page.locator('audio');
  await expect(audio).toHaveCount(1);

  await page.getByRole('button', { name: 'پخش نمونه صوتی' }).click();
  await expect.poll(() => audio.evaluate((el) => !(el as HTMLAudioElement).paused), { timeout: 5000 }).toBe(true);
  await expect(page.getByRole('button', { name: 'توقف پخش نمونه' })).toBeVisible();

  await page.getByRole('button', { name: 'توقف پخش نمونه' }).click();
  await expect.poll(() => audio.evaluate((el) => (el as HTMLAudioElement).paused), { timeout: 5000 }).toBe(true);
});
