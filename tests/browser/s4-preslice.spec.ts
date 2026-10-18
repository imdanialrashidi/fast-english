import { expect } from '@playwright/test';
import { test } from './helpers';

// S4 pre-slice 3+4: fixed 16/9 card container re-measured at 320/360/390,
// plus pagination rendering with >=13 labelled topics (S4PaginationSeeder).
// Fixture labels are s4-paginate-NN; S1/S3 fixtures supply the rest.


async function mediaRatio(page): Promise<number> {
  const box = await page.locator('.fe-card-media').first().boundingBox();
  if (!box) throw new Error('no card media found');
  return box.width / box.height;
}

for (const width of [320, 360, 390]) {
  test(`S4 pre-slice cover ratio at ${width}px stays 16/9`, async ({ sub: page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/app');
    await page.locator('.fe-card-media').first().waitFor();

    const ratio = await mediaRatio(page);
    // 16/9 = 1.777...; tolerance is subpixel rounding only (the old
    // 1.68-1.88 range is explained in the exec plan as ±0.1 around 1.777).
    expect(ratio).toBeGreaterThan(1.72);
    expect(ratio).toBeLessThan(1.83);

    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.scrollingElement?.scrollWidth ?? 0,
      inner: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(inner);
  });
}

test('S4 pre-slice cover ratio matches across widths', async ({ sub: page }) => {
  const ratios: number[] = [];
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/app');
    await page.locator('.fe-card-media').first().waitFor();
    ratios.push(await mediaRatio(page));
  }
  const spread = Math.max(...ratios) - Math.min(...ratios);
  expect(spread).toBeLessThan(0.05);
});

test('S4 pre-slice pagination renders and works at 360px with 44px targets', async ({ sub: page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/app');
  await page.locator('article.fe-card').first().waitFor();

  const countText = await page.getByRole('status').first().textContent();
  const total = Number(countText?.replace(/[^0-9]/g, '') ?? '0');
  expect(total).toBeGreaterThanOrEqual(13);

  const cardsPage1 = await page.locator('article.fe-card').count();
  expect(cardsPage1).toBe(12);

  const pagination = page.locator('nav.fe-pagination, .fe-pagination nav');
  await expect(pagination.first()).toBeVisible();

  // Every pagination link meets the 44px target.
  const links = pagination.first().getByRole('link');
  const linkCount = await links.count();
  expect(linkCount).toBeGreaterThan(0);
  for (let i = 0; i < linkCount; i++) {
    const box = await links.nth(i).boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }

  // Page two loads one or more labelled fixtures and keeps no-scroll.
  const page2 = pagination.first().getByRole('link', { name: '2' });
  if (await page2.count()) {
    await page2.first().click();
    await page.waitForURL('**page=2**');
    await page.locator('article.fe-card').first().waitFor();
    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.scrollingElement?.scrollWidth ?? 0,
      inner: window.innerWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(inner);
  }

  await page.screenshot({ path: 'test-results/browser-shots/s4-pagination-360.png' });
});
