import { expect, test, type Page } from '@playwright/test';

// Install guide (owner 2026-10-26): one public page with the iPhone, Android,
// and desktop walkthroughs. iPhone Safari never fires beforeinstallprompt, so
// this page is the only install path there — it has to be readable at 360 and
// reachable from the download page.

async function checkGuide(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/install');
  await expect(page.getByRole('heading', { name: 'نصب روی گوشی' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /iPhone/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'اندروید' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'کامپیوتر' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'بعد از نصب' })).toBeVisible();

  // The Apple-specific label is visible and stays LTR.
  await expect(page.getByText('Add to Home Screen', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Add to Home Screen', { exact: true })).toHaveAttribute('dir', 'ltr');

  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth);

  // Primary actions keep 44px touch targets.
  for (const name of ['ساخت حساب', 'نمونهٔ رایگان', 'صفحهٔ دانلود']) {
    const box = await page.getByRole('link', { name }).first().boundingBox();
    expect(box, `${name} has a box`).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  expect(errors).toEqual([]);
  await page.screenshot({ path: `test-results/browser-shots/install-guide-${width}.png` });
}

test('install guide 360: iPhone, Android, desktop and after-install steps', async ({ page }) => {
  await checkGuide(page, 360);
});

test('install guide 1440: same content recomposed', async ({ page }) => {
  await checkGuide(page, 1440);
});

test('download links to the install guide', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/download');
  await page.getByRole('link', { name: 'راهنمای نصب روی گوشی' }).click();
  await page.waitForURL('**/install');
  await expect(page.getByRole('heading', { name: 'نصب روی گوشی' })).toBeVisible();
});
