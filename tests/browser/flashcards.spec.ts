import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './helpers';

// Text-first flashcards (owner clarification 2026-11-15): the word is on
// the card from the start, «نمایش پاسخ» reveals the meaning, and word audio
// plays on reveal. The browser proof covers the book unit flow, the daily
// queue, the first/last action rules, the two book buckets, the lesson
// vocabulary deck with its four grades, and 320 px reflow.

const BOOK = '/app/books/aef-3e-starter';

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

test('flashcards: word first, answer reveal, audio, first/last actions and buckets', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    await page.addInitScript(() => {
        const target = window as unknown as { __flashcardAudio: string[] };
        target.__flashcardAudio = [];
        HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
            target.__flashcardAudio.push(this.src);
            return Promise.resolve();
        };
    });

    await page.goto('/app/flashcards');
    await expect(page.getByRole('heading', { name: 'کتاب‌ها' })).toBeVisible();
    await expect(page.getByText('American English File Starter').first()).toBeVisible();
    await expect(page.locator('.fe-bottomnav').getByText('کتاب‌ها')).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-index-393.png', fullPage: true });

    await page.goto(BOOK);
    const unitOne = page.locator('[data-flashcard-unit="1"]');
    await expect(unitOne).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-book-393.png', fullPage: true });
    await unitOne.getByRole('link', { name: /شروع|ادامه/ }).click();
    await expect(page.locator('[data-unit-flashcards]')).toBeVisible();
    await expect(page.locator('[data-unit-exercise]')).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/books-unit-hub-393.png', fullPage: true });
    await page.locator('[data-unit-flashcards]').click();

    await expect(page.locator('[data-flashcard-start]')).toBeVisible();
    await page.locator('[data-flashcard-start-button]').click();

    const card = page.locator('[data-flashcard-card]');
    await expect(card).toBeVisible();
    await expect(page.locator('[data-flashcard-word]')).toBeVisible();
    await expect(page.locator('[data-flashcard-word]')).toHaveText('zero');
    await expect(card).toHaveAttribute('data-revealed', 'false');
    await expect(page.locator('[data-flashcard-prev]')).toHaveCount(0);
    await expect(page.locator('[data-flashcard-next]')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-card-front-393.png', fullPage: true });

    await expect(page.getByText('صفر')).toHaveCount(0);
    await page.locator('[data-flashcard-reveal]').click();
    await expect(card).toHaveAttribute('data-revealed', 'true');
    await expect(page.getByText('صفر')).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-card-393.png', fullPage: true });

    const played = await page.evaluate(() => (window as unknown as { __flashcardAudio: string[] }).__flashcardAudio);
    expect(played.some((src) => src.includes('/media/flashcards/'))).toBe(true);

    await page.locator('[data-flashcard-grade="good"]').click();
    await expect(page.locator('[data-flashcard-position]')).toHaveText('۲ از ۲۵');

    // The next card starts on its word again; going back to card one shows
    // the revealed answer and keeps its recorded grade.
    await expect(page.locator('[data-flashcard-word]')).toHaveText('one');
    await expect(card).toHaveAttribute('data-revealed', 'false');
    await page.locator('[data-flashcard-prev]').click();
    await expect(page.locator('[data-flashcard-word]')).toHaveText('zero');
    await expect(card).toHaveAttribute('data-revealed', 'true');
    await expect(page.locator('[data-flashcard-prev]')).toHaveCount(0);
    await expect(page.getByText('پاسخ این کارت ثبت شده است')).toBeVisible();

    // Walk to the last card without answering the rest.
    for (let guard = 0; guard < 30; guard++) {
        const next = page.locator('[data-flashcard-next]');
        if ((await next.count()) === 0) {
            break;
        }
        await next.click();
    }
    await expect(page.locator('[data-flashcard-next]')).toHaveCount(0);
    await expect(page.locator('[data-flashcard-prev]')).toHaveCount(1);

    await page.locator('[data-flashcard-reveal]').click();
    await page.locator('[data-flashcard-grade="good"]').click();

    await expect(page.locator('[data-flashcard-summary]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'این درس تمام شد.' })).toBeVisible();
    await expect(page.getByText('درست گفتم').first()).toBeVisible();
    await expect(page.getByText('درست نگفتم').first()).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-summary-393.png', fullPage: true });

    await page.getByRole('link', { name: 'دیدن نتیجهٔ درس' }).click();
    await expect(page.getByRole('heading', { name: 'نتیجهٔ درس' })).toBeVisible();
    await expect(page.locator('[data-flashcard-result="good"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-results-393.png', fullPage: true });
});

test('flashcards: wrong bucket and retry, 320 px reflow', async ({ sub: page }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    await page.goto(`${BOOK}/2`);
    await page.locator('[data-unit-flashcards]').click();
    await page.locator('[data-flashcard-start-button]').click();
    await expect(page.locator('[data-flashcard-word]')).toBeVisible();
    await page.locator('[data-flashcard-reveal]').click();
    await page.locator('[data-flashcard-grade="again"]').click();
    await expect(page.locator('[data-flashcard-position]')).toHaveText('۲ از ۲۱');

    await page.goto(`${BOOK}/2/flashcards/results`);
    await expect(page.getByRole('heading', { name: 'نتیجهٔ درس' })).toBeVisible();
    await expect(page.locator('[data-flashcard-result="again"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'مرور دوبارهٔ غلط‌ها' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'مرور دوبارهٔ غلط‌ها' }).click();
    await expect(page.locator('[data-flashcard-start]')).toBeVisible();
    await expect(page.getByText('مرور دوبارهٔ کارت‌های «درست نگفتم»')).toBeVisible();
    await expect(page.locator('[data-flashcard-start]')).toContainText('۱ کارت');
    await page.reload();
    await expect(page.locator('[data-flashcard-start]')).toContainText('۱ کارت');
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-retry-320.png', fullPage: true });
    await page.locator('[data-flashcard-start]').screenshot({ path: 'test-results/browser-shots/flashcards-retry-start-fresh.png' });
});

test('flashcards: daily review page is reachable and reflows', async ({ sub: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/flashcards/review');
    await expect(page.getByRole('heading', { name: 'مرور امروز' }).first()).toBeVisible();
    const empty = page.locator('[data-flashcard-empty]');
    const start = page.locator('[data-flashcard-start]');
    expect((await empty.count()) + (await start.count())).toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/browser-shots/flashcards-review-390.png', fullPage: true });
});

test('lesson deck: glossary cards, four grades and notebook sync', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    await page.goto('/app/topics/morning-market?level=A1');
    await page.getByRole('link', { name: /فلش‌کارت این درس/ }).click();

    await expect(page.getByRole('heading', { name: 'فلش‌کارت واژه‌ها' })).toBeVisible();
    await expect(page.getByText('۳ واژه', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/lesson-deck-393.png', fullPage: true });

    await page.locator('[data-flashcard-start-button]').click();

    const card = page.locator('[data-flashcard-card]');
    await expect(page.locator('[data-flashcard-word]')).toHaveText('crowded');
    await expect(card).toHaveAttribute('data-revealed', 'false');
    await page.locator('[data-flashcard-reveal]').click();
    await expect(card).toHaveAttribute('data-revealed', 'true');
    await expect(page.getByText('شلوغ')).toBeVisible();

    // Four grades, not the book pair.
    for (const grade of ['again', 'hard', 'good', 'easy']) {
        await expect(page.locator(`[data-flashcard-grade="${grade}"]`)).toBeVisible();
    }

    await page.locator('[data-flashcard-grade="good"]').click();
    await expect(page.locator('[data-flashcard-word]')).toHaveText('fresh');
    await expect(card).toHaveAttribute('data-revealed', 'false');
    await page.locator('[data-flashcard-reveal]').click();
    await expect(card).toHaveAttribute('data-revealed', 'true');
    await page.locator('[data-flashcard-grade="easy"]').click();
    await expect(page.locator('[data-flashcard-word]')).toHaveText('seller');
    await page.locator('[data-flashcard-reveal]').click();
    await expect(card).toHaveAttribute('data-revealed', 'true');
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
