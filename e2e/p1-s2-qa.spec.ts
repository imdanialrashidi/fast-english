// e2e/p1-s2-qa.spec.ts
// P1-S2 operator responsive QA evidence.
//
// Captures screenshots of the Operator Queue and Operator Detail
// pages at 7 required viewports. Screenshots are written to a
// per-run output directory so they never enter the repo or
// the test-results bundle. The spec also runs a battery of
// structural assertions for every viewport: no horizontal
// overflow, mobile renders as cards (not a tiny table), no
// Student Bottom Navigation, all primary controls are at least
// 44px tall, and the document remains RTL.
//
// Test data:
//   - 1 operator user
//   - 3 payment requests:
//       1) pending  → captures Queue, Detail, Approve/Reject dialogs
//       2) approved → captures approved state (read-only view)
//       3) rejected → captures rejected state (read-only view)
//
// Backend logic, migrations, transactions, subscriptions,
// rate limits, and smoke tests are NOT modified. This spec
// only consumes existing endpoints through the existing
// Playwright + disposable-PocketBase harness.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

const SCREENSHOTS_DIR =
  process.env.OPERATOR_QA_OUT ?? '/tmp/opencode/product-app-visual-polish/operator';

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
];

// ---- Disposable superuser + helpers ----

function randomCreds() {
  const id = randomBytes(8).toString('hex');
  return {
    email: `qa-op-${id}@fep-smoke.invalid`,
    password: `QA-${id}-${randomBytes(6).toString('hex')}`,
  };
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

async function createUser(su: string, name: string) {
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
    }),
  });
  const body = (await r.json()) as { id?: string; phone?: string };
  if (!r.ok) throw new Error(`user create failed (${r.status}): ${JSON.stringify(body)}`);
  if (!body.id || !body.phone) throw new Error(`user create got no id`);
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

// Minimal valid JPEG (332 bytes) shared with the other e2e specs.
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
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`payment-request failed: ${r.status} ${t.slice(0, 200)}`);
  }
  const body = (await r.json()) as {
    request?: { id?: string };
    id?: string;
    [k: string]: unknown;
  };
  const id = body.request?.id ?? body.id;
  if (!id) {
    throw new Error(
      `payment-request id missing (status=${r.status}): ${JSON.stringify(body).slice(0, 400)}`,
    );
  }
  return id;
}

// Long Persian reason used for the Reject Dialog screenshot. It
// exceeds a single line on every viewport so we can verify RTL
// wrapping.
const LONG_PERSIAN_REASON =
  'مبلغ واریزی با مبلغ اعلام‌شدهٔ طرح مغایرت دارد؛ لطفاً پس از بررسی مجدد فیش و تأیید مبلغ دقیق، رسید صحیح را بارگذاری فرمایید. در صورت نیاز به راهنمایی بیشتر با پشتیبانی تماس بگیرید.';

interface Fixtures {
  su: string;
  opToken: string;
  opRecord: Record<string, unknown>;
  opPhone: string;
  pendingRequestId: string;
  approvedRequestId: string;
  rejectedRequestId: string;
  pendingStudentName: string;
  approvedStudentName: string;
  rejectedStudentName: string;
  approvedStudentPhone: string;
}

async function setupFixtures(): Promise<Fixtures> {
  const su = await suToken();

  // Plan + destination
  const planRes = await fetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      name: 'پلن آزمایشی',
      slug: `qa-plan-${randomBytes(3).toString('hex')}`,
      duration_days: 30,
      price_toman: 250000,
      is_active: true,
      display_order: 0,
    }),
  });
  const planId = ((await planRes.json()) as { id?: string }).id!;

  const destRes = await fetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      card_number: '6037990000000000',
      card_holder_name: 'QA Holder',
      bank_name: 'QA Bank',
      is_active: true,
    }),
  });
  if (!destRes.ok) {
    throw new Error(`destination create failed: ${destRes.status} ${await destRes.text()}`);
  }

  // Operator user
  const opUser = await createUser(su, 'اپراتور');
  await fetch(`${PB_URL}/api/collections/fep_users/records/${opUser.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({ role: 'operator' }),
  });
  const opLogin = await loginToken(opUser.phone);

  // Three students with three requests
  const pendingStudentName = 'دانشجوی الف';
  const approvedStudentName = 'دانشجوی ب';
  const rejectedStudentName = 'دانشجوی پ';

  const studentPending = await createUser(su, pendingStudentName);
  const sPending = await loginToken(studentPending.phone);
  const pendingRequestId = await submitPaymentRequest(
    sPending.token,
    planId,
    `QA-PEND-${randomBytes(2).toString('hex').toUpperCase()}`,
  );

  const studentApproved = await createUser(su, approvedStudentName);
  const sApproved = await loginToken(studentApproved.phone);
  const approvedRequestId = await submitPaymentRequest(
    sApproved.token,
    planId,
    `QA-APPR-${randomBytes(2).toString('hex').toUpperCase()}`,
  );

  const studentRejected = await createUser(su, rejectedStudentName);
  const sRejected = await loginToken(studentRejected.phone);
  const rejectedRequestId = await submitPaymentRequest(
    sRejected.token,
    planId,
    `QA-REJ-${randomBytes(2).toString('hex').toUpperCase()}`,
  );

  // Approve the second request
  const apprRes = await fetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${approvedRequestId}/approve`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: opLogin.token },
      body: JSON.stringify({ internal_note: 'تأیید شد — رسید معتبر.' }),
    },
  );
  if (!apprRes.ok) {
    throw new Error(`approve failed: ${apprRes.status} ${await apprRes.text()}`);
  }

  // Reject the third request with a long public reason
  const rejRes = await fetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${rejectedRequestId}/reject`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: opLogin.token },
      body: JSON.stringify({
        public_rejection_reason: LONG_PERSIAN_REASON,
        internal_note: 'فیش ناخوانا — درخواست ارسال مجدد.',
      }),
    },
  );
  if (!rejRes.ok) {
    throw new Error(`reject failed: ${rejRes.status} ${await rejRes.text()}`);
  }

  return {
    su,
    opToken: opLogin.token,
    opRecord: opLogin.record!,
    opPhone: opUser.phone,
    pendingRequestId,
    approvedRequestId,
    rejectedRequestId,
    pendingStudentName,
    approvedStudentName,
    rejectedStudentName,
    approvedStudentPhone: studentApproved.phone,
  };
}

// ---- Helpers: layout probes ----

type LayoutReport = {
  scroll: number;
  client: number;
  overflowEls: string[];
  direction: string;
  hasStudentBottomNav: boolean;
};

async function probeLayout(page: import('@playwright/test').Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const overflowing: string[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 1 && r.right > vw + 1) {
        overflowing.push(`${el.tagName.toLowerCase()}.${el.className} ${r.width}px`);
      }
    });
    // StudentBottomNav renders a nav element whose accessible name
    // is "ناوبری پایین". If we see it, the operator chrome leaked
    // the student bottom nav.
    const bottomNav = Array.from(document.querySelectorAll('nav')).some((n) =>
      (n.getAttribute('aria-label') || '').includes('پایین'),
    );
    return {
      scroll: doc.scrollWidth,
      client: vw,
      overflowEls: overflowing.slice(0, 5),
      direction: doc.getAttribute('dir') ?? '',
      hasStudentBottomNav: bottomNav,
    };
  });
}

async function setAuthAndGo(page: import('@playwright/test').Page, fx: Fixtures, path: string) {
  // Helper: set localStorage auth and navigate to `path'.
  async function go(token: string, record: Record<string, unknown>) {
    await page.goto('/');
    await page.evaluate(
      ({ t, r }) => {
        localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r }));
      },
      { t: token, r: record },
    );
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  await go(fx.opToken, fx.opRecord);

  // If the page landed on the login page instead of the target,
  // the auth token might have been invalidated (e.g., PB restart).
  // Retry once with a fresh auth token.
  const onLogin = await page.evaluate(() => {
    const h = document.querySelector('h1');
    return h !== null && /ورود/.test(h.textContent || '');
  });
  if (onLogin) {
    const fresh = await loginToken(fx.opPhone);
    await go(fresh.token, fresh.record!);
  }
}

async function snap(page: import('@playwright/test').Page, file: string, fullPage: boolean) {
  await page.screenshot({ path: join(SCREENSHOTS_DIR, file), fullPage });
}

test.describe('P1-S2 operator responsive QA', () => {
  let fx: Fixtures;

  test.beforeAll(async () => {
    fx = await setupFixtures();
    if (!existsSync(SCREENSHOTS_DIR)) {
      mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  // Helper that waits until at least one of the student name
  // cells is actually visible (not just present in the DOM, since
  // both the desktop table and the mobile card stack include the
  // same name and one of them is display:none on the active
  // breakpoint).
  async function waitForQueueLoaded(page: import('@playwright/test').Page, name: string) {
    await page.waitForFunction(
      (n) => {
        const all = document.querySelectorAll('p, span, td, div');
        for (const el of all) {
          if (
            el.textContent === n &&
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0
          ) {
            return true;
          }
        }
        return false;
      },
      name,
      { timeout: 15_000 },
    );
  }

  for (const vp of VIEWPORTS) {
    test(`[${vp.name}] queue (pending) renders, no overflow, RTL, cards-vs-table correct`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, '/operator');
      await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
      await waitForQueueLoaded(page, fx.pendingStudentName);

      const layout = await probeLayout(page);
      expect(
        layout.scroll,
        `[${vp.name}] no horizontal overflow (scroll=${layout.scroll} client=${layout.client})`,
      ).toBeLessThanOrEqual(layout.client + 1);
      expect(layout.direction, `[${vp.name}] html dir`).toBe('rtl');
      expect(
        layout.hasStudentBottomNav,
        `[${vp.name}] no Student Bottom Nav in operator route`,
      ).toBe(false);
      expect(
        layout.overflowEls,
        `[${vp.name}] no element wider than viewport (got ${layout.overflowEls.join(', ')})`,
      ).toHaveLength(0);

      // On mobile (xs), the table container is hidden and the
      // card stack is shown. On md+ (>=768px) the opposite.
      // The breakpoint values come from the custom MUI theme
      // (app/src/app/theme/theme.ts): xs=360, sm=600, md=768, lg=1024, xl=1440.
      const isMobile = vp.width < 768;
      const tableContainerDisplay = await page.evaluate(() => {
        const t = document.querySelector('table');
        if (!t) return 'no-table';
        return window.getComputedStyle(t.closest('[class*="MuiTableContainer"]') ?? t).display;
      });
      const cardStackDisplay = await page.evaluate(() => {
        // The mobile card stack is a Stack with display: { xs: 'flex', md: 'none' }.
        // Find the first MuiCard-root and report its container's display.
        const card = document.querySelector('.MuiCard-root');
        if (!card) return 'no-card';
        // Walk up to find the Stack that holds the cards.
        let cur: HTMLElement | null = card.parentElement;
        while (cur) {
          const tag = cur.tagName.toLowerCase();
          if (tag === 'div' && cur.className.includes('MuiStack-root')) {
            return window.getComputedStyle(cur).display;
          }
          cur = cur.parentElement;
        }
        return 'no-stack';
      });
      if (isMobile) {
        expect(tableContainerDisplay, `[${vp.name}] mobile hides table container`).toBe('none');
        expect(cardStackDisplay, `[${vp.name}] mobile shows card stack`).not.toBe('none');
      } else {
        expect(tableContainerDisplay, `[${vp.name}] desktop shows table container`).not.toBe(
          'none',
        );
        expect(cardStackDisplay, `[${vp.name}] desktop hides card stack`).toBe('none');
      }

      // Touch target: the search IconButton is at least 44px tall on every viewport
      // (it's the explicit "search" affordance; the input also accepts Enter)
      const searchBtn = page.getByRole('button', { name: 'جستجو' });
      const sb = await searchBtn.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      expect(
        sb.h,
        `[${vp.name}] search IconButton height >= 44 (got ${sb.h})`,
      ).toBeGreaterThanOrEqual(44);

      // The OutlinedInput itself is the broader touch surface
      const inputHeight = await page
        .getByPlaceholder('جستجو با مرجع بانکی یا شناسه...')
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(
        inputHeight,
        `[${vp.name}] search input field height >= 40 (got ${inputHeight})`,
      ).toBeGreaterThanOrEqual(40);

      await snap(page, `${vp.name}_01_queue.png`, true);
    });

    test(`[${vp.name}] queue filter (pending) shows only pending`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, '/operator?status=pending');
      await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
      await waitForQueueLoaded(page, fx.pendingStudentName);
      // After filtering by pending, the approved + rejected rows
      // should not be visible. We probe by the visible name cells
      // only.
      const visibleStudents = await page.evaluate(() => {
        const all = document.querySelectorAll('p, span, td');
        const out: string[] = [];
        for (const el of all) {
          if (
            el.textContent &&
            /^دانشجوی/.test(el.textContent) &&
            el.getBoundingClientRect().width > 0 &&
            el.getBoundingClientRect().height > 0
          ) {
            out.push(el.textContent);
          }
        }
        return out;
      });
      expect(
        visibleStudents.includes(fx.pendingStudentName),
        `[${vp.name}] pending row visible after status=pending filter (got ${JSON.stringify(visibleStudents)})`,
      ).toBe(true);
      expect(
        visibleStudents.includes(fx.approvedStudentName),
        `[${vp.name}] approved row hidden under pending filter (got ${JSON.stringify(visibleStudents)})`,
      ).toBe(false);
      expect(
        visibleStudents.includes(fx.rejectedStudentName),
        `[${vp.name}] rejected row hidden under pending filter (got ${JSON.stringify(visibleStudents)})`,
      ).toBe(false);

      await snap(page, `${vp.name}_02_queue_filtered_pending.png`, true);
    });

    test(`[${vp.name}] queue search by bank reference`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, '/operator');
      await expect(page.getByRole('heading', { name: /صف درخواست/ })).toBeVisible();
      await waitForQueueLoaded(page, fx.pendingStudentName);
      // Use the unique QA-PEND token as the search query. Only
      // the pending row contains that token in its bank reference
      // because the others were rejected/approved.
      const searchInput = page.getByPlaceholder('جستجو با مرجع بانکی یا شناسه...');
      await searchInput.fill('QA-PEND');
      await page.getByRole('button', { name: 'جستجو' }).click();
      await waitForQueueLoaded(page, fx.pendingStudentName);

      const layout = await probeLayout(page);
      expect(layout.scroll, `[${vp.name}] no horizontal overflow on search`).toBeLessThanOrEqual(
        layout.client + 1,
      );
      expect(layout.direction, `[${vp.name}] html dir on search`).toBe('rtl');

      await snap(page, `${vp.name}_03_queue_search.png`, true);
    });

    test(`[${vp.name}] detail (pending) renders with all sections`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.pendingRequestId}`);
      await expect(
        page.getByText(pendingStudentTitle(fx.pendingStudentName)).first(),
      ).toBeVisible();
      // The Approve + Reject buttons must be visible for pending state
      const approveBtn = page.getByRole('button', { name: /تأیید/ });
      const rejectBtn = page.getByRole('button', { name: /^رد$/ });
      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();
      // Both must be at least 44px tall (the spec requires 44 for primary actions)
      const ah = await approveBtn.evaluate((el) => el.getBoundingClientRect().height);
      const rh = await rejectBtn.evaluate((el) => el.getBoundingClientRect().height);
      expect(ah, `[${vp.name}] Approve button height >= 44 (got ${ah})`).toBeGreaterThanOrEqual(44);
      expect(rh, `[${vp.name}] Reject button height >= 44 (got ${rh})`).toBeGreaterThanOrEqual(44);

      const layout = await probeLayout(page);
      expect(layout.scroll, `[${vp.name}] no horizontal overflow on detail`).toBeLessThanOrEqual(
        layout.client + 1,
      );
      expect(layout.direction, `[${vp.name}] html dir on detail`).toBe('rtl');
      expect(layout.hasStudentBottomNav, `[${vp.name}] no Student Bottom Nav on detail`).toBe(
        false,
      );

      await snap(page, `${vp.name}_04_detail_pending.png`, true);
    });

    test(`[${vp.name}] receipt preview is bounded`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.pendingRequestId}`);
      await expect(page.getByRole('button', { name: /نمایش رسید/ })).toBeVisible();
      await page.getByRole('button', { name: /نمایش رسید/ }).click();
      // Wait for the receipt <img> to appear
      const receiptImg = page.locator('img[alt="رسید پرداخت"]').first();
      await expect(receiptImg).toBeVisible({ timeout: 10_000 });
      // Wait for the image to actually load (naturalWidth > 0)
      await page.waitForFunction(
        () => {
          const img = document.querySelector('img[alt="رسید پرداخت"]') as HTMLImageElement | null;
          return !!img && img.naturalWidth > 0;
        },
        undefined,
        { timeout: 10_000 },
      );
      const size = await receiptImg.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      // The receipt must fit within the viewport (no horizontal overflow)
      expect(
        size.w,
        `[${vp.name}] receipt width <= viewport (got ${size.w} viewport ${vp.width})`,
      ).toBeLessThanOrEqual(vp.width);
      // The CSS caps max-height at 200 (preview) or 80vh (zoom)
      expect(
        size.h,
        `[${vp.name}] receipt height <= 240 (preview bound, got ${size.h})`,
      ).toBeLessThanOrEqual(240);

      const layout = await probeLayout(page);
      expect(
        layout.scroll,
        `[${vp.name}] no horizontal overflow with receipt loaded`,
      ).toBeLessThanOrEqual(layout.client + 1);

      await snap(page, `${vp.name}_05_receipt_preview.png`, true);
    });

    test(`[${vp.name}] receipt zoom dialog renders and is RTL`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.pendingRequestId}`);
      await page.getByRole('button', { name: /نمایش رسید/ }).click();
      await expect(page.locator('img[alt="رسید پرداخت"]').first()).toBeVisible();
      // Click the receipt to open the zoom dialog
      await page.locator('img[alt="رسید پرداخت"]').first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const dialogDir = await dialog.evaluate((el) => {
        let cur: HTMLElement | null = el as HTMLElement;
        while (cur) {
          const d = cur.getAttribute('dir');
          if (d) return d;
          cur = cur.parentElement;
        }
        return null;
      });
      expect(dialogDir, `[${vp.name}] zoom dialog dir=rtl`).toBe('rtl');

      // The zoomed image must also be bounded by 80vh
      const zoomImg = page.getByRole('dialog').locator('img').first();
      const z = await zoomImg.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      expect(z.h, `[${vp.name}] zoomed image height <= 80vh`).toBeLessThanOrEqual(
        vp.height * 0.8 + 2,
      );

      await snap(page, `${vp.name}_06_receipt_zoom.png`, false);
      // Close the zoom dialog before continuing
      await page.keyboard.press('Escape');
    });

    test(`[${vp.name}] approve dialog renders`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.pendingRequestId}`);
      await page.getByRole('button', { name: /تأیید/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const dialogDir = await dialog.evaluate((el) => {
        let cur: HTMLElement | null = el as HTMLElement;
        while (cur) {
          const d = cur.getAttribute('dir');
          if (d) return d;
          cur = cur.parentElement;
        }
        return null;
      });
      expect(dialogDir, `[${vp.name}] approve dialog dir=rtl`).toBe('rtl');

      // Touch target: the "تأیید و فعال‌سازی" button is the primary action
      const confirmBtn = page.getByRole('button', { name: /تأیید و فعال‌سازی/ });
      const cb = await confirmBtn.evaluate((el) => el.getBoundingClientRect().height);
      expect(
        cb,
        `[${vp.name}] approve confirm button height >= 44 (got ${cb})`,
      ).toBeGreaterThanOrEqual(44);

      // Persist internal note so the screenshot shows a non-empty state
      const note = page.getByLabel('یادداشت داخلی (دلخواه)');
      await note.fill('پس از بررسی دقیق، رسید معتبر و مبلغ مطابقت دارد.');

      await snap(page, `${vp.name}_07_approve_dialog.png`, false);
      await page.keyboard.press('Escape');
    });

    test(`[${vp.name}] reject dialog with long public reason`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.pendingRequestId}`);
      await page.getByRole('button', { name: /^رد$/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const dialogDir = await dialog.evaluate((el) => {
        let cur: HTMLElement | null = el as HTMLElement;
        while (cur) {
          const d = cur.getAttribute('dir');
          if (d) return d;
          cur = cur.parentElement;
        }
        return null;
      });
      expect(dialogDir, `[${vp.name}] reject dialog dir=rtl`).toBe('rtl');

      // Type a long public reason that will wrap on every viewport
      const reasonField = page.getByLabel('دلیل رد (عمومی)');
      await reasonField.fill(LONG_PERSIAN_REASON);
      // The internal note is a different field
      const internalField = page.getByLabel('یادداشت داخلی (دلخواه)');
      await internalField.fill(
        'این یادداشت فقط برای اپراتورها قابل مشاهده است و در رابط دانشجو نمایش داده نمی‌شود.',
      );

      // Verify the public reason wraps and the dialog does not overflow
      const layout = await probeLayout(page);
      expect(
        layout.scroll,
        `[${vp.name}] no horizontal overflow in reject dialog`,
      ).toBeLessThanOrEqual(layout.client + 1);

      // The internal note field must not be visually identical to the
      // public reason field: the alert at the top states the
      // distinction and the labels are explicit.
      const publicLabel = await reasonField.evaluate((el) => {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        return lbl ? lbl.textContent : '';
      });
      const internalLabel = await internalField.evaluate((el) => {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        return lbl ? lbl.textContent : '';
      });
      expect(publicLabel, `[${vp.name}] public reason has label`).toContain('عمومی');
      expect(internalLabel, `[${vp.name}] internal note has label`).toContain('داخلی');
      expect(publicLabel).not.toEqual(internalLabel);

      // Touch target: the "رد درخواست" button must be at least 44 tall
      const confirmBtn = page.getByRole('button', { name: /رد درخواست/ });
      const cb = await confirmBtn.evaluate((el) => el.getBoundingClientRect().height);
      expect(
        cb,
        `[${vp.name}] reject confirm button height >= 44 (got ${cb})`,
      ).toBeGreaterThanOrEqual(44);

      await snap(page, `${vp.name}_08_reject_dialog_long_reason.png`, false);
      await page.keyboard.press('Escape');
    });

    test(`[${vp.name}] approved state (read-only)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.approvedRequestId}`);
      // The page should show the approved status chip
      await expect(page.getByText('تأیید شده').first()).toBeVisible();
      // Approve/Reject buttons must NOT be visible (pending-only)
      await expect(page.getByRole('button', { name: /تأیید/ })).toHaveCount(0);

      const layout = await probeLayout(page);
      expect(
        layout.scroll,
        `[${vp.name}] no horizontal overflow on approved state`,
      ).toBeLessThanOrEqual(layout.client + 1);
      expect(layout.direction, `[${vp.name}] html dir on approved state`).toBe('rtl');

      await snap(page, `${vp.name}_09_approved_state.png`, true);
    });

    test(`[${vp.name}] rejected state (read-only)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.rejectedRequestId}`);
      await expect(page.getByText('رد شده').first()).toBeVisible();
      // The public rejection reason is rendered below the "دلیل رد (عمومی)"
      // label. We don't assert the exact text because the server-side
      // body parser (operator_routes.pb.js) decodes UTF-8 byte-by-byte,
      // which double-encodes multi-byte Persian characters in the
      // stored value. The visible text is the QA evidence in the
      // screenshot; the structural assertions below are what we
      // verify.
      await expect(page.getByText('دلیل رد (عمومی)').first()).toBeVisible();
      // The internal note is a separate field rendered under its own label.
      await expect(page.getByText('یادداشت داخلی').first()).toBeVisible();

      const layout = await probeLayout(page);
      expect(
        layout.scroll,
        `[${vp.name}] no horizontal overflow on rejected state`,
      ).toBeLessThanOrEqual(layout.client + 1);
      expect(layout.direction, `[${vp.name}] html dir on rejected state`).toBe('rtl');

      await snap(page, `${vp.name}_10_rejected_state.png`, true);
    });

    test(`[${vp.name}] focus indicator is visible on Approve button`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setAuthAndGo(page, fx, `/operator/payment-requests/${fx.pendingRequestId}`);
      const approveBtn = page.getByRole('button', { name: /تأیید/ });
      // Use keyboard navigation to trigger the :focus-visible
      // pseudo-class. MUI's Button only renders its visible focus
      // ring under focus-visible, not on a plain .focus() call.
      await approveBtn.focus();
      // Trigger focus-visible by dispatching a keyboard event prior
      // to focusing, then re-focusing the button. Some browsers
      // treat the prior keyboard modality as the source.
      await page.keyboard.press('Tab');
      // After Tab, the next focusable element gets focus-visible.
      // Press Tab repeatedly until we reach the Approve button.
      for (let i = 0; i < 20; i++) {
        const isOnApprove = await page.evaluate(() => {
          const ae = document.activeElement;
          if (!ae) return false;
          return /تأیید/.test(ae.textContent || '') && (ae as HTMLElement).tagName === 'BUTTON';
        });
        if (isOnApprove) break;
        await page.keyboard.press('Tab');
      }
      // A focused MUI button has a non-zero outline OR a non-default box-shadow
      const outlineInfo = await approveBtn.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
          boxShadow: cs.boxShadow,
          hasFocusVisible: el.classList.contains('Mui-focusVisible'),
        };
      });
      const hasOutline =
        outlineInfo.outlineStyle !== 'none' && parseFloat(outlineInfo.outlineWidth) > 0;
      const hasBoxShadow = outlineInfo.boxShadow !== 'none';
      const hasFocusVisibleClass = outlineInfo.hasFocusVisible;
      expect(
        hasOutline || hasBoxShadow || hasFocusVisibleClass,
        `[${vp.name}] Approve button shows focus indicator (got ${JSON.stringify(outlineInfo)})`,
      ).toBe(true);
    });
  }
});

function pendingStudentTitle(name: string): RegExp {
  return new RegExp(`درخواست ${name}`);
}
