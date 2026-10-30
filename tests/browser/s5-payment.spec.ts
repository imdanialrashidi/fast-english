import { expect, test } from '@playwright/test';
import { completeEmailVerification } from './helpers';

// S5-7 browser: learner cancels awaiting_receipt via the real UI, the row
// is kept (reload still shows cancelled), and a new purchase creates a new
// request. Pending has no cancel control (staff-only, deferred to S6).
// Uses a fresh registered student per test so the single-open rule never
// collides across runs. Real uploads, no mocks.

async function registerFreshStudent(page, tag: string) {
  const email = `s5-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'password123';
  await page.goto('/register');
  await page.getByLabel('نام').fill(`S5 ${tag}`);
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByLabel('تکرار رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL(/\/email\/verify|\/account/);
  if (page.url().includes('/email/verify')) {
    await completeEmailVerification(page, email);
  }
}

test('S5-7 cancel: awaiting_receipt cancels, row kept, new purchase creates new', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerFreshStudent(page, 'cancel');

  // Choose a plan from the subscribe page.
  await page.goto('/app/subscribe');
  await page.getByRole('heading', { name: 'انتخاب پلن' }).waitFor();
  const chooseButtons = page.getByRole('button', { name: 'انتخاب این پلن' });
  await expect(chooseButtons.first()).toBeVisible();
  await chooseButtons.first().click();
  await page.waitForURL('**/app/payments/*');
  const firstUrl = page.url();

  // Awaiting state with the receipt form + cancel control.
  await expect(page.getByRole('heading', { name: 'درخواست پرداخت' })).toBeVisible();
  await expect(page.getByText('در انتظار رسید')).toBeVisible();
  await expect(page.locator('#receipt')).toBeVisible();

  // Cancel the draft.
  await page.getByRole('button', { name: 'لغو این درخواست' }).click();
  await page.waitForURL('**/app/payments/*');
  await expect(page.getByText('لغو شده')).toBeVisible();

  // Reload-safe: the cancelled row persists.
  await page.reload();
  await expect(page.getByText('لغو شده')).toBeVisible();

  // A new purchase creates a new request (different URL, awaiting again).
  await page.goto('/app/subscribe');
  await page.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
  await page.waitForURL('**/app/payments/*');
  const secondUrl = page.url();
  expect(secondUrl).not.toBe(firstUrl);
  await expect(page.getByText('در انتظار رسید')).toBeVisible();
});

test('S5-7 pending has no learner cancel control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerFreshStudent(page, 'pending');

  await page.goto('/app/subscribe');
  await page.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
  await page.waitForURL('**/app/payments/*');

  // Submit a real fixture receipt.
  const receiptInput = page.locator('#receipt');
  await receiptInput.setInputFiles('database/seeders/fixtures/s3-cover-fixture.jpg');
  await page.getByRole('button', { name: 'ثبت رسید' }).click();
  await page.waitForURL('**/app/payments/*');
  await expect(page.getByText('قدم بعدی: انتظار برای بررسی')).toBeVisible();

  // No cancel button on pending (staff-only cancellation is S6).
  await expect(page.getByRole('button', { name: 'لغو این درخواست' })).toHaveCount(0);
});
