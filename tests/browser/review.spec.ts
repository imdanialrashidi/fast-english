import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './helpers';

// Review hub (owner request 2026-11-15; book cards retired 2026-11-18):
// due words and exercise mistakes in one read-only page, reachable from
// Today and the books shelf, with one deterministic primary action.

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test('review hub: two queues, primary action and 320 reflow', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    await page.goto('/app/today');
    await page.getByRole('link', { name: /مرور همه/ }).click();

    await expect(page.getByRole('heading', { name: 'مرور', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'واژه‌های من' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'تمرین‌های کتاب' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'کارت‌های کتاب' })).toHaveCount(0);
    await expect(page.locator('[data-review-count]')).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/review-hub-393.png', fullPage: true });

    const primary = page.locator('[data-review-primary]');
    await expect(primary).toBeVisible();
    const target = await primary.getAttribute('href');
    expect(target).not.toBeNull();

    await Promise.all([
        page.waitForURL((url) => url.pathname === new URL(target as string, page.url()).pathname),
        primary.click(),
    ]);
    await expect(page).not.toHaveURL(/\/app\/review$/);

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/app/review');
    await expectNoHorizontalOverflow(page);
});

test('the books shelf links to the review hub', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    await page.goto('/app/books');
    await page.getByRole('link', { name: 'مرور واژه‌ها و تمرین‌ها' }).click();

    await expect(page.getByRole('heading', { name: 'مرور', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'تمرین‌های کتاب' })).toBeVisible();
});
