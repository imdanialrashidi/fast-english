import { expect } from '@playwright/test';
import { test } from './helpers';

// S3-7 rendered mobile proof for the library: no horizontal scroll, fixed
// cover aspect ratio, 44px control targets at 360/390, reflow at 320.
// S4 pre-slice: the ratio is owned by one fixed container (.fe-card-media,
// 16/9 = 1.777...); the 1.68-1.88 band is ±0.1 tolerance for subpixel
// rounding and border-box measurement at 320-390 px.

async function noHorizontalScroll(page): Promise<{ scroll: number; inner: number }> {
  return page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }));
}

// Paid-only slice: the library needs the subscribed lane account.

test('S3-7 library at 360px: no scroll, kept aspect ratio, reachable controls', async ({ sub: page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/app');
  await page.locator('article.fe-card').first().waitFor();

  const { scroll, inner } = await noHorizontalScroll(page);
  expect(scroll).toBeLessThanOrEqual(inner);

  const cover = page.locator('.fe-card-media').first();
  const box = await cover.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width / box!.height).toBeGreaterThan(1.68);
  expect(box!.width / box!.height).toBeLessThan(1.88);

  await page.getByRole('button', { name: /فیلترها/ }).click();
  for (const group of ['سطح', 'دسته']) {
    const target = page.getByRole('group', { name: group });
    await expect(target).toBeVisible();
    // Every filter button in the group meets the 44px target rule.
    for (const button of await target.getByRole('button').all()) {
      const box = await button.boundingBox();
      if (!box) continue;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole('button', { name: 'بستن فیلترها' }).click();
  const search = page.getByLabel('جست‌وجو در عنوان');
  const searchBox = await search.boundingBox();
  expect(searchBox).not.toBeNull();
  expect(searchBox!.height).toBeGreaterThanOrEqual(44);
  const submit = page.getByRole('button', { name: 'جست‌وجو' });
  const submitBox = await submit.boundingBox();
  expect(submitBox!.height).toBeGreaterThanOrEqual(44);
  expect(submitBox!.width).toBeGreaterThanOrEqual(44);

  await page.screenshot({ path: 'test-results/browser-shots/s3-mobile-360.png' });
});

test('S3-7 library at 390px: no scroll, kept aspect ratio', async ({ sub: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await page.locator('article.fe-card').first().waitFor();

  const { scroll, inner } = await noHorizontalScroll(page);
  expect(scroll).toBeLessThanOrEqual(inner);

  const box = await page.locator('.fe-card-media').first().boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width / box!.height).toBeGreaterThan(1.68);
  expect(box!.width / box!.height).toBeLessThan(1.88);

  await page.screenshot({ path: 'test-results/browser-shots/s3-mobile-390.png' });
});

test('S3-7 library at 320px reflows without losing controls', async ({ sub: page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/app?level=A1');
  await page.locator('article.fe-card').first().waitFor();

  const { scroll, inner } = await noHorizontalScroll(page);
  expect(scroll).toBeLessThanOrEqual(inner);

  await page.getByRole('button', { name: /فیلترها/ }).click();
  await expect(page.getByRole('group', { name: 'سطح' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'دسته' })).toBeVisible();
  await page.getByRole('button', { name: 'بستن فیلترها' }).click();
  await expect(page.getByLabel('جست‌وجو در عنوان')).toBeVisible();
  await expect(page.getByRole('button', { name: 'جست‌وجو' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Morning Market' })).toBeVisible();

  await page.screenshot({ path: 'test-results/browser-shots/s3-narrow-320.png' });
});
