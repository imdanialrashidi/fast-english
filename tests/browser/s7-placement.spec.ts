import { expect, test } from '@playwright/test';
import { registerSubscribeAndApprove } from './helpers';

// S7 answer flow on Chromium: a fresh learner subscribes and is approved
// (paid-only gate), then starts the pinned attempt, saves one answer per
// question through the real forms (resume-safe), submits once, sees the
// score + suggested level + disclaimer, and accepts the result into
// preferred_level. Real HTTP, no mocks. The fixture key rotates
// (position-1)%4, so selecting the first option everywhere scores
// exactly 5 → A2; the client never receives the key (proven in Pest S7-1).

test('S7 flow: start, answer each question, submit once, accept sets level', async ({
  browser,
}) => {
  // Paid-only slice: placement needs an approved subscription; the
  // helper mints an isolated learner + approval per run.
  const { learnerCtx, learner: page } = await registerSubscribeAndApprove(browser, 'flow');
  try {
    await page.setViewportSize({ width: 390, height: 844 });

    // Start pins an attempt to the current published version.
    await page.goto('/app/placement');
  await page.getByRole('heading', { name: 'تعیین سطح (اختیاری)' }).waitFor();
  await page.getByRole('button', { name: 'شروع آزمون' }).click();
  await page.waitForURL('**/app/placement/*');
  await expect(page.getByRole('heading', { name: 'سؤالات تعیین سطح' })).toBeVisible();

  // The answer key never reaches the client.
  const questionHtml = await page.content();
  expect(questionHtml).not.toContain('correct_option');
  expect(questionHtml).not.toContain('scoring_rules');

  // Save the first option on all 20 questions, one mutation per question.
  // The confirmation text persists between saves, so the loop alone
  // cannot prove the final POST landed: count real answer responses and
  // drain all 20 before asserting server state after reload.
  let savedCount = 0;
  const saveIds = new Set<string>();
  const saveStatuses: Array<string> = [];
  page.on('response', (res) => {
    const m = res.url().match(/\/app\/placement\/(\d+)\/answer/);
    if (res.request().method() === 'POST' && m !== null) {
      saveStatuses.push(`${res.status()}`);
      if (res.ok()) {
        savedCount += 1;
        saveIds.add(m[1] as string);
      }
    }
  });
  for (let position = 1; position <= 20; position++) {
    const section = page.locator(`section[aria-label="سؤال ${position}"]`);
    await expect(section).toBeVisible();
    await section.locator('input[type="radio"][value="0"]').check();
    await section.getByRole('button', { name: `ذخیره پاسخ سؤال ${position}` }).click();
    await expect(page.getByText('پاسخ ذخیره شد.')).toBeVisible();
  }
  await expect.poll(() => savedCount, 'all 20 answer POSTs landed').toBe(20);
  // All saves target the single pinned attempt (no cross-attempt split).
  expect(saveIds.size).toBe(1);

  // Resume check: reload keeps the selections. Wait for the Inertia page
  // to mount before counting; an immediate count can race hydration under
  // a loaded full-suite run.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'سؤالات تعیین سطح' })).toBeVisible();
  await expect.poll(() => page.locator('input[type="radio"]:checked').count()).toBe(20);

  // Submit once → result with score, suggested level, and disclaimer.
  await page.getByRole('button', { name: 'ثبت نهایی پاسخ‌ها' }).click();
  await page.waitForURL('**/app/placement/result/*');
  await expect(page.getByRole('heading', { name: 'نتیجه تعیین سطح' })).toBeVisible();
  await expect(page.getByText('نمره: 5 از ۲۰')).toBeVisible();
  await expect(page.getByText('سطح پیشنهادی: A2')).toBeVisible();
  await expect(page.getByText('راهنمای اولیه، بدون گواهی رسمی')).toBeVisible();
  await page.screenshot({ path: 'test-results/browser-shots/s7-result-390.png' });

  // Accept stores the suggested level as the explicit preference.
  await page.getByRole('button', { name: 'تأیید و ذخیره سطح ترجیحی' }).click();
  await expect(page.getByText('سطح ترجیحی ذخیره شد.')).toBeVisible();

  await page.goto('/app/account');
  // App-profile layout (owner direction 2026-10-21): the level is a
  // definition-row value under its label, not a colon-joined sentence.
  const levelRow = page.locator('dl > div').filter({ hasText: 'سطح ترجیحی' });
  await expect(levelRow).toBeVisible();
  await expect(levelRow.getByText('A2', { exact: true })).toBeVisible();
  } finally {
    await learnerCtx.close();
  }
});
