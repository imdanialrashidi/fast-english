// e2e/podcast-s5-screenshots.spec.ts
// OPT-IN uninspected Human-review artifacts for Podcast Slice 5 (§35).
//
// Run with: FEP_SCREENSHOTS=1 CI=1 pnpm exec playwright test e2e/podcast-s5-screenshots.spec.ts
//
// Writes PNGs to /tmp/opencode/fep-podcast-s5/ (outside the repository).
// These screenshots are NOT acceptance evidence — the submitter cannot
// interpret visuals; they exist only for later Human review. Deterministic
// acceptance comes from podcast-home.spec.ts and visual-slice-2.spec.ts.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const OUT_ROOT = '/tmp/opencode/fep-podcast-s5';
const ENV_FLAG = process.env.FEP_SCREENSHOTS === '1';

function randId(): string {
  return randomBytes(6).toString('hex');
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown>, ok: res.ok };
}

const AUDIO_FIXTURE = Buffer.from(
  (() => {
    const size = 8192;
    const b = new Uint8Array(size);
    b[0] = 0xff;
    b[1] = 0xfb;
    b[2] = 0x90;
    b[3] = 0x00;
    for (let i = 4; i < size; i++) b[i] = 0x55;
    return b.buffer;
  })(),
);

const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

test('capture Podcast Slice 5 screenshots', async ({ page }) => {
  test.skip(!ENV_FLAG, 'opt-in: set FEP_SCREENSHOTS=1');
  test.setTimeout(240_000);

  const suEmail = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const suPassword = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const suLogin = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: suEmail, password: suPassword }),
  });
  const su = (suLogin.body as { token?: string })?.token || '';
  if (!su) throw new Error('superuser auth failed');

  // Seed: destination + plan + one published Episode (draft → artwork →
  // publish, the real hooks path).
  await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'T',
      bank_name: 'T',
      is_active: true,
    }),
  });
  const plan = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      name: 'اشتراک آزمون اسکرینشات',
      slug: `p-ss-${randId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const PLAN_ID = plan.body?.id as string;

  const cat = await jsonFetch(
    `${PB_URL}/api/collections/categories/records?filter=(key='general')&perPage=1`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const categoryId = (cat.body as { items?: Array<{ id: string }> })?.items?.[0]?.id;
  if (!categoryId) throw new Error('default category missing');

  const topic = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: 'Pyramids Topic',
      slug: `ss-${randId()}`,
      description: 'd',
      sort_order: 1,
      status: 'draft',
      content_key: `fx-${randId()}`,
    }),
  });
  const topicId = topic.body?.id as string;
  const boundary = `--FB${randId()}`;
  const art = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG_FIXTURE,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  await fetch(`${PB_URL}/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: art,
  });
  await jsonFetch(`${PB_URL}/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      status: 'published',
      category: categoryId,
      content_key: `fx-${randId()}`,
      content_version: 1,
      title_fa: 'رازهای معماری اهرام مصر',
      description_fa: 'توضیح اپیزود',
    }),
  });
  const lesson = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: 'B1',
      title: 'Pyramids of Egypt',
      summary: 's',
      body: 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  const lessonId = lesson.body?.id as string;
  const audioBoundary = `--FB${randId()}`;
  const audio = Buffer.concat([
    Buffer.from(
      `--${audioBoundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    ),
    AUDIO_FIXTURE,
    Buffer.from(`\r\n--${audioBoundary}--\r\n`),
  ]);
  await fetch(`${PB_URL}/api/collections/lessons/records/${lessonId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${audioBoundary}`,
    },
    body: audio,
  });
  await jsonFetch(`${PB_URL}/api/collections/lessons/records/${lessonId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      status: 'published',
      audio_duration_seconds: 600,
      summary_fa: 'خلاصه فارسی',
      content_version: 1,
    }),
  });

  const staff = await createStaff(su);
  let phoneCounter = 0;
  const makeStudent = async (name: string) => {
    const phone = `09${String(10000000 + phoneCounter++ * 7919).slice(0, 10)}`;
    const password = 'Test1234!';
    const canonicalPhone = `+98${phone.slice(1)}`;
    await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
      method: 'POST',
      body: JSON.stringify({ name, phone, password, passwordConfirm: password }),
    });
    const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
      method: 'POST',
      body: JSON.stringify({ identity: canonicalPhone, password }),
    });
    const token = (login.body as { token?: string })?.token || '';
    const prBoundary = `--FB${randId()}`;
    const prBody = Buffer.concat([
      Buffer.from(
        `--${prBoundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${PLAN_ID}\r\n--${prBoundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG_FIXTURE,
      Buffer.from(`\r\n--${prBoundary}--\r\n`),
    ]);
    const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${prBoundary}`,
      },
      body: prBody,
    });
    const prj = (await prRes.json()) as { request?: { id?: string } };
    await jsonFetch(
      `${PB_URL}/api/fast-english/operator/payment-requests/${prj.request?.id}/approve`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${staff.token}` },
        body: JSON.stringify({}),
      },
    );
    const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    return (refresh.body as { token?: string })?.token || token;
  };

  // Placement questions + completion for the active students.
  const existingQ = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${su}` },
  });
  if (((existingQ.body as { items?: unknown[] })?.items?.length ?? 0) === 0) {
    for (let i = 0; i < 20; i++) {
      await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
        method: 'POST',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({
          question_key: `ssq${String(i).padStart(2, '0')}`,
          version: 1,
          position: i + 1,
          prompt: `Q${i + 1}`,
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' },
          ],
          options_text: JSON.stringify([
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' },
          ]),
          correct_option_id: 'a',
          is_active: true,
        }),
      });
    }
  }
  const completePlacement = async (token: string) => {
    const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id;
    let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
    for (const q of (start.body as { questions?: Array<{ id: string }> })?.questions || []) {
      const ans = await jsonFetch(
        `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${token}` },
          body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
        },
      );
      rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
    }
    await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ expectedRevision: rev }),
    });
    await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ selectedLevel: 'B1' }),
    });
  };

  const progressToken = await makeStudent('دانشجوی فعال');
  await completePlacement(progressToken);
  await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${progressToken}` },
    body: JSON.stringify({ positionSeconds: 150, expectedRevision: 0 }),
  });
  const freshToken = await makeStudent('دانشجوی تازه');
  await completePlacement(freshToken);

  // Expired: signup only, marked expired by the superuser.
  const expPhone = `09${String(10000000 + phoneCounter++ * 7919).slice(0, 10)}`;
  const expLogin = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'دانشجوی منقضی',
      phone: expPhone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const expId = expLogin.body?.id as string;
  await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${expId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ account_status: 'expired' }),
  });
  const expAuth = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({
      identity: `+98${expPhone.slice(1)}`,
      password: 'Test1234!',
    }),
  });
  const expiredToken = (expAuth.body as { token?: string })?.token || '';

  const setAuthAndGo = async (token: string, path: string) => {
    await page.goto('/');
    await page.evaluate(
      ({ t }) => {
        localStorage.setItem(
          'pocketbase_auth',
          JSON.stringify({ token: t, model: { id: '', phone: '' } }),
        );
      },
      { t: token },
    );
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
  };

  const shots = [
    { file: 'home-with-progress', route: '/', token: progressToken },
    { file: 'home-first-use', route: '/', token: freshToken },
    { file: 'home-expired', route: '/', token: expiredToken },
    { file: 'account-settings', route: '/account', token: progressToken },
    { file: 'progress', route: '/progress', token: progressToken },
    { file: 'library', route: '/library', token: progressToken },
  ];

  for (const size of [
    { name: '390x844', width: 390, height: 844 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1440x900', width: 1440, height: 900 },
  ]) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' });
      for (const shot of shots) {
        await setAuthAndGo(shot.token, shot.route);
        mkdirSync(`${OUT_ROOT}/${scheme}/${size.name}`, { recursive: true });
        await page.screenshot({
          path: `${OUT_ROOT}/${scheme}/${size.name}/${shot.file}.png`,
          fullPage: true,
        });
      }
    }
  }
  console.log(`Podcast Slice 5 artifacts written to ${OUT_ROOT}/`);
});
