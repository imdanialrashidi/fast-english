import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './helpers';

// Owner decisions 2026-11-21/22: the books shelf has five items and each one
// keeps its own hierarchy. This spec proves the navigation skeleton without
// pretending that a preparing leaf has content.

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test('the books shelf shows the five items and each track drills down', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books');

    await expect(page.getByRole('heading', { name: 'کتاب‌ها', exact: true })).toBeVisible();
    for (const name of ['کتاب', 'استوری‌بوک', 'کمبریج آیلتس', 'اینساید ریدینگ', 'TED Talk']) {
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/library-shelf-393.png', fullPage: true });

    await page.getByRole('heading', { name: 'TED Talk', exact: true }).click();
    await page.waitForURL('**/app/ted');
    await expect(page.getByRole('heading', { name: 'ایده‌های بزرگ، هر کدام یک صفحهٔ جدا.' })).toBeVisible();

    await page.goto('/app/books');
    await page.getByRole('heading', { name: 'استوری‌بوک', exact: true }).click();
    await page.waitForURL('**/app/books/story');
    await expect(page.getByRole('heading', { name: 'استوری‌بوک', exact: true }).last()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Starter', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/library-story-levels-393.png', fullPage: true });

    await page.getByRole('heading', { name: 'Starter', exact: true }).click();
    await page.waitForURL('**/app/books/story/a2');
    await expect(page.getByRole('heading', { name: 'پلیس تلویزیون', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-story-books-393.png', fullPage: true });

    await page.goto('/app/books/ielts');
    await expect(page.getByRole('heading', { name: 'کمبریج آیلتس ۱۹', exact: true })).toBeVisible();
    await page.goto('/app/books/ielts/19');
    await expect(page.getByRole('heading', { name: 'آکادمیک', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'جنرال', exact: true })).toBeVisible();
    await page.goto('/app/books/ielts/19/academic');
    await expect(page.getByRole('link', { name: /تست ۱/ })).toBeVisible();
    await page.goto('/app/books/ielts/19/academic/test-1');
    await expect(page.locator('a[href$="/test-1/passage-1"]')).toBeVisible();
    await page.goto('/app/books/ielts/19/academic/test-1/passage-1');
    await page.setViewportSize({ width: 393, height: 851 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-passage-393.png', fullPage: true });

    // 19 also has the real General Training structure (sections, not passages).
    await page.goto('/app/books/ielts/19/general');
    await expect(page.getByRole('link', { name: /تست ۱/ })).toBeVisible();
    await page.goto('/app/books/ielts/19/general/test-1');
    await expect(page.locator('a[href$="/section-1"]')).toBeVisible();

    // 20 and 21 are Academic only.
    await page.goto('/app/books/ielts/20');
    await expect(page.getByRole('heading', { name: 'آکادمیک', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'جنرال', exact: true })).toHaveCount(0);

    await page.goto('/app/books/inside-reading');
    await expect(page.getByRole('heading', { name: 'مقدماتی', exact: true })).toBeVisible();
    await page.goto('/app/books/inside-reading/intro');
    await expect(page.locator('a[href$="/intro/unit-1"]')).toBeVisible();
    await page.goto('/app/books/inside-reading/intro/unit-1');
    await expect(page.locator('a[href$="/unit-1/reading-1"]')).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ir-readings-393.png', fullPage: true });
});

test('the American English File item keeps its pages and covers', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/american-english-file');

    await expect(page.getByRole('heading', { name: 'کتاب', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'American English File Starter' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/library-aef-shelf-393.png', fullPage: true });
});
