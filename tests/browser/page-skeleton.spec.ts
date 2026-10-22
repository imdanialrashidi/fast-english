import { expect, test } from '@playwright/test';

// Owner follow-up 2026-10-22: in-app navigation shows a skeleton only
// while the next page is actually loading, then disappears. The route is
// delayed here so the state is observable instead of flashing. Service
// workers are blocked so Playwright can intercept the Inertia XHR.

test('in-app navigation shows a skeleton while the reader loads', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto('/login');
    await page.getByLabel('ایمیل', { exact: true }).fill('browser-sub@example.com');
    await page.getByLabel('رمز عبور', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'ورود', exact: true }).click();
    await page.waitForURL('**/account**');

    await page.route('**/app/topics/**', async (route) => {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 800);
      await promise;
      await route.continue();
    });

    await page.goto('/app');
    await page.getByRole('link', { name: /The City Park/ }).first().click();

    await expect(page.locator('[data-page-skeleton]')).toBeVisible();
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'test-results/browser-shots/page-skeleton-390.png' });
    await expect(page.locator('article.fe-english-body')).toBeVisible();
    await expect(page.locator('[data-page-skeleton]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
