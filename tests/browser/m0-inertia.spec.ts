import { expect, test } from '@playwright/test';

// M0 Inertia foundation: the landing page renders through the full
// Laravel → Inertia → React path. Owner rewrite 2026-11-22: the page
// sells the paid library, carries the owner learner count and offer, and
// puts the support channel in the chrome. No free sample exists here.
test('landing renders the React page with the offer and support paths', async ({ page }) => {
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      pageErrors.push(message.text());
    }
  });
  // Lane note: two S3 cover fixtures are absent from this checkout's
  // storage/ (the Blade /app library 403s on the same files), so
  // fixture misses under /storage/ are tolerated here — anything else
  // failing is a real regression.
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto('/');

  // Document contract: fa RTL, permanent light (no theme attribute).
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const hasThemeAttr = await page.locator('html').evaluate((el) => el.hasAttribute('data-theme'));
  expect(hasThemeAttr).toBe(false);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

  // Transport proof: the React root mounted the Landing page component.
  // (Inertia v3.5 encodes the page in <script data-page type=json>.)
  const component = await page.locator('script[data-page="app"]').evaluate((el) => {
    const raw = el.textContent;
    if (!raw) throw new Error('empty page JSON');
    return (JSON.parse(raw) as { component: string }).component;
  });
  expect(component).toBe('Landing/Index');
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('#app')).toContainText('تنها پادکست استاندارد');

  // The owner's figures and price are the first thing a buyer reads.
  await expect(page.getByText('۱۶٬۳۵۵').first()).toBeVisible();
  await expect(page.getByText('۶۴۱٬۰۰۰ تومان', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('۹۹۰٬۰۰۰ تومان', { exact: true })).toBeVisible();

  // Support: chrome strip plus the inline paths, all on the confirmed
  // number, with Bale and Telegram as real external destinations.
  await expect(page.getByText('09936908633').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'پیام در بله' }).first()).toHaveAttribute('href', 'https://ble.ir/+989936908633');
  await expect(page.getByRole('link', { name: 'پیام در تلگرام' }).first()).toHaveAttribute('href', 'https://t.me/+989936908633');

  // FAQ and the paid CTA render; no sample path and no audio player.
  await expect(page.locator('#app')).toContainText('برای چه سطحی مناسب است؟');
  await expect(page.getByRole('link', { name: /ثبت‌نام و فعال‌سازی دسترسی/ })).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('a[href="/sample"]')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
  expect(badResponses.filter((line) => !line.includes('/storage/'))).toEqual([]);

  await page.screenshot({ path: 'test-results/browser-shots/m0-landing-desktop.png', fullPage: true });
});

test('landing has no horizontal overflow on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: 'test-results/browser-shots/m0-landing-390.png', fullPage: false });
});
