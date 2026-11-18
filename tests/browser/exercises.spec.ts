import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './helpers';

// The grammar-first unit page (owner request 2026-11-16): topics and their
// questions in order, one answer marked in place with Persian feedback,
// first answer counted once, progress persisted and read on shelf/book.

const UNIT = '/app/books/aef-3e-starter/1';

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test('unit page: topics, an answered question and persisted progress', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    await page.goto(UNIT);
    await expect(page.getByRole('heading', { name: 'A cappuccino, please' })).toBeVisible();
    await expect(page.getByText('verb be (singular): I and you')).toBeVisible();
    await expect(page.getByText('پیشرفت')).toContainText('۰ از ۱۸ سؤال');
    await expectNoHorizontalOverflow(page);

    const first = page.locator('article').nth(1);
    await first.locator('button[data-option-index="1"]').click();
    await first.getByRole('button', { name: 'بررسی پاسخ' }).click();

    await expect(first.getByText('پاسخ درست نیست.')).toBeVisible();
    await expect(first.getByText('پاسخ درست:')).toBeVisible();
    await expect(first.getByText('با I از am استفاده می‌کنیم')).toBeVisible();
    await expect(page.getByText('پیشرفت')).toContainText('۱ از ۱۸ سؤال');

    await page.screenshot({ path: 'test-results/browser-shots/unit-first-answer-393.png', fullPage: true });

    // The first answer survives a reload and is still counted once.
    await page.reload();
    await expect(page.getByText('پیشرفت')).toContainText('۱ از ۱۸ سؤال');
    await expect(page.locator('article').nth(1).getByText('پاسخ درست:')).toBeVisible();

    // The book list and the shelf read the same progress.
    await page.goto('/app/books/aef-3e-starter');
    await expect(page.locator('[data-unit-exercise-status]').first()).toContainText('۱ از ۱۸ سؤال');

    await page.goto('/app/books');
    await expect(page.locator('[data-book-exercise]').first()).toContainText('۱ از');
});

test('matching pairs are tappable at 320 and keep their answer', async ({ sub: page }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    await page.goto(UNIT);
    const matching = page.locator('article').filter({ hasText: 'هر نیمهٔ جمله را' });
    await expect(matching).toBeVisible();

    const left = matching.locator('button').filter({ hasText: "Hello, I'm" });
    await left.click();
    await matching.locator('button').filter({ hasText: 'Maria.' }).click();

    await expect(left).toContainText('Maria.');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/unit-matching-320.png', fullPage: true });
});
