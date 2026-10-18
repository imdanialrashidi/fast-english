import { expect } from '@playwright/test';
import { test } from './helpers';

// S3-4 browser proof: filter/search on the real library (fe_browser seed:
// S1 + S3 fixtures + S4 labelled pagination fixtures for the pre-slice
// item 4). State lives in the URL query string, so reload and
// back/forward preserve it.
//

// Paid-only slice: the library needs an active subscription, so every leg
// signs in with the subscribed lane account first.

// S4 pre-slice adaptation: the lane now holds >=13 visible topics, so the
// unfiltered first page shows 12 cards (pagination) instead of 4. Filter
// expectations that are unaffected by the A1-only S4 fixtures (category,
// title, B1, empty C2) keep their counts; the A1 and reset legs expect 12.

test('S3-4 library shows one card per visible topic and hides the rest', async ({ sub: page }) => {
  await page.goto('/app');

  const cards = page.locator('article.fe-card');
  // S4 pagination fixtures: 12 per page, total >=13.
  await expect(cards).toHaveCount(12);

  await expect(page.getByRole('heading', { name: 'The City Park' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Night Trains' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Morning Market' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rainy Day' })).toBeVisible();

  for (const hidden of ['Hidden Draft Notebook', 'Empty Shelf', 'Archived Whisper']) {
    await expect(page.getByRole('heading', { name: hidden })).toHaveCount(0);
  }
});

test('S3-4 level and category filters plus title search narrow correctly', async ({ sub: page }) => {
  // A1 now includes the 12 labelled S4 fixtures + Morning Market = 13
  // total, 12 on the first page.
  await page.goto('/app?level=A1');
  await expect(page.locator('article.fe-card')).toHaveCount(12);
  await expect(page.getByRole('heading', { name: 'Morning Market' })).toBeVisible();

  await page.goto('/app?category=story');
  await expect(page.locator('article.fe-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Rainy Day' })).toBeVisible();

  await page.goto('/app?q=market');
  await expect(page.locator('article.fe-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Morning Market' })).toBeVisible();
});

test('S3-4 empty result explains itself and the reset restores the list', async ({ sub: page }) => {
  await page.goto('/app?level=C2');

  await expect(page.getByText('مطلبی با این مشخصات پیدا نشد')).toBeVisible();
  await expect(page.locator('article.fe-card')).toHaveCount(0);

  await page.getByRole('link', { name: 'پاک کردن فیلترها' }).first().click();
  await expect(page).toHaveURL(/\/app(\?.*)?$/);
  await expect(page.locator('article.fe-card')).toHaveCount(12);
});

test('S3-4 filter state survives UI change, reload, and back navigation', async ({ sub: page }) => {
  await page.goto('/app');

  // Premium pill filters are links carrying the same GET params: clicking
  // a level pill navigates to the filtered URL (back/forward compatible).
  await page.getByRole('group', { name: 'سطح' }).getByRole('link', { name: 'B1', exact: true }).click();
  await expect(page).toHaveURL(/level=B1/);
  // city-park (B1), night-trains (B1), rainy-day (B1 sample).
  await expect(page.locator('article.fe-card')).toHaveCount(3);

  await page.reload();
  await expect(page).toHaveURL(/level=B1/);
  await expect(page.locator('article.fe-card')).toHaveCount(3);

  await page.goBack();
  await expect(page).toHaveURL(/\/app(\?.*)?$/);
  await expect(page.locator('article.fe-card')).toHaveCount(12);
});
