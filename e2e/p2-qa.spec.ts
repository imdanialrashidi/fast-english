// e2e/p2-qa.spec.ts
// P2 responsive visual QA: authenticated screenshots at 7 viewports across
// P2-S1 (placement flow) and P2-S2 (level selection + dashboard) states.
//
// Uses localStorage auth injection (PocketBase JS SDK LocalAuthStore key
// "pocketbase_auth") to authenticate the browser session. All mandatory
// state assertions use Playwright expect() with bounded timeouts.
// Optional branches use explicit count/visibility checks. An anti-false-positive guard fails when
// a Login page is displayed instead of the expected Product state.
//
// Run: pnpm exec playwright test e2e/p2-qa.spec.ts
// Output: /tmp/opencode/p2-s1-placement-qa-fixed/ and .../p2-s2-dashboard-qa-fixed/

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const APP_URL = PB_URL.replace(/:\d+/, ':18102');
const QA_ROOT = '/tmp/opencode/product-app-visual-polish';
const P2S1_DIR = `${QA_ROOT}/p2-s1-placement-qa-fixed`;
const P2S2_DIR = `${QA_ROOT}/p2-s2-dashboard-qa-fixed`;

const VIEWPORTS: { w: number; h: number; name: string }[] = [
  { w: 390, h: 844, name: '390x844' },
  { w: 768, h: 1024, name: '768x1024' },
  { w: 1440, h: 900, name: '1440x900' },
];

const TEST_QUESTIONS = Array.from({ length: 20 }, (_, i) => ({
  key: `qqa${String(i).padStart(2, '0')}`,
  prompt:
    i === 5
      ? 'Which of the following sentences demonstrates the correct use of the past perfect continuous tense in a complex narrative describing an action that was in progress before another action occurred?'
      : `Question ${i + 1}: Choose the correct option.`,
  options: [
    { id: 'a', text: `Option A for Q${i + 1}` },
    { id: 'b', text: `Option B for Q${i + 1}` },
    { id: 'c', text: `Option C for Q${i + 1}` },
    { id: 'd', text: `Option D for Q${i + 1}` },
  ],
  correct: 'a',
}));

async function getSuperuserToken(): Promise<string> {
  const email = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const password = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const body = (await auth.json()) as { token?: string };
  return body.token || '';
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

let phoneCounter = 0;
function nextPhone(): string {
  const tail = String(phoneCounter++).padStart(2, '0');
  const rand = randomBytes(4).readUInt32BE(0) % 10_000_000;
  const mid = String(rand).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function seedFixtures(suToken: string): Promise<void> {
  const existingRes = await fetch(
    `${PB_URL}/api/collections/placement_questions/records?perPage=1`,
    { headers: { authorization: suToken } },
  );
  if (existingRes.status === 200) {
    const existingBody = (await existingRes.json()) as { totalItems?: number };
    if (existingBody.totalItems && existingBody.totalItems >= 20) return;
  }
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const q = TEST_QUESTIONS[i];
    const createR = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: suToken },
      body: JSON.stringify({
        question_key: q.key,
        version: 1,
        position: i + 1,
        prompt: q.prompt,
        options: q.options,
        options_text: JSON.stringify(q.options),
        correct_option_id: q.correct,
        is_active: true,
      }),
    });
    if (createR.status !== 200)
      throw new Error(
        `seed Q${i + 1} failed: ${createR.status} ${JSON.stringify(createR.body).slice(0, 100)}`,
      );
  }
}

async function getOperatorToken(suToken: string): Promise<string> {
  const staff = await createStaff(suToken);
  return staff.token;
}

async function createActiveStudent(
  suToken: string,
  opToken: string,
): Promise<{ token: string; phone: string; userId: string; record: Record<string, unknown> }> {
  const phone = nextPhone();
  const password = 'Test1234!';

  const signupR = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'دانشجوی آزمون', phone, password, passwordConfirm: password }),
  });
  if (signupR.status !== 200)
    throw new Error(`signup: ${signupR.status} ${JSON.stringify(signupR.body).slice(0, 200)}`);
  const signupBody = signupR.body as Record<string, string>;
  const canonicalPhone = signupBody.phone || phone;

  const loginR = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  if (loginR.status !== 200)
    throw new Error(`login: ${loginR.status} ${JSON.stringify(loginR.body).slice(0, 200)}`);
  const loginBody = loginR.body as { token?: string; record?: Record<string, unknown> };
  const token = loginBody.token || '';
  const record = loginBody.record || {};

  // Payment setup
  await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'TEST',
      bank_name: 'TEST',
      is_active: true,
    }),
  });
  const planR = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      name: 'T',
      slug: `qa-${randomBytes(3).toString('hex')}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = (planR.body as { id?: string })?.id || '';
  if (!planId) throw new Error('plan creation failed');

  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `----FormBoundary${randomBytes(6).toString('hex')}`;
  const reqBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="receipt.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    pngBytes,
    Buffer.from(
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}--\r\n`,
    ),
  ]);
  const reqR = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: { authorization: token, 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: reqBody,
  });
  if (reqR.status !== 201) {
    const txt = await reqR.text();
    throw new Error(`payment request failed: ${reqR.status} ${txt.slice(0, 200)}`);
  }

  const requestBody = (await reqR.json()) as { request?: { id?: string }; id?: string };
  const requestId = requestBody.request?.id ?? requestBody.id;
  if (!requestId) throw new Error('payment request response did not include an id');
  const approveR = await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${requestId}/approve`,
    { method: 'POST', headers: { authorization: opToken } },
  );
  if (approveR.status !== 200)
    throw new Error(`approve: ${approveR.status} ${JSON.stringify(approveR.body).slice(0, 200)}`);

  return { token, phone: canonicalPhone, userId: signupBody.id || '', record };
}

/** Anti-false-positive guard: fails if login page is still showing */
async function assertNotLogin(page: import('@playwright/test').Page): Promise<void> {
  await expect(async () => {
    const hasPassword = await page.locator('input[name="password"]').isVisible();
    if (hasPassword) throw new Error('Login form is visible — auth was not established');
  }).toPass({ timeout: 2000 });
  await expect(page.locator('input[name="password"]')).toHaveCount(0, { timeout: 1000 });
}

// ===== P2-S1 =====
test.describe('P2-S1 responsive placement QA', () => {
  let suToken: string;

  test.beforeAll(async () => {
    suToken = await getSuperuserToken();
    await seedFixtures(suToken);
  });

  for (const vp of VIEWPORTS) {
    test(`[${vp.name}] placement screenshots`, {
      tag: vp.name === '390x844' ? '@critical' : undefined,
    }, async ({ page }) => {
      mkdirSync(`${P2S1_DIR}/${vp.name}`, { recursive: true });
      await page.setViewportSize({ width: vp.w, height: vp.h });

      // Each viewport gets a fresh attempt. Reusing a submitted attempt would
      // legitimately land on the result screen and make the screenshot gate
      // depend on test order rather than the viewport under inspection.
      const opToken = await getOperatorToken(suToken);
      const student = await createActiveStudent(suToken, opToken);

      // Inject auth into localStorage before any page JS loads
      await page.addInitScript(
        (authData: { token: string; record: Record<string, unknown> }) => {
          localStorage.setItem('pocketbase_auth', JSON.stringify(authData));
        },
        { token: student.token, record: student.record },
      );

      await page.goto(`${APP_URL}/placement`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      await assertNotLogin(page);
      await expect(page).toHaveURL(/\/placement/);

      // Close sidebar drawer if visible (tablet sizes)
      const sidebarClose = page.getByRole('button', { name: /بستن/i }).first();
      if ((await sidebarClose.count()) > 0 && (await sidebarClose.isVisible())) {
        await sidebarClose.click();
        await page.waitForTimeout(300);
      }

      // The placement page loads questions directly (no intro since we have 20 active questions).
      // First visible element is Question 1's prompt.
      // If the page shows an error or loading state instead, fail immediately.
      const loadingOrError = page.locator('text=/در حال بارگذاری|خطا|آزمون در دسترس/');
      if ((await loadingOrError.count()) > 0 && (await loadingOrError.isVisible())) {
        // Take a debug screenshot and fail with context
        await page.screenshot({ path: `${P2S1_DIR}/${vp.name}/00-load-error.png` });
        throw new Error(
          'Placement page did not load properly - showing loading/error state. Screenshot saved.',
        );
      }
      await expect(page.getByText(/Question 1/i).first()).toBeVisible({ timeout: 12000 });

      // 1. First question with options
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${P2S1_DIR}/${vp.name}/01-question.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      const nextButton = page.getByRole('button', { name: 'بعدی' }).first();
      await expect(nextButton).toBeVisible({ timeout: 3000 });
      const nextReachable = await nextButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const target = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return target === element || element.contains(target);
      });
      expect(nextReachable, `[${vp.name}] next action is not covered by navigation`).toBe(true);

      // Select an option
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 3000 });
      await firstCheckbox.click();
      await page.waitForTimeout(500);

      // 2. Selected option
      await page.screenshot({
        path: `${P2S1_DIR}/${vp.name}/02-selected-option.png`,
        fullPage: true,
      });

      // Helper: answer current question and navigate
      async function answerAndAdvance() {
        const cb = page.locator('input[type="checkbox"]').first();
        await expect(cb).toBeVisible({ timeout: 3000 });
        await cb.click();
        // Wait for save to complete
        await page.waitForTimeout(800);
        const nextBtn = page.getByRole('button', { name: /بعدی/i }).first();
        const reviewBtn = page.getByRole('button', { name: /مرور/i }).first();
        const nextVisible = await nextBtn.isVisible();
        if (nextVisible) {
          await nextBtn.click();
        } else {
          await expect(reviewBtn).toBeVisible({ timeout: 2000 });
          await reviewBtn.click();
        }
        await page.waitForTimeout(500);
      }

      // Navigate through Q1-Q5
      for (let q = 0; q < 5; q++) {
        await answerAndAdvance();
      }

      // 3. Q6 with long English prompt
      await expect(page.getByText(/past perfect continuous/i).first()).toBeVisible({
        timeout: 3000,
      });
      await page.screenshot({
        path: `${P2S1_DIR}/${vp.name}/03-long-question.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Complete remaining 15 questions (Q6 through Q20)
      for (let q = 0; q < 15; q++) {
        await answerAndAdvance();
      }

      // 4. Review screen
      await page.waitForTimeout(500);
      await expect(page.getByText(/مرور پاسخ/).first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({ path: `${P2S1_DIR}/${vp.name}/04-review.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Click submit button
      const submitBtn = page.getByRole('button', { name: /ثبت نهایی/i }).first();
      await expect(submitBtn).toBeVisible({ timeout: 3000 });
      await submitBtn.click();
      await page.waitForTimeout(500);

      // 5. Submit confirmation dialog
      await expect(page.getByText(/ثبت نهایی آزمون/i).first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({
        path: `${P2S1_DIR}/${vp.name}/05-confirm-dialog.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Confirm
      const confirmBtn = page.getByRole('button', { name: /تأیید و ثبت/i }).first();
      await expect(confirmBtn).toBeVisible({ timeout: 3000 });
      await confirmBtn.click();
      await page.waitForTimeout(2000);

      // 6. Submitted: navigates to /placement/result
      await expect(page).toHaveURL(/result/);
      await expect(page.getByText(/نمره/i).first()).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: `${P2S1_DIR}/${vp.name}/06-submitted.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }
});

// ===== P2-S2 =====
test.describe('P2-S2 responsive dashboard QA', () => {
  let suToken: string;

  test.beforeAll(async () => {
    suToken = await getSuperuserToken();
    await seedFixtures(suToken);
  });

  /** Create a fresh student + complete placement for one test. */
  async function setupStudent() {
    const opToken = await getOperatorToken(suToken);
    const student = await createActiveStudent(suToken, opToken);
    const tk = student.token;
    // Complete placement via API
    const sr = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
      method: 'POST',
      headers: { authorization: tk },
    });
    const sb = sr.body as {
      attempt?: { id: string; revision: number };
      questions?: Array<{ id: string; options: Array<{ id: string }> }>;
    };
    const aid = sb.attempt?.id || '';
    const qs = sb.questions || [];
    let rv = sb.attempt?.revision || 1;
    for (const q of qs) {
      const ans = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${aid}/answer`, {
        method: 'PUT',
        headers: { authorization: tk },
        body: JSON.stringify({ questionId: q.id, optionId: q.options[0].id, expectedRevision: rv }),
      });
      rv = (ans.body as { attempt?: { revision: number } }).attempt?.revision || rv + 1;
    }
    await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${aid}/submit`, {
      method: 'POST',
      headers: { authorization: tk },
      body: JSON.stringify({ expectedRevision: rv }),
    });
    return { userToken: tk, loginRecord: student.record };
  }

  for (const vp of VIEWPORTS) {
    test(`[${vp.name}] dashboard screenshots`, async ({ page }) => {
      mkdirSync(`${P2S2_DIR}/${vp.name}`, { recursive: true });
      await page.setViewportSize({ width: vp.w, height: vp.h });

      // Each test gets a unique student so they don't interfere
      const { userToken, loginRecord } = await setupStudent();

      // Inject auth
      await page.addInitScript(
        (authData: { token: string; record: Record<string, unknown> }) => {
          localStorage.setItem('pocketbase_auth', JSON.stringify(authData));
        },
        { token: userToken, record: loginRecord },
      );

      await page.goto(`${APP_URL}/placement/result`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      await assertNotLogin(page);
      await expect(page).toHaveURL(/result/);

      // 1. Suggested-level result
      await expect(page.getByText(/سطح پیشنهادی/i).first()).toBeVisible({ timeout: 8000 });
      await expect(page.getByText(/C2/i).first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/نمره.*20.*20/).first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({
        path: `${P2S2_DIR}/${vp.name}/01-suggested-level.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Open the level picker by clicking "انتخاب سطح دیگر"
      const chooseAnother = page.getByRole('button', { name: /انتخاب سطح دیگر/i }).first();
      await expect(chooseAnother).toBeVisible({ timeout: 3000 });
      await chooseAnother.click();
      await page.waitForTimeout(500);

      // 2. Level picker showing all 6 levels
      await expect(page.getByText(/A1|A2|B1|B2|C1|C2/).first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({ path: `${P2S2_DIR}/${vp.name}/02-level-picker.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Click a different level (B1) to trigger confirmation dialog
      const levelB1 = page.getByRole('button', { name: 'B1' }).first();
      await expect(levelB1).toBeVisible({ timeout: 3000 });
      await levelB1.click();
      await page.waitForTimeout(500);

      // 3. Different-level confirmation dialog
      await expect(page.getByText(/تأیید انتخاب سطح/i).first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({
        path: `${P2S2_DIR}/${vp.name}/03-confirm-dialog.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Cancel the dialog
      const cancelBtn = page.getByRole('button', { name: /انصراف/i }).first();
      await expect(cancelBtn).toBeVisible({ timeout: 2000 });
      await cancelBtn.click();
      await page.waitForTimeout(500);

      // The level picker is still open. Click C2 (which is the suggested level)
      // to trigger the selection confirmation dialog.
      const c2Btn = page.getByRole('button', { name: 'C2' }).first();
      await expect(c2Btn).toBeVisible({ timeout: 3000 });
      await c2Btn.click();
      await page.waitForTimeout(500);

      // Confirm the selection (even C2 goes through confirmation when selected
      // from the picker)
      const yesBtn = page.getByRole('button', { name: /تأیید/i }).first();
      await expect(yesBtn).toBeVisible({ timeout: 3000 });
      await yesBtn.click();

      // Should navigate to dashboard
      await page.waitForURL(/\/$/, { timeout: 20000 });
      await page.waitForTimeout(1000);

      await assertNotLogin(page);

      // 4. Home
      await expect(page.getByText(/سلام/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/C2/i).first()).toBeVisible({ timeout: 3000 });
      // Podcast Slice 5 Home progress panel.
      await expect(page.getByTestId('progress-card')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/روزهای باقی‌مانده/i).first()).toBeVisible({ timeout: 3000 });
      await page.screenshot({ path: `${P2S2_DIR}/${vp.name}/04-dashboard.png`, fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }
});
