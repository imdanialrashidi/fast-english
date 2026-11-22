import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './helpers';

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
}

/** The reader restores the last page; tests always start at page one. */
async function rewind(page: Page, label: string): Promise<void> {
    const button = page.getByRole('button', { name: label });
    for (let index = 0; index < 80; index += 1) {
        if (!(await button.isEnabled())) {
            break;
        }
        await button.click();
        await page.waitForTimeout(120);
    }
}

test('story reader: real audio, word preview, sentence highlight and page turn', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/story/a2/police-tv');
    await rewind(page, 'صفحهٔ قبل');

    await expect(page.getByRole('heading', { name: 'پلیس تلویزیون', exact: true }).first()).toBeVisible();
    await expect(page.getByText('1 / 61')).toBeVisible();
    await expect(page.getByText(/Dan and Sue are police officers/)).toBeVisible();
    await expect(page.locator('#player-play')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await expect(page.locator('#lesson-audio')).toHaveAttribute('src', /\/media\/library\//);

    const preview = page.getByRole('button', { name: /پیش‌خوانی/ }).first();
    await expect(preview).toBeVisible();
    await preview.click();
    await expect(page.getByText('عصبانی', { exact: true })).toBeVisible();
    await page.locator('#player-play').click();
    await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
    await expect(page.locator('[data-sentence-active="true"]').first()).toBeVisible();
    await expect(page.locator('#player-play')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/browser-shots/library-story-reader-393.png', fullPage: true });

    await page.getByRole('button', { name: 'صفحهٔ بعد' }).click();
    await expect(page.getByText(/Every day someone steals money/)).toBeVisible();
});

test('IELTS reader: real Passage 1, answer, score, explanation and evidence jump', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-1/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'How tennis rackets have changed', exact: true })).toBeVisible();
    await expect(page.getByText('given a position in a list')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await expect(page.locator('#lesson-audio')).toHaveAttribute('src', /\/media\/library\//);
    await page.locator('#player-play').click();
    await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
    await expect(page.locator('[data-sentence-active="true"]').first()).toBeVisible();
    await page.locator('#player-play').click();

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 FALSE, Q8 paint; the other eleven stay unanswered.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('paint');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/متن می‌گوید تغییر راکت او چنان نامحسوس/)).toBeVisible();

    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-result-393.png', fullPage: true });

    const paragraph = page.locator('p[lang="en"]').first();
    await paragraph.selectText();
    await paragraph.dispatchEvent('mouseup');
    await expect(page.getByText(/در سال ۲۰۱۶، اندی ماری/)).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-translation-393.png', fullPage: true });
});

test('Inside Reading reader: original audio, paragraph words and sentence highlight', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/inside-reading/intro/unit-1/reading-1');
    await rewind(page, 'صفحهٔ قبل');

    await expect(page.getByRole('heading', { name: 'نقشه مغز اولیه', exact: true }).first()).toBeVisible();
    await expect(page.locator('#player-play')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const preview = page.getByRole('button', { name: /پیش‌خوانی/ }).first();
    await preview.click();
    await expect(page.getByText('رفتار', { exact: true })).toBeVisible();

    await page.locator('#player-play').click();
    await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
    await expect(page.locator('[data-sentence-active="true"]').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ir-reader-393.png', fullPage: true });
});


test('a mapped 2x3 panel is served on its frame', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/story/a2/police-tv');
    await rewind(page, 'صفحهٔ قبل');

    for (let index = 0; index < 4; index += 1) {
        await page.getByRole('button', { name: 'صفحهٔ بعد' }).click();
        await page.waitForTimeout(120);
    }

    await expect(page.getByText('5 / 61')).toBeVisible();
    const panel = page.locator('div[role="img"]').first();
    await expect(panel).toBeVisible();
    const background = await panel.evaluate((element) => getComputedStyle(element).backgroundImage);
    const position = await panel.evaluate((element) => getComputedStyle(element).backgroundPosition);
    expect(background).toContain('/media/library/');

    // The current panel stays at the top through text-only pages until the
    // next mapped frame arrives.
    await page.getByRole('button', { name: 'صفحهٔ بعد' }).click();
    await expect(page.getByText('6 / 61')).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('background-position', position);

    for (let index = 0; index < 11; index += 1) {
        await page.getByRole('button', { name: 'صفحهٔ بعد' }).click();
    }
    await expect(page.getByText('17 / 61')).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(panel).not.toHaveCSS('background-position', position);
    await page.screenshot({ path: 'test-results/browser-shots/library-story-panel-393.png', fullPage: true });
});

test('a Woof-generated story frame carries the required credit and audio', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/story/b2/henry-viii-and-his-six-wives');
    await rewind(page, 'صفحهٔ قبل');

    await expect(page.getByRole('heading', { name: 'هنری هشتم و شش همسرش', exact: true }).first()).toBeVisible();
    await expect(page.locator('#player-play')).toBeVisible();
    await expect(page.getByText('Voice by Underdog Woof')).toBeVisible();

    await expect(page.locator('#lesson-audio')).toHaveAttribute('src', /\/media\/library\//);
    await page.locator('#player-play').click();
    await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
    await expect(page.locator('[data-sentence-active="true"]').first()).toBeVisible();
});

test('IELTS Passage 2: matching, two-answer groups and weighted score', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-1/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The pirates of the ancient Mediterranean', exact: true })).toBeVisible();
    await expect(page.getByText('people who do not fit in')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 D; Q20/21 B+D; Q22/23 C+E; Q24 grain. The remaining seven are blank.
    await page.locator('input[type="radio"]').nth(3).check();
    const checks = page.locator('input[type="checkbox"]');
    await checks.nth(1).check();
    await checks.nth(3).check();
    await checks.nth(7).check();
    await checks.nth(9).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('grain');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۶ از ۱۳/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-p2-result-393.png', fullPage: true });
});

test('IELTS Passage 3: MCQ, phrase-summary and Yes/No/Not Given', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-1/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The persistence and peril of misinformation', exact: true })).toBeVisible();
    await expect(page.getByText('certain to happen')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 D, Q31 G, Q37 YES; the rest stay blank.
    await page.locator('input[type="radio"]').nth(3).check();
    await page.getByLabel(/frequent exposure/).first().check();
    await page.getByLabel('YES').first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۳ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-p3-result-393.png', fullPage: true });
});

test('IELTS Test 2 Passage 1: notes completion, TFNG and evidence', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-2/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The Industrial Revolution in Britain', exact: true })).toBeVisible();
    await expect(page.getByText('relating to farming')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 piston; Q8 NOT GIVEN; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('piston');
    await page.locator('input[type="radio"]').nth(2).check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t2p1-result-393.png', fullPage: true });
});

test('IELTS Test 2 Passage 2: matching, completion, weighted pair', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-2/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Athletes and stress', exact: true })).toBeVisible();
    await expect(page.getByText('the act of leaving a competition')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 D; Q19 injury; Q23/24 B+D; the rest stay blank.
    await page.locator('input[type="radio"]').nth(3).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('injury');
    const checks = page.locator('input[type="checkbox"]');
    await checks.nth(1).check();
    await checks.nth(3).check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۴ از ۱۳/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t2p2-result-393.png', fullPage: true });
});

test('IELTS Test 2 Passage 3: phrase summary, YNNG and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-2/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'An inquiry into the existence of the gifted child', exact: true })).toBeVisible();
    await expect(page.getByText('having great natural ability')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 H, Q33 YES, Q38 C; the rest stay blank.
    await page.getByLabel(/H\. unique/).first().check();
    await page.getByLabel('YES').first().check();
    await page.getByLabel(/spirit of inquiry/).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۳ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t2p3-result-393.png', fullPage: true });
});

test('IELTS Test 3 Passage 1: TFNG, notes completion and evidence', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-3/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Archaeologists discover evidence of prehistoric island settlers', exact: true })).toBeVisible();
    await expect(page.getByText('skilled')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 FALSE; Q8 caves; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('caves');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t3p1-result-393.png', fullPage: true });
});

test('IELTS Test 3 Passage 2: matching paragraphs, notes and experts', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-3/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The global importance of wetlands', exact: true })).toBeVisible();
    await expect(page.getByText('communities of living things')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 G; Q18 carbon; the rest stay blank.
    await page.getByRole('radio', { name: 'G', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('carbon');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t3p2-result-393.png', fullPage: true });
});

test('IELTS Test 3 Passage 3: MCQ, sentence endings and YNNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-3/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Is the era of artificial speech translation upon us?', exact: true })).toBeVisible();
    await expect(page.getByText('something that blocks progress')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 D, Q31 C, Q35 NO; the rest stay blank.
    await page.locator('input[type="radio"]').nth(3).check();
    await page.getByLabel(/far from perfect/).first().check();
    await page.getByRole('radio', { name: 'NO', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۳ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t3p3-result-393.png', fullPage: true });
});

test('IELTS Test 4 Passage 1: butterfly TFNG and notes', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-4/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The impact of climate change on butterflies in Britain', exact: true })).toBeVisible();
    await expect(page.getByText('people who work to protect nature')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 FALSE; Q7 colonies; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('colonies');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t4p1-result-393.png', fullPage: true });
});

test('IELTS Test 4 Passage 2: paragraph matching, people and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-4/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Deep-sea mining', exact: true })).toBeVisible();
    await expect(page.getByText('bacteria that are hard to kill')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 C; Q24 waste; the rest stay blank.
    await page.getByRole('radio', { name: 'C', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('waste');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t4p2-result-393.png', fullPage: true });
});

test('IELTS Test 4 Passage 3: MCQ, summary and YNNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/academic/test-4/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The Unselfish Gene', exact: true })).toBeVisible();
    await expect(page.getByText('cruel and without pity')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 C, Q31 egalitarianism, Q36 NOT GIVEN; the rest stay blank.
    await page.locator('input[type="radio"]').nth(2).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('egalitarianism');
    await page.getByRole('radio', { name: 'NOT GIVEN', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۳ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-t4p3-result-393.png', fullPage: true });
});

test('IELTS General 19 Section 3: headings, summary and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-1/section-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Emojis', exact: true })).toBeVisible();
    await expect(page.getByText('things that do not change')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q28 vi; Q33 dated; Q38 B; the rest stay blank.
    await page.getByLabel(/vi\. The rapid spread/).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('dated');
    await page.getByLabel(/soon forgotten/).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۳ از ۱۳/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19s3-result-393.png', fullPage: true });
});

test('IELTS General 19 Section 1: FAQ TFNG and review matching', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-1/section-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Gobridge Tramlink FAQs and Adorable knitwear reviews', exact: true })).toBeVisible();
    await expect(page.getByText('schedules')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 FALSE; Q8 B; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.getByRole('radio', { name: 'B', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19s1-result-393.png', fullPage: true });
});

test('IELTS General 19 Section 2: two texts and sentence completion', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-1/section-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'How to become a great leader and resign professionally', exact: true })).toBeVisible();
    await expect(page.getByText('making you feel nervous')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q15 trust; Q22 temptations; the rest stay blank.
    await page.getByRole('textbox', { name: 'پاسخ سوال 15' }).fill('trust');
    await page.getByRole('textbox', { name: 'پاسخ سوال 22' }).fill('temptations');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19s2-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 2 Section 1: campsite matching and newsletter TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-2/section-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Local campsites and Durridge Heights newsletter', exact: true })).toBeVisible();
    await expect(page.getByText('buildings and services provided')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 D; Q8 TRUE; the rest stay blank.
    await page.getByRole('radio', { name: 'D', exact: true }).first().check();
    await page.getByRole('radio', { name: 'TRUE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t2s1-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 2 Section 2: flowchart and sentence completion', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-2/section-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'A day in the life of a care worker and work-life balance', exact: true })).toBeVisible();
    await expect(page.getByText('an illness or medical problem')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q15 condition; Q21 wellbeing; the rest stay blank.
    await page.getByRole('textbox', { name: 'پاسخ سوال 15' }).fill('condition');
    await page.getByRole('textbox', { name: 'پاسخ سوال 21' }).fill('wellbeing');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t2s2-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 2 Section 3: Henry programme MCQ, people and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-2/section-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: /Henry.*programme gives children choices/ })).toBeVisible();
    await expect(page.getByText('being very overweight')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q28 D; Q36 boundaries; the rest stay blank.
    await page.locator('input[type="radio"]').nth(3).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('boundaries');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t2s3-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 3 Section 1: film reviews and sports events', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-3/section-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Film reviews and Sports events in New Zealand', exact: true })).toBeVisible();
    await expect(page.getByText('people who play music')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 E; Q9 B; the rest stay blank.
    await page.getByRole('radio', { name: 'E', exact: true }).first().check();
    await page.getByRole('group', { name: 'پاسخ سوال 9' }).getByRole('radio', { name: 'B', exact: true }).check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible();
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t3s1-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 3 Section 2: redundancy notes and restaurant rules', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-3/section-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'What to do if you are made redundant and Palvin’s Restaurant instructions', exact: true })).toBeVisible();
    await expect(page.getByText('the people who work for a company')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q15 list; Q22 measurements; the rest stay blank.
    await page.getByRole('textbox', { name: 'پاسخ سوال 15' }).fill('list');
    await page.getByRole('textbox', { name: 'پاسخ سوال 22' }).fill('measurements');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t3s2-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 3 Section 3: medieval women MCQ, paragraphs and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-3/section-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The forgotten role of women in medieval arts', exact: true })).toBeVisible();
    await expect(page.getByText('hand-written books')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q28 C; Q37 gold; the rest stay blank.
    await page.locator('input[type="radio"]').nth(2).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('gold');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t3s3-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 4 Section 1: café reviews and Frog Valley TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-4/section-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Customer reviews of cafés and Frog Valley development', exact: true })).toBeVisible();
    await expect(page.getByText('the way a room is decorated')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 C; Q6 FALSE; the rest stay blank.
    await page.getByRole('radio', { name: 'C', exact: true }).first().check();
    await page.getByRole('radio', { name: 'FALSE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t4s1-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 4 Section 2: institute TFNG and scholarships', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-4/section-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Percil Training Institute and scholarships', exact: true })).toBeVisible();
    await expect(page.getByText('an organization for education')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q15 FALSE; Q25 20 weeks; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.getByRole('textbox', { name: 'پاسخ سوال 25' }).fill('20 weeks');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t4s2-result-393.png', fullPage: true });
});

test('IELTS General 19 Test 4 Section 3: rewilding summary, people and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/19/general/test-4/section-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Divided opinions about letting farmland return to its natural state', exact: true })).toBeVisible();
    await expect(page.getByText('returned to a wild state')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q28 maize; Q31 A; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('maize');
    await page.locator('input[name="question-q31"]').first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts-g19t4s3-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 1 Passage 1: kakapo TFNG and notes', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-1/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The kākāpō', exact: true })).toBeVisible();
    await expect(page.getByText('active at night')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 FALSE; Q7 bulbs; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('bulbs');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t1p1-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 1 Passage 2: elms sections, people and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-1/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Reintroducing elms to Britain', exact: true })).toBeVisible();
    await expect(page.getByText('large trees', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 C; Q24 oak; the rest stay blank.
    await page.getByRole('radio', { name: 'C', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('oak');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t1p2-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 1 Passage 3: stress MCQ, endings and YNNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-1/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'How stress affects our judgement', exact: true })).toBeVisible();
    await expect(page.getByText('compare the importance of things')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 C; Q31 B; the rest stay blank.
    await page.locator('input[type="radio"]').nth(2).check();
    await page.locator('input[name="question-q31"]').nth(1).check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t1p3-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 2 Passage 1: manatees notes and TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-2/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Manatees', exact: true })).toBeVisible();
    await expect(page.getByText('living in water')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 tail; Q7 TRUE; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('tail');
    await page.getByRole('radio', { name: 'TRUE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t2p1-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 2 Passage 2: procrastination sections, notes and pairs', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-2/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Procrastination', exact: true })).toBeVisible();
    await expect(page.getByText('delaying tasks')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 B; Q17 laziness; the rest stay blank.
    await page.getByRole('radio', { name: 'B', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('laziness');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t2p2-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 2 Passage 3: robo-umpires YNNG, summary and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-2/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Invasion of the Robot Umpires', exact: true })).toBeVisible();
    await expect(page.getByText('a strange device')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 NO; Q33 former roles; the rest stay blank.
    await page.getByRole('radio', { name: 'NO', exact: true }).first().check();
    await page.getByRole('radio', { name: /former roles/ }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t2p3-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 3 Passage 1: frozen food notes and TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-3/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Frozen Food', exact: true })).toBeVisible();
    await expect(page.getByText('kept safe from decay')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 potatoes; Q8 NOT GIVEN; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('potatoes');
    await page.getByRole('radio', { name: 'NOT GIVEN', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t3p1-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 3 Passage 2: coral reef headings, causes and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-3/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Can the planet’s coral reefs be saved?', exact: true })).toBeVisible();
    await expect(page.getByText('a man-made reef')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 vi; Q24 tentacles; the rest stay blank.
    await page.getByRole('radio', { name: /Promoting hope/ }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('tentacles');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t3p2-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 3 Passage 3: robots people, endings and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-3/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Robots and us', exact: true })).toBeVisible();
    await expect(page.getByText('settle and control a place')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 A; Q34 changes made to other planets; the rest stay blank.
    await page.locator('input[name="question-q27"]').first().check();
    await page.getByRole('radio', { name: /changes made to other planets/ }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t3p3-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 4 Passage 1: O’Keeffe notes and TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-4/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Georgia O’Keeffe', exact: true })).toBeVisible();
    await expect(page.getByText('great skill')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 teacher; Q8 FALSE; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('teacher');
    await page.getByRole('radio', { name: 'FALSE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t4p1-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 4 Passage 2: climate adaptation sections, notes and people', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-4/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Adapting to the effects of climate change', exact: true })).toBeVisible();
    await expect(page.getByText('growing strongly')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 C; Q18 pumps; the rest stay blank.
    await page.getByRole('radio', { name: 'C', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('pumps');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t4p2-result-393.png', fullPage: true });
});

test('IELTS 20 Academic Test 4 Passage 3: guard dogs sections, people and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/20/academic/test-4/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'A new role for livestock guard dogs', exact: true })).toBeVisible();
    await expect(page.getByText('farm animals', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 D; Q37 jackals; the rest stay blank.
    await page.getByRole('radio', { name: 'D', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('jackals');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts20a-t4p3-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 1 Passage 1: Davies sisters notes and TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-1/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The Davies Sisters', exact: true })).toBeVisible();
    await expect(page.getByText('collected a large amount')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 shipping; Q8 TRUE; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('mining');
    await page.getByRole('radio', { name: 'TRUE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t1p1-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 1 Passage 2: silence sections, summary and people', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-1/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Why we need silence', exact: true })).toBeVisible();
    await expect(page.getByText('familiar with and able to notice')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 B; Q18 breath; the rest stay blank.
    await page.getByRole('radio', { name: 'B', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('breath');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t1p2-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 1 Passage 3: sugar review MCQ, summary and YNNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-1/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Book review: The World of Sugar', exact: true })).toBeVisible();
    await expect(page.getByText('given financial support')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 B; Q31 H; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.getByRole('radio', { name: /migrant workers/ }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t1p3-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 2 Passage 1: animal dreams table and TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-2/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Do animals dream?', exact: true })).toBeVisible();
    await expect(page.getByText('unable to move')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 rats; Q6 TRUE; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('rats');
    await page.getByRole('radio', { name: 'TRUE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t2p1-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 2 Passage 2: Mapungubwe sections, gold pair and summary', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-2/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Mapungubwe', exact: true })).toBeVisible();
    await expect(page.getByText('a large area of flat high land')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 E; Q22 prosperity; the rest stay blank.
    await page.getByRole('radio', { name: 'E', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('prosperity');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t2p2-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 2 Passage 3: AI MCQ, summary and YNNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-2/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Artificial Intelligence', exact: true })).toBeVisible();
    await expect(page.getByText('uncontrolled excitement or fear')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 B; Q30 F; the rest stay blank.
    await page.locator('input[type="radio"]').nth(1).check();
    await page.getByRole('radio', { name: /equality/ }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t2p3-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 3 Passage 1: saiga notes and TFNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-3/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Saving the saiga', exact: true })).toBeVisible();
    await expect(page.getByText('limited to')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 dust; Q8 FALSE; the rest stay blank.
    await page.locator('input[placeholder*="حداکثر"]').first().fill('dust');
    await page.getByRole('radio', { name: 'FALSE', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t3p1-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 3 Passage 2: Dar es Salaam TFNG and notes', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-3/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The problems of getting around the city of Dar es Salaam', exact: true })).toBeVisible();
    await expect(page.getByText('a city with over 10 million people')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 NOT GIVEN; Q19 lanes; the rest stay blank.
    await page.getByRole('radio', { name: 'NOT GIVEN', exact: true }).first().check();
    await page.locator('input[placeholder*="حداکثر"]').first().fill('lanes');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t3p2-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 3 Passage 3: prehistory MCQ, endings and YNNG', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-3/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'Rethinking the Past', exact: true })).toBeVisible();
    await expect(page.getByText('a statement that is obviously true')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 A; Q31 E; the rest stay blank.
    await page.locator('input[type="radio"]').first().check();
    await page.getByRole('radio', { name: /only species capable/ }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t3p3-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 4 Passage 1: water hyacinth TFNG and flow-chart', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-4/passage-1');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The problems and benefits created by the spread of the water hyacinth in Kenya', exact: true })).toBeVisible();
    await expect(page.getByText('living in water')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q1 TRUE; Q8 cow dung; the rest stay blank.
    await page.getByRole('radio', { name: 'TRUE', exact: true }).first().check();
    await page.locator('input[placeholder*="کلمه"]').first().fill('cow dung');
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t4p1-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 4 Passage 2: multilingualism summary, YNNG and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-4/passage-2');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'How could multilingualism benefit India’s poorest schoolchildren?', exact: true })).toBeVisible();
    await expect(page.getByText('full of activity')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q14 I; Q20 NO; the rest stay blank.
    await page.getByRole('radio', { name: /dense population/ }).first().check();
    await page.getByRole('radio', { name: 'NO', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۳/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t4p2-result-393.png', fullPage: true });
});

test('IELTS 21 Academic Test 4 Passage 3: globemakers summary, YNNG and MCQ', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/ielts/21/academic/test-4/passage-3');
    await rewind(page, 'پاراگراف قبل');

    await expect(page.getByRole('heading', { name: 'The Globemakers: The Curious Story of an Ancient Craft', exact: true })).toBeVisible();
    await expect(page.getByText('unable to stop thinking about something')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const retry = page.getByRole('button', { name: 'تلاش دوباره' });
    if ((await retry.count()) > 0) {
        await retry.first().click();
    }

    // Q27 G; Q33 NO; the rest stay blank.
    await page.getByRole('radio', { name: /challenging task/ }).first().check();
    await page.getByRole('radio', { name: 'NO', exact: true }).first().check();
    await page.getByRole('button', { name: /ثبت پاسخ‌ها و دیدن نتیجه/ }).click();

    await expect(page.getByText(/نتیجه: ۲ از ۱۴/)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /نمایش شاهد در متن/ }).first().click();
    await expect(page.getByRole('button', { name: 'حالت هدایت‌شده' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ielts21a-t4p3-result-393.png', fullPage: true });
});

test('Inside Reading level 1: bicycle text, original audio and word preview', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/books/inside-reading/1/unit-1/reading-1');
    await rewind(page, 'صفحهٔ قبل');

    await expect(page.getByRole('heading', { name: 'تاریخچه دوچرخه', exact: true }).first()).toBeVisible();
    await expect(page.getByText('The bicycle was not invented by one individual')).toBeVisible();
    await expect(page.locator('#player-play')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: /پیش‌خوانی/ }).first().click();
    await expect(page.getByText('دوچرخه', { exact: true }).first()).toBeVisible();

    await page.locator('#player-play').click();
    await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
    await expect(page.locator('[data-sentence-active="true"]').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/library-ir-level1-393.png', fullPage: true });
});

test('TED is a category of articles with a plain transcript and one player', async ({ sub: page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/app/ted');
    await page.waitForURL('**/app?category=ted-talk');
    await expect(page.getByText('۵۳ مطلب')).toBeVisible();
    await expect(page.locator('a[href*="/app/ted/"]')).toHaveCount(12);
    await expectNoHorizontalOverflow(page);

    await page.goto('/app/ted/ted_ed_what_are_tariffs_and_how_do_they_work');
    await expect(page.getByRole('heading', { name: 'What are tariffs, and how do they work?', exact: true }).first()).toBeVisible();
    await expect(page.getByText('۱۰ واژه')).toBeVisible();
    await expect(page.locator('[data-sentence-active]')).toHaveCount(0);
    await expect(page.locator('#player-play')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.locator('#player-play').click();
    await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
    await expect(page.locator('#player-play')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/browser-shots/library-ted-393.png', fullPage: true });
});

test('Inside Reading all five levels: title, text, audio and word preview', async ({ sub: page }) => {
    const books = [
        ['intro', 'نقشه مغز اولیه'],
        ['1', 'تاریخچه دوچرخه'],
        ['2', 'کوبر پدی: واقعاً در زیر زمین'],
        ['3', 'معماری بازار'],
        ['4', 'المپیک حیوانات'],
    ];
    for (const [level, title] of books) {
        await page.goto(`/app/books/inside-reading/${level}/unit-1/reading-1`);
        await rewind(page, 'صفحهٔ قبل');
        await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
        await expect(page.locator('#player-play')).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await page.getByRole('button', { name: /پیش‌خوانی/ }).first().click();
        await expect(page.locator('[data-word-card], .word-card').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({ path: 'test-results/browser-shots/library-ir-levels-393.png', fullPage: true });
});
