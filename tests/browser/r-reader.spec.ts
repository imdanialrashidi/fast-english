import { expect } from '@playwright/test';
import { test } from './helpers';

// R3 reader (READ-01/02): plain English paragraphs beside the normal
// audio player. Owner direction 2026-10-21 removed sentence-level
// synchronisation: no highlighted rows, no click-to-seek, no cue props.

const LEARNER_A2 = '/app/topics/city-park?level=A2';
const SAMPLE_A2 = '/sample?topic=city-park&level=A2';

test('public sample renders normal paragraphs and normal playback', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SAMPLE_A2);

  const body = page.locator('article.fe-english-body');
  await expect(body).toBeVisible();
  await expect(body).toHaveAttribute('lang', 'en');
  await expect(body).toHaveAttribute('dir', 'ltr');
  await expect(body).toContainText('On Saturday morning, Sara walks');

  // The retired synchronised surface is absent.
  await expect(page.locator('.fe-sentence')).toHaveCount(0);
  await expect(page.locator('[data-start]')).toHaveCount(0);

  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration));
  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);

  await page.screenshot({ path: 'test-results/browser-shots/r-reader-390.png' });
});

test('learner reader at 1440px: measure, paragraphs, and shell recomposed', async ({ sub: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LEARNER_A2);

  await expect(page.locator('article.fe-english-body')).toBeVisible();
  await expect(page.locator('article.fe-english-body p').first()).toBeVisible();
  await expect(page.locator('.fe-sentence')).toHaveCount(0);

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

test('reflow at 320px: landing, discover, reader keep controls intact', async ({ sub: page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const url of ['/', '/app', '/app/topics/city-park?level=A2']) {
    await page.goto(url);
    await expect(page.locator('#fe-content, #fe-public-content')).toBeVisible();
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
      inner: window.innerWidth,
    }));
    expect(scroll.scrollWidth, url).toBeLessThanOrEqual(scroll.inner);
  }

  const paragraph = page.locator('article.fe-english-body p').first();
  await paragraph.waitFor();
  const box = await paragraph.boundingBox();
  expect(box!.width).toBeGreaterThan(180);
});
