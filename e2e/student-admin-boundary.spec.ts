// e2e/student-admin-boundary.spec.ts
// Podcast Slice 1 — focused Student/Admin boundary coverage:
//   1.  Student sees no Staff navigation
//   2.  Student /operator and /admin routes are Not Found
//   3.  Student credentials cannot sign into Admin
//   4.  Staff credentials cannot sign into Student
//   5.  Staff can sign into Admin
//   6.  Staff can open the payment queue
//   7.  Staff can open a protected receipt
//   8.  Staff can approve a pending request
//   9.  Staff can reject a pending request
//  10.  Student token is rejected by Staff payment APIs
//  11.  Legacy Operator token is rejected by Staff APIs
//  12.  Admin contains no Student navigation
//  13.  Student Theme control exists only in Account Settings
//  14.  Admin Theme control exists only in Admin Settings
//  15.  No Theme toggle exists in either Top App Bar or Auth screen
//  16.  Theme preference persists after refresh
//  17.  Admin deep links survive refresh
//  18.  Admin Service Worker is absent

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../playwright.config';
import { createStaff, superuserAuth } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

function uniquePhone(): string {
  const tail = String(Date.now()).slice(-4);
  const mid = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

// Make a student active without a payment flow (superuser tooling only —
// the same shortcut the other visual specs use).
async function activateStudent(userId: string, su: string): Promise<void> {
  const r = await fetch(`${PB_URL}/api/collections/fep_users/records/${userId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({ account_status: 'active' }),
  });
  if (!r.ok) throw new Error(`activate failed: ${r.status}`);
}

async function signupStudent(name: string) {
  const phone = uniquePhone();
  const r = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name, phone, password: 'Test1234!', passwordConfirm: 'Test1234!' }),
    headers: { 'content-type': 'application/json' },
  });
  const body = (await r.json()) as { id?: string; phone?: string };
  if (!body.id || !body.phone) throw new Error(`signup failed: ${r.status}`);
  const login = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: body.phone, password: 'Test1234!' }),
  });
  const loginBody = (await login.json()) as { token?: string; record?: Record<string, unknown> };
  if (!loginBody.token) throw new Error('student login failed');
  return { id: body.id, phone: body.phone, token: loginBody.token, record: loginBody.record };
}

// Legacy fep_users operator record (kept for migration safety).
async function signupLegacyOperator(su: string) {
  const phone = uniquePhone();
  const r = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Legacy',
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
    headers: { 'content-type': 'application/json' },
  });
  const body = (await r.json()) as { id?: string; phone?: string };
  await fetch(`${PB_URL}/api/collections/fep_users/records/${body.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  const login = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: body.phone, password: 'Test1234!' }),
  });
  const loginBody = (await login.json()) as { token?: string };
  return loginBody.token ?? '';
}

// Minimal valid PNG receipt (1x1).
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

async function submitRequest(studentToken: string, planId: string, bankRef: string) {
  const form = new FormData();
  form.append('plan_id', planId);
  form.append('bank_reference', bankRef);
  form.append('sender_card_last4', '4321');
  form.append('transfer_at', new Date().toISOString());
  form.append('receipt_file', new Blob([PNG_BYTES], { type: 'image/png' }), 'r.png');
  const r = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: { authorization: studentToken },
    body: form,
  });
  const body = (await r.json()) as { request?: { id?: string } };
  if (!body.request?.id) throw new Error(`request submit failed: ${r.status}`);
  return body.request.id;
}

test.describe('Student/Admin boundary', () => {
  let staff: Awaited<ReturnType<typeof createStaff>>;
  let su: string;
  let planId: string;

  test.beforeAll(async () => {
    su = await superuserAuth();
    staff = await createStaff(su);
    const planRes = await fetch(`${PB_URL}/api/collections/plans/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({
        name: 'Boundary Plan',
        slug: `bd-${randomBytes(3).toString('hex')}`,
        duration_days: 30,
        price_toman: 100000,
        is_active: true,
      }),
    });
    planId = ((await planRes.json()) as { id?: string }).id!;
    await fetch(`${PB_URL}/api/collections/payment_destination/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({
        card_number: '0000000000000000',
        card_holder_name: 'B',
        bank_name: 'B',
        is_active: true,
      }),
    });
  });

  test('1. student sees no Staff navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const student = await signupStudent('نو');
    await page.goto('/');
    await page.evaluate(
      ({ t, r }) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r })),
      { t: student.token, r: student.record },
    );
    await page.goto('/');
    await expect(page.getByTestId('student-bottom-nav')).toBeVisible();
    await expect(page.getByRole('link', { name: 'پنل اپراتور' })).toHaveCount(0);
    await expect(page.getByText('اپراتور', { exact: true })).toHaveCount(0);
  });

  test('2. student /operator and /admin routes are Not Found', async ({ page }) => {
    const student = await signupStudent('بندانگار');
    await page.goto('/');
    await page.evaluate(
      ({ t, r }) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r })),
      { t: student.token, r: student.record },
    );
    for (const route of ['/operator', '/admin', '/staff']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: 'صفحه پیدا نشد' })).toBeVisible();
    }
  });

  test('3. student credentials cannot sign into Admin', async ({ page }) => {
    const student = await signupStudent('ورود');
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(`${student.phone}@fep.local`);
    await page.getByTestId('admin-login-password').locator('input').fill('Test1234!');
    await page.getByTestId('admin-login-submit').click();
    await expect(page.getByText('ایمیل یا رمز عبور نادرست است.')).toBeVisible();
    await expect(page).toHaveURL(`${ADMIN_URL}/login`);
  });

  test('4. staff credentials cannot sign into Student', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('شمارهٔ موبایل').fill(staff.email);
    await page.getByLabel('رمز عبور', { exact: true }).fill(staff.password);
    await page.getByRole('button', { name: 'ورود' }).click();
    // Student login is phone-based; the Staff email is not a valid student
    // identity, so the form shows a safe error and stays on /login.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'ورود' })).toBeVisible();
  });

  test('5. staff can sign into Admin', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(staff.email);
    await page.getByTestId('admin-login-password').locator('input').fill(staff.password);
    await page.getByTestId('admin-login-submit').click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'داشبورد مدیریت' })).toBeVisible();
  });

  test('6+7+8+9. staff queue, protected receipt, approve and reject', async ({ page }) => {
    const student = await signupStudent('پردازش');
    const requestId = await submitRequest(
      student.token,
      planId,
      `BD-${randomBytes(3).toString('hex')}`,
    );
    const student2 = await signupStudent('رد');
    const rejectId = await submitRequest(
      student2.token,
      planId,
      `BD-${randomBytes(3).toString('hex')}`,
    );

    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(staff.email);
    await page.getByTestId('admin-login-password').locator('input').fill(staff.password);
    await page.getByTestId('admin-login-submit').click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });

    // 6. queue
    await page.goto(`${ADMIN_URL}/payments`);
    await expect(page.getByRole('heading', { name: /درخواست‌های پرداخت/ })).toBeVisible();

    // 7. protected receipt inside the detail
    await page.goto(`${ADMIN_URL}/payments/${requestId}`);
    await expect(page.getByTestId('operator-receipt-ready')).toBeVisible({ timeout: 15_000 });

    // 8. approve
    await page.getByTestId('operator-approve-open').click();
    await page.getByTestId('approve-confirm').click();
    await expect(page.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });

    // 9. reject (new request)
    await page.goto(`${ADMIN_URL}/payments/${rejectId}`);
    await page.getByTestId('operator-reject-open').click();
    await page.getByLabel('دلیل رد (عمومی)').fill('رسید نامشخص است');
    await page.getByTestId('reject-confirm').click();
    await expect(page.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });
  });

  test('10. student token is rejected by Staff payment APIs', async () => {
    const student = await signupStudent('نفوذ');
    const r = await fetch(`${PB_URL}/api/fast-english/operator/payment-requests`, {
      headers: { authorization: student.token },
    });
    expect(r.status).toBe(403);
  });

  test('11. legacy operator token is rejected by Staff APIs', async () => {
    const legacyToken = await signupLegacyOperator(su);
    const r = await fetch(`${PB_URL}/api/fast-english/operator/payment-requests`, {
      headers: { authorization: legacyToken },
    });
    expect(r.status).toBe(403);
  });

  test('12. admin contains no Student navigation', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(staff.email);
    await page.getByTestId('admin-login-password').locator('input').fill(staff.password);
    await page.getByTestId('admin-login-submit').click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });
    const nav = page.getByRole('navigation', { name: 'ناوبری مدیریت' });
    await expect(nav).toBeVisible();
    for (const label of ['خانه', 'کتابخانه', 'پیشرفت', 'حساب']) {
      await expect(nav.getByRole('link', { name: label })).toHaveCount(0);
    }
    await expect(nav.getByRole('link', { name: 'داشبورد' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'پرداختها' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'تنظیمات' })).toBeVisible();
  });

  test('13. student theme control exists only in Account Settings', async ({ page }) => {
    const student = await signupStudent('تم');
    await activateStudent(student.id, su);
    await page.goto('/');
    await page.evaluate(
      ({ t, r }) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r })),
      { t: student.token, r: student.record },
    );
    // No control on the shell; present inside Account settings.
    await page.goto('/');
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto('/account');
    await expect(page.getByTestId('account-theme-switch')).toBeVisible();
  });

  test('14. admin theme control exists only in Admin Settings', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(staff.email);
    await page.getByTestId('admin-login-password').locator('input').fill(staff.password);
    await page.getByTestId('admin-login-submit').click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto(`${ADMIN_URL}/settings`);
    await expect(page.getByTestId('admin-theme-switch')).toBeVisible();
  });

  test('15. no theme toggle in either Top App Bar or Auth screen', async ({ page }) => {
    const student = await signupStudent('بدونکلید');
    // Student Top App Bar + auth screens.
    await page.goto('/');
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto('/login');
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto('/signup');
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto('/');
    await page.evaluate(
      ({ t, r }) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r })),
      { t: student.token, r: student.record },
    );
    await page.goto('/');
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    // Admin Top App Bar + Admin login.
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(staff.email);
    await page.getByTestId('admin-login-password').locator('input').fill(staff.password);
    await page.getByTestId('admin-login-submit').click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
  });

  test('16. theme preference persists after refresh', async ({ page }) => {
    const student = await signupStudent('پایداری');
    await activateStudent(student.id, su);
    await page.goto('/');
    await page.evaluate(
      ({ t, r }) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r })),
      { t: student.token, r: student.record },
    );
    await page.goto('/account');
    await page
      .getByTestId('account-theme-switch')
      .getByRole('button', { name: 'حالت تیره' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await page
      .getByTestId('account-theme-switch')
      .getByRole('button', { name: 'حالت سیستمی' })
      .click();
  });

  test('17. admin deep links survive refresh', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByTestId('admin-login-email').locator('input').fill(staff.email);
    await page.getByTestId('admin-login-password').locator('input').fill(staff.password);
    await page.getByTestId('admin-login-submit').click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });
    for (const path of ['/payments', '/settings']) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page).toHaveURL(`${ADMIN_URL}${path}`);
      await page.reload();
      await expect(page).toHaveURL(`${ADMIN_URL}${path}`);
    }
  });

  test('18. admin Service Worker is absent', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { registrations: 0, controller: false };
      const regs = await navigator.serviceWorker.getRegistrations();
      return { registrations: regs.length, controller: !!navigator.serviceWorker.controller };
    });
    expect(sw.registrations).toBe(0);
    expect(sw.controller).toBe(false);
    const swRes = await page.request.get(`${ADMIN_URL}/sw.js`);
    // The Admin SPA fallback may answer any path, but it must never serve
    // a Service Worker script.
    const swBody = await swRes.text();
    expect(swBody).not.toMatch(/precacheAndRoute|workbox|self\.addEventListener\('install'/);
    const manifestRes = await page.request.get(`${ADMIN_URL}/manifest.webmanifest`);
    const manifestType = manifestRes.headers()['content-type'] ?? '';
    expect(manifestType).not.toContain('manifest');
    // Even if the SPA fallback answers, no Student manifest structure
    // (name + start_url + scope) may be served.
    expect(await manifestRes.text()).not.toMatch(/"start_url"\s*:\s*"\/"/);
  });
});
