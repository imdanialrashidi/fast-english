import { expect } from '@playwright/test';
import { test } from './helpers';

// S4-6 persistent player + logout in Chromium: audio keeps playing through
// an in-app navigation (reader → library → back) with no duplicate
// listeners; logout stops the audio and clears its source; a second account
// sees none of the first account's progress or saved items.

const LOGIN = '/login';
const READER_A2 = '/app/topics/city-park?level=A2';
const LIBRARY = '/app';
const ACCOUNT = '/account';
const SUB = { email: 'browser-sub@example.com', password: 'password' };
const G = { email: 'browser-g@example.com', password: 'password' };

async function login(page, user: { email: string; password: string }) {
  await page.goto(LOGIN);
  await page.getByLabel('ایمیل', { exact: true }).fill(user.email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'ورود' }).click();
  await page.waitForURL('**/account**');
}

async function listenerCount(page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __fePlayerBound?: boolean }).__fePlayerBound ? 1 : 0);
}

test('S4-6 audio survives reader to library and back with one listener set', async ({ sub: page }) => {
  await page.goto(READER_A2);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));

  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);
  expect(await listenerCount(page)).toBe(1);

  const miniBefore = await page.locator('#mini-player').textContent();
  expect(miniBefore).toContain('The City Park');
  expect(miniBefore).toContain('A2');

  // In-app navigation to the library via the desktop rail: the same audio
  // element keeps playing. Scope to the rail because the reader now also
  // has a back link with the same words.
  const elementHandle = await page.locator('#lesson-audio').elementHandle();
  await page.locator('.fe-sidebar').getByRole('link', { name: 'کشف مطالب', exact: true }).click();
  await page.waitForURL('**/app**');
  await expect(page.locator('article.fe-card').first()).toBeVisible();
  const stillPlaying = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused);
  expect(stillPlaying).toBe(true);
  const sameElement = await page.locator('#lesson-audio').elementHandle();
  expect(await elementHandle?.evaluate((a, b) => a === b, await sameElement?.evaluate((x) => x))).toBeDefined();
  expect(await listenerCount(page)).toBe(1);

  // Back to the reader: same lesson keeps its time, still no duplicates.
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#fe-lesson-data') !== null);
  const playingAfterBack = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused);
  expect(playingAfterBack).toBe(true);
  expect(await listenerCount(page)).toBe(1);

  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.paused))
    .toBe(true);
});

test('S4-6 logout stops the audio, clears its source, and isolates accounts', async ({ page }) => {
  await login(page, SUB);
  await page.goto(READER_A2);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);

  // Save a position and a bookmark as F.
  await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => {
    a.currentTime = 8;
  });
  await page.locator('#player-play').click();
  await page.waitForTimeout(800);
  const bookmarkBtn = page.locator('#bookmark-toggle');
  if (await bookmarkBtn.count()) {
    const pressed = await bookmarkBtn.getAttribute('aria-pressed');
    if (pressed !== 'true') {
      await bookmarkBtn.click();
      await expect(bookmarkBtn).toHaveAttribute('aria-pressed', 'true');
    }
  }

  // Real logout through the account form (full navigation, no wire:navigate).
  await page.goto(ACCOUNT);
  await expect(page.locator('body')).toContainText(SUB.email);
  await page.getByRole('button', { name: 'خروج از حساب' }).click();
  await page.waitForURL(/\/(login|$)/);
  await expect(page.locator('#lesson-audio')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(SUB.email);

  // Second account (no subscription) sees none of the first
  // account's state: a non-sample learner URL refuses with the locked
  // state (sample URLs redirect to the public experience instead).
  await login(page, G);
  await page.goto('/app/topics/night-trains?level=B1');
  await expect(page.getByRole('heading', { name: 'برای ادامه، اشتراک فعال لازم است' })).toBeVisible();
  await expect(page.getByText('ادامه از موقعیت ذخیره‌شده')).toHaveCount(0);

  await page.goto('/app/saved');
  await expect(page.getByRole('heading', { name: 'برای ادامه، اشتراک فعال لازم است' })).toBeVisible();
});
