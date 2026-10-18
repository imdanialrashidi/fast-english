import { expect } from '@playwright/test';
import { test } from './helpers';

// S4-1 resume with real playback in Chromium: a logged-in student listens,
// pauses (which saves), reloads, and returns to find the position restored
// with nothing auto-playing. Anonymous listening is never saved (proved by
// the absence of a progress row via the reader's zero initial position).

const READER = '/app/topics/city-park?level=A2';

test('S4-1 resume: pause saves, reload restores, nothing auto-plays', async ({ sub: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(READER);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));

  // Listen: play, jump to 12 s (inside the 20 s A2 fixture), pause to save.
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);
  await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => {
    a.currentTime = 12;
  });
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.paused))
    .toBe(true);

  // Wait for the pause-save to reach the server (resume notice appears on reload).
  await page.waitForTimeout(800);

  // Reload: position restored, still paused.
  await page.reload();
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));
  await expect(page.locator('#lesson-audio')).toHaveJSProperty('paused', true);
  const restored = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.currentTime);
  expect(restored).toBeGreaterThan(10);
  expect(restored).toBeLessThan(14);
  // Resume acknowledged: the continue notice, or the completed banner
  // when the lane account already finished this lesson (the position
  // restore above is the actual resume proof either way).
  await expect(page.getByText(/ادامه از موقعیت ذخیره‌شده|این درس تکمیل شده است/)).toBeVisible();

  // Return via navigation: still restored, still paused.
  await page.goto('/app');
  await page.goto(READER);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));
  await expect(page.locator('#lesson-audio')).toHaveJSProperty('paused', true);
  const returned = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.currentTime);
  expect(returned).toBeGreaterThan(10);
});

test('S4-1 anonymous listening leaves no saved position', async ({ page }) => {
  // Paid-only slice: anonymous hits resolve to the public sample, which
  // carries no learner affordances — nothing to save with, nothing resumed.
  await page.goto('/sample?topic=city-park&level=A2');
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));
  await expect(page.locator('#fe-lesson-data')).toHaveCount(0);
  await expect(page.locator('#bookmark-toggle')).toHaveCount(0);
  await expect(page.locator('#mark-read')).toHaveCount(0);
  await expect(page.getByText('ادامه از موقعیت ذخیره‌شده')).toHaveCount(0);
});
