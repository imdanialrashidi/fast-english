import { expect } from '@playwright/test';
import { registerSubscribeAndApprove, test } from './helpers';

// S8 pre-slice debt 2: placement question + result captured at 1280 CSS
// px (desktop measure), plus the browser console record for the placement
// and payment pages. Evidence is inspected as rendered pixels afterwards;
// the console lines are printed into the test output for the record.
// Paid-only slice: placement needs an approved subscription.

test('S8 preslice: placement at 1280 with console record', async ({ browser }) => {
  const { learnerCtx, learner: page } = await registerSubscribeAndApprove(browser, 'preslice');
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.goto('/app/placement');
  await page.getByRole('button', { name: 'شروع آزمون' }).click();
  await page.waitForURL('**/app/placement/*');
  await expect(page.getByRole('heading', { name: 'سؤالات تعیین سطح' })).toBeVisible();
  await page.screenshot({ path: 'test-results/browser-shots/s8-placement-1280.png' });

  // The confirmation text persists between saves: count real answer
  // responses and drain all 20 before submitting.
  let savedCount = 0;
  page.on('response', (res) => {
    if (res.request().method() === 'POST' && /\/app\/placement\/\d+\/answer/.test(res.url()) && res.ok()) {
      savedCount += 1;
    }
  });
  for (let position = 1; position <= 20; position++) {
    const section = page.locator(`section[aria-label="سؤال ${position}"]`);
    await section.locator('input[type="radio"][value="0"]').check();
    await section.getByRole('button', { name: `ذخیره پاسخ سؤال ${position}` }).click();
    await expect(page.getByText('پاسخ ذخیره شد.')).toBeVisible();
  }
  await expect.poll(() => savedCount, 'all 20 answer POSTs landed').toBe(20);
  await page.getByRole('button', { name: 'ثبت نهایی پاسخ‌ها' }).click();
  await page.waitForURL('**/app/placement/result/*');
  await expect(page.getByRole('heading', { name: 'نتیجه تعیین سطح' })).toBeVisible();
  await page.screenshot({ path: 'test-results/browser-shots/s8-placement-result-1280.png' });

  // Payment pages console record (pending state via real subscribe+receipt).
  await page.goto('/app/subscribe');
  await page.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
  await page.waitForURL('**/app/payments/*');
  await page.screenshot({ path: 'test-results/browser-shots/s8-payment-1280.png' });

  console.log(`S8-PRESLICE-CONSOLE placement+payment 1280: errors=${JSON.stringify(consoleErrors)} failed=${JSON.stringify(failedRequests)}`);
  } finally {
    await learnerCtx.close();
  }
});
