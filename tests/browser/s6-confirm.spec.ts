import { expect, test } from '@playwright/test';
import { completeEmailVerification } from './helpers';

// S7 pre-slice 2: every staff money/access action requires an explicit
// confirmation step showing the server snapshot amount, and a single
// mis-click (open then Cancel) changes nothing. Uses a fresh learner per
// run so the single-open rule never collides. Real uploads, no mocks.

async function registerFreshLearner(page, tag: string) {
  const email = `s6c-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'password123';
  await page.goto('/register');
  await page.getByLabel('نام').fill(`S6C ${tag}`);
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByLabel('تکرار رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL(/\/email\/verify|\/account/);
  if (page.url().includes('/email/verify')) {
    await completeEmailVerification(page, email);
  }
  return email;
}

async function staffLogin(page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('browser-staff@example.com');
  await page.getByRole('textbox', { name: /Password/ }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin$/);
}

test('S6 confirm: mis-click changes nothing; every action shows the snapshot amount', async ({
  browser,
}) => {
  const learnerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const learner = await learnerCtx.newPage();
    const staff = await staffCtx.newPage();

    // Learner reaches pending (real subscribe + real receipt).
    const learnerEmail = await registerFreshLearner(learner, 'confirm');
    await learner.goto('/app/subscribe');
    await learner.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
    await learner.waitForURL('**/app/payments/*');
    await learner.locator('#receipt').setInputFiles('database/seeders/fixtures/s3-cover-fixture.jpg');
    await learner.getByRole('button', { name: 'ثبت رسید' }).click();
    await learner.waitForURL('**/app/payments/*');
    await expect(learner.getByText('قدم بعدی: انتظار برای بررسی')).toBeVisible();

    // Staff opens the learner's record through the queue search.
    await staffLogin(staff);
    await staff.goto('/admin/payment-requests');
    await staff.getByRole('searchbox', { name: 'Search', exact: true }).fill(learnerEmail);
    const rowLink = staff.getByRole('link', { name: learnerEmail });
    await expect(rowLink).toBeVisible();
    await rowLink.click();
    await staff.waitForURL('**/admin/payment-requests/*');
    await expect(staff.getByText('تومان').first()).toBeVisible();

    // Every money/access action shows a confirmation with the snapshot amount.
    const actions: Array<{ button: string; heading: RegExp }> = [
      { button: 'Approve', heading: /Confirm approval/ },
      { button: 'Reject', heading: /Confirm rejection/ },
      { button: 'Cancel', heading: /Confirm cancellation/ },
      { button: 'Grant subscription', heading: /Confirm manual grant/ },
      { button: 'Revoke subscription', heading: /Confirm revoke/ },
    ];
    for (const { button, heading } of actions) {
      await staff.getByRole('button', { name: button, exact: true }).first().click();
      await expect(staff.getByText(heading)).toBeVisible();
      await expect(staff.locator('.fi-modal-description', { hasText: /تومان/ })).toBeVisible();
      await staff.screenshot({
        path: `test-results/browser-shots/s6-confirm-${button.replace(/[^a-z]+/gi, '-').toLowerCase()}-390.png`,
      });
      // Mis-click: Cancel the modal instead of confirming.
      await staff.getByRole('button', { name: 'Cancel', exact: true }).last().click();
      await expect(staff.getByText(heading)).toHaveCount(0);
    }

    // A single mis-click changed nothing: still pending, no success note.
    await expect(staff.getByText('Approved; subscription extended.')).toHaveCount(0);
    await expect(staff.getByText('pending').first()).toBeVisible();
    await staff.reload();
    await expect(staff.getByText('pending').first()).toBeVisible();

    // Learner still has no premium access after the mis-clicks.
    await learner.goto('/app/topics/night-trains?level=B1');
    await expect(learner.getByRole('heading', { name: 'Night Trains' }).first()).toHaveCount(0);
  } finally {
    await learnerCtx.close();
    await staffCtx.close();
  }
});
