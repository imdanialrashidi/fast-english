import { expect, test } from '@playwright/test';

// Landing contract, owner rewrite 2026-11-22: a paid conversion page with
// the 16,355 learner figure, the 990,000 → 641,000 offer, real library
// numbers, TED Talks, and support in Bale/Telegram on 09936908633.
// No free sample, no trial CTA, no public audio. No horizontal scroll and
// every touch target is at least 44px.

async function checkLanding(page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /تنها پادکست استاندارد/ })).toBeVisible();

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

test('S8 landing 360: promise, offer, support, and library proof', async ({ page }) => {
  await checkLanding(page, 360);

  await expect(page.getByText('DRAFT')).toHaveCount(0);
  await expect(page.getByText('۱۶٬۳۵۵').first()).toBeVisible();
  await expect(page.getByText('۶۴۱٬۰۰۰ تومان', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('۹۹۰٬۰۰۰ تومان', { exact: true })).toBeVisible();

  // The two support number placements are visible without opening a menu.
  await expect(page.getByText('09936908633').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'پیام در بله' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'پیام در تلگرام' }).first()).toBeVisible();

  // The paid path and its explicit price are one tap away.
  await expect(page.getByRole('link', { name: /شروع کن با .* تخفیف/ }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'کتابخانهٔ فست انگلیش' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'پرسش‌های شما' })).toBeVisible();
  await expect(page.getByText('فست انگلیش برای چه کسی ساخته شده؟')).toBeVisible();

  // No free sample and no public audio exist on this page.
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.getByText('نمونه رایگان')).toHaveCount(0);
  await expect(page.locator('a[href="/sample"]')).toHaveCount(0);

  // Landing/app separation: no guest-facing link may enter the app.
  const appLinks = await page.locator('a[href^="/app"]').count();
  expect(appLinks).toBe(0);

  const html = await page.content();
  expect(html).toContain('lang="fa"');
  await page.screenshot({ path: 'test-results/browser-shots/s8-landing-360.png', fullPage: true });
});

test('S8 landing 390: same states recomposed', async ({ page }) => {
  await checkLanding(page, 390);
  await expect(page.getByText('۱۶٬۳۵۵').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'پیام در بله' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'پیام در تلگرام' }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/browser-shots/s8-landing-390.png', fullPage: true });
});

test('S8 landing reduced-motion: content renders without animation', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /تنها پادکست استاندارد/ })).toBeVisible();
  // No entrance animation may hide the promise when motion is reduced.
  const hero = page.locator('section[aria-label="معرفی Fast English"]');
  await expect(hero).toBeVisible();
  const opacity = await hero.evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
  await expect(page.getByRole('heading', { name: /TED/ }).first()).toBeVisible();
  await ctx.close();
});

test('S8 landing exposes real support destinations and no audio player', async ({ page }) => {
  await page.goto('/');

  const bale = page.getByRole('link', { name: 'پیام در بله' }).first();
  await expect(bale).toHaveAttribute('href', 'https://ble.ir/+989936908633');
  await expect(bale).toHaveAttribute('target', '_blank');

  const telegram = page.getByRole('link', { name: 'پیام در تلگرام' }).first();
  await expect(telegram).toHaveAttribute('href', 'https://t.me/+989936908633');

  const phone = page.getByRole('link', { name: /تماس با پشتیبانی/ }).first();
  await expect(phone).toHaveAttribute('href', 'tel:+989936908633');

  await expect(page.locator('audio')).toHaveCount(0);
});
