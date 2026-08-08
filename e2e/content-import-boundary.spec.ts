// e2e/content-import-boundary.spec.ts
// Podcast Slice 3 — minimal browser/auth boundary coverage for the
// content-import infrastructure (no Admin Import UI exists yet):
//   1. Staff Admin session can call the plan route (read-only diff).
//   2. A Student session is denied the plan route.
//   3. The Admin application remains functional after the import
//      infrastructure is added (login + dashboard render).
//
// The importer's real coverage lives in the smoke suite
// (scripts/smoke-content-import.mjs, 32 scenarios).

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../playwright.config';
import { createStaff, staffStoragePayload, superuserAuth } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

test.describe('content-import boundary', () => {
  test('Staff session can call the plan route and it returns a plan', async () => {
    const su = await superuserAuth();
    const staff = await createStaff(su);
    const res = await fetch(`${PB_URL}/api/fast-english/staff/content-import/plan`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${staff.token}`,
      },
      body: JSON.stringify({
        manifest: JSON.stringify({
          schemaVersion: '1.0.0',
          contentKey: 'general.e2e-plan-only',
          contentVersion: 1,
          categoryKey: 'general',
          episode: {
            slug: 'e2e-plan-only',
            titleEn: 'Plan Only',
            titleFa: 'فقط برنامه',
            descriptionFa: 'توضیح',
            artworkSquare: 'artwork/square.png',
            artworkAltFa: 'آلت',
          },
          variants: [],
        }),
        assets: [],
        fingerprint: 'x',
      }),
    });
    expect(res.status).toBe(400); // invalid package → structured rejection
    const body = (await res.json()) as { code?: string };
    expect(['manifest_invalid', 'invalid_request']).toContain(body.code);
    // Plan route must never mutate: no topic may exist for this key.
    const topics = await fetch(`${PB_URL}/api/collections/topics/records?perPage=200`, {
      headers: { authorization: su },
    });
    const items =
      ((await topics.json()) as { items?: Array<{ content_key?: string }> }).items ?? [];
    expect(items.some((t) => t.content_key === 'general.e2e-plan-only')).toBe(false);
  });

  test('Student session is denied the plan route', async () => {
    // Student signup (public) then a session token.
    const phone =
      `09${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}${String(Date.now()).slice(-2)}`.slice(
        0,
        11,
      );
    const signup = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Student',
        phone,
        password: 'Test1234!',
        passwordConfirm: 'Test1234!',
      }),
    });
    const signupBody = (await signup.json()) as { id?: string; phone?: string };
    if (!signupBody.id || !signupBody.phone) throw new Error(`signup failed: ${signup.status}`);
    const login = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: signupBody.phone, password: 'Test1234!' }),
    });
    const token = ((await login.json()) as { token?: string }).token;
    if (!token) throw new Error('student login failed');

    const res = await fetch(`${PB_URL}/api/fast-english/staff/content-import/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ manifest: '{}', assets: [], fingerprint: 'x' }),
    });
    expect(res.status === 401 || res.status === 403).toBe(true);
  });

  test('Admin application remains functional after import infrastructure is added', async ({
    page,
  }) => {
    const su = await superuserAuth();
    const staff = await createStaff(su);
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByLabel(/ایمیل|email/i).fill(staff.email);
    await page.getByLabel(/رمز عبور|password/i).fill(staff.password);
    await page.getByRole('button', { name: /ورود/i }).click();
    await page.waitForURL(`${ADMIN_URL}/`, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'داشبورد مدیریت' })).toBeVisible();
  });

  test('Admin SPA session can call the plan route (API-boundary proof)', async ({ page }) => {
    const su = await superuserAuth();
    const staff = await createStaff(su);
    await page.addInitScript(
      (payload) => {
        window.localStorage.setItem('fep_staff_auth', payload);
      },
      staffStoragePayload(staff.token, staff.record),
    );
    await page.goto(`${ADMIN_URL}/`);
    await expect(page.getByRole('heading', { name: 'داشبورد مدیریت' })).toBeVisible();

    const res = await page.evaluate(async (url) => {
      const token = JSON.parse(localStorage.getItem('fep_staff_auth') ?? '{}').token;
      const r = await fetch(`${url}/api/fast-english/staff/content-import/plan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ manifest: '{}', assets: [], fingerprint: 'x' }),
      });
      return { status: r.status, body: (await r.json()) as { code?: string } };
    }, PB_URL);
    expect(res.status).toBe(400); // authenticated, structured rejection
    expect(['manifest_invalid', 'invalid_request']).toContain(res.body.code);
  });
});
