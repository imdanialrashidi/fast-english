// e2e/p1-s2.spec.ts
// P1-S2 operator E2E: browser integration test.
//
// Tests:
//  - Operator queue route renders (proves routing + guard + auth works)
//  - Student is denied access to operator routes
//
// Backend behavior and dialog workflows are thoroughly covered by
// scripts/smoke-operator.mjs (52 scenarios covering auth, queue,
// detail, receipt, approve, reject, subscriptions, concurrency,
// rate limiting).

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

function randomCreds() {
  const id = randomBytes(8).toString('hex');
  return { email: `e2e-op3-${id}@fep-smoke.invalid`, password: `E2E-${id}` };
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

async function signupUser(name: string) {
  const phone = uniquePhone();
  const r = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name, phone, password: 'Test1234!', passwordConfirm: 'Test1234!' }),
    headers: { 'content-type': 'application/json' },
  });
  const body = (await r.json()) as { id?: string; phone?: string };
  if (r.status === 429) throw new Error(`signup rate limited`);
  if (!body.id || !body.phone) throw new Error(`signup failed`);
  return { id: body.id, phone: body.phone };
}

async function loginToken(phone: string) {
  const r = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: phone, password: 'Test1234!' }),
  });
  const body = (await r.json()) as { token?: string; record?: Record<string, unknown> };
  if (!body.token) throw new Error(`login failed`);
  return { token: body.token, record: body.record };
}

test.describe('P1-S2 operator E2E', () => {
  let opToken: string;
  let opRecord: Record<string, unknown>;

  test.beforeAll(async () => {
    const su = await suToken();
    const opUser = await signupUser('اپراتور');
    // Promote to operator
    await fetch(`${PB_URL}/api/collections/fep_users/records/${opUser.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({ role: 'operator' }),
    });
    const login = await loginToken(opUser.phone);
    opToken = login.token;
    opRecord = login.record!;

    // Create a plan + payment request so the queue is non-empty
    const planRes = await fetch(`${PB_URL}/api/collections/plans/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({
        name: 'E2E Plan',
        slug: `e2e-plan-${randomBytes(3).toString('hex')}`,
        duration_days: 30,
        price_toman: 100000,
        is_active: true,
        display_order: 0,
      }),
    });
    const planId = ((await planRes.json()) as { id?: string }).id!;

    const destRes = await fetch(`${PB_URL}/api/collections/payment_destination/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: su },
      body: JSON.stringify({
        card_number: '0000000000000000',
        card_holder_name: 'Test',
        bank_name: 'Test Bank',
        is_active: true,
      }),
    });
    if (!destRes.ok) {
      throw new Error(`destination create failed: ${destRes.status} ${await destRes.text()}`);
    }

    const student = await signupUser('دانشجو');
    const sLogin = await loginToken(student.phone);
    const form = new FormData();
    form.append('plan_id', planId);
    form.append('bank_reference', 'ref');
    form.append('sender_card_last4', '1234');
    form.append('transfer_at', new Date().toISOString());
    // Minimal valid JPEG (332 bytes, same fixture as smoke tests)
    const _jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b,
      0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
      0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
      0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
      0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05,
      0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12,
      0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1,
      0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09,
      0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36,
      0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
      0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74,
      0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92,
      0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8,
      0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
      0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1,
      0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
      0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb,
      0xd0, 0xff, 0xd9,
    ]);
    form.append('receipt_file', new Blob([_jpeg], { type: 'image/jpeg' }), 'r.jpg');
    const req = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
      method: 'POST',
      headers: { authorization: sLogin.token },
      body: form,
    });
    if (!req.ok) {
      const text = await req.text();
      throw new Error(`payment request failed: ${req.status} ${text.slice(0, 200)}`);
    }
  });

  test('operator queue route renders with auth via localStorage', async ({ page }) => {
    // Set auth state directly via localStorage to avoid login form issues.
    await page.goto('/');
    await page.evaluate(
      ({ token, record }) => {
        localStorage.setItem('pocketbase_auth', JSON.stringify({ token, model: record }));
      },
      { token: opToken, record: opRecord },
    );

    // Navigate to operator queue
    await page.goto('/operator');
    await page.waitForURL('**/operator', { timeout: 15_000 });

    // The queue page shows pending requests
    await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
    // At least one student name visible
    await expect(page.getByText('دانشجو').first()).toBeVisible();
    // Plan name visible in the queue
    await expect(page.getByText('E2E Plan').first()).toBeVisible();
  });

  test('student denied operator access', async ({ page }) => {
    // Create a new student and set their auth
    const studentUser = await signupUser('دسترسی');
    const sLogin = await loginToken(studentUser.phone);

    await page.goto('/');
    await page.evaluate(
      ({ token, record }) => {
        localStorage.setItem('pocketbase_auth', JSON.stringify({ token, model: record }));
      },
      { token: sLogin.token, record: sLogin.record },
    );

    await page.goto('/operator');
    // Student should see the permission denied panel
    await expect(page.getByText('دسترسی ندارید')).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/operator');
    await page.waitForURL('**/login', { timeout: 15_000 });
  });
});
