import { expect } from '@playwright/test';
import { test } from './helpers';

// M1 public-to-learning journey (PUB-01, LIB-01/02, READ-01/02/03):
// landing → sample CTA → library (search/filter/pagination/empty) →
// reader (level select, audio, cues, glossary, save/progress) with the
// locked, missing-level, and fallback states. Real seeded data on the
// browser lane; one fresh account per run keeps mutations deterministic.

// Paid-only slice: the sample resolves through the public experience;
// the library and learner-reader legs need an active subscription.
const CITY_A2 = '/sample?topic=city-park&level=A2';
const CITY_B1 = '/sample?topic=city-park&level=B1';
const MARKET_A1 = '/sample?topic=morning-market&level=A1';
const LEARNER_CITY_A2 = '/app/topics/city-park?level=A2';
const LEARNER_MARKET_A1 = '/app/topics/morning-market?level=A1';


test('M1 landing stages the real sample and its CTA opens the reader', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const cta = page.getByRole('link', { name: 'شروع با نمونه رایگان' }).first();
    await expect(cta).toBeVisible();
    await expect(page.locator('section[aria-label="نمونه واقعی"]')).toBeVisible();

    await cta.click();
    await page.waitForURL(/\/sample/);
    await expect(page.locator('ol.fe-sentences, article.fe-english-body').first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'یک نمونه واقعی، بدون ثبت‌نام' })).toBeVisible();
    await page.screenshot({ path: 'test-results/browser-shots/m1-landing-390.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'یک نمونه واقعی، بدون ثبت‌نام' })).toBeVisible();
    const landingScroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
    }));
    expect(landingScroll.scrollWidth).toBeLessThanOrEqual(landingScroll.innerWidth + 1);
    await page.screenshot({ path: 'test-results/browser-shots/m1-landing-1440.png' });
});

test('M1 library filters, searches, paginates, and explains empty results', async ({ sub: page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: 'کشف مطالب' })).toBeVisible();
    await expect(page.locator('article.fe-card').first()).toBeVisible();

    // Level pill navigates with the state in the URL; reload keeps it.
    await page.getByRole('group', { name: 'سطح' }).getByRole('link', { name: 'B1', exact: true }).click();
    await expect(page).toHaveURL(/level=B1/);
    await page.reload();
    await expect(page).toHaveURL(/level=B1/);

    // Title search narrows to the matching topic.
    await page.goto('/app?q=market');
    await expect(page.getByRole('heading', { name: 'Morning Market' })).toBeVisible();

    // Pagination exposes page two.
    await page.goto('/app');
    const total = await page.getByRole('status').filter({ hasText: 'مطلب' }).first().textContent();
    expect(Number(total?.replace(/[^0-9]/g, ''))).toBeGreaterThan(12);
    await page.getByRole('link', { name: 'صفحه 2' }).click();
    await expect(page).toHaveURL(/page=2/);

    // Empty state explains itself with a reset back to the list.
    await page.goto('/app?level=C2');
    await expect(page.getByText('مطلبی با این مشخصات پیدا نشد')).toBeVisible();
    await page.getByRole('link', { name: 'پاک کردن فیلترها' }).first().click();
    await expect(page.locator('article.fe-card').first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await page.locator('article.fe-card').first().waitFor();
    await page.screenshot({ path: 'test-results/browser-shots/m1-library-390.png' });
});

test('M1 reader plays synced sentences and keeps level selection in the URL', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CITY_A2);
    await expect(page.locator('ol.fe-sentences')).toBeVisible();
    await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));

    // Selecting a sentence seeks to its interval and plays it.
    const second = page.locator('.fe-sentence').nth(1);
    const start = Number(await second.getAttribute('data-start'));
    await second.click();
    await expect
        .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
        .toBe(true);
    const current = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.currentTime);
    expect(Math.abs(current - start)).toBeLessThan(1.5);
    await expect.poll(() => page.locator('.fe-sentence[aria-current="true"]').count()).toBeGreaterThan(0);
    await page.locator('#player-play').click();

    // Demanding state: expanded console with the seek control and times.
    await page.locator('#player-toggle').click();
    await expect(page.locator('#player-seek')).toBeVisible();
    await expect(page.locator('#player-duration')).not.toHaveText('–:––');
    await page.screenshot({ path: 'test-results/browser-shots/m1-player-expanded-390.png' });
    await page.locator('#player-toggle').click();

    // Level pills switch versions through the URL and stop the old audio.
    await page.getByRole('link', { name: 'B1', exact: true }).click();
    await page.waitForURL(/level=B1/);
    await expect(page.locator('#lesson-audio')).toHaveJSProperty('paused', true);

    await page.screenshot({ path: 'test-results/browser-shots/m1-reader-390.png' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(CITY_A2);
    await page.locator('.fe-sentence').first().waitFor();
    const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
    }));
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth + 1);
    await page.screenshot({ path: 'test-results/browser-shots/m1-reader-1440.png' });

    await page.screenshot({ path: 'test-results/browser-shots/m1-reader-1440.png' });
});

test('M1 library at 1440px', async ({ sub: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.locator('article.fe-card').first().waitFor();
    await page.screenshot({ path: 'test-results/browser-shots/m1-library-1440.png' });
});

test('M1 missing level, locked premium, and cue fallback stay honest', async ({ page }) => {
    // Missing level: exact message with the available levels, no substitution.
    await page.goto('/app/topics/city-park?level=B2');
    await expect(page.getByRole('heading', { name: 'این سطح هنوز آماده نیست' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'A2', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'B1', exact: true })).toBeVisible();
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('On Saturday morning, Sara walks');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/browser-shots/m1-notready-390.png' });

    // Locked premium: anonymous readers get the locked state with one
    // subscription CTA, never the body.
    await page.goto('/app/topics/night-trains?level=B1');
    await expect(page.getByRole('heading', { name: 'برای ادامه، اشتراک فعال لازم است' })).toBeVisible();
    const lockedPanel = page.locator('section[aria-label="نیاز به اشتراک"]');
    await expect(lockedPanel.getByRole('link', { name: 'ساخت حساب' })).toBeVisible();
    const locked = await page.locator('body').textContent();
    expect(locked).not.toContain('The night train left the station');

    // Cue fallback: usable plain reader with an honest notice.
    await page.goto(MARKET_A1);
    await expect(page.locator('article.fe-english-body')).toBeVisible();
    await expect(page.getByText('همگام‌سازی جمله‌به‌جمله برای این نسخه هنوز آماده نیست')).toBeVisible();
});

test('M1 signed-in reader saves bookmarks, words, and completion', async ({ sub: page }) => {
    // Paid-only slice: learner mutations need the subscribed lane
    // account; each leg normalizes lane state first so reruns are
    // deterministic (idempotent toggle/reset/duplicate-save paths).
    await page.goto(LEARNER_CITY_A2);
    await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));

    // Bookmark ends pressed regardless of prior lane state.
    const bookmark = page.locator('#bookmark-toggle');
    if ((await bookmark.getAttribute('aria-pressed')) === 'true') {
        await bookmark.click();
        await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
    }
    await bookmark.click();
    await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#bookmark-status')).toContainText('به ذخیره‌شده‌ها اضافه شد');

    // Completion ends marked regardless of prior lane state.
    if ((await page.locator('#mark-read').count()) === 0) {
        await page.locator('#reset-progress').click();
        await expect(page.locator('#mark-read')).toBeVisible();
    }
    await page.locator('#mark-read').click();
    await expect(page.getByText('این درس تکمیل شده است')).toBeVisible();
    await page.reload();
    await expect(page.getByText('این درس تکمیل شده است')).toBeVisible();

    // A glossary word saves into the notebook (first save and the
    // duplicate-save path both confirm visibly).
    await page.goto(LEARNER_MARKET_A1);
    await expect(page.getByRole('heading', { name: 'واژه‌های کلیدی' })).toBeVisible();
    const save = page.getByRole('button', { name: 'ذخیره واژه' }).first();
    await save.click();
    await expect(page.locator('#vocab-status')).toContainText('دفترچه');
    await expect(page.getByRole('button', { name: 'ذخیره شد' }).first()).toBeVisible();
});
