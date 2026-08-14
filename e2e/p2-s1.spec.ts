// e2e/p2-s1.spec.ts
// P2-S1 end-to-end flow against disposable PocketBase + built app.
// Uses direct API calls for data operations and browser for UI verification.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createStaff } from './fixtures';

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
  const qc = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${suToken}` },
  });
  const totalItems = (qc.body as Record<string, unknown>)?.totalItems as number;
  if (totalItems !== 20) throw new Error(`Expected 20 questions, got ${totalItems}`);
}

async function getOperatorToken(suToken: string): Promise<string> {
  const staff = await createStaff(suToken);
  return staff.token;
}

async function createActiveStudent(
  suToken: string,
): Promise<{ phone: string; password: string; token: string; userId: string }> {
  const opToken = await getOperatorToken(suToken);
  const phone = nextPhone();
  const password = 'Test1234!';

  // Signup
  const signupRes = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  if (!signupRes.ok) throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
  const signupBody = signupRes.body as Record<string, string>;
  const userId = signupBody.id || '';
  const canonicalPhone = signupBody.phone || '';

  // Login
  const loginRes = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  const token = (loginRes.body as { token?: string })?.token || '';

  // Create active payment destination
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

  // Create plan
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
  if (!planId) throw new Error(`Plan failed: ${JSON.stringify(planRes.body)}`);

  // Create payment request with multipart PNG
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
  if (prRes.status !== 201) throw new Error(`PR failed: ${prRes.status} ${JSON.stringify(prBody)}`);
  const prId = (prBody?.request as Record<string, unknown>)?.id as string;
  if (!prId) throw new Error(`No PR ID: ${JSON.stringify(prBody)}`);

  // Approve via operator
  const approveRes = await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${opToken}` },
      body: JSON.stringify({}),
    },
  );
  if (approveRes.status !== 200)
    throw new Error(`Approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);

  // Refresh token
  const refreshRes = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = (refreshRes.body as { token?: string })?.token || token;

  return { phone: canonicalPhone, password, token: refreshedToken, userId };
}

// ---- Test ----

test.describe('P2-S1 Placement E2E', () => {
  let studentData: { phone: string; password: string; token: string };

  test.beforeAll(async () => {
    const suToken = await getSuperuserToken();
    expect(suToken).toBeTruthy();
    await seedFixtures(suToken);
    studentData = await createActiveStudent(suToken);
  });

  test('placement API flow: start, answer, submit', async () => {
    // Start attempt
    const startResp = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${studentData.token}` },
    });
    expect(startResp.status).toBe(201);
    const startBody = startResp.body as {
      kind?: string;
      attempt?: { id: string; revision: number };
      questions?: Array<{
        id: string;
        position: number;
        options: Array<{ id: string; text: string }>;
      }>;
    };
    expect(startBody.attempt).toBeTruthy();
    const attemptId = startBody.attempt?.id;
    const questions = startBody.questions || [];
    expect(questions.length).toBe(20);

    // Verify no answer keys in start response
    const startStr = JSON.stringify(startBody);
    for (const key of ANSWER_KEYS) {
      expect(startStr).not.toContain(key);
    }

    // Verify all questions have valid options
    for (const q of questions) {
      expect(q.position).toBeGreaterThanOrEqual(1);
      expect(q.position).toBeLessThanOrEqual(20);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(6);
    }

    // Answer all 20 questions
    let rev = startBody.attempt?.revision;
    for (const q of questions) {
      const optId = q.options[0]?.id;
      if (!optId) throw new Error(`Question ${q.id} has no options`);
      const ans = await jsonFetch(
        `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${studentData.token}` },
          body: JSON.stringify({ questionId: q.id, optionId: optId, expectedRevision: rev }),
        },
      );
      expect(ans.ok).toBe(true);
      const ansBody = ans.body as { attempt?: { revision: number } };
      rev = ansBody.attempt?.revision || rev + 1;
    }
    expect(rev).toBe(21); // Started at 1, incremented 20 times

    // Submit
    const submitResp = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${studentData.token}` },
        body: JSON.stringify({ expectedRevision: rev }),
      },
    );
    expect(submitResp.status).toBe(200);
    const submitBody = submitResp.body as {
      kind?: string;
      attempt?: { score?: number; maxScore?: number; submittedAt?: string };
    };
    expect(submitBody.kind).toBe('submitted');
    expect(submitBody.attempt?.score).toBe(20);
    expect(submitBody.attempt?.maxScore).toBe(20);
    expect(submitBody.attempt?.submittedAt).toBeTruthy();

    // Verify no answer keys in submit response
    const submitStr = JSON.stringify(submitBody);
    for (const key of ANSWER_KEYS) {
      expect(submitStr).not.toContain(key);
    }

    // Resume via API - verify frozen state
    const resumeResp = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${studentData.token}` },
    });
    expect(resumeResp.status).toBe(200);
    const resumeBody = resumeResp.body as { kind?: string };
    expect(resumeBody.kind).toBe('submitted');
  });

  test('final submit recovers from a concurrent 409 (stale revision) without a dead-end lock', async ({
    page,
  }) => {
    // Regression for the submit-lock dead-end: when the final submit hits
    // placement_attempt_stale (attempt modified elsewhere), the app reloads
    // the attempt and must re-enable the submit gate. With the bug, the
    // second «تأیید و ثبت» silently no-ops forever (submitLockRef stuck).
    const suToken = await getSuperuserToken();
    const student = await createActiveStudent(suToken);

    // Answer all 20 questions via API (attempt stays in_progress).
    const startResp = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${student.token}` },
    });
    expect(startResp.status).toBe(201);
    const startBody = startResp.body as {
      attempt?: { id: string; revision: number };
      questions?: Array<{ id: string; options: Array<{ id: string }> }>;
    };
    const attemptId = startBody.attempt?.id;
    const questions = startBody.questions || [];
    expect(questions.length).toBe(20);
    let rev = startBody.attempt?.revision as number;
    for (const q of questions) {
      const ans = await jsonFetch(
        `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${student.token}` },
          body: JSON.stringify({
            questionId: q.id,
            optionId: q.options[0]?.id,
            expectedRevision: rev,
          }),
        },
      );
      expect(ans.ok).toBe(true);
      rev = (ans.body as { attempt?: { revision: number } }).attempt?.revision || rev + 1;
    }

    // Login in the real browser; the active student without placement is
    // redirected to /placement, which resumes the in_progress attempt.
    await page.goto('/login');
    await page.getByLabel('شمارهٔ موبایل').fill(student.phone);
    await page.locator('input[name="password"]').fill(student.password);
    await page.getByRole('button', { name: 'ورود' }).click();
    await page.waitForURL('**/placement', { timeout: 10000 });

    // Navigate to the last question and into the review screen.
    await page.getByRole('button', { name: 'رفتن به سؤال 20' }).click();
    await page.getByRole('button', { name: 'مرور' }).click();
    await expect(page.getByRole('button', { name: 'ثبت نهایی' })).toBeVisible();
    await page.getByRole('button', { name: 'ثبت نهایی' }).click();
    await expect(page.getByRole('button', { name: 'تأیید و ثبت' })).toBeVisible();

    // Concurrent modification: bump the revision server-side while the
    // confirm dialog is open (simulating a second tab answering).
    const staleAns = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${student.token}` },
        body: JSON.stringify({
          questionId: questions[0]?.id,
          optionId: questions[0]?.options[0]?.id,
          expectedRevision: rev,
        }),
      },
    );
    expect(staleAns.status).toBe(200);

    // Submit — the server answers 409 placement_attempt_stale; the app
    // reloads the attempt and returns to the question flow (no error
    // dead-end).
    await page.getByRole('button', { name: 'تأیید و ثبت' }).click();
    await expect(page.getByText('خطا در ثبت نهایی')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'رفتن به سؤال 20' })).toBeVisible({
      timeout: 5000,
    });

    // Recovery: re-enter review and submit again. With the dead-end bug the
    // gate stays locked and this click silently no-ops (no navigation).
    await page.getByRole('button', { name: 'رفتن به سؤال 20' }).click();
    await page.getByRole('button', { name: 'مرور' }).click();
    await page.getByRole('button', { name: 'ثبت نهایی' }).click();
    await page.getByRole('button', { name: 'تأیید و ثبت' }).click();
    await page.waitForURL(/\/placement\/result/, { timeout: 10000 });
  });
});
