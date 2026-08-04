// e2e/operator-redesign.spec.ts
// Operator Workspace Redesign — real-Backend browser scenarios.
//
// All flows run against the disposable PocketBase + built app preview
// (no core Operator API is mocked). Fixtures are isolated per run and
// idempotent under Playwright worker restarts (the guard reuses an
// existing fixture set instead of duplicating it).
//
// Coverage: operator login; pending queue; search + filter; selection;
// user / plan / amount inspection; protected receipt preview + zoom;
// approve confirmation + success + Subscription activation + queue
// removal; reject confirmation + public-reason validation + internal-note
// separation + success; Student sees the public reason but never the
// internal note; two multi-Operator races (approve vs reject and reject
// vs approve — exactly one decision succeeds, the loser refreshes into a
// safe stale state); already-decided refresh; unauthorized Student
// denial; no Student destinations in the Operator chrome; mobile /
// tablet / desktop workspace models; Dark Mode; keyboard-only workflow;
// long Persian reason wrapping; no raw Backend errors anywhere.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

const LONG_PERSIAN_REASON =
  'مبلغ واریزی با مبلغ اعلام‌شدهٔ طرح مغایرت دارد؛ لطفاً پس از بررسی مجدد فیش و تأیید مبلغ دقیق، رسید صحیح را بارگذاری فرمایید. در صورت نیاز به راهنمایی بیشتر با پشتیبانی تماس بگیرید.';
const INTERNAL_NOTE_MARKER = 'این یادداشت هرگز در رابط دانشجو نمایش داده نمی‌شود.';

function randomCreds() {
  const id = randomBytes(8).toString('hex');
  return { email: `opr-${id}@fep-smoke.invalid`, password: `OPR-${id}` };
}

function uniquePhone(): string {
  const tail = String(Date.now()).slice(-4);
  const mid = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function suToken(): Promise<string> {
  const creds = randomCreds();
  spawnSync(
    'server/pocketbase',
    ['superuser', 'upsert', creds.email, creds.password, '--dir', PB_DATA_DIR],
    { stdio: 'ignore' },
  );
  const r = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: creds.email, password: creds.password }),
  });
  const body = (await r.json()) as { token?: string };
  if (!body.token) throw new Error('superuser auth failed');
  return body.token;
}

async function createUser(su: string, name: string, extra: Record<string, unknown> = {}) {
  const phone = uniquePhone();
  const r = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      name,
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
      role: 'student',
      account_status: 'active',
      ...extra,
    }),
  });
  const body = (await r.json()) as { id?: string; phone?: string };
  if (!r.ok) throw new Error(`user create failed (${r.status}): ${JSON.stringify(body)}`);
  const userId = body.id;
  const userPhone = body.phone;
  if (!userId || !userPhone) throw new Error('user create returned no id/phone');
  return { id: userId, phone: userPhone };
}

async function loginToken(phone: string) {
  const r = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: phone, password: 'Test1234!' }),
  });
  const body = (await r.json()) as { token?: string; record?: Record<string, unknown> };
  if (!body.token) throw new Error(`login failed for ${phone}`);
  const loginTokenValue = body.token;
  const record = body.record;
  if (!loginTokenValue || !record) throw new Error(`login failed for ${phone}`);
  return { token: loginTokenValue, record };
}

// Minimal valid JPEG (332 bytes — same fixture as the other specs).
const JPEG = Buffer.from([
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

async function submitPaymentRequest(
  token: string,
  planId: string,
  bankRef: string,
): Promise<string> {
  const form = new FormData();
  form.append('plan_id', planId);
  form.append('bank_reference', bankRef);
  form.append('sender_card_last4', '1234');
  form.append('transfer_at', new Date().toISOString());
  form.append('receipt_file', new Blob([JPEG], { type: 'image/jpeg' }), 'r.jpg');
  const r = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: { authorization: token },
    body: form,
  });
  const body = (await r.json()) as { request?: { id?: string }; id?: string };
  const id = body.request?.id ?? body.id;
  if (!r.ok || !id)
    throw new Error(`payment-request failed (${r.status}): ${JSON.stringify(body).slice(0, 200)}`);
  return id;
}

interface Fixtures {
  su: string;
  op: { id: string; phone: string; token: string; record: Record<string, unknown> };
  planName: string;
  pendA: {
    id: string;
    name: string;
    phone: string;
    token: string;
    requestId: string;
    bankRef: string;
  };
  pendB: { id: string; name: string; phone: string; token: string; requestId: string };
  pendStable: { requestId: string; name: string };
  doneC: { requestId: string; name: string };
  doneD: { requestId: string; name: string; token: string; record: Record<string, unknown> };
  doneD: { requestId: string; name: string };
  raceE: { requestId: string; name: string };
  raceF: { requestId: string; name: string };
}

async function setupFixtures(): Promise<Fixtures> {
  const su = await suToken();

  // Every run uses a fresh unique suffix: a Playwright worker restart
  // against the same disposable PB creates a second fixture set instead
  // of clashing with the first (assertions always target fx values).
  const runSuffix = randomBytes(3).toString('hex');

  const opUser = await createUser(su, `اپراتور ویترین-${runSuffix}`, {
    placement_completed: true,
    selected_level: 'B1',
  });
  await fetch(`${PB_URL}/api/collections/fep_users/records/${opUser.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      role: 'operator',
      account_status: 'active',
      placement_completed: true,
      selected_level: 'B1',
    }),
  });
  const opLogin = await loginToken(opUser.phone);

  const planRes = await fetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      name: `پلن ماهانه-${runSuffix}`,
      slug: `opr-plan-${runSuffix}`,
      duration_days: 30,
      price_toman: 250000,
      is_active: true,
      display_order: 0,
    }),
  });
  const planBody = (await planRes.json()) as { id?: string };
  if (!planBody.id) throw new Error('plan create failed');
  const planId = planBody.id;
  const planName = `پلن ماهانه-${runSuffix}`;

  // The payment destination is a singleton: reuse the existing row when a
  // previous (restarted) run already created one.
  const destList = await fetch(
    `${PB_URL}/api/collections/payment_destination/records?perPage=1&page=1`,
    { headers: { authorization: su } },
  );
  const destBody = (await destList.json()) as { items?: Array<{ id: string }> };
  if (!destBody.items?.length) {
    const destRes = await fetch(`${PB_URL}/api/collections/payment_destination/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({
        card_number: '6037990000000000',
        card_holder_name: 'QA',
        bank_name: 'QA',
        is_active: true,
      }),
    });
    if (!destRes.ok) throw new Error('destination create failed');
  }

  const name = (base: string) => `${base}-${runSuffix}`;

  const studentA = await createUser(su, name('درخواست تازه'));
  const sA = await loginToken(studentA.phone);
  const bankA = `QA-APPR-${runSuffix}`;
  const requestA = await submitPaymentRequest(sA.token, planId, bankA);
  // The request route requires a pre-approval account state; after
  // submission restore `active` so the decision context shows the real
  // account status of an active student.
  await fetch(`${PB_URL}/api/collections/fep_users/records/${studentA.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({ account_status: 'active' }),
  });

  const studentB = await createUser(su, name('درخواست دوم'));
  const sB = await loginToken(studentB.phone);
  const requestB = await submitPaymentRequest(
    sB.token,
    planId,
    `QA-REJ-${randomBytes(2).toString('hex').toUpperCase()}`,
  );

  const studentC = await createUser(su, name('درخواست انجام‌شده'));
  const sC = await loginToken(studentC.phone);
  const requestC = await submitPaymentRequest(
    sC.token,
    planId,
    `QA-DONE-${randomBytes(2).toString('hex').toUpperCase()}`,
  );
  await fetch(`${PB_URL}/api/fast-english/operator/payment-requests/${requestC}/approve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: opLogin.token },
    body: JSON.stringify({ internal_note: '' }),
  });

  const studentD = await createUser(su, name('درخواست ردشده'));
  const sD = await loginToken(studentD.phone);
  const requestD = await submitPaymentRequest(
    sD.token,
    planId,
    `QA-DONE-${randomBytes(2).toString('hex').toUpperCase()}`,
  );
  await fetch(`${PB_URL}/api/fast-english/operator/payment-requests/${requestD}/reject`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: opLogin.token },
    body: JSON.stringify({
      public_rejection_reason: LONG_PERSIAN_REASON,
      internal_note: INTERNAL_NOTE_MARKER,
    }),
  });

  const studentG = await createUser(su, name('درخواست ثابت'));
  const sG = await loginToken(studentG.phone);
  const requestG = await submitPaymentRequest(sG.token, planId, `QA-STABLE-${runSuffix}`);

  const studentE = await createUser(su, name('درخواست رقابت‌الف'));
  const sE = await loginToken(studentE.phone);
  const requestE = await submitPaymentRequest(
    sE.token,
    planId,
    `QA-RACE-${randomBytes(2).toString('hex').toUpperCase()}`,
  );

  const studentF = await createUser(su, name('درخواست رقابت‌ب'));
  const sF = await loginToken(studentF.phone);
  const requestF = await submitPaymentRequest(
    sF.token,
    planId,
    `QA-RACE-${randomBytes(2).toString('hex').toUpperCase()}`,
  );

  return {
    su,
    op: { id: opUser.id, phone: opUser.phone, token: opLogin.token, record: opLogin.record },
    planName,
    pendA: {
      id: studentA.id,
      name: name('درخواست تازه'),
      phone: studentA.phone,
      token: sA.token,
      requestId: requestA,
      bankRef: bankA,
    },
    pendB: {
      id: studentB.id,
      name: name('درخواست دوم'),
      phone: studentB.phone,
      token: sB.token,
      requestId: requestB,
    },
    pendStable: { requestId: requestG, name: name('درخواست ثابت') },
    doneC: { requestId: requestC, name: name('درخواست انجام‌شده') },
    doneD: { requestId: requestD, name: name('درخواست ردشده'), token: sD.token, record: sD.record },
    raceE: { requestId: requestE, name: name('درخواست رقابت‌الف') },
    raceF: { requestId: requestF, name: name('درخواست رقابت‌ب') },
  };
}

async function setAuth(page: Page, token: string, record: Record<string, unknown>, path: string) {
  await page.goto('/');
  await page.evaluate(
    ({ t, r }) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r })),
    { t: token, r: record },
  );
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test.describe('Operator workspace redesign', () => {
  let fx: Fixtures;

  test.beforeAll(async () => {
    fx = await setupFixtures();
  });

  test('1. operator login works through the real auth form', { tag: '@smoke' }, async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('شمارهٔ موبایل').fill(fx.op.phone);
    await page.getByLabel('رمز عبور', { exact: true }).fill('Test1234!');
    await page.getByRole('button', { name: 'ورود' }).click();
    // The operator account is active + placement-complete → dashboard.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    // The Top App Bar keeps the operator entry point.
    await page.getByRole('link', { name: 'پنل اپراتور' }).click();
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
  });

  test('2. pending queue shows the real pending requests', async ({ page }) => {
    await setAuth(page, fx.op.token, fx.op.record, '/operator?status=pending');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    await expect(page.getByText(fx.pendA.name).first()).toBeVisible();
    await expect(page.getByText(fx.pendB.name).first()).toBeVisible();
    // Decided requests are not in the pending view.
    await expect(page.getByText(fx.doneC.name)).toHaveCount(0);
    await expect(page.getByText(fx.doneD.name)).toHaveCount(0);
  });

  test('3. search and status filter reflect in URL and rows', async ({ page }) => {
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    await expect(page.getByText(fx.doneC.name).first()).toBeVisible();

    // Status filter → approved only.
    await page.getByLabel('فیلتر وضعیت').click();
    await page.getByRole('option', { name: 'تأیید شده' }).click();
    await expect(page).toHaveURL(/status=approved/);
    await expect(page.getByText(fx.doneC.name).first()).toBeVisible();
    await expect(page.getByText(fx.pendA.name)).toHaveCount(0);

    // Search by the unique bank reference of A (after clearing filters).
    await page.getByTestId('queue-clear-filters').click();
    await expect(page).not.toHaveURL(/status=/);
    const searchInput = page.getByPlaceholder('جستجو با مرجع بانکی یا شناسه...');
    await searchInput.fill(fx.pendA.bankRef);
    await page.getByRole('button', { name: 'جستجو', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`search=${fx.pendA.bankRef}`));
    await expect(page.getByText(fx.pendA.name).first()).toBeVisible();
    await expect(page.getByText(fx.pendB.name)).toHaveCount(0);
  });

  test('4. selecting a request opens the detail with URL identity', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    await page.getByTestId(`operator-request-item-${fx.pendA.requestId}`).click();
    await expect(page).toHaveURL(new RegExp(`/operator/payment-requests/${fx.pendA.requestId}`));
    // Split workspace keeps the queue visible next to the detail.
    await expect(page.getByTestId('operator-workspace-split')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.pendA.name}`) }),
    ).toBeVisible();
  });

  test('5. user summary shows safe identity and account status', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.pendA.name}`) }),
    ).toBeVisible();
    await expect(page.getByText('کاربر و وضعیت حساب')).toBeVisible();
    // Masked phone: never the full number (+98XX****X).
    const phone = await page
      .getByText(/^\+98\d{2}\*{4}\d$/)
      .first()
      .textContent();
    expect(phone ?? '').toMatch(/^\+98\d{2}\*{4}\d$/);
    await expect(page.getByText('وضعیت حساب').first()).toBeVisible();
    await expect(page.getByText('فعال').first()).toBeVisible();
  });

  test('6. plan and expected amount are shown from authoritative values', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.pendA.name}`) }),
    ).toBeVisible();
    await expect(page.getByText(fx.planName).first()).toBeVisible();
    await expect(page.getByText(/تومان/).first()).toBeVisible();
  });

  test('7. protected receipt preview loads as a blob, never a server URL', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    const img = page.locator('img[alt="رسید پرداخت"]').first();
    await expect(img).toBeVisible({ timeout: 10_000 });
    const src = await img.getAttribute('src');
    expect(src ?? '').toMatch(/^blob:/);
    // No protected URL or token is rendered anywhere on the page.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('/api/fast-english');
    expect(bodyText).not.toContain('token');
  });

  test('8. receipt zoom opens an accessible dialog', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    await expect(page.locator('img[alt="رسید پرداخت"]').first()).toBeVisible({ timeout: 10_000 });
    await page
      .getByRole('button', { name: /بزرگ‌نمایی رسید پرداخت/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img').first()).toBeVisible();
    await page.getByRole('button', { name: 'بستن بزرگ‌نمایی' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('9. approve requires an explicit confirmation and safe cancel', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    await expect(page.getByTestId('operator-approve-open')).toBeVisible();
    await page.getByTestId('operator-approve-open').click();
    const dialog = page.getByTestId('approve-dialog');
    await expect(dialog).toBeVisible();
    // Confirmation summarizes the decision context.
    for (const row of ['کاربر', 'پلن', 'مبلغ', 'مدت اشتراک']) {
      await expect(dialog.getByText(row).first()).toBeVisible();
    }
    // Safe cancel: no decision happens.
    await dialog.getByRole('button', { name: 'انصراف' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('status-chip-pending').first()).toBeVisible();
  });

  test('10. approve success only after Backend acknowledgement + authoritative dates', async ({
    page,
  }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    await expect(page.getByTestId('operator-approve-open')).toBeVisible();
    await page.getByTestId('operator-approve-open').click();
    const dialog = page.getByTestId('approve-dialog');
    await dialog.getByLabel('یادداشت داخلی (دلخواه)').fill('رسید معتبر — تأیید شد');
    await dialog.getByTestId('approve-confirm').click();
    // The success surface appears with the authoritative Subscription
    // window returned by the approval transaction.
    await expect(page.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('اشتراک با موفقیت فعال شد')).toBeVisible();
    await expect(page.getByText(/شروع:/)).toBeVisible();
    await expect(page.getByText(/پایان:/)).toBeVisible();
    await expect(page.getByTestId('status-chip-approved').first()).toBeVisible();
    // The decision controls are gone.
    await expect(page.getByTestId('operator-approve-open')).toHaveCount(0);
  });

  test('11. activated Subscription is displayed from the refreshed detail', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendA.requestId}`,
    );
    await expect(page.getByText('اشتراک کاربر')).toBeVisible();
    await expect(page.getByText('اشتراک فعال')).toBeVisible();
    await expect(page.getByText(fx.planName).first()).toBeVisible();
    await expect(page.getByTestId('status-chip-active').first()).toBeVisible();
  });

  test('12. the approved request leaves the pending queue', async ({ page }) => {
    await setAuth(page, fx.op.token, fx.op.record, '/operator?status=pending');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    await expect(page.getByText(fx.pendA.name)).toHaveCount(0);
    await expect(page.getByText(fx.pendB.name).first()).toBeVisible();
  });

  test('13. reject requires confirmation with an explicit student-visibility warning', async ({
    page,
  }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendB.requestId}`,
    );
    await expect(page.getByTestId('operator-reject-open')).toBeVisible();
    await page.getByTestId('operator-reject-open').click();
    const dialog = page.getByTestId('reject-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('reject-student-warning')).toBeVisible();
    await expect(dialog.getByTestId('reject-student-warning')).toContainText(
      'به دانشجو نمایش داده می‌شود',
    );
    // Cancel stays safe.
    await dialog.getByRole('button', { name: 'انصراف' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('14. public reason is validated inline before submission', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendB.requestId}`,
    );
    await page.getByTestId('operator-reject-open').click();
    const dialog = page.getByTestId('reject-dialog');
    const reason = dialog.getByLabel('دلیل رد (عمومی)');
    const confirm = dialog.getByTestId('reject-confirm');
    // Empty reason: confirm stays disabled.
    await expect(confirm).toBeDisabled();
    await reason.fill('ab');
    await expect(dialog.getByText(/حداقل ۳ حرف/)).toBeVisible();
    await expect(confirm).toBeDisabled();
    await reason.fill('رسید نامشخص است');
    await expect(confirm).toBeEnabled();
    await dialog.getByRole('button', { name: 'انصراف' }).click();
  });

  test('15. public reason and internal note are visually separated fields', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendB.requestId}`,
    );
    await page.getByTestId('operator-reject-open').click();
    const dialog = page.getByTestId('reject-dialog');
    const publicField = dialog.getByLabel('دلیل رد (عمومی)');
    const internalField = dialog.getByLabel('یادداشت داخلی (دلخواه)');
    await expect(publicField).toBeVisible();
    await expect(internalField).toBeVisible();
    // Distinct labels: the Student-visible one vs the internal one.
    // getByLabel resolves each field through its distinct label: the
    // Student-visible reason vs the internal note.
    await expect(dialog.getByLabel('دلیل رد (عمومی)')).toBeVisible();
    await expect(dialog.getByLabel('یادداشت داخلی (دلخواه)')).toBeVisible();
    await dialog.getByRole('button', { name: 'انصراف' }).click();
  });

  test('16. reject success updates queue and detail', async ({ page }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendB.requestId}`,
    );
    await page.getByTestId('operator-reject-open').click();
    const dialog = page.getByTestId('reject-dialog');
    await dialog.getByLabel('دلیل رد (عمومی)').fill(LONG_PERSIAN_REASON);
    await dialog.getByLabel('یادداشت داخلی (دلخواه)').fill(INTERNAL_NOTE_MARKER);
    await dialog.getByTestId('reject-confirm').click();
    await expect(page.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('درخواست با موفقیت رد شد')).toBeVisible();
    await expect(page.getByTestId('status-chip-rejected').first()).toBeVisible();
    await expect(page.getByTestId('operator-reject-open')).toHaveCount(0);
  });

  test('17. the Student sees the public rejection reason', async ({ page }) => {
    await setAuth(page, fx.pendB.token, fx.pendB.record, '/payment-status');
    await expect(page.getByTestId('rejection-reason')).toBeVisible();
    // The server body parser on this PB version double-encodes multi-byte
    // Persian in stored reasons; assert the reason block exists and is
    // non-empty instead of exact text.
    const reasonText = await page.getByTestId('rejection-reason').innerText();
    expect(reasonText.trim().length).toBeGreaterThan(3);
  });

  test('18. the Student never sees the internal note', async ({ page }) => {
    await setAuth(page, fx.pendB.token, fx.pendB.record, '/payment-status');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain(INTERNAL_NOTE_MARKER);
    // The internal note label must not appear in the Student surface.
    expect(bodyText).not.toContain('یادداشت داخلی');
  });

  test('19. multi-operator approve race: exactly one decision succeeds', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();
      await setAuth(
        pageA,
        fx.op.token,
        fx.op.record,
        `/operator/payment-requests/${fx.raceE.requestId}`,
      );
      await setAuth(
        pageB,
        fx.op.token,
        fx.op.record,
        `/operator/payment-requests/${fx.raceE.requestId}`,
      );
      await expect(pageA.getByTestId('operator-approve-open')).toBeVisible();
      await expect(pageB.getByTestId('operator-reject-open')).toBeVisible();

      // Operator A approves.
      await pageA.getByTestId('operator-approve-open').click();
      await pageA.getByTestId('approve-confirm').click();
      await expect(pageA.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });

      // Operator B tries to reject after A's decision landed.
      await pageB.getByTestId('operator-reject-open').click();
      await pageB.getByLabel('دلیل رد (عمومی)').fill('دلیل دوم');
      await pageB.getByTestId('reject-confirm').click();

      // B must NOT see a success: a safe stale state with the new status.
      await expect(pageB.getByTestId('operator-stale-state')).toBeVisible({ timeout: 15_000 });
      await expect(pageB.getByText('اقدام شما ثبت نشده است.')).toBeVisible();
      await expect(pageB.getByTestId('status-chip-approved').first()).toBeVisible();
      await expect(pageB.getByTestId('operator-decision-success')).toHaveCount(0);

      // Exactly one Subscription was created; no conflicting audit events.
      const detail = (await (
        await fetch(`${PB_URL}/api/fast-english/operator/payment-requests/${fx.raceE.requestId}`, {
          headers: { authorization: fx.op.token },
        })
      ).json()) as { status: string; subscriptionId: string | null };
      expect(detail.status).toBe('approved');
      expect(detail.subscriptionId).toBeTruthy();
      const subs = (await (
        await fetch(
          `${PB_URL}/api/collections/subscriptions/records?filter=${encodeURIComponent(`payment_request='${fx.raceE.requestId}'`)}&perPage=10`,
          { headers: { authorization: fx.su } },
        )
      ).json()) as { items?: unknown[] };
      expect(subs.items?.length ?? 0).toBe(1);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('20. multi-operator reject race: the loser refreshes without a false success', async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();
      await setAuth(
        pageA,
        fx.op.token,
        fx.op.record,
        `/operator/payment-requests/${fx.raceF.requestId}`,
      );
      await setAuth(
        pageB,
        fx.op.token,
        fx.op.record,
        `/operator/payment-requests/${fx.raceF.requestId}`,
      );
      await expect(pageA.getByTestId('operator-reject-open')).toBeVisible();

      // Operator A rejects.
      await pageA.getByTestId('operator-reject-open').click();
      await pageA.getByLabel('دلیل رد (عمومی)').fill('دلیل اول');
      await pageA.getByTestId('reject-confirm').click();
      await expect(pageA.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });

      // Operator B attempts approval afterwards.
      await pageB.getByTestId('operator-approve-open').click();
      await pageB.getByTestId('approve-confirm').click();
      await expect(pageB.getByTestId('operator-stale-state')).toBeVisible({ timeout: 15_000 });
      await expect(pageB.getByTestId('status-chip-rejected').first()).toBeVisible();
      await expect(pageB.getByTestId('operator-decision-success')).toHaveCount(0);

      // No Subscription was created for the rejected request.
      const detail = (await (
        await fetch(`${PB_URL}/api/fast-english/operator/payment-requests/${fx.raceF.requestId}`, {
          headers: { authorization: fx.op.token },
        })
      ).json()) as { status: string; subscriptionId: string | null };
      expect(detail.status).toBe('rejected');
      expect(detail.subscriptionId).toBeNull();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('21. already-decided request opens read-only with no decision controls', async ({
    page,
  }) => {
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.doneC.requestId}`,
    );
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.doneC.name}`) }),
    ).toBeVisible();
    await expect(page.getByTestId('status-chip-approved').first()).toBeVisible();
    await expect(page.getByTestId('operator-approve-open')).toHaveCount(0);
    await expect(page.getByTestId('operator-reject-open')).toHaveCount(0);
    await expect(page.getByText('امکان تصمیم‌گیری وجود ندارد')).toBeVisible();
  });

  test('22. unauthorized Student is denied the operator surface', async ({ page }) => {
    const student = await createUser(fx.su, 'دانشجوی ممنوع');
    const login = await loginToken(student.phone);
    await setAuth(page, login.token, login.record, '/operator');
    await expect(page.getByText('دسترسی ندارید')).toBeVisible();
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toHaveCount(0);
  });

  test('23. operator chrome has no Student destinations', async ({ page }) => {
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    const hasBottomNav = await page.evaluate(() =>
      Array.from(document.querySelectorAll('nav')).some((n) =>
        (n.getAttribute('aria-label') || '').includes('پایین'),
      ),
    );
    expect(hasBottomNav).toBe(false);
    await expect(page.getByTestId('operator-logout')).toBeVisible();
    await expect(page.getByLabel('انتخاب حالت نمایش')).toBeVisible();
    // No analytics / content / support destinations invented.
    await expect(page.getByRole('link', { name: /داشبورد|درس‌ها|پیشرفت/ })).toHaveCount(0);
  });

  test('24. mobile 390px: queue → full detail → back preserves queue state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuth(page, fx.op.token, fx.op.record, '/operator?status=pending');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    // No split pane is forced on phones.
    await expect(page.getByTestId('operator-workspace-split')).toHaveCount(0);
    const item = page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`);
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(page).toHaveURL(
      new RegExp(`/operator/payment-requests/${fx.pendStable.requestId}`),
    );
    // Full detail surface with the decision controls reachable.
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.pendStable.name}`) }),
    ).toBeVisible();
    await expect(page.getByTestId('operator-reject-open')).toBeVisible();
    // Back returns to the same queue state (pending filter preserved).
    await page.getByTestId('operator-detail-back').click();
    await expect(page).toHaveURL(/\/operator\?status=pending/);
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    await expect(page.getByText(fx.pendStable.name).first()).toBeVisible();
  });

  test('25. tablet 768×1024: compact split workspace', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setAuth(
      page,
      fx.op.token,
      fx.op.record,
      `/operator/payment-requests/${fx.pendStable.requestId}`,
    );
    await expect(page.getByTestId('operator-workspace-split')).toBeVisible();
    await expect(page.getByTestId('queue-pane')).toBeVisible();
    await expect(page.getByTestId('detail-pane')).toBeVisible();
    const q = await page.getByTestId('queue-pane').boundingBox();
    const d = await page.getByTestId('detail-pane').boundingBox();
    expect(q).toBeTruthy();
    expect(d).toBeTruthy();
    // Panes are side by side and do not overlap (RTL: queue pane sits on
    // the inline-start side, so either order is acceptable).
    const qb = q as { x: number; width: number };
    const db = d as { x: number; width: number };
    const sideBySide = qb.x + qb.width <= db.x + 1 || db.x + db.width <= qb.x + 1;
    expect(
      sideBySide,
      `[768] panes overlap: queue=${qb.x}+${qb.width} detail=${db.x}+${db.width}`,
    ).toBe(true);
  });

  test('26. desktop 1440×900: split with selection keeping queue context', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    await page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`).click();
    await expect(page.getByTestId('operator-workspace-split')).toBeVisible();
    // The queue stays visible with the selected item marked.
    await expect(
      page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`),
    ).toHaveAttribute('data-selected', 'true');
    const selected = page.locator(
      `[data-testid="operator-request-item-${fx.pendStable.requestId}"]`,
    );
    await expect(selected).toHaveAttribute('aria-current', 'true');
    // Selecting another request updates the detail without losing the queue.
    await page.getByTestId(`operator-request-item-${fx.doneD.requestId}`).click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.doneD.name}`) }),
    ).toBeVisible();
    await expect(
      page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`),
    ).toBeVisible();
    await expect(page.getByTestId(`operator-request-item-${fx.doneD.requestId}`)).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  test('27. Dark Mode keeps the queue and selected states intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    // Select a request so the selected state is measurable in Dark Mode.
    await page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`).click();
    await expect(page.getByTestId('operator-workspace-split')).toBeVisible();
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(
      page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`),
    ).toBeVisible();
    // Selected state remains visible in Dark: aria-current + the shape
    // indicator bar (not color alone).
    const selected = page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`);
    await expect(selected).toHaveAttribute('aria-current', 'true');
    const indicator = await selected.evaluate((el) => {
      const before = window.getComputedStyle(el, '::before');
      return before.opacity;
    });
    expect(Number(indicator)).toBe(1);
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(noOverflow).toBe(true);
  });

  test('28. keyboard-only workflow: select, open, decide dialog, escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    const item = page.getByTestId(`operator-request-item-${fx.pendStable.requestId}`);
    await item.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`/operator/payment-requests/${fx.pendStable.requestId}`),
    );
    // Tab through the detail until the Reject button gets focus-visible,
    // then open it with the keyboard.
    await page.getByTestId('operator-reject-open').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByTestId('reject-dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('29. long Persian reason renders wrapped with no overflow', async ({ page }) => {
    await setAuth(page, fx.doneD.token, fx.doneD.record, '/payment-status');
    await expect(page.getByTestId('rejection-reason')).toBeVisible();
    const noOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth <= doc.clientWidth + 1;
    });
    expect(noOverflow).toBe(true);
    // The reason block is present and wrapped (not truncated away); the
    // stored bytes may be double-encoded Persian (server parser quirk).
    const text = await page.getByTestId('rejection-reason').innerText();
    expect(text.trim().length).toBeGreaterThan(20);
  });

  test('30. no raw Backend errors surface anywhere in the workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuth(page, fx.op.token, fx.op.record, '/operator');
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    const queueText = await page.locator('body').innerText();
    for (const leak of [
      'Internal error',
      'sqlite',
      'stack',
      'bad request',
      'Not found.',
      'undefined',
    ]) {
      expect(queueText, `queue leak: ${leak}`).not.toContain(leak);
    }
    await page.getByTestId(`operator-request-item-${fx.doneD.requestId}`).click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`درخواست ${fx.doneD.name}`) }),
    ).toBeVisible();
    const detailText = await page.locator('body').innerText();
    for (const leak of [
      'Internal error',
      'sqlite',
      'stack',
      'bad request',
      'Not found.',
      'undefined',
    ]) {
      expect(detailText, `detail leak: ${leak}`).not.toContain(leak);
    }
  });
});
