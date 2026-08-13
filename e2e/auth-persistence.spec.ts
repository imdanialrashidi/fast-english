// e2e/auth-persistence.spec.ts
// Student signup/login persistence journey — defect-sensitive regression for
// the "account/profile missing or reset after logout/login/reload" bug.
//
// The server record (PocketBase fep_users) is the source of truth. This spec
// drives the REAL browser UI for signup → payment redirect → logout → login,
// then proves the same durable record ID and profile fields survive login,
// reload, and fresh authentication, and that Account renders the
// server-authoritative name/phone with no editable profile fields.
//
// The e2e PocketBase is disposable per run (global-setup), so the restart-
// durability evidence for the intended persistent environment lives in
// scripts/smoke-auth.mjs (same data dir, process restart).

import { expect, test } from '@playwright/test';
import { PB_URL, superuserAuth } from './fixtures';

function uniquePhone(): string {
  const digits = `09${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  return digits; // 11 digits: 09 + 9
}

function canonicalPhone(local: string): string {
  return `+98${local.slice(1)}`;
}

function displayPhone(canonical: string): string {
  // Mirrors formatIranianPhoneForDisplay: +98 912 345 6789
  return `${canonical.slice(0, 3)} ${canonical.slice(3, 6)} ${canonical.slice(6, 9)} ${canonical.slice(9)}`;
}

async function assertNotLogin(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('input[name="password"]')).toHaveCount(0, { timeout: 15_000 });
}

test('signup → logout → login → Account: same durable record and authoritative profile', {
  tag: '@critical',
}, async ({ page }) => {
  const phone = uniquePhone();
  const canonical = canonicalPhone(phone);
  const name = 'دانشجوی ماندگار';
  const password = 'Test1234!';
  const su = await superuserAuth();

  // ---- 1. Signup through the real UI ----
  await page.goto('/signup');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="passwordConfirm"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Payment redirect: a fresh Student is pending_payment.
  await expect(page).toHaveURL(/\/payment/, { timeout: 20_000 });
  await assertNotLogin(page);

  // ---- 2. Exactly one durable server record with the submitted profile ----
  const listParams = new URLSearchParams({ filter: `phone='${canonical}'`, perPage: '200' });
  const list = await fetch(`${PB_URL}/api/collections/fep_users/records?${listParams}`, {
    headers: { authorization: su },
  });
  expect(list.status).toBe(200);
  const listBody = (await list.json()) as {
    totalItems?: number;
    items?: Array<Record<string, unknown>>;
  };
  expect(listBody.totalItems).toBe(1);
  const record = listBody.items?.[0] as Record<string, unknown>;
  expect(record.name).toBe(name);
  expect(record.phone).toBe(canonical);
  expect(record.email).toBe(`${canonical}@fep.local`);
  expect(record.role).toBe('student');
  expect(record.account_status).toBe('pending_payment');
  const userId = String(record.id);

  // ---- 3. Activate (server-side, superuser) so the Account page is reachable ----
  const activate = await fetch(`${PB_URL}/api/collections/fep_users/records/${userId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      account_status: 'active',
      placement_completed: true,
      selected_level: 'B1',
    }),
  });
  expect(activate.status).toBe(200);

  // ---- 4. Reload: the authenticated profile must survive (authRefresh) ----
  await page.reload();
  await expect.poll(async () => new URL(page.url()).pathname, { timeout: 20_000 }).toBe('/');
  await assertNotLogin(page);

  // ---- 5. Logout through the real Account UI ----
  await page.goto('/account');
  await expect(page.getByTestId('account-logout')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByText(displayPhone(canonical))).toBeVisible();
  await page.getByTestId('account-logout').click();
  await page.goto('/login');
  await expect(page.locator('input[name="password"]')).toBeVisible({ timeout: 20_000 });

  // ---- 6. Login again with the same phone/password ----
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await assertNotLogin(page);

  // ---- 7. The browser session holds the SAME record id; server has one record ----
  const stored = await page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem('pocketbase_auth') ?? '{}') as {
        token?: string;
        record?: { id?: string };
        model?: { id?: string };
      };
    } catch {
      return {};
    }
  });
  // The SDK writes `record`; some suites inject the older `model` shape.
  expect((stored.record ?? stored.model)?.id).toBe(userId);
  const after = await fetch(`${PB_URL}/api/collections/fep_users/records?${listParams}`, {
    headers: { authorization: su },
  });
  const afterBody = (await after.json()) as { totalItems?: number };
  expect(afterBody.totalItems).toBe(1);

  // ---- 8. Account renders the authoritative name/phone after fresh login ----
  await page.goto('/account');
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(displayPhone(canonical))).toBeVisible();

  // No protected account field is client-editable on Account.
  expect(await page.getByRole('textbox').count()).toBe(0);

  // ---- 9. Reload keeps the authenticated profile ----
  await page.reload();
  await assertNotLogin(page);
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(displayPhone(canonical))).toBeVisible();
});
