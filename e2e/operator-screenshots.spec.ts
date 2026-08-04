// e2e/operator-screenshots.spec.ts
// OPT-IN uninspected Human-review artifacts for the Operator Workspace
// Redesign.
//
// Run with: FEP_SCREENSHOTS=1 CI=1 pnpm exec playwright test e2e/operator-screenshots.spec.ts
//
// Writes PNGs to /tmp/opencode/fep-operator-redesign/ (outside the
// repository). These screenshots are NOT acceptance evidence — the
// submitter cannot interpret visuals; they exist only for later Human
// review. Deterministic acceptance comes from the other specs.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

const OUT_ROOT = '/tmp/opencode/fep-operator-redesign';
const ENV_FLAG = process.env.FEP_SCREENSHOTS === '1';

function randomCreds() {
  const id = randomBytes(8).toString('hex');
  return { email: `opshot-${id}@fep-smoke.invalid`, password: `OPSHOT-${id}` };
}

function uniquePhone(): string {
  const tail = String(Date.now()).slice(-4);
  const mid = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function superuserAuth(): Promise<string> {
  const { email, password } = randomCreds();
  spawnSync('server/pocketbase', ['superuser', 'upsert', email, password, '--dir', PB_DATA_DIR], {
    stdio: 'ignore',
  });
  const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const body = (await auth.json()) as { token?: string };
  if (!body.token) throw new Error('superuser auth failed');
  return body.token;
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

// One shared operator + plan for every layout (created once, reuse-safe).
let shared: {
  su: string;
  opToken: string;
  opRecord: Record<string, unknown>;
  planId: string;
} | null = null;

async function ensureShared(): Promise<void> {
  if (shared) return;
  const su = await superuserAuth();
  const opPhone = uniquePhone();
  const signup = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'اپراتور عکس',
      phone: opPhone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const opBody = (await signup.json()) as { id?: string };
  await fetch(`${PB_URL}/api/collections/fep_users/records/${opBody.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  const login = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: opPhone, password: 'Test1234!' }),
  });
  const loginBody = (await login.json()) as { token?: string; record?: Record<string, unknown> };
  const planRes = await fetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      name: 'پلن عکس',
      slug: `shot-op-plan-${randomBytes(3).toString('hex')}`,
      duration_days: 30,
      price_toman: 250000,
      is_active: true,
      display_order: 0,
    }),
  });
  const planBody = (await planRes.json()) as { id?: string };
  const dests = await fetch(
    `${PB_URL}/api/collections/payment_destination/records?perPage=1&page=1`,
    {
      headers: { authorization: su },
    },
  );
  const destsBody = (await dests.json()) as { items?: unknown[] };
  if (!destsBody.items?.length) {
    await fetch(`${PB_URL}/api/collections/payment_destination/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({
        card_number: '0000000000000000',
        card_holder_name: 'SHOT',
        bank_name: 'SHOT',
        is_active: true,
      }),
    });
  }
  const opToken = loginBody.token;
  const opRecord = loginBody.record;
  const planId = planBody.id;
  if (!opToken || !opRecord || !planId) throw new Error('screenshot fixtures incomplete');
  shared = { su, opToken, opRecord, planId };
}

/** Create a fresh pending request; returns { requestId, studentName }. */
async function createPendingRequest(
  tag: string,
): Promise<{ requestId: string; studentName: string }> {
  const phone = uniquePhone();
  const signup = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `دانشجو ${tag}`,
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const userBody = (await signup.json()) as { id?: string };
  const sLogin = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: phone, password: 'Test1234!' }),
  });
  const sBody = (await sLogin.json()) as { token?: string };
  const form = new FormData();
  form.append('plan_id', sh.planId);
  form.append('bank_reference', `SHOT-${tag}-${randomBytes(3).toString('hex').toUpperCase()}`);
  form.append('sender_card_last4', '1234');
  form.append('transfer_at', new Date().toISOString());
  form.append('receipt_file', new Blob([JPEG_1x1], { type: 'image/jpeg' }), 'r.jpg');
  const req = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: { authorization: sBody.token! },
    body: form,
  });
  const reqBody = (await req.json()) as { request?: { id?: string }; id?: string };
  const requestId = reqBody.request?.id ?? reqBody.id;
  if (!requestId) throw new Error('pending request create failed for screenshots');
  return { requestId, studentName: `دانشجو ${tag}` };
}

async function setOpAuth(page: Page, mode: string, path: string) {
  const sh = shared;
  if (!sh) throw new Error('shared fixtures not initialized');
  await page.goto('/');
  await page.evaluate(
    ({ t, r, m }) => {
      localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r }));
      localStorage.setItem('mui-mode', m);
    },
    { t: sh.opToken, r: sh.opRecord, m: mode },
  );
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

for (const layout of LAYOUTS) {
  test.describe(`operator screenshots ${layout.name} ${layout.mode}`, () => {
    test.skip(!ENV_FLAG, 'opt-in: set FEP_SCREENSHOTS=1 to generate human-review artifacts');

    test.beforeAll(async () => {
      await ensureShared();
    });

    test('capture the ten uninspected operator states', async ({ page }) => {
      const dir = `${OUT_ROOT}/${layout.mode}/${layout.name}`;
      mkdirSync(dir, { recursive: true });
      await page.setViewportSize({ width: layout.width, height: layout.height });

      // 1. Queue populated (pending + approved + rejected rows visible).
      await setOpAuth(page, layout.mode, '/operator');
      await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
      await expect(page.getByTestId('operator-queue-list').locator('li').first()).toBeVisible();
      await page.screenshot({ path: `${dir}/01-queue-populated.png`, fullPage: true });

      // 2. Filtered empty (a search with no hits is an actionable state).
      await setOpAuth(page, layout.mode, '/operator?search=SHOT-NO-MATCH');
      await expect(page.getByTestId('queue-empty-filtered')).toBeVisible();
      await page.screenshot({ path: `${dir}/02-filtered-empty.png`, fullPage: true });

      // 3. Request detail + 4. receipt zoom + 5. approve + 6. reject dialogs.
      const pending = await createPendingRequest('بررسی');
      await setOpAuth(page, layout.mode, `/operator/payment-requests/${pending.requestId}`);
      await expect(
        page.getByRole('heading', { name: new RegExp(`درخواست ${pending.studentName}`) }),
      ).toBeVisible();
      await expect(page.locator('img[alt="رسید پرداخت"]').first()).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: `${dir}/03-request-detail.png`, fullPage: true });
      await page
        .getByRole('button', { name: /بزرگ‌نمایی رسید پرداخت/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.screenshot({ path: `${dir}/04-receipt-zoom.png` });
      await page.keyboard.press('Escape');
      await page.getByTestId('operator-approve-open').click();
      await expect(page.getByTestId('approve-dialog')).toBeVisible();
      await page.screenshot({ path: `${dir}/05-approve-confirmation.png` });
      await page.getByRole('button', { name: 'انصراف' }).click();
      await page.getByTestId('operator-reject-open').click();
      await page
        .getByLabel('دلیل رد (عمومی)')
        .fill('مبلغ واریزی با مبلغ اعلام‌شدهٔ طرح مغایرت دارد؛ لطفاً رسید صحیح را بارگذاری کنید.');
      await page.screenshot({ path: `${dir}/06-reject-confirmation.png` });
      await page.keyboard.press('Escape');

      // 7. Approved result (authoritative dates from the Backend response).
      const toApprove = await createPendingRequest('تأیید');
      await setOpAuth(page, layout.mode, `/operator/payment-requests/${toApprove.requestId}`);
      await page.getByTestId('operator-approve-open').click();
      await page.getByTestId('approve-confirm').click();
      await expect(page.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${dir}/07-approved-result.png`, fullPage: true });

      // 8. Rejected result.
      const toReject = await createPendingRequest('رد');
      await setOpAuth(page, layout.mode, `/operator/payment-requests/${toReject.requestId}`);
      await page.getByTestId('operator-reject-open').click();
      await page.getByLabel('دلیل رد (عمومی)').fill('اطلاعات رسید با پرداخت مطابقت ندارد.');
      await page.getByLabel('یادداشت داخلی (دلخواه)').fill('یادداشت داخلی آزمایشی برای اپراتور');
      await page.getByTestId('reject-confirm').click();
      await expect(page.getByTestId('operator-decision-success')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${dir}/08-rejected-result.png`, fullPage: true });

      // 9. Stale conflict: another operator decides while this one watches.
      const staleTarget = await createPendingRequest('رقابت');
      await setOpAuth(page, layout.mode, `/operator/payment-requests/${staleTarget.requestId}`);
      await expect(page.getByTestId('operator-reject-open')).toBeVisible();
      await fetch(
        `${PB_URL}/api/fast-english/operator/payment-requests/${staleTarget.requestId}/approve`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: sh.opToken },
          body: JSON.stringify({ internal_note: '' }),
        },
      );
      await page.getByTestId('operator-reject-open').click();
      await page.getByLabel('دلیل رد (عمومی)').fill('دلیل پس از تصمیم دیگران');
      await page.getByTestId('reject-confirm').click();
      await expect(page.getByTestId('operator-stale-state')).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${dir}/09-stale-conflict.png`, fullPage: true });

      // 10. Queue empty (no pending left) — a calm success state.
      const pendingList = await fetch(
        `${PB_URL}/api/collections/payment_requests/records?filter=${encodeURIComponent("status='pending'")}&perPage=200`,
        { headers: { authorization: sh.su } },
      );
      const pendingBody = (await pendingList.json()) as { items?: Array<{ id: string }> };
      for (const item of pendingBody.items ?? []) {
        await fetch(`${PB_URL}/api/collections/payment_requests/records/${item.id}`, {
          method: 'DELETE',
          headers: { authorization: shared!.su },
        });
      }
      await setOpAuth(page, layout.mode, '/operator?status=pending');
      await expect(page.getByTestId('queue-empty-no-pending')).toBeVisible();
      await page.screenshot({ path: `${dir}/10-queue-empty.png`, fullPage: true });
    });
  });
}
