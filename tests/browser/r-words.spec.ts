import { expect } from '@playwright/test';
import { registerSubscribeAndApprove, test } from './helpers';

// R4 vocabulary notebook (VOCAB-01, AC-25): save a word from the reader via
// the real endpoint with its lesson context, find it in the notebook after
// reload, review it with a grade, and see it leave the due queue. A unique
// word per run keeps the lane re-runnable against fe_browser.

const WORD = `rword${Date.now().toString(36)}`;
const READER = '/app/topics/city-park?level=A2';


test('R4 notebook: save from reader, persist, review with a grade', async ({ browser }) => {
  // Paid-only slice: a pristine approved learner per run (the shared
  // lane account accumulates words across runs, which breaks the
  // single-due-word review assertions below).
  const { learnerCtx, learner: page } = await registerSubscribeAndApprove(browser, 'words');
  try {
    await page.setViewportSize({ width: 390, height: 844 });

  // Save a word with the reader's real lesson id for true lesson context.
  await page.goto(READER);
  const lessonId = await page.locator('#fe-lesson-data').getAttribute('data-lesson-id');
  expect(Number(lessonId)).toBeGreaterThan(0);
  const saved: number = await page.evaluate(
    (args: { word: string; lesson: number }) => {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
      return fetch('/app/words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ word: args.word, meaning_fa: 'واژه آزمایشی', lesson_id: args.lesson }),
      }).then((res) => res.status);
    },
    { word: WORD, lesson: Number(lessonId) },
  );
  expect(saved).toBe(201);

  // Notebook lists the word after reload with its saved meaning.
  await page.goto('/app/words');
  const row = page.locator('div', { has: page.getByText(WORD) }).last();
  await expect(page.getByText(WORD)).toBeVisible();
  await expect(row.getByText('واژه آزمایشی')).toBeVisible();

  // Review: the word is due, shows its meaning, and grades forward.
  await page.goto('/app/words/review');
  await expect(page.locator('.fe-flash-word')).toHaveText(WORD);
  await page.getByRole('button', { name: 'نمایش معنی' }).click();
  await expect(page.getByText('واژه آزمایشی')).toBeVisible();
  await page.getByRole('button', { name: 'خوب', exact: true }).click();
  await page.waitForLoadState('load');
  // After a Good grade the word leaves the due queue.
  await expect(page.getByText('واژه‌ای برای مرور نیست')).toBeVisible();

  await page.screenshot({ path: 'test-results/browser-shots/r-words-390.png' });
  } finally {
    await learnerCtx.close();
  }
});
