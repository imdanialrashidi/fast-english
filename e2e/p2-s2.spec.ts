// e2e/p2-s2.spec.ts
// P2-S2 — Level selection and dashboard E2E flow.
// Uses the same fixtures and student setup from P2-S1.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

const ANSWER_KEYS = [
  'correctOptionId',
  'correct_option_id',
  'correctAnswer',
  'answerKey',
  'isCorrect',
  'gradingKey',
];

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

function randomId() {
  return randomBytes(6).toString('hex');
}

let phoneCounter = 0;
function nextPhone(): string {
  const tail = String(phoneCounter++).padStart(2, '0');
  const rand = randomBytes(4).readUInt32BE(0) % 10_000_000;
  const mid = String(rand).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, ok: res.ok };
}

const TEST_QUESTIONS = Array.from({ length: 20 }, (_, i) => {
  const letters = ['a', 'b', 'c', 'd'];
  return {
    key: `q${String(i).padStart(2, '0')}`,
    prompt: `Question ${i + 1}: Choose the correct option.`,
    options: letters.map((id, j) => ({ id, text: `Option ${j + 1}` })),
    correct: 'a',
  };
});

async function seedFixtures(suToken: string): Promise<void> {
  // Check if already seeded
  const existing = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${suToken}` },
  });
  if (
    (existing.body as { totalItems?: number })?.totalItems &&
    (existing.body as { totalItems: number }).totalItems >= 20
  ) {
    return; // Already seeded
  }
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const q = TEST_QUESTIONS[i];
    const r = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${suToken}` },
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
    if (!r.ok && r.status !== 400) throw new Error(`Seed Q${i} failed: ${r.status}`);
  }
}

async function getOperatorToken(suToken: string): Promise<string> {
  const phone = nextPhone();
  const s = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Op',
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const uid = (s.body as Record<string, string>)?.id || '';
  await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${uid}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${suToken}` },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  const l = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({
      identity: (s.body as Record<string, string>)?.phone || phone,
      password: 'Test1234!',
    }),
  });
  return (l.body as { token?: string })?.token || '';
}

async function createActiveStudent(suToken: string): Promise<{ phone: string; token: string }> {
  const opToken = await getOperatorToken(suToken);
  const phone = nextPhone();
  const password = 'Test1234!';

  const signupRes = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  if (!signupRes.ok) throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
  const signupBody = signupRes.body as Record<string, string>;
  const canonicalPhone = signupBody.phone || '';

  const loginRes = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  if (!loginRes.ok) throw new Error(`Login failed`);
  const token = (loginRes.body as { token?: string })?.token || '';

  await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${suToken}` },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'TEST',
      bank_name: 'TEST',
      is_active: true,
    }),
  });

  const planRes = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${suToken}` },
    body: JSON.stringify({
      name: 'T',
      slug: `t-${randomId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = (planRes.body as { id?: string })?.id || '';

  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `----FormBoundary${randomId()}`;
  const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footerStr = `\r\n--${boundary}--\r\n`;
  const fullBody = Buffer.concat([Buffer.from(headerStr), pngBytes, Buffer.from(footerStr)]);
  const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });
  const prText = await prRes.text();
  let prBody: Record<string, unknown>;
  try {
    prBody = JSON.parse(prText);
  } catch {
    prBody = { _raw: prText };
  }
  if (prRes.status !== 201) throw new Error(`PR failed: ${prRes.status}`);
  const prId = (prBody?.request as Record<string, unknown>)?.id as string;

  const approveRes = await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${opToken}` },
      body: JSON.stringify({}),
    },
  );
  if (approveRes.status !== 200) throw new Error(`Approve failed: ${approveRes.status}`);

  const refreshRes = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = (refreshRes.body as { token?: string })?.token || token;

  return { phone: canonicalPhone, token: refreshedToken };
}

async function completePlacement(studentToken: string): Promise<void> {
  const startResp = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${studentToken}` },
  });
  const startBody = startResp.body as {
    attempt?: { id: string; revision: number };
    questions?: Array<{ id: string; options: Array<{ id: string }> }>;
  };
  const attemptId = startBody.attempt?.id;
  let rev = startBody.attempt?.revision;
  for (const q of startBody.questions || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({
          questionId: q.id,
          optionId: q.options[0].id,
          expectedRevision: rev,
        }),
      },
    );
    rev = (ans.body as { attempt?: { revision: number } }).attempt?.revision || rev + 1;
  }
  await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
}

// ---- Tests ----

test.describe('P2-S2 Level Selection and Dashboard E2E', () => {
  let suToken: string;
  let student1: { phone: string; token: string }; // placement completed, will select level through UI

  test.beforeAll(async () => {
    suToken = await getSuperuserToken();
    expect(suToken).toBeTruthy();
    await seedFixtures(suToken);
    student1 = await createActiveStudent(suToken);
    // Complete placement via API
    await completePlacement(student1.token);
  });

  test('suggested level is server-calculated and correct', async () => {
    // After submitting (all answers correct = score 20 = C2)
    const ctx = await jsonFetch(`${PB_URL}/api/fast-english/placement/level-context`, {
      headers: { authorization: `Bearer ${student1.token}` },
    });
    expect(ctx.status).toBe(200);
    const body = ctx.body as { kind: string; suggestedLevel: string };
    expect(body.kind).toBe('level_selection_required');
    expect(body.suggestedLevel).toBe('C2');
  });

  test('accept suggested level and see dashboard', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('شمارهٔ موبایل').fill(student1.phone);
    await page.locator('input[name="password"]').fill('Test1234!');
    await page.getByRole('button', { name: 'ورود' }).click();

    // After login, redirect to placement (not dashboard since placement not completed)
    await page.waitForURL('**/placement', { timeout: 10000 });

    // Go to result page
    await page.goto('/placement/result');
    await page.waitForLoadState('networkidle');

    // Should show the level selection page
    await expect(page.getByText(/C2/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/سطح پیشنهادی/i).first()).toBeVisible();

    // Click accept suggestion (the button with the suggestion level)
    const acceptBtn = page.getByRole('button', { name: /C2/i });
    await acceptBtn.click();

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.getByText(/خوش آمدید/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('C2').first()).toBeVisible();
  });

  test('dashboard shows correct student data', async ({ page }) => {
    // Login with another student who already has level selected via API
    const student = await createActiveStudent(suToken);
    await completePlacement(student.token);
    // Select level via API
    await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
      method: 'POST',
      headers: { authorization: `Bearer ${student.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ selectedLevel: 'B1' }),
    });

    // Login and go to dashboard
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('شمارهٔ موبایل').fill(student.phone);
    await page.locator('input[name="password"]').fill('Test1234!');
    await page.getByRole('button', { name: 'ورود' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Check elements
    await expect(page.getByText(/خوش آمدید/i)).toBeVisible();
    await expect(page.getByText('B1').first()).toBeVisible();
    await expect(page.getByText(/سطح پیشنهادی/i).first()).toBeVisible();
    await expect(page.getByText(/دروس آموزشی/i)).toBeVisible();
    await expect(page.getByText(/روزهای باقی‌مانده/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /خروج/i })).toBeVisible();
  });

  test('no answer keys in responses', async () => {
    const student = await createActiveStudent(suToken);
    await completePlacement(student.token);
    await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
      method: 'POST',
      headers: { authorization: `Bearer ${student.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ selectedLevel: 'A2' }),
    });

    const ctx = await jsonFetch(`${PB_URL}/api/fast-english/placement/level-context`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    const ctxStr = JSON.stringify(ctx.body);
    for (const key of ANSWER_KEYS) {
      expect(ctxStr).not.toContain(key);
    }

    const dash = await jsonFetch(`${PB_URL}/api/fast-english/dashboard`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    const dashStr = JSON.stringify(dash.body);
    for (const key of ANSWER_KEYS) {
      expect(dashStr).not.toContain(key);
    }
    expect(dashStr).not.toContain('internal_note');
  });

  test('unauthenticated dashboard returns 401', async () => {
    const dash = await jsonFetch(`${PB_URL}/api/fast-english/dashboard`, {});
    expect(dash.status).toBe(401);
  });
});
