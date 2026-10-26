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
        body: JSON.stringify({ word: args.word, meaning_fa: 'واژه آزمایشی', example_en: `The ${args.word} appears in this sentence.`, lesson_id: args.lesson }),
      }).then((res) => res.status);
    },
    { word: WORD, lesson: Number(lessonId) },
  );
  expect(saved).toBe(201);

  // Notebook lists the word after reload with its saved meaning. The CSV
  // import was retired on 2026-10-25, so the tool must stay absent.
  await page.goto('/app/words');
  await expect(page.getByRole('heading', { name: 'واژه‌ها' })).toBeVisible();
  await expect(page.getByText('ورود از CSV')).toHaveCount(0);
  // The due word drives the only tab badge, with real data.
  await expect(page.locator('.fe-bottomnav [data-due-badge]')).toHaveCount(1);
  await expect(page.locator('.fe-bottomnav [data-due-badge]')).toHaveText('۱');
  await page.screenshot({ path: 'test-results/browser-shots/r-words-tools-390.png' });
  const row = page.locator('div', { has: page.getByText(WORD) }).last();
  await expect(page.getByText(WORD, { exact: true })).toBeVisible();
  await expect(row.getByText('واژه آزمایشی')).toBeVisible();

  // Review: the word is due. Cloze hides it inside its real example,
  // then reveal restores the word + meaning and grading proceeds.
  await page.goto('/app/words/review');
  await expect(page.locator('#flash-cloze')).toContainText('_____');
  await expect(page.locator('#flash-cloze')).not.toContainText(WORD);
  await expect(page.locator('.fe-flash-word')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/browser-shots/r-words-cloze-390.png' });
  await page.getByRole('button', { name: 'نمایش معنی' }).click();
  await expect(page.locator('.fe-flash-word')).toHaveText(WORD);
  await expect(page.getByText('واژه آزمایشی')).toBeVisible();
  await expect(page.getByText(`The ${WORD} appears in this sentence.`)).toBeVisible();
  await page.getByRole('button', { name: 'خوب', exact: true }).click();
  await page.waitForLoadState('load');
  // After a Good grade the word leaves the due queue.
  await expect(page.getByText('واژه‌ای برای مرور نیست')).toBeVisible();

  await page.screenshot({ path: 'test-results/browser-shots/r-words-390.png' });
  } finally {
    await learnerCtx.close();
  }
});
