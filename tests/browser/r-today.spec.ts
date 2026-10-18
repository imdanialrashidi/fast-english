import { expect } from '@playwright/test';
import { test } from './helpers';

// R5 Today (PLAN-01, AC-26): greeting, continue section, plan, goal ring,
// and recommendations render from persisted state. Paid-only slice: the
// subscribed lane account drives these captures; derivation from progress
// stays proven in Pest (R5DailyPlanTest) and the review flow in r-words.


async function noHorizontalScroll(page) {
  return page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }));
}

test('R5 today at 390px: greeting, goal default, empty plan, tab bar', async ({ sub: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Paid-only slice: Today needs the subscribed lane account (plan
  // derivation from progress stays proven in Pest R5DailyPlanTest).
  await page.goto('/app/today');

  await expect(page.getByRole('heading', { name: 'امروز هم قدمی بزرگ به سمت هدف‌هات برداشتی.' })).toBeVisible();
  await expect(page.getByText('هدف امروز: 10 دقیقه مطالعه')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'برنامه امروز' })).toBeVisible();

  const { scroll, inner } = await noHorizontalScroll(page);
  expect(scroll).toBeLessThanOrEqual(inner);

  // Mobile tab bar: exactly the four student destinations.
  const tabs = page.locator('.fe-bottomnav a');
  await expect(tabs).toHaveCount(4);
  for (const name of ['امروز', 'کشف', 'واژه‌ها', 'حساب']) {
    await expect(page.locator('.fe-bottomnav').getByRole('link', { name })).toBeVisible();
  }

  await page.screenshot({ path: 'test-results/browser-shots/r-today-390.png' });
});

test('R5 today at 1440px: sidebar shell, same IA as mobile', async ({ sub: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/today');

  await expect(page.locator('.fe-sidebar')).toBeVisible();
  await expect(page.locator('.fe-bottomnav')).toBeHidden();
  await expect(page.locator('.fe-sidebar').getByRole('link', { name: 'امروز' })).toHaveAttribute('aria-current', 'page');

  const { scroll, inner } = await noHorizontalScroll(page);
  expect(scroll).toBeLessThanOrEqual(inner + 1);

  await page.screenshot({ path: 'test-results/browser-shots/r-today-1440.png' });
});
