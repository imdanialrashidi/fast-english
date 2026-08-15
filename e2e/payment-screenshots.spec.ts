// e2e/payment-screenshots.spec.ts
// OPT-IN uninspected Human-review artifacts for the Payment redesign.
//
// Run with: FEP_SCREENSHOTS=1 CI=1 pnpm exec playwright test e2e/payment-screenshots.spec.ts
//
// Writes PNGs to /tmp/opencode/fep-payment-redesign/ (outside the
// repository). These screenshots are NOT acceptance evidence — the
// submitter cannot interpret visuals; they exist only for later
// Human review. Deterministic acceptance comes from the other specs.

import { mkdirSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import {
  createStaff,
  ensureOwnedDestination,
  ensureOwnedPlan,
  PB_URL,
  planRadio,
  superuserAuth,
} from './fixtures';

const OUT_ROOT = '/tmp/opencode/fep-payment-redesign';
const ENV_FLAG = process.env.FEP_SCREENSHOTS === '1';

let sharedPlanId = '';

function uniquePhone(): string {
  const tail = String(Date.now()).slice(-4);
  const mid = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

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

async function signupAndLogin(page: Page, phone: string): Promise<void> {
  await page.goto('/signup');
  const form = page.getByRole('form', { name: 'فرم ثبت‌نام' });
  await form.getByRole('textbox', { name: 'نام' }).fill('E2E عکس');
  await form.getByLabel('شمارهٔ موبایل').fill(phone);
  await form.getByLabel('رمز عبور', { exact: true }).fill('Test1234!');
  await form.getByLabel('تکرار رمز عبور').fill('Test1234!');
  await form.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL('**/payment', { timeout: 30_000 });
}

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

const LAYOUTS = [
  { name: '390x844', width: 390, height: 844, mode: 'light' },
  { name: '390x844', width: 390, height: 844, mode: 'dark' },
  { name: '768x1024', width: 768, height: 1024, mode: 'light' },
  { name: '1440x900', width: 1440, height: 900, mode: 'light' },
  { name: '1440x900', width: 1440, height: 900, mode: 'dark' },
] as const;

for (const layout of LAYOUTS) {
  test.describe(`screenshots ${layout.name} ${layout.mode}`, () => {
    test.skip(!ENV_FLAG, 'opt-in: set FEP_SCREENSHOTS=1 to generate human-review artifacts');

    test.beforeAll(async () => {
      await ensureFixtures();
    });

    test('capture the seven uninspected states', async ({ page, browser }) => {
      const dir = `${OUT_ROOT}/${layout.mode}/${layout.name}`;
      mkdirSync(dir, { recursive: true });
      await page.setViewportSize({ width: layout.width, height: layout.height });

      // --- User A: instructions → selected → uploading → pending → approved ---
      const phoneA = uniquePhone();
      await signupAndLogin(page, phoneA);
      await page.evaluate((m) => localStorage.setItem('mui-mode', m), layout.mode);
      await page.reload();
      await page.waitForURL('**/payment', { timeout: 15_000 });
      await expect(page.getByTestId('payment-journey')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${dir}/01-payment-instructions.png`, fullPage: true });

      await planRadio(page, sharedPlanId).check();
      await page.locator('input[type="file"]').setInputFiles({
        name: 'receipt.jpg',
        mimeType: 'image/jpeg',
        buffer: JPEG_1x1,
      });
      await expect(page.getByTestId('receipt-selected')).toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: `${dir}/02-receipt-selected.png`, fullPage: true });

      // Receipt preview dialog.
      await page.getByTestId('preview-zoom').click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: `${dir}/07-receipt-preview-dialog.png` });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });

      // Uploading state: delay the first POST so the honest
      // indeterminate progress is visible in the capture. The route
      // stays registered for the rest of the test (subsequent
      // requests pass through untouched) — no unroute races.
      let delayed = false;
      await page.route('**/api/fast-english/payment-requests', async (route) => {
        if (!delayed && route.request().method() === 'POST') {
          delayed = true;
          await new Promise((r) => setTimeout(r, 2500));
        }
        await route.continue();
      });
      await page.getByRole('button', { name: /ارسال رسید/ }).click();
      await expect(page.getByText('در حال ارسال رسید…')).toBeVisible({ timeout: 5_000 });
      await page.screenshot({ path: `${dir}/03-uploading.png` });
      await page.waitForURL('**/payment-status', { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
        timeout: 15_000,
      });
      await page.screenshot({ path: `${dir}/04-pending.png`, fullPage: true });

      // Approved: authorize through the real operator route.
      const receiptReq = page.waitForRequest(
        (req) => req.url().includes('/payment-requests/') && req.url().includes('/receipt'),
      );
      await page.getByRole('button', { name: 'نمایش رسید' }).click();
      const rec = await receiptReq;
      const requestId = rec.url().match(/payment-requests\/([^/]+)\/receipt/)?.[1];
      expect(requestId).toBeTruthy();
      const opToken = await getOperatorToken();
      const approve = await fetch(
        `${PB_URL}/api/fast-english/operator/payment-requests/${requestId}/approve`,
        { method: 'POST', headers: { authorization: opToken } },
      );
      expect(approve.status).toBe(200);
      await page.getByTestId('refresh-status').click();
      await expect(page.getByTestId('approved-panel')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${dir}/06-approved.png`, fullPage: true });

      // --- User B: rejected (fresh context so the session is clean) ---
      const ctxB = await browser.newContext({
        viewport: { width: layout.width, height: layout.height },
        locale: 'fa-IR',
      });
      const pageB = await ctxB.newPage();
      try {
        // Load the app once so localStorage is available, set the
        // mode, then run the signup flow (mode persists).
        await pageB.goto('/login');
        await pageB.getByRole('button', { name: 'ورود' }).waitFor();
        await pageB.evaluate((m) => localStorage.setItem('mui-mode', m), layout.mode);
        const phoneB = uniquePhone();
        await signupAndLogin(pageB, phoneB);
        await planRadio(pageB, sharedPlanId).check();
        await pageB.locator('input[type="file"]').setInputFiles({
          name: 'r2.jpg',
          mimeType: 'image/jpeg',
          buffer: JPEG_1x1,
        });
        await pageB.getByRole('button', { name: /ارسال رسید/ }).click();
        await pageB.waitForURL('**/payment-status', { timeout: 30_000 });
        await expect(pageB.getByRole('heading', { name: /در انتظار بررسی/ })).toBeVisible({
          timeout: 15_000,
        });
        const req2 = pageB.waitForRequest(
          (req) => req.url().includes('/payment-requests/') && req.url().includes('/receipt'),
        );
        await pageB.getByRole('button', { name: 'نمایش رسید' }).click();
        const rec2 = await req2;
        const requestId2 = rec2.url().match(/payment-requests\/([^/]+)\/receipt/)?.[1];
        expect(requestId2).toBeTruthy();
        const suToken = await superuserAuth();
        const reject = await fetch(
          `${PB_URL}/api/collections/payment_requests/records/${requestId2}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', authorization: suToken },
            body: JSON.stringify({
              status: 'rejected',
              public_rejection_reason:
                'تصویر رسید ارسالی با مبلغ انتقال‌یافته مطابقت ندارد و بخشی از تصویر (شمارهٔ پیگیری و زمان واریز) خوانا نیست؛ لطفاً تصویر واضح‌تر و کامل‌تر از رسید پرداخت همین مبلغ ارسال کنید تا بررسی شود.',
            }),
          },
        );
        expect(reject.ok).toBe(true);
        await pageB.reload();
        await expect(pageB.getByTestId('rejected-panel')).toBeVisible({ timeout: 15_000 });
        await pageB.screenshot({ path: `${dir}/05-rejected.png`, fullPage: true });
      } finally {
        await ctxB.close();
      }
    });
  });
}
