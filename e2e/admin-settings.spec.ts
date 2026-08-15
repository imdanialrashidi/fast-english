// e2e/admin-settings.spec.ts
// Business Configuration slice — real-browser proof of the Admin
// Business Settings surface (/settings):
//   - the panel loads the canonical plans (seeded like the production tool),
//     the destination and the site contact;
//   - a plan price edit propagates to the PUBLIC settings endpoint (the
//     same endpoint the Landing consumes) — the canonical path;
//   - the destination editor saves card/holder/bank/ETA and the review ETA
//     default «حداکثر تا ۲۴ ساعت» is pre-filled;
//   - the support/collaboration contact saves and the public endpoint
//     reflects it;
//   - the yearly/365-day plan cannot be created from the editor.
//
// Runs against the disposable PocketBase + built Admin preview (no API
// mocking), same harness as the operator specs.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../playwright.config';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

function randomCreds() {
  const id = randomBytes(8).toString('hex');
  return { email: `bset-${id}@fep-smoke.invalid`, password: `BSET-${id}-Aa1` };
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

async function staffSession(token: string): Promise<{ payload: string }> {
  const email = `staff-${randomBytes(6).toString('hex')}@fep-smoke.invalid`;
  const password = 'Staff-Aa1-123456!';
  const r = await fetch(`${PB_URL}/api/collections/staff_admins/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: token },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      display_name: 'Settings E2E',
      is_active: true,
      verified: true,
    }),
  });
  if (r.status !== 200) throw new Error('staff create failed');
  const login = await fetch(`${PB_URL}/api/collections/staff_admins/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const body = (await login.json()) as { token?: string; record?: unknown };
  if (!body.token) throw new Error('staff login failed');
  return {
    payload: JSON.stringify({ token: body.token, model: body.record }),
  };
}

test.describe('Admin Business Settings', () => {
  let token: string;
  let session: { payload: string };

  test.beforeAll(async () => {
    token = await suToken();
    // Seed the canonical launch plans through the same payload the
    // production seed tool writes. Idempotent: retries reuse existing rows.
    const existing = await fetch(`${PB_URL}/api/collections/plans/records?perPage=50`, {
      headers: { authorization: token },
    });
    const have = ((await existing.json()) as { items: Array<{ slug: string }> }).items.map(
      (p) => p.slug,
    );
    for (const p of [
      { name: 'ماهانه', slug: 'monthly', duration_days: 30, price_toman: 299000, display_order: 1 },
      {
        name: 'سه ماهه',
        slug: 'quarterly',
        duration_days: 90,
        price_toman: 807300,
        display_order: 2,
      },
    ]) {
      if (have.includes(p.slug)) continue;
      const r = await fetch(`${PB_URL}/api/collections/plans/records`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: token },
        body: JSON.stringify({ ...p, is_active: true, description: '' }),
      });
      if (r.status !== 200) throw new Error('plan seeding failed');
    }
    session = await staffSession(token);
  });

  test('panel loads plans and propagates a price edit to the public endpoint', async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('fep_staff_auth', payload);
    }, session.payload);
    await page.goto(`${ADMIN_URL}/settings`);

    await expect(page.getByTestId('business-settings-panel')).toBeVisible();
    await expect(page.getByTestId('settings-plan-monthly')).toContainText('ماهانه');
    await expect(page.getByTestId('settings-plan-monthly')).toContainText('۲۹۹,۰۰۰');
    await expect(page.getByTestId('settings-plan-quarterly')).toContainText('۸۰۷,۳۰۰');

    // Edit the monthly price.
    await page.getByTestId('settings-edit-plan-monthly').click();
    await page.getByLabel('قیمت (تومان)').fill('310000');
    await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
    await expect(page.getByText('ذخیره شد.')).toBeVisible({ timeout: 10_000 });

    // The change propagates through the canonical public path (the exact
    // endpoint the Landing consumes).
    const pub = await fetch(`${PB_URL}/api/fast-english/public/settings`);
    const body = (await pub.json()) as {
      plans: Array<{ slug: string; priceToman: number }>;
    };
    const monthly = body.plans.find((p) => p.slug === 'monthly');
    expect(monthly?.priceToman).toBe(310000);

    // Restore the canonical price.
    await page.getByTestId('settings-edit-plan-monthly').click();
    await page.getByLabel('قیمت (تومان)').fill('299000');
    await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
    await expect(page.getByText('ذخیره شد.')).toBeVisible({ timeout: 10_000 });
  });

  test('destination editor pre-fills the review ETA default and saves', async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('fep_staff_auth', payload);
    }, session.payload);
    await page.goto(`${ADMIN_URL}/settings`);

    await page.getByTestId('settings-edit-destination').click();
    await page.getByLabel('شماره کارت').fill('6037 9912 3456 7890');
    await page.getByLabel('نام دارندهٔ کارت').fill('E2E HOLDER');
    await page.getByLabel('نام بانک').fill('E2E BANK');
    // The ETA field is pre-filled with the owner default.
    await expect(page.getByLabel('زمان تقریبی بررسی')).toHaveValue('حداکثر تا ۲۴ ساعت');
    await page.getByTestId('settings-save-destination').click();
    await expect(page.getByText('ذخیره شد.')).toBeVisible({ timeout: 10_000 });

    const dest = await fetch(`${PB_URL}/api/collections/payment_destination/records`);
    const body = (await dest.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items[0].card_number).toBe('6037991234567890');
    expect(body.items[0].review_sla_text).toBe('حداکثر تا ۲۴ ساعت');
  });

  test('support/collaboration contact saves and public settings reflect it', async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('fep_staff_auth', payload);
    }, session.payload);
    await page.goto(`${ADMIN_URL}/settings`);

    await page.getByLabel('آدرس کانال (https/mailto/tel)').fill('https://t.me/fep-e2e');
    await page.getByTestId('settings-save-site').click();
    await expect(page.getByText('ذخیره شد.')).toBeVisible({ timeout: 10_000 });

    const pub = await fetch(`${PB_URL}/api/fast-english/public/settings`);
    const body = (await pub.json()) as { support: { supportContact: string } };
    expect(body.support.supportContact).toBe('https://t.me/fep-e2e');
  });

  test('the yearly/365-day plan cannot be created from the editor', async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('fep_staff_auth', payload);
    }, session.payload);
    await page.goto(`${ADMIN_URL}/settings`);

    await page.getByTestId('settings-add-plan').click();
    await page.getByLabel('نام طرح (فارسی)').fill('سالانه');
    await page.getByLabel('شناسه انگلیسی (slug)').fill('yearly');
    await page.getByLabel('مدت (روز)').fill('365');
    await page.getByLabel('قیمت (تومان)').fill('900000');
    await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
    await expect(page.getByText('طرح سالانه (۳۶۵ روز) ارائه نمیشود.')).toBeVisible();

    // No yearly plan exists anywhere.
    const plans = await fetch(`${PB_URL}/api/collections/plans/records?perPage=50`, {
      headers: { authorization: token },
    });
    const items = (await plans.json()) as { items: Array<{ slug: string; duration_days: number }> };
    expect(items.items.some((p) => p.slug === 'yearly' || p.duration_days === 365)).toBe(false);
  });

  test('a plan with price 0 shows «طرح رایگان» and the editor explains 0 toman', async ({
    page,
  }) => {
    // Seed one free plan (the same shape the editor writes).
    const r = await fetch(`${PB_URL}/api/collections/plans/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({
        name: 'آزمایشی رایگان',
        slug: `e2e-admin-free-${randomBytes(3).toString('hex')}`,
        duration_days: 30,
        price_toman: 0,
        is_active: true,
        display_order: 3,
      }),
    });
    const body = (await r.json()) as { slug?: string };
    if (!body.slug) throw new Error('free plan seeding failed');

    await page.addInitScript((payload) => {
      localStorage.setItem('fep_staff_auth', payload);
    }, session.payload);
    await page.goto(`${ADMIN_URL}/settings`);

    // The current commercial state is obvious: the free chip + active chip.
    await expect(page.getByTestId(`settings-plan-free-${body.slug}`)).toContainText('طرح رایگان');
    await expect(page.getByTestId(`settings-plan-${body.slug}`)).toContainText('فعال');
    // The price editor explains that 0 toman means free.
    await page.getByTestId(`settings-edit-plan-${body.slug}`).click();
    await expect(page.getByLabel('قیمت (تومان)')).toHaveValue('0');
    await expect(page.getByText('۰ تومان = طرح رایگان')).toBeVisible();
  });

  test('card-to-card toggle: «فعال/غیرفعال» state is obvious and stored config survives', async ({
    page,
  }) => {
    // The staff localStorage payload carries the API token; use it to
    // drive the REAL staff route (the exact surface the editor calls).
    const staffToken = (JSON.parse(session.payload) as { token: string }).token;
    const putDestination = async (isActive: boolean) => {
      const res = await fetch(`${PB_URL}/api/fast-english/staff/business-settings/destination`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: staffToken },
        body: JSON.stringify({
          card_number: '6037991234567890',
          card_holder_name: 'E2E HOLDER',
          bank_name: 'E2E BANK',
          instructions: '',
          review_sla_text: 'حداکثر تا ۲۴ ساعت',
          support_contact: '',
          is_active: isActive,
        }),
      });
      if (res.status !== 200) throw new Error(`destination PUT failed: ${res.status}`);
    };
    await putDestination(true);

    await page.addInitScript((payload) => {
      localStorage.setItem('fep_staff_auth', payload);
    }, session.payload);
    await page.goto(`${ADMIN_URL}/settings`);

    // Enabled state is explicit.
    await expect(page.getByTestId('settings-card-transfer-status')).toContainText(
      'پرداخت کارتبه‌کارت: فعال',
    );
    // Disable through the editor: the stored values stay visible.
    await page.getByTestId('settings-edit-destination').click();
    await expect(page.getByLabel('شماره کارت')).toHaveValue('6037991234567890');
    await page.getByLabel('فعال است (فقط یک مقصد فعال میتواند وجود داشته باشد)').uncheck();
    await page.getByTestId('settings-save-destination').click();
    await expect(page.getByText('ذخیره شد.')).toBeVisible({ timeout: 10_000 });

    // Off state is explicit; the stored card is NOT deleted.
    await expect(page.getByTestId('settings-card-transfer-status')).toContainText(
      'پرداخت کارتبه‌کارت: غیرفعال',
    );
    await expect(page.getByTestId('settings-destination-summary')).toContainText(
      '6037991234567890',
    );
    const pubOff = await fetch(`${PB_URL}/api/fast-english/public/settings`);
    const bodyOff = (await pubOff.json()) as { payment: { cardTransferEnabled: boolean } };
    expect(bodyOff.payment.cardTransferEnabled).toBe(false);

    // Re-enable from the same stored values.
    await page.getByTestId('settings-edit-destination').click();
    await expect(page.getByLabel('شماره کارت')).toHaveValue('6037991234567890');
    await page.getByLabel('فعال است (فقط یک مقصد فعال میتواند وجود داشته باشد)').check();
    await page.getByTestId('settings-save-destination').click();
    await expect(page.getByText('ذخیره شد.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('settings-card-transfer-status')).toContainText(
      'پرداخت کارتبه‌کارت: فعال',
    );
    const pubOn = await fetch(`${PB_URL}/api/fast-english/public/settings`);
    const bodyOn = (await pubOn.json()) as { payment: { cardTransferEnabled: boolean } };
    expect(bodyOn.payment.cardTransferEnabled).toBe(true);
  });
});
