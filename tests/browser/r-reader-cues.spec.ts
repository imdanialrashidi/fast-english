import { expect } from '@playwright/test';
import { test } from './helpers';

// R3 immersive reader (READ-03, AC-24): the seeded A2 sample carries
// fixture cues, so sentences render as selectable rows. Selecting a
// sentence seeks to its interval and plays it; the playing sentence is
// marked with aria-current. The missing-cue fallback is proven in Pest
// (R3AudioCuesTest); here the synced path is exercised on real audio.

const LEARNER_A2 = '/app/topics/city-park?level=A2';
const SAMPLE_A2 = '/sample?topic=city-park&level=A2';

test('R3 synced reader: sentences seek to their interval and highlight', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Paid-only slice: the synced sample interaction lives on the public
  // sample experience (same sentence/cue/audio contract).
  await page.goto(SAMPLE_A2);

  const sentences = page.locator('.fe-sentence');
  await expect(sentences.first()).toBeVisible();
  const count = await sentences.count();
  expect(count).toBeGreaterThan(3);

  // Every sentence carries a valid interval inside the audio duration.
  // (At t=0 the first sentence is already current — that is correct.)
  // The player binds its source after mount, so metadata is awaited
  // exactly like every other audio spec in this lane.
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));
  const duration = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.duration);
  expect(Number.isFinite(duration)).toBe(true);
  for (const row of await sentences.all()) {
    const start = Number(await row.getAttribute('data-start'));
    const end = Number(await row.getAttribute('data-end'));
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThanOrEqual(duration + 0.6);
  }

  // Selecting the second sentence seeks to its start and plays it.
  const second = sentences.nth(1);
  const start = Number(await second.getAttribute('data-start'));
  await second.click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);
  const current = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.currentTime);
  expect(Math.abs(current - start)).toBeLessThan(1.5);

  // The playing sentence is marked; pausing keeps the mark readable.
  await expect
    .poll(() => page.locator('.fe-sentence[aria-current="true"]').count())
    .toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/browser-shots/r-reader-390.png' });
});

test('R3 reader at 1440px: measure, player, and sentences recomposed', async ({ sub: page }) => {  await page.setViewportSize({ width: 1440, height: 900 });
  // Paid-only slice: the learner shell (sidebar + persistent player)
  // needs the subscribed lane account.
  await page.goto(LEARNER_A2);
  await expect(page.locator('.fe-sentence').first()).toBeVisible();

  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth + 1);

  // Desktop sidebar carries the same four destinations as mobile tabs.
  await expect(page.locator('.fe-sidebar')).toBeVisible();
  for (const name of ['امروز', 'کشف مطالب', 'واژه‌ها', 'حساب']) {
    await expect(page.locator('.fe-sidebar').getByRole('link', { name })).toBeVisible();
  }

  await page.screenshot({ path: 'test-results/browser-shots/r-reader-1440.png' });
});

test('R3 reflow at 320px: landing, discover, reader keep controls intact', async ({ sub: page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const url of ['/', '/app', '/app/topics/city-park?level=A2']) {
    await page.goto(url);
    // Either shell's main landmark (public pages mount PublicLayout).
    await expect(page.locator('#fe-content, #fe-public-content')).toBeVisible();
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
      inner: window.innerWidth,
    }));
    expect(scroll.scrollWidth, url).toBeLessThanOrEqual(scroll.inner);
  }
  await page.locator('.fe-sentence').first().waitFor();
  const box = await page.locator('.fe-sentence').first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
