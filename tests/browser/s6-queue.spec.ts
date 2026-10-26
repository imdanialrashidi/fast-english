import { expect, test } from '@playwright/test';

// S6 browser: the staff payment queue end-to-end on Chromium at 390 CSS px.
// A fresh learner subscribes and uploads a real receipt (pending grants
// nothing), staff approves from the Filament payment queue (snapshot +
// receipt visible), and the learner can then open premium content.
// Two isolated contexts (learner + staff), no mocks.

async function registerFreshLearner(page, tag: string) {
  const email = `s6-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'password123';
  await page.goto('/register');
  await page.getByLabel('نام').fill(`S6 ${tag}`);
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByLabel('تکرار رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL('**/account**');
  return email;
}

test('S6 queue: pending first, approve grants premium access', async ({ browser }) => {
  const learnerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const learner = await learnerCtx.newPage();
    const staff = await staffCtx.newPage();

    // Learner: subscribe + real receipt -> pending (grants nothing).
    const learnerEmail = await registerFreshLearner(learner, 'queue');
    await learner.goto('/app/subscribe');
    await learner.getByRole('heading', { name: 'انتخاب پلن' }).waitFor();
    await learner.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
    await learner.waitForURL('**/app/payments/*');
    await learner.locator('#receipt').setInputFiles('database/seeders/fixtures/s3-cover-fixture.jpg');
    await learner.getByRole('button', { name: 'ثبت رسید' }).click();
    await learner.waitForURL('**/app/payments/*');
    await expect(learner.getByText('قدم بعدی: انتظار برای بررسی')).toBeVisible();
    await learner.goto('/app/topics/night-trains?level=B1');
    await expect(learner.getByRole('heading', { name: 'Night Trains' }).first()).toHaveCount(0);

    // Staff: panel login -> payment queue, pending first with snapshot.
    await staff.goto('/admin/login');
    await staff.getByLabel('Email').fill('browser-staff@example.com');
    await staff.getByRole('textbox', { name: /Password/ }).fill('password');
    await staff.getByRole('button', { name: 'Sign in' }).click();
    // Exact dashboard URL: '**/admin**' also matches /admin/login and
    // would race ahead of the sign-in.
    await staff.waitForURL(/\/admin$/);
    await staff.goto('/admin/payment-requests');
    // The lane accumulates rows across runs, so find the learner's row
    // through the queue search (email column is searchable).
    await staff.getByRole('searchbox', { name: 'Search', exact: true }).fill(learnerEmail);
    const rowLink = staff.getByRole('link', { name: learnerEmail });
    await expect(rowLink).toBeVisible();
    await expect(staff.getByText('تومان').first()).toBeVisible();
    await staff.screenshot({ path: 'test-results/browser-shots/s6-queue-390.png' });

    // Open the record: snapshot + receipt image via the staff route.
    await rowLink.click();
    await staff.waitForURL('**/admin/payment-requests/*');
    await expect(staff.getByText('تومان').first()).toBeVisible();
    await expect(staff.locator('img').first()).toBeVisible();

    // Approve through the shared action: explicit confirmation showing
    // the server snapshot amount (S7 pre-slice 2).
    await staff.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await expect(staff.getByText('Confirm approval')).toBeVisible();
    await expect(staff.locator('.fi-modal-description', { hasText: /تومان/ })).toBeVisible();
    await staff.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(staff.getByText('Approved; subscription extended.')).toBeVisible();
    await expect(staff.getByText('Approved').first()).toBeVisible();
    await staff.screenshot({ path: 'test-results/browser-shots/s6-approve-390.png' });

    // Learner: premium opens after approval.
    await learner.goto('/app/topics/night-trains?level=B1');
    await expect(learner.getByRole('heading', { name: 'Night Trains', level: 2 })).toBeVisible();
  } finally {
    await learnerCtx.close();
    await staffCtx.close();
  }
});
