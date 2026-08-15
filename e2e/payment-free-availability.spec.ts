// e2e/payment-free-availability.spec.ts
// Business Configuration slice — real-browser proof of the accepted
// commercial-state matrix on the Student surface:
//
//   A. Active free plan (price 0) + card transfer ON  → «رایگان» shown,
//      no card number, no receipt picker, «شروع رایگان» activates the
//      entitlement server-side and the user continues to placement.
//   B. Active paid plan + card transfer ON → destination card + receipt
//      picker + submit (the existing card-transfer flow).
//   C. Active paid plan + card transfer OFF → «موقتاً در دسترس نیست»,
//      NOT selectable, no receipt/card UI, no dead checkout; the free
//      plan still activates.
//
// The app talks to the real disposable PocketBase; the owner-side state
// (plan prices, destination toggle) is changed through the real API the
// Admin surface uses.

import { expect, type Page, test } from '@playwright/test';
import {
  ensureOwnedDestination,
  ensureOwnedPlan,
  PB_URL,
  planRadio,
  superuserAuth,
} from './fixtures';

// ensureOwnedPlan is imported for symmetry with the other payment specs
// (the shared disposable PB fixture); the dedicated plans of this spec
// are created through createPlan below.
void ensureOwnedPlan;

let paidPlanId = '';
let paidPlanName = ''; // used by assertions below
void paidPlanName;
let freePlanId = '';
let freePlanName = ''; // used by assertions below
void freePlanName;
let destinationId = '';

function uniquePhone(): string {
  const tail = String(Date.now()).slice(-4);
  const mid = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function createPlan(
  suToken: string,
  name: string,
  priceToman: number,
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: suToken },
    body: JSON.stringify({
      name,
      slug: `e2e-${priceToman === 0 ? 'free' : 'paid'}-${Math.random().toString(16).slice(2, 8)}`,
      duration_days: 30,
      price_toman: priceToman,
      is_active: true,
      display_order: priceToman === 0 ? 1 : 2,
      description: priceToman === 0 ? 'طرح رایگان e2e' : 'طرح پولی e2e',
    }),
  });
  if (res.status !== 200) throw new Error(`plan create failed: ${res.status}`);
  const body = (await res.json()) as { id: string };
  return { id: body.id, name };
}

async function setDestinationActive(active: boolean): Promise<void> {
  const suToken = await superuserAuth();
  const res = await fetch(
    `${PB_URL}/api/collections/payment_destination/records/${destinationId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: suToken },
      body: JSON.stringify({ is_active: active }),
    },
  );
  if (res.status !== 200) throw new Error(`destination toggle failed: ${res.status}`);
}

async function signupAndLogin(page: Page, phone: string): Promise<void> {
  await page.goto('/signup');
  const form = page.getByRole('form', { name: 'فرم ثبت‌نام' });
  await form.getByRole('textbox', { name: 'نام' }).fill('E2E دانشجو');
  await form.getByLabel('شمارهٔ موبایل').fill(phone);
  await form.getByLabel('رمز عبور', { exact: true }).fill('Test1234!');
  await form.getByLabel('تکرار رمز عبور').fill('Test1234!');
  await form.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL('**/payment', { timeout: 30_000 });
}

test.describe('student payment: free plans + card-to-card availability', () => {
  test.beforeAll(async () => {
    const suToken = await superuserAuth();
    // Paid plan — a dedicated one so the price is fully owned by this
    // spec (ensureOwnedPlan's default plan is reused by other specs).
    const paid = await createPlan(suToken, 'E2E Paid 1', 1_234_567);
    paidPlanId = paid.id;
    paidPlanName = paid.name;
    const free = await createPlan(suToken, 'E2E Free 1', 0);
    freePlanId = free.id;
    freePlanName = free.name;
    destinationId = await ensureOwnedDestination(suToken);
    await setDestinationActive(true);
  });

  test.afterAll(async () => {
    // Leave the shared disposable PB in the enabled state for other specs.
    await setDestinationActive(true).catch(() => {});
  });

  test('A: free plan (price 0) → «رایگان», no card/receipt UI, instant server activation', {
    tag: '@critical',
  }, async ({ page }) => {
    const phone = uniquePhone();
    await signupAndLogin(page, phone);

    // The free plan renders «رایگان» — never «۰ تومان».
    await expect(page.getByTestId(`plan-${freePlanId}`)).toBeVisible();
    await expect(page.getByTestId(`plan-price-${await planSlug(freePlanId)}`)).toContainText(
      'رایگان',
    );

    // Select the free plan → the receipt picker must NOT appear and the
    // free activation CTA appears instead; the destination card number
    // must disappear for the free flow.
    await planRadio(page, freePlanId).click();
    await expect(page.getByTestId('start-free-plan')).toBeVisible();
    await expect(page.getByTestId('start-free-plan')).toContainText('شروع رایگان');
    await expect(page.getByTestId('select-receipt')).toHaveCount(0);
    await expect(page.getByTestId('payment-card-number')).toHaveCount(0);
    await expect(page.getByTestId('free-plan-note')).toBeVisible();

    // Activate — server-authoritative; the user continues to placement.
    await page.getByTestId('start-free-plan').click();
    await page.waitForURL('**/placement', { timeout: 30_000 });

    // Server state: account active, exactly one free subscription
    // (amount snapshot 0), no payment request.
    const suToken = await superuserAuth();
    const userRes = await fetch(
      `${PB_URL}/api/collections/fep_users/records?filter=${encodeURIComponent(
        `phone='+98${phone.slice(1)}'`,
      )}`,
      { headers: { authorization: suToken } },
    );
    const userBody = (await userRes.json()) as {
      items: Array<{ id: string; account_status: string }>;
    };
    expect(userBody.items[0].account_status).toBe('active');
    const subsRes = await fetch(
      `${PB_URL}/api/collections/subscriptions/records?filter=${encodeURIComponent(
        `user='${userBody.items[0].id}'`,
      )}`,
      { headers: { authorization: suToken } },
    );
    const subsBody = (await subsRes.json()) as {
      items: Array<{ source: string; amount_snapshot: number; status: string }>;
    };
    expect(subsBody.items).toHaveLength(1);
    expect(subsBody.items[0]).toMatchObject({
      source: 'free',
      amount_snapshot: 0,
      status: 'active',
    });
    const reqRes = await fetch(
      `${PB_URL}/api/collections/payment_requests/records?filter=${encodeURIComponent(
        `user='${userBody.items[0].id}'`,
      )}`,
      { headers: { authorization: suToken } },
    );
    const reqBody = (await reqRes.json()) as { items: unknown[] };
    expect(reqBody.items).toHaveLength(0);
  });

  test('B: paid plan + card transfer ON → destination card + receipt flow', {
    tag: '@critical',
  }, async ({ page }) => {
    await setDestinationActive(true);
    const phone = uniquePhone();
    await signupAndLogin(page, phone);

    await expect(page.getByTestId(`plan-${paidPlanId}`)).toBeVisible();
    await planRadio(page, paidPlanId).click();

    // The existing card-transfer surface is intact.
    await expect(page.getByTestId('payment-card-number')).toBeVisible();
    await expect(page.getByTestId('select-receipt')).toBeVisible();
    await expect(page.getByTestId('submit-payment')).toBeVisible();
    await expect(page.getByTestId('submit-payment')).toContainText('ارسال رسید و ثبت درخواست');
  });

  test('C: paid plan + card transfer OFF → unavailable, no receipt/card UI, free still works', {
    tag: '@critical',
  }, async ({ page }) => {
    // The shared PB may hold destination rows from OTHER specs; the
    // canonical toggle state is "no ACTIVE destination", so deactivate
    // every row and restore them afterwards.
    const suToken = await superuserAuth();
    const list = await fetch(`${PB_URL}/api/collections/payment_destination/records?perPage=200`, {
      headers: { authorization: suToken },
    });
    const dests = ((await list.json()) as { items: Array<{ id: string }> }).items;
    const setAll = async (active: boolean) => {
      for (const d of dests) {
        await fetch(`${PB_URL}/api/collections/payment_destination/records/${d.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', authorization: suToken },
          body: JSON.stringify({ is_active: active }),
        });
      }
    };
    await setAll(false);
    const phone = uniquePhone();
    await signupAndLogin(page, phone);

    // Paid plan is visibly unavailable and NOT selectable (aria-disabled).
    await expect(page.getByTestId(`plan-${paidPlanId}`)).toBeVisible();
    await expect(page.getByTestId(`plan-unavailable-${await planSlug(paidPlanId)}`)).toBeVisible();
    await expect(planRadio(page, paidPlanId)).toBeDisabled();

    // No receipt/card UI can appear; the honest note explains the state.
    await expect(page.getByTestId('select-receipt')).toHaveCount(0);
    await expect(page.getByTestId('payment-card-number')).toHaveCount(0);
    await expect(page.getByTestId('paid-unavailable-note')).toBeVisible();

    // The free plan is still selectable and activates (free is free).
    await planRadio(page, freePlanId).click();
    await expect(page.getByTestId('start-free-plan')).toBeVisible();
    await expect(page.getByTestId('select-receipt')).toHaveCount(0);
    await page.getByTestId('start-free-plan').click();
    await page.waitForURL('**/placement', { timeout: 30_000 });

    // Restore the enabled state for the other specs sharing this PB.
    await setAll(true);
  });
});

async function planSlug(planId: string): Promise<string> {
  const suToken = await superuserAuth();
  const res = await fetch(`${PB_URL}/api/collections/plans/records/${planId}`, {
    headers: { authorization: suToken },
  });
  const body = (await res.json()) as { slug: string };
  return body.slug;
}
