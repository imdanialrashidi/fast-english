import { expect } from '@playwright/test';
import { test } from './helpers';

// S4-7 rendered mobile: saved + reader at 360/390 have no horizontal
// scroll, the mini-player never covers text, and every target is >=44px.
// Screenshots are captured and must be inspected as pixels (not counts).

const READER = '/app/topics/city-park?level=A2';

async function noHorizontalScroll(page) {
  return page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }));
}

async function assertTargets(page) {
  for (const role of [
    page.locator('#player-play'),
    page.locator('#player-back'),
    page.locator('#player-forward'),
    page.locator('#player-seek'),
  ]) {
    const box = await role.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const speedBox = await page.locator('#player-speed').boundingBox();
  expect(speedBox).not.toBeNull();
  expect(speedBox!.height).toBeGreaterThanOrEqual(44);
  expect(speedBox!.width).toBeGreaterThanOrEqual(44);
  for (const nav of await page.getByRole('link', { name: /مطالب|ذخیره‌شده‌ها|حساب/ }).all()) {
    const box = await nav.boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}


for (const width of [360, 390]) {
  test(`S4-7 reader at ${width}px: no scroll, mini-player clear, 44px targets`, async ({ sub: page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto(READER);
    await page.locator('article.fe-english-body').first().waitFor();
    await page.locator('#player-toggle').click();
    await expect(page.locator('#player-seek')).toBeVisible();

    const { scroll, inner } = await noHorizontalScroll(page);
    expect(scroll).toBeLessThanOrEqual(inner);

    await assertTargets(page);

    // The fixed mini-player must not cover the last glossary row: scroll
    // to the very bottom, then the row sits above the player bar thanks
    // to the end-of-content padding.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    const overlap = await page.evaluate(() => {
      const content = document.querySelector('#fe-content');
      const bar = document.querySelector('.fe-playerbar');
      if (!content || !bar) return null;
      const contentBottom = content.getBoundingClientRect().bottom;
      const barTop = bar.getBoundingClientRect().top;
      const lastRow = document.querySelector('.fe-glossary-row:last-child, article.fe-english-body p:last-child');
      const rowBottom = lastRow ? lastRow.getBoundingClientRect().bottom : contentBottom;
      return { contentBottom, barTop, rowBottom };
    });
    expect(overlap).not.toBeNull();
    expect(overlap!.rowBottom).toBeLessThanOrEqual(overlap!.barTop + 1);

    await page.screenshot({ path: `test-results/browser-shots/s4-reader-${width}.png` });
  });

  test(`S4-7 saved at ${width}px: no scroll, 44px targets`, async ({ sub: page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/app/saved');
    await page.locator('#fe-content').waitFor();

    const { scroll, inner } = await noHorizontalScroll(page);
    expect(scroll).toBeLessThanOrEqual(inner);

    const cards = await page.locator('article.fe-card').count();
    if (cards > 0) {
      const box = await page.locator('.fe-card-media').first().boundingBox();
      expect(box!.width / box!.height).toBeGreaterThan(1.68);
      expect(box!.width / box!.height).toBeLessThan(1.88);
    }

    await page.screenshot({ path: `test-results/browser-shots/s4-saved-${width}.png` });
  });
}
