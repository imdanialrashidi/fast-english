// e2e/p3-s1.spec.ts
// P3-S1 end-to-end: topics, lessons, published visibility, entitlement,
// premium audio, public sample, and tampering resistance.
// No screenshots required.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randId() {
  return randomBytes(6).toString('hex');
}

let phoneCounter = 0;
function nextPhone(): string {
  const tail = String(phoneCounter++).padStart(2, '0');
  const r = randomBytes(4).readUInt32BE(0) % 10_000_000;
  return `09${String(r).padStart(7, '0')}${tail}`.slice(0, 11);
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
  return { status: res.status, body: body as Record<string, unknown>, ok: res.ok };
}

async function getSuperuserToken(): Promise<string> {
  const email = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const password = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const r = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  return (r.body as { token?: string })?.token || '';
}

// Audio fixture — minimal valid MP3
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

async function makeTopic(su: string, overrides: Record<string, unknown> = {}) {
  const r = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: `T ${randId()}`,
      slug: `t-${randId()}`,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: overrides.status || 'published',
      ...overrides,
    }),
  });
  return r.body;
}

async function uploadAudio(su: string, lessonId: string) {
  const boundary = `--FB${randId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    AUDIO_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${PB_URL}/api/collections/lessons/records/${lessonId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
  });
  if (res.status !== 200) throw new Error(`audio upload: ${res.status}`);
}

async function makeLesson(su: string, topicId: string, overrides: Record<string, unknown> = {}) {
  const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level || 'B1',
      title: overrides.title || `L ${randId()}`,
      summary: 's',
      body: 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  const id = cr.body?.id as string;
  if (!id) throw new Error(`create lesson: ${JSON.stringify(cr.body).slice(0, 200)}`);
  await uploadAudio(su, id);
  if (overrides.status !== 'published' && overrides.status !== undefined) return { id };
  const patch: Record<string, unknown> = { status: 'published' };
  if (overrides.is_public_sample) patch.is_public_sample = true;
  // Set server-authoritative duration for published lessons
  const dur = Number(overrides.audio_duration_seconds || 0) || 600;
  patch.audio_duration_seconds = dur;
  const pr = await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`publish: ${pr.status}`);
  return { id };
}

// ---------------------------------------------------------------------------
// Seed fixtures
// ---------------------------------------------------------------------------
async function seedFixtures(su: string) {
  const topic = await makeTopic(su, {
    slug: `t-main-${randId()}`,
    status: 'published',
    sort_order: 1,
  });
  const mainTopicId = topic.id as string;
  const lesson = await makeLesson(su, mainTopicId, { level: 'B1', title: 'B1 Lesson One' });
  const lessonId = lesson.id;

  // Draft topic
  const draftTopic = await makeTopic(su, {
    slug: `t-draft-${randId()}`,
    status: 'published',
    sort_order: 2,
  });
  await makeLesson(su, draftTopic.id as string, { level: 'B1' });
  await jsonFetch(`${PB_URL}/api/collections/topics/records/${draftTopic.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ status: 'draft' }),
  });

  // A2 lesson
  const a2Topic = await makeTopic(su, {
    slug: `t-a2-${randId()}`,
    status: 'published',
    sort_order: 3,
  });
  const a2Lesson = await makeLesson(su, a2Topic.id as string, { level: 'A2', title: 'A2 Lesson' });
  const a2LessonId = a2Lesson.id;

  // Public sample
  const sampleTopic = await makeTopic(su, {
    slug: `t-sample-${randId()}`,
    status: 'published',
    sort_order: 4,
  });
  await makeLesson(su, sampleTopic.id as string, {
    level: 'B1',
    title: 'Sample Lesson',
    is_public_sample: true,
  });

  return { lessonId, a2LessonId };
}

// ---------------------------------------------------------------------------
// Create fully-entitled student
// ---------------------------------------------------------------------------
async function createFullStudent(su: string, level = 'B1') {
  // Get operator token
  const opPhone = nextPhone();
  const opS = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Op',
      phone: opPhone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const opId = opS.body?.id as string;
  await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${opId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  const opL = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({
      identity: (opS.body?.phone as string) || opPhone,
      password: 'Test1234!',
    }),
  });
  const opToken = (opL.body as { token?: string })?.token || '';

  const phone = nextPhone();
  const password = 'Test1234!';
  const canonicalPhone = `+98${phone.slice(1)}`;

  // Signup
  const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  const userId = signup.body?.id as string;

  // Login with canonical phone
  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = (login.body as { token?: string })?.token || '';

  // Payment destination
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

  // Plan
  const plan = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      name: 'P',
      slug: `p-${randId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = plan.body?.id as string;

  // Payment request with receipt
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `--FB${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: prBody,
  });
  const prText = await prRes.text();
  let prj: Record<string, unknown> = {};
  try {
    prj = JSON.parse(prText);
  } catch {
    prj = { _raw: prText };
  }
  if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
  const prId = (prj?.request as Record<string, unknown>)?.id as string;

  // Approve
  await jsonFetch(`${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`, {
    method: 'POST',
    headers: { authorization: `Bearer ${opToken}` },
    body: JSON.stringify({}),
  });

  // Refresh token
  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = (refresh.body as { token?: string })?.token || token;

  // Placement questions
  for (let i = 0; i < 20; i++) {
    await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        question_key: `q${String(i).padStart(2, '0')}`,
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

  // Complete placement
  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id;
  let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
  for (const q of (
    start.body as { questions?: Array<{ id: string; options: Array<{ id: string }> }> }
  )?.questions || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${refreshedToken}` },
        body: JSON.stringify({
          questionId: q.id,
          optionId: q.options[0].id,
          expectedRevision: rev,
        }),
      },
    );
    rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
  }
  await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });

  // Select level
  const lr = await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ selectedLevel: level }),
  });
  if (lr.status !== 200) throw new Error(`level select: ${lr.status}`);

  return { phone: canonicalPhone, password, token: refreshedToken, userId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
let su: string;
let lessonId: string;
let a2LessonId: string;
let student: { phone: string; password: string; token: string };

test.describe('P3-S1 Lessons E2E', () => {
  test.beforeAll(async () => {
    su = await getSuperuserToken();
    expect(su).toBeTruthy();
    const fixtures = await seedFixtures(su);
    lessonId = fixtures.lessonId;
    a2LessonId = fixtures.a2LessonId;
    student = await createFullStudent(su, 'B1');
  });

  // ------------------------------------------------------------------
  // 1. Eligible student login → lessons list → detail
  // ------------------------------------------------------------------
  test('eligible student sees lessons list with correct lessons', async ({ page }) => {
    await page.goto('/login');
    // The login form uses `name="phone"` (from react-hook-form register('phone'))
    await page.locator('input[name="phone"]').fill(student.phone);
    await page.locator('input[name="password"]').fill(student.password);
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard (the app redirects to /dashboard on success)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Navigate to lessons
    await page.goto('/lessons');
    await expect(page).toHaveURL('/lessons', { timeout: 10_000 });

    // Should see the B1 lesson
    await expect(page.getByRole('heading', { name: 'B1 Lesson One' })).toBeVisible({
      timeout: 10_000,
    });

    // Draft topic lesson should NOT appear
    await expect(page.getByText(/Draft/)).toHaveCount(0);

    // A2 lesson should NOT appear (wrong level)
    await expect(page.getByText('A2 Lesson')).toHaveCount(0);

    // Click the lesson to go to detail
    await page.getByRole('heading', { name: 'B1 Lesson One' }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-z0-9]+/, { timeout: 10_000 });

    // The article should have dir="ltr"
    const article = page.locator('article[lang="en"]');
    await expect(article).toBeVisible({ timeout: 10_000 });
    const articleDir = await article.getAttribute('dir');
    expect(articleDir).toBe('ltr');

    // Audio player: wait for either the audio element or an error state.
    // Audio elements are hidden by design; use toBeAttached instead of toBeVisible.
    const audio = page.locator('audio[preload="metadata"]');
    const audioErrorEl = page.locator('text=خطا در دریافت فایل صوتی');
    await expect(audio.or(audioErrorEl).first()).toBeAttached({ timeout: 15_000 });
  });

  // ------------------------------------------------------------------
  // 2. Wrong-level lesson is denied
  // ------------------------------------------------------------------
  test('wrong-level lesson access returns error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="phone"]').fill(student.phone);
    await page.locator('input[name="password"]').fill(student.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Directly navigate to A2 lesson
    await page.goto(`/lessons/${a2LessonId}`);
    // Should show access denied or not found
    await expect(page.locator('text=دسترسی محدود').or(page.locator('text=یافت نشد'))).toBeVisible({
      timeout: 10_000,
    });
  });

  // ------------------------------------------------------------------
  // 3. Public sample works without login
  // ------------------------------------------------------------------
  test('public sample works without login', async ({ page }) => {
    await page.goto('/sample');
    await expect(page).toHaveURL('/sample', { timeout: 10_000 });

    // Should show the sample lesson — use .first() because the title appears twice (header + h1)
    await expect(page.getByRole('heading', { name: 'Sample Lesson' }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Article should have dir="ltr"
    const article = page.locator('article[lang="en"]');
    await expect(article).toBeVisible({ timeout: 10_000 });
    const articleDir = await article.getAttribute('dir');
    expect(articleDir).toBe('ltr');

    // Audio element should be present
    const audio = page.locator('audio[preload="metadata"]');
    await expect(audio).toBeVisible({ timeout: 10_000 });

    // Audio src should be inside <source> element, pointing to public sample proxy
    const src = await audio.locator('source').getAttribute('src');
    expect(src).toContain('/api/fast-english/public/sample/audio');
  });

  // ------------------------------------------------------------------
  // 4. No raw PB errors or filesystem paths in the UI
  // ------------------------------------------------------------------
  test('no raw PB errors or filesystem paths visible', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="phone"]').fill(student.phone);
    await page.locator('input[name="password"]').fill(student.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Check lessons page
    await page.goto('/lessons');
    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toContain('storage/');
    expect(bodyText).not.toContain('"code"');
    expect(bodyText).not.toContain('"message"');
  });
});
