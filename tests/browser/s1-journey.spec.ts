import { expect, test } from '@playwright/test';

const A2 = '/app/topics/city-park?level=A2';
const B1 = '/app/topics/city-park?level=B1';

// S1-1 sample journey on the real seeded topic, plus lab baselines.
test('A2 reader shows only the A2 lesson body and audio', async ({ page }) => {
  await page.goto(A2);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('ol.fe-sentences')).toHaveAttribute('lang', 'en');
  await expect(page.locator('ol.fe-sentences')).toHaveAttribute('dir', 'ltr');

  await expect(page.locator('ol.fe-sentences')).toContainText('On Saturday morning, Sara walks');
  await expect(page.locator('ol.fe-sentences')).not.toContainText('Sara loves Saturday mornings');

  const src = await page.locator('#lesson-audio').getAttribute('src');
  expect(src).toContain('/media/lessons/');
  const bodyAudioRefs = await page.locator('ol.fe-sentences').evaluate((el) => el.innerHTML.includes('/media/lessons/'));
  expect(bodyAudioRefs).toBe(false);

  // No autoplay: audio is paused at load.
  const state = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => ({
    paused: a.paused,
    currentTime: a.currentTime,
  }));
  expect(state.paused).toBe(true);
  expect(state.currentTime).toBe(0);
});

test('B1 reader shows only the B1 lesson body and audio', async ({ page }) => {
  await page.goto(B1);
  await expect(page.locator('ol.fe-sentences')).toContainText('Sara loves Saturday mornings');
  await expect(page.locator('ol.fe-sentences')).not.toContainText('On Saturday morning, Sara walks');

  const src = await page.locator('#lesson-audio').getAttribute('src');
  expect(src).toContain('/media/lessons/');
});

test('switching level loads the other lesson and stops the old audio', async ({ page }) => {
  await page.goto(A2);
  const srcA2 = await page.locator('#lesson-audio').getAttribute('src');

  await page.locator('#player-play').click();
  await expect
    .poll(() => page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => !a.paused))
    .toBe(true);

  await page.getByRole('link', { name: 'B1', exact: true }).click();
  // Paid-only slice: the sample levels resolve inside /sample (the
  // query carries topic + level, so match the level param, not the tail).
  await page.waitForURL(/level=B1/);

  const srcB1 = await page.locator('#lesson-audio').getAttribute('src');
  expect(srcB1).not.toBe(srcA2);
  await expect(page.locator('ol.fe-sentences')).toContainText('Sara loves Saturday mornings');
  await expect(page.locator('ol.fe-sentences')).not.toContainText('On Saturday morning, Sara walks');

  // Fresh page: nothing plays without a new user gesture.
  const paused = await page.locator('#lesson-audio').evaluate((a: HTMLAudioElement) => a.paused);
  expect(paused).toBe(true);
});

test('lab baselines: HTML, player ready', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(B1);
  await page.waitForFunction(() => {
    const a = document.querySelector<HTMLAudioElement>('#lesson-audio');
    return a !== null && Number.isFinite(a.duration);
  });
  const readyMs = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return { htmlMs: n.responseEnd - n.requestStart, domMs: n.domContentLoadedEventEnd - n.startTime };
  });
  console.log(`LAB htmlMs=${Math.round(nav.htmlMs)} domMs=${Math.round(nav.domMs)} playerReadyMs=${readyMs}`);
});
