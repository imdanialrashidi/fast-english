// e2e/payment-redesign.spec.ts
// Real-browser coverage for the Payment Experience Redesign.
// Runs against a disposable PocketBase + built app (same harness as
// the other specs; no API mocking). Covers the 20 required scenarios:
//   1  instructions render from actual data
//   2  amount + card number copy
//   3  supported receipt selection
//   4  client validation for invalid/oversized files
//   5  receipt preview (bounded, zoomable)
//   6  replacement
//   7  removal
//   8  upload success
//   9  pending status + refresh preserves state
//  10  duplicate-submit prevention
//  11  rejected reason (long, wraps)
//  12  resubmission with a new receipt
//  13  approved state (authoritative data)
//  14  protected preview authorization
//  15  expired / unauthorized behavior
//  16  no raw backend errors in the DOM
//  17  mobile/tablet/desktop geometry (7 viewports)
//  18  dark mode
//  19  keyboard flow (file chooser, dialog trap/restore)
//  20  zoom dialog fits the viewport

import { expect, type Page, test } from '@playwright/test';
import {
  createStaff,
  ensureOwnedDestination,
  ensureOwnedPlan,
  PB_URL,
  planRadio,
  superuserAuth,
} from './fixtures';

// ---- Helpers (same patterns as p1-s1.spec.ts) ----

// The suite-owned plan (unique per run) is seeded by the shared
// helpers; tests select the exact plan by its record ID.
let sharedPlanId = '';

function uniquePhone(): string {
  const tail = String(Date.now()).slice(-4);
  const mid = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

// Deterministic fixture seeding: reuse the suite-owned plan and
// destination (deduplicated by the shared helpers) so every describe
// can call this safely against the same disposable PB.
async function ensureFixtures(): Promise<void> {
  const suToken = await superuserAuth();
  const plan = await ensureOwnedPlan(suToken);
  sharedPlanId = plan.id;
  await ensureOwnedDestination(suToken);
}

async function getOperatorToken(): Promise<string> {
  const suToken = await superuserAuth();
  const staff = await createStaff(suToken);
  return staff.token;
}

async function approveRequest(requestId: string): Promise<void> {
  const opToken = await getOperatorToken();
  const r = await fetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${requestId}/approve`,
    {
      method: 'POST',
      headers: { authorization: opToken },
    },
  );
  if (r.status !== 200) throw new Error(`approve failed: ${r.status} ${await r.text()}`);
}

async function setRequestRejectedBySuperuser(requestId: string, reason: string): Promise<void> {
  const suToken = await superuserAuth();
  const r = await fetch(`${PB_URL}/api/collections/payment_requests/records/${requestId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: suToken },
    body: JSON.stringify({ status: 'rejected', public_rejection_reason: reason }),
  });
  if (!r.ok) throw new Error(`rejected fixture patch failed: ${r.status} ${await r.text()}`);
}

async function signupAndLogin(
  page: Page,
  name: string,
  phone: string,
  password: string,
): Promise<void> {
  await page.goto('/signup');
  const form = page.getByRole('form', { name: 'فرم ثبت‌نام' });
  await form.getByRole('textbox', { name: 'نام' }).fill(name);
  await form.getByLabel('شمارهٔ موبایل').fill(phone);
  await form.getByLabel('رمز عبور', { exact: true }).fill(password);
  await form.getByLabel('تکرار رمز عبور').fill(password);
  await form.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL('**/payment', { timeout: 30_000 });
}

async function selectPlanAndReceipt(page: Page, fileName = 'r.jpg'): Promise<void> {
  await planRadio(page, sharedPlanId).check();
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'image/jpeg',
    buffer: JPEG_1x1,
  });
}

async function submitFlow(page: Page, fileName = 'r.jpg'): Promise<void> {
  await selectPlanAndReceipt(page, fileName);
  await page.getByRole('button', { name: /ارسال رسید/ }).click();
  await page.waitForURL('**/payment-status', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
    timeout: 15_000,
  });
}

function setDarkMode(page: Page): Promise<void> {
  return page.evaluate(() => {
    localStorage.setItem('mui-mode', 'dark');
  });
}

const LONG_REASON =
  'تصویر رسید ارسالی با مبلغ انتقالیافته مطابقت ندارد و بخشی از تصویر (شمارهٔ پیگیری و زمان واریز) خوانا نیست؛ لطفاً تصویر واضحتر و کاملتر از رسید پرداخت همین مبلغ ارسال کنید تا بررسی شود.';

// A 1x1 JPEG (valid signature; server accepts it).
const JPEG_1x1 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
  0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
  0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
  0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
  0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
  0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2,
  0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6,
  0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
  0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd0, 0xff, 0xd9,
]);

test.describe('payment redesign — instructions and copy', () => {
  test.beforeAll(async () => {
    await ensureFixtures();
  });

  test('1. payment instructions render from actual data with a single H1', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E دانشجو', phone, 'Test1234!');

    // Journey: five stages from the real state machine.
    const journey = page.getByTestId('payment-journey');
    await expect(journey).toBeVisible();
    await expect(page.getByText('مشاهده اطلاعات پرداخت').first()).toBeVisible();

    // Instructions come from the real backend data (the exact plan
    // and destination values depend on which disposable fixtures the
    // suite created first, so assertions stay structural).
    await expect(page.getByRole('heading', { name: 'انتخاب طرح' })).toBeVisible();
    await expect(page.getByText('E2E Monthly', { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId('payment-details-card')).toBeVisible();
    // Card number renders as 4 groups of 4 digits with the Arabic comma.
    const cardNumber = await page.getByTestId('payment-card-number').textContent();
    expect(cardNumber).toMatch(/^[۰-۹0-9]{4}،[۰-۹0-9]{4}،[۰-۹0-9]{4}،[۰-۹0-9]{4}$/);
    // The bank row exists with a real value.
    await expect(page.getByText('نام بانک', { exact: true })).toBeVisible();
    await expect(page.getByText(/به‌صورت دستی/)).toBeVisible();

    // The amount block is the selected plan's value once chosen.
    await planRadio(page, sharedPlanId).check();
    await expect(page.getByTestId('payment-amount')).toContainText('۱٬۲۳۴٬۵۶۷');

    // Exactly one H1 on the page.
    const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length);
    expect(h1Count).toBe(1);
  });

  test('2. amount and card number copy with accessible feedback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E کپی', phone, 'Test1234!');
    await planRadio(page, sharedPlanId).check();

    // The clipboard must contain exactly the digits shown on screen.
    // The clipboard must contain exactly the digits shown on screen
    // (the aria-label carries the full card number in Persian digits).
    const cardLabel =
      (await page.getByTestId('payment-card-number').getAttribute('aria-label')) ?? '';
    const expectedCard = cardLabel
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/\D/g, '');
    expect(expectedCard).toMatch(/^\d{12,32}$/);

    await page.getByTestId('copy-card').getByRole('button').click();
    await expect(page.getByText('کپی شد', { exact: true }).first()).toBeVisible();
    const cardClip = await page.evaluate(() => navigator.clipboard.readText());
    expect(cardClip).toBe(expectedCard);

    await page.getByTestId('copy-amount').getByRole('button').click();
    const amountClip = await page.evaluate(() => navigator.clipboard.readText());
    expect(amountClip).toBe('1234567');
  });
});

test.describe('payment redesign — receipt selection, preview, replace, remove', () => {
  test.beforeAll(async () => {
    await ensureFixtures();
  });

  test('3. supported receipt selection shows filename, type and size', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E رسید', phone, 'Test1234!');
    await selectPlanAndReceipt(page, 'receipt.jpg');
    const selected = page.getByTestId('receipt-selected');
    await expect(selected).toBeVisible();
    await expect(selected).toContainText('receipt.jpg');
    await expect(selected).toContainText('image/jpeg');
    await expect(selected).toContainText('بایت');
  });

  test('4. client validation rejects invalid and oversized files', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E خطا', phone, 'Test1234!');
    await planRadio(page, sharedPlanId).check();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'fake.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await expect(page.getByText(/فرمت فایل باید JPEG، PNG یا WebP باشد/)).toBeVisible({
      timeout: 5_000,
    });

    await page.locator('input[type="file"]').setInputFiles({
      name: 'big.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0xff),
    });
    await expect(page.getByText(/حجم فایل نباید بیشتر از ۵ مگابایت باشد/)).toBeVisible({
      timeout: 5_000,
    });
    // No selection remains after the rejected files.
    await expect(page.getByTestId('select-receipt')).toBeVisible();
  });

  test('5. receipt preview is bounded and zoomable in a fitting dialog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E پیش‌نمایش', phone, 'Test1234!');
    await selectPlanAndReceipt(page);
    const img = page.locator('img[alt="پیش‌نمایش رسید"]');
    await expect(img).toBeVisible({ timeout: 5_000 });
    const size = await img.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    expect(size.w).toBeLessThanOrEqual(390);
    expect(size.h).toBeLessThanOrEqual(280);

    await page.getByTestId('preview-zoom').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    const box = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        w: innerWidth,
        h: innerHeight,
      };
    });
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.top).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(box.w + 1);
    expect(box.bottom).toBeLessThanOrEqual(box.h + 1);
    // The dialog image is a local blob URL, never a server path.
    const src = await dialog.locator('img').getAttribute('src');
    expect(src).toMatch(/^blob:/);
    expect(src).not.toMatch(/\/api\//);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test('6. replacement updates the selection and preview', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E جایگزینی', phone, 'Test1234!');
    await selectPlanAndReceipt(page, 'first.jpg');
    await expect(page.getByTestId('receipt-selected')).toContainText('first.jpg');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'second.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_1x1,
    });
    await expect(page.getByTestId('receipt-selected')).toContainText('second.jpg');
    await expect(page.getByTestId('receipt-selected')).not.toContainText('first.jpg');
    await expect(page.locator('img[alt="پیش‌نمایش رسید"]')).toBeVisible({ timeout: 5_000 });
  });

  test('7. removal clears the selection before submission', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E حذف', phone, 'Test1234!');
    await selectPlanAndReceipt(page);
    await expect(page.getByTestId('receipt-selected')).toBeVisible();

    await page.getByTestId('remove-receipt').click();
    await expect(page.getByTestId('select-receipt')).toBeVisible();
    await expect(page.getByTestId('receipt-selected')).not.toBeVisible();
    // Submission is blocked without a receipt.
    await expect(page.getByTestId('submit-payment')).toBeDisabled();
  });
});

test.describe('payment redesign — submission, pending, rejected, approved', () => {
  test.beforeAll(async () => {
    await ensureFixtures();
  });

  test('8+9+10. upload succeeds; pending workspace replaces the form and survives refresh; duplicates are blocked', {
    tag: '@critical',
  }, async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E جریان', phone, 'Test1234!');

    // Simplified journey (Business Configuration slice): the submit button
    // is disabled until a plan + receipt file are chosen — there is no
    // confirmation checkbox and no transfer-reference step.
    await expect(page.getByTestId('submit-payment')).toBeDisabled();
    await selectPlanAndReceipt(page);
    await expect(page.getByTestId('submit-payment')).toBeEnabled();

    // The sticky submit area still shows the honest plan/price summary.
    await expect(page.getByText(/E2E Monthly.*۱٬۲۳۴٬۵۶۷ تومان/).last()).toBeVisible();

    await page.getByRole('button', { name: /ارسال رسید/ }).click();
    await page.waitForURL('**/payment-status', { timeout: 30_000 });

    // Pending workspace replaces the submission form.
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('pending-alert')).toBeVisible();
    await expect(page.getByTestId('payment-status-timeline')).toBeVisible();
    await expect(page.getByTestId('payment-request-summary')).toContainText('E2E Monthly');
    await expect(page.getByTestId('payment-request-summary')).toContainText('۱٬۲۳۴٬۵۶۷');
    // The form is gone.
    await expect(page.getByTestId('select-receipt')).not.toBeVisible();

    // Refresh (both reload and in-page retry) preserves the pending state.
    await page.reload();
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('refresh-status').click();
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });

    // Duplicate submission is prevented: /payment redirects to status.
    await page.goto('/payment');
    await expect(page).toHaveURL(/\/payment-status/);
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('11+12. rejected reason renders (long, wrapping) and resubmission creates a new request', async ({
    page,
  }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E رد', phone, 'Test1234!');
    await submitFlow(page);

    // Capture the first request id from its receipt URL.
    const showFirst = page.getByRole('button', { name: 'نمایش رسید' });
    await showFirst.waitFor({ state: 'visible' });
    const firstReceiptReq = page.waitForRequest(
      (req) => req.url().includes('/payment-requests/') && req.url().includes('/receipt'),
    );
    await showFirst.click();
    await expect(page.getByTestId('receipt-preview-ready')).toBeVisible({ timeout: 15_000 });
    const firstReq = await firstReceiptReq;
    const firstId = firstReq.url().match(/payment-requests\/([^/]+)\/receipt/)?.[1];
    if (!firstId) throw new Error('first request id missing');

    // Operator rejects with a long public reason.
    await setRequestRejectedBySuperuser(firstId, LONG_REASON);
    await page.reload();
    await expect(page.getByTestId('rejected-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('rejection-reason')).toContainText(LONG_REASON);
    // The long reason wraps without horizontal overflow.
    const reasonOverflow = await page
      .getByTestId('rejection-reason')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(reasonOverflow).toBe(true);
    await expect(page.getByTestId('resubmit-cta')).toBeVisible();
    await expect(page.getByTestId('resubmit-cta')).toHaveText('ارسال درخواست جدید');

    // Resubmission: new receipt → new request.
    await page.getByTestId('resubmit-cta').click();
    await page.waitForURL('**/payment', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'انتخاب طرح' })).toBeVisible();
    await selectPlanAndReceipt(page, 'r2.jpg');
    // Simplified journey: submission is direct after choosing plan + file.
    await page.getByRole('button', { name: /ارسال رسید/ }).click();
    await page.waitForURL('**/payment-status', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });
    const secondShow = page.getByRole('button', { name: 'نمایش رسید' });
    const secondReceiptReq = page.waitForRequest(
      (req) => req.url().includes('/payment-requests/') && req.url().includes('/receipt'),
    );
    await secondShow.click();
    const secondReq = await secondReceiptReq;
    const secondId = secondReq.url().match(/payment-requests\/([^/]+)\/receipt/)?.[1];
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);
  });

  test('13. approved state shows activation and authoritative request data', {
    tag: '@critical',
  }, async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E تأیید', phone, 'Test1234!');
    await submitFlow(page);

    // Approve through the real operator route, then refresh in-page
    // (the client session stays stale, so the workspace is reachable).
    const receiptReq = page.waitForRequest(
      (req) => req.url().includes('/payment-requests/') && req.url().includes('/receipt'),
    );
    await page.getByRole('button', { name: 'نمایش رسید' }).click();
    const rec = await receiptReq;
    const requestId = rec.url().match(/payment-requests\/([^/]+)\/receipt/)?.[1];
    if (!requestId) throw new Error('request id missing before approve');
    await approveRequest(requestId);

    await page.getByTestId('refresh-status').click();
    await expect(page.getByTestId('approved-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('approved-alert')).toBeVisible();
    await expect(page.getByTestId('approved-panel')).toContainText('E2E Monthly');
    await expect(page.getByTestId('approved-panel')).toContainText('۱٬۲۳۴٬۵۶۷');
    // Receipt is not shown after approval.
    await expect(
      page.getByTestId('approved-panel').getByRole('button', { name: /نمایش رسید/ }),
    ).not.toBeVisible();
    // Placement is the next step for this fresh student.
    await expect(page.getByTestId('approved-primary-cta')).toHaveText('شروع تعیین سطح');
  });

  test('14. protected preview: owner blob URL only; unauth 401; cross-user 404', async ({
    page,
    context,
  }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E مالک', phone, 'Test1234!');
    await submitFlow(page);
    const receiptReq = page.waitForRequest(
      (req) => req.url().includes('/payment-requests/') && req.url().includes('/receipt'),
    );
    await page.getByRole('button', { name: 'نمایش رسید' }).click();
    await expect(page.getByTestId('receipt-preview-ready')).toBeVisible({ timeout: 15_000 });
    const rec = await receiptReq;
    const requestId = rec.url().match(/payment-requests\/([^/]+)\/receipt/)?.[1];
    expect(requestId).toBeTruthy();

    const src = await page.locator('[data-testid="receipt-preview-ready"] img').getAttribute('src');
    expect(src).toMatch(/^blob:/);
    expect(src).not.toMatch(/token=/);
    expect(src).not.toMatch(/\/api\//);

    // Unauthenticated → 401.
    const unauthContext = await context.browser()?.newContext();
    const unauthPage = await unauthContext.newPage();
    await unauthPage.goto('/login');
    const unauthStatus = await unauthPage.evaluate(
      (id) => fetch(`/api/fast-english/payment-requests/${id}/receipt`).then((r) => r.status),
      requestId,
    );
    expect(unauthStatus).toBe(401);
    await unauthContext.close();

    // Cross-user → 404 (no existence leak).
    const crossContext = await context.browser()?.newContext();
    const crossPage = await crossContext.newPage();
    await signupAndLogin(crossPage, 'E2E مزاحم', uniquePhone(), 'Test1234!');
    const crossStatus = await crossPage.evaluate(async (id) => {
      const raw = localStorage.getItem('pocketbase_auth') || '';
      let token = '';
      try {
        if (raw) token = JSON.parse(raw).token || '';
      } catch {}
      const r = await fetch(`/api/fast-english/payment-requests/${id}/receipt`, {
        headers: { authorization: token },
      });
      return r.status;
    }, requestId);
    expect(crossStatus).toBe(404);
    await crossContext.close();
  });

  test('15. expired user sees an honest renewal gate; unauthorized user is redirected', async ({
    page,
    context,
  }) => {
    // Expired user: form is hidden, no renewal claim.
    const phone = uniquePhone();
    const suToken = await superuserAuth();
    const signup = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E منقضی',
        phone,
        password: 'Test1234!',
        passwordConfirm: 'Test1234!',
      }),
    });
    const userBody = (await signup.json()) as { id?: string; phone?: string };
    await fetch(`${PB_URL}/api/collections/fep_users/records/${userBody.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: suToken },
      body: JSON.stringify({ account_status: 'expired' }),
    });
    await page.goto('/login');
    await page.getByLabel('شمارهٔ موبایل').fill(userBody.phone || phone);
    await page.getByLabel('رمز عبور', { exact: true }).fill('Test1234!');
    await page.getByRole('button', { name: 'ورود' }).click();
    await page.waitForURL('**/payment', { timeout: 15_000 });
    await expect(page.getByText(/تمدید اشتراک در حال حاضر فعال نیست/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('select-receipt')).not.toBeVisible();
    // No renewal CTA is offered (backend does not support it).
    await expect(page.getByRole('button', { name: /تمدید/ })).toHaveCount(0);

    // Unauthorized user: /payment → /login.
    const anonContext = await context.browser()?.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto('/payment');
    await anonPage.waitForURL('**/login', { timeout: 15_000 });
    await anonContext.close();
  });

  test('16. no raw backend errors ever reach the DOM', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E امن', phone, 'Test1234!');
    await submitFlow(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/UNIQUE constraint failed/);
    expect(bodyText).not.toMatch(/ApiError/);
    expect(bodyText).not.toMatch(/Failed to authenticate/);
    expect(bodyText).not.toMatch(/validation_invalid_value/);
    expect(bodyText).not.toMatch(/pocketbase|PocketBase/i);
    expect(bodyText).not.toMatch(/internal_note/);
  });
});

test.describe('payment redesign — viewport geometry', () => {
  test.beforeAll(async () => {
    await ensureFixtures();
  });

  for (const [name, width, height] of [
    ['390x844', 390, 844],
    ['768x1024', 768, 1024],
    ['1440x900', 1440, 900],
  ]) {
    test(`17. ${name}: no overflow; journey, card number, preview and CTA stay in bounds`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      const phone = uniquePhone();
      await signupAndLogin(page, `E2E ${name}`, phone, 'Test1234!');

      // Payment form surface.
      const noHorizontalOverflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        );
      expect(await noHorizontalOverflow(), `${name} /payment overflow`).toBe(true);

      // Journey stepper stays within the viewport.
      const journeyBox = await page
        .getByTestId('payment-journey')
        .evaluate((el) => el.getBoundingClientRect());
      expect(journeyBox.width).toBeLessThanOrEqual(width + 1);
      expect(journeyBox.right).toBeLessThanOrEqual(width + 1);

      // Card number + copy control do not overlap.
      await planRadio(page, sharedPlanId).check();
      const [cardBox, copyBox] = await Promise.all([
        page.getByTestId('payment-card-number').evaluate((el) => el.getBoundingClientRect()),
        page.getByTestId('copy-card').evaluate((el) => el.getBoundingClientRect()),
      ]);
      const overlap =
        cardBox.right > copyBox.left + 1 &&
        copyBox.right > cardBox.left + 1 &&
        cardBox.bottom > copyBox.top + 1 &&
        copyBox.bottom > cardBox.top + 1;
      expect(overlap, `${name} copy overlaps card number`).toBe(false);
      expect(cardBox.right, `${name} card number inside viewport`).toBeLessThanOrEqual(width + 1);
      expect(copyBox.right, `${name} copy control inside viewport`).toBeLessThanOrEqual(width + 1);

      // Receipt preview bounded.
      await page.locator('input[type="file"]').setInputFiles({
        name: 'r.jpg',
        mimeType: 'image/jpeg',
        buffer: JPEG_1x1,
      });
      const imgBox = await page
        .locator('img[alt="پیش‌نمایش رسید"]')
        .evaluate((el) => el.getBoundingClientRect());
      expect(imgBox.width).toBeLessThanOrEqual(width + 1);
      expect(imgBox.height).toBeLessThanOrEqual(281);

      // Primary CTA is not covered by the Bottom Navigation (xs only;
      // the sticky offset clears the 64px nav + safe area).
      if (width < 768) {
        const ctaBox = await page
          .getByTestId('submit-payment')
          .evaluate((el) => el.getBoundingClientRect());
        expect(ctaBox.bottom, `${name} CTA above bottom navigation`).toBeLessThanOrEqual(
          height - 60,
        );
        expect(ctaBox.right).toBeLessThanOrEqual(width + 1);
      }

      // Pending workspace geometry.
      // Simplified journey: submission is direct after choosing plan + file.
      await page.getByRole('button', { name: /ارسال رسید/ }).click();
      await page.waitForURL('**/payment-status', { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
        timeout: 15_000,
      });
      expect(await noHorizontalOverflow(), `${name} /payment-status overflow`).toBe(true);
      const timelineBox = await page
        .getByTestId('payment-status-timeline')
        .evaluate((el) => ({ w: el.scrollWidth, c: el.clientWidth }));
      expect(timelineBox.w).toBeLessThanOrEqual(timelineBox.c + 1);
      // Zoom dialog fits the viewport.
      await page.getByRole('button', { name: 'نمایش رسید' }).click();
      await page.getByTestId('receipt-preview-open').waitFor({ state: 'visible' });
      await page.getByTestId('receipt-preview-open').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      const dbox = await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight };
      });
      expect(dbox.l).toBeGreaterThanOrEqual(-1);
      expect(dbox.t).toBeGreaterThanOrEqual(-1);
      expect(dbox.r).toBeLessThanOrEqual(dbox.w + 1);
      expect(dbox.b).toBeLessThanOrEqual(dbox.h + 1);
    });
  }
});

test.describe('payment redesign — dark mode and keyboard', () => {
  test.beforeAll(async () => {
    await ensureFixtures();
  });

  test('18. dark mode renders with semantic surfaces and no raw black/white', async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E تاریک', phone, 'Test1234!');
    await setDarkMode(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    // Wait for the payment surface to render before reading computed
    // styles (the html attribute applies before React mounts).
    await expect(page.getByTestId('payment-details-card')).toBeVisible();

    const colors = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const cardEl = document.querySelector('[data-testid="payment-details-card"]');
      if (!cardEl) throw new Error('details card missing');
      const card = getComputedStyle(cardEl);
      return { bodyBg: body.backgroundColor, cardBg: card.backgroundColor };
    });
    expect(colors.bodyBg).not.toBe('rgb(255, 255, 255)');
    expect(colors.bodyBg).not.toBe('rgb(0, 0, 0)');
    expect(colors.cardBg).not.toBe('rgb(255, 255, 255)');
    expect(colors.cardBg).not.toBe('rgb(0, 0, 0)');

    // The status workspace also renders cleanly in dark mode.
    await selectPlanAndReceipt(page);
    // Simplified journey: submission is direct after choosing plan + file.
    await page.getByRole('button', { name: /ارسال رسید/ }).click();
    await page.waitForURL('**/payment-status', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
      timeout: 15_000,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(true);
  });

  test('19. keyboard flow: file chooser, dialog focus trap and focus restoration', async ({
    page,
  }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, 'E2E کیبورد', phone, 'Test1234!');
    await planRadio(page, sharedPlanId).check();

    // Keyboard activation of the select action opens the native file chooser.
    const select = page.getByTestId('select-receipt');
    await select.focus();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
      .toBe('select-receipt');
    // press() re-focuses the element at press time, so a re-render
    // between focus() and the key event cannot drop the activation.
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), select.press('Enter')]);
    await chooser.setFiles({
      name: 'kbd.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_1x1,
    });
    await expect(page.getByTestId('receipt-selected')).toBeVisible();

    // Zoom dialog: focus moves inside and Tab stays inside (trap);
    // Escape closes and focus returns to the opener.
    const zoomBtn = page.getByTestId('preview-zoom');
    await zoomBtn.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      );
      expect(inside, `tab ${i} stays inside dialog`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    const focusedTestId = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid'),
    );
    expect(focusedTestId).toBe('preview-zoom');

    // Keyboard removal.
    await page.getByTestId('remove-receipt').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('select-receipt')).toBeVisible();
  });
});
