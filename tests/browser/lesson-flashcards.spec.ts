import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './helpers';

// The only flashcard deck left (owner decision 2026-11-18): an article's
// glossary, opened from the reader, four grades, and the vocabulary
// notebook as the single schedule. Book decks are gone.

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test('article deck: glossary cards, four grades and notebook sync', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    await page.goto('/app/topics/morning-market?level=A1');
    await page.getByRole('link', { name: /فلش‌کارت واژه‌های این مقاله/ }).click();

    await expect(page.getByRole('heading', { name: 'فلش‌کارت واژه‌ها' })).toBeVisible();
    await expect(page.getByText('۳ واژه', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/lesson-deck-393.png', fullPage: true });

    await page.locator('[data-flashcard-start-button]').click();

    const card = page.locator('[data-flashcard-card]');
    await expect(page.locator('[data-flashcard-word]')).toHaveText('crowded');
    await expect(card).toHaveAttribute('data-revealed', 'false');
    await page.locator('[data-flashcard-reveal]').click();
    await expect(card).toHaveAttribute('data-revealed', 'true');
    await expect(page.getByText('شلوغ')).toBeVisible();

    for (const grade of ['again', 'hard', 'good', 'easy']) {
        await expect(page.locator(`[data-flashcard-grade="${grade}"]`)).toBeVisible();
    }

    await page.locator('[data-flashcard-grade="good"]').click();
    await expect(page.locator('[data-flashcard-word]')).toHaveText('fresh');
    await expect(card).toHaveAttribute('data-revealed', 'false');
    await page.locator('[data-flashcard-reveal]').click();
    await page.locator('[data-flashcard-grade="easy"]').click();
    await expect(page.locator('[data-flashcard-word]')).toHaveText('seller');
    await page.locator('[data-flashcard-reveal]').click();
    await page.locator('[data-flashcard-grade="good"]').click();

    await expect(page.locator('[data-flashcard-summary]')).toBeVisible();
    await expect(page.getByText('بلدم').first()).toBeVisible();
    await expect(page.getByText('نیاز به مرور').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/lesson-deck-summary-393.png', fullPage: true });

    // Grading writes the notebook row; the deck is not a parallel schedule.
    await page.goto('/app/words');
    await expect(page.getByText('crowded').first()).toBeVisible();
    await expect(page.getByText('fresh').first()).toBeVisible();
});

test('article deck reflows at 320 px', async ({ sub: page }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    await page.goto('/app/topics/morning-market?level=A1');
    await page.getByRole('link', { name: /فلش‌کارت واژه‌های این مقاله/ }).click();
    await expectNoHorizontalOverflow(page);
    await page.locator('[data-flashcard-start-button]').click();
    await page.locator('[data-flashcard-reveal]').click();
    await expect(page.locator('[data-flashcard-grade="good"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
});
