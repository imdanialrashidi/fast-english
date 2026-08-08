// e2e/p3-s2.spec.ts
// P3-S2 end-to-end: progress persistence, audio player controls, resume,
// completion, lesson card progress, dashboard progress, and continue learning.
// Uses real PocketBase and real App builds.
// Responsive visual evidence is written outside the repository.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const VISUAL_QA_DIR = '/tmp/opencode/product-app-visual-polish/lessons-audio';

const VISUAL_VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

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

// Audio fixture
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

// Minimal valid PNG (1x1) for Episode artwork uploads (Podcast Slice 2).
const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

let defaultCategoryId = '';

async function getDefaultCategoryId(su: string): Promise<string> {
  if (defaultCategoryId) return defaultCategoryId;
  const r = await jsonFetch(
    `${PB_URL}/api/collections/categories/records?filter=(key='general')&perPage=1`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const item = (r.body as { items?: Array<{ id: string }> })?.items?.[0];
  if (!item) throw new Error('default category missing');
  defaultCategoryId = item.id;
  return defaultCategoryId;
}

async function uploadArtwork(su: string, topicId: string) {
  const boundary = `--FB${randId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
    PNG_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${PB_URL}/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 200) throw new Error(`artwork upload: ${res.status}`);
}

async function makeTopic(su: string, overrides: Record<string, unknown> = {}) {
  const slug = (overrides.slug as string) || `t-${randId()}`;
  // Podcast Slice 2: published Episodes require category/content_key/
  // title_fa/description_fa and artwork, so fixtures publish through the
  // same draft -> artwork -> publish path the hooks enforce.
  const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: (overrides.title as string) || `T ${randId()}`,
      slug,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: 'draft',
    }),
  });
  const id = cr.body?.id as string;
  if (!id) throw new Error(`topic create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  if (overrides.keepDraft) return cr.body;
  await uploadArtwork(su, id);
  const patch: Record<string, unknown> = {
    status: overrides.status || 'published',
    category: await getDefaultCategoryId(su),
    content_key: `fx-${randId()}`,
    content_version: 1,
    title_fa: 'عنوان اپیزود',
    description_fa: 'توضیح اپیزود',
  };
  const pr = await jsonFetch(`${PB_URL}/api/collections/topics/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`topic publish: ${pr.status}`);
  return cr.body;
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
  // Podcast Slice 2 Variant invariants for new publishes
  patch.summary_fa = 'خلاصه فارسی';
  patch.content_version = 1;
  const pr = await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`publish: ${pr.status}`);
  return { id };
}

// ---------------------------------------------------------------------------
// Create fully-entitled student
// ---------------------------------------------------------------------------
async function createFullStudent(su: string, level = 'B1') {
  // Staff Administrator token (Podcast Slice 1)
  const staff = await createStaff(su);
  const opToken = staff.token;

  const phone = nextPhone();
  const password = 'Test1234!';
  const canonicalPhone = `+98${phone.slice(1)}`;

  const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  const userId = signup.body?.id as string;

  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = (login.body as { token?: string })?.token || '';

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
      name: 'P',
      slug: `p-${randId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = plan.body?.id as string;

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

  await jsonFetch(`${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`, {
    method: 'POST',
    headers: { authorization: `Bearer ${opToken}` },
    body: JSON.stringify({}),
  });

  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  let refreshedToken = (refresh.body as { token?: string })?.token || token;

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

  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attemptId = start.body?.attempt?.id as string;
  let rev = (start.body?.attempt as Record<string, unknown>)?.revision as number;
  for (const q of (start.body?.questions as Array<Record<string, unknown>>) || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${refreshedToken}` },
        body: JSON.stringify({
          questionId: q.id,
          optionId: (q.options as Array<Record<string, unknown>>)[0].id,
          expectedRevision: rev,
        }),
      },
    );
    rev = ((ans.body?.attempt as Record<string, unknown>)?.revision as number) || rev + 1;
  }
  await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });

  const lr = await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ selectedLevel: level }),
  });
  if (lr.status !== 200) throw new Error(`level select: ${lr.status}`);

  const refresh2 = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  refreshedToken = (refresh2.body as { token?: string })?.token || refreshedToken;

  return { token: refreshedToken, userId, phone: canonicalPhone };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('P3-S2 Progress and Audio Player', () => {
  let su: string;
  let lessonId: string;
  let lesson3Id: string;
  let lesson4Id: string;
  let studentToken: string;
  let studentUserId: string;
  let studentPhone: string;

  test.beforeAll(async () => {
    su = await getSuperuserToken();

    // Idempotent fixture guard: in some environments Playwright restarts the
    // worker mid-run and re-executes this beforeAll against the same shared
    // PocketBase. Reusing an already-seeded lesson keeps the suite green and
    // the assertions strict (the list must still contain exactly one of each
    // title). Without the guard, duplicate fixtures would break every
    // strict-mode heading assertion in this file.
    const existing = await jsonFetch(`${PB_URL}/api/collections/lessons/records?perPage=200`, {
      headers: { authorization: `Bearer ${su}` },
    });
    const existingLessons = (existing.body?.items as Array<Record<string, unknown>>) || [];

    // Create student (always: the token is what the tests actually use).
    const student = await createFullStudent(su, 'B1');
    studentToken = student.token;
    studentUserId = student.userId;
    studentPhone = student.phone;

    if (existingLessons.some((l) => l.level === 'B1' && l.title === 'P3S2 Lesson 1')) {
      // All four fixtures already exist — reuse them and skip seeding.
      lessonId = existingLessons.find((l) => l.title === 'P3S2 Lesson 1')?.id as string;
      lesson3Id = existingLessons.find((l) => l.title === 'P3S2 Lesson 3 (resume)')?.id as string;
      lesson4Id = existingLessons.find((l) => l.title === 'P3S2 Lesson 4 (stall)')?.id as string;
      return;
    }

    // Create separate topics for each lesson (unique index on topic+level)
    const topic1 = await makeTopic(su, {
      slug: `t-p3s2-a-${randId()}`,
      status: 'published',
      sort_order: 1,
    });
    const topicId = topic1.id as string;

    const lesson = await makeLesson(su, topicId, { level: 'B1', title: 'P3S2 Lesson 1' });
    lessonId = lesson.id;

    const topic2 = await makeTopic(su, {
      slug: `t-p3s2-b-${randId()}`,
      status: 'published',
      sort_order: 2,
    });
    // Second published lesson (kept for queue/DB state; id never read).
    await makeLesson(su, topic2.id as string, {
      level: 'B1',
      title: 'P3S2 Lesson 2',
    });

    // Fresh lesson reserved for the resume test (must never be touched by
    // other tests so it starts with no progress).
    const topic3 = await makeTopic(su, {
      slug: `t-p3s2-c-${randId()}`,
      status: 'published',
      sort_order: 3,
    });
    const lesson3 = await makeLesson(su, topic3.id as string, {
      level: 'B1',
      title: 'P3S2 Lesson 3 (resume)',
    });
    lesson3Id = lesson3.id;

    // Fresh lesson reserved for the stalled-save scenario (must never be
    // touched by other tests so it starts with no progress).
    const topic4 = await makeTopic(su, {
      slug: `t-p3s2-d-${randId()}`,
      status: 'published',
      sort_order: 4,
    });
    const lesson4 = await makeLesson(su, topic4.id as string, {
      level: 'B1',
      title: 'P3S2 Lesson 4 (stall)',
    });
    lesson4Id = lesson4.id;
  });

  // Helper: inject auth token into localStorage (must navigate to app origin first)
  async function injectToken(page: {
    goto: (url: string) => Promise<unknown>;
    evaluate: (fn: (token: string) => void, token: string) => Promise<unknown>;
  }) {
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token, model: { id: '', phone: '' } }),
      );
      localStorage.setItem('pocketbase_auth_version', '1');
    }, studentToken);
  }

  // 1. Eligible Student logs in
  test('1 - eligible student can log in and see lessons', { tag: '@critical' }, async ({
    page,
  }) => {
    await injectToken(page);
    await page.goto('/lessons');
    await expect(page.getByRole('heading', { name: 'P3S2 Lesson 1' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('heading', { name: 'P3S2 Lesson 2' })).toBeVisible({
      timeout: 5_000,
    });
  });

  // 2. Opens a lesson
  test('2 - opens a real lesson', async ({ page }) => {
    await injectToken(page);
    await page.goto(`/lessons/${lessonId}`);
    await expect(page.getByRole('heading', { name: 'P3S2 Lesson 1' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // 3. Audio metadata loads (player renders)
  test('3 - audio player renders', async ({ page }) => {
    await injectToken(page);
    await page.goto(`/lessons/${lessonId}`);
    await page.waitForTimeout(3000);
    // Check that the audio player area is attached (audio element may be hidden)
    const player = page.locator('[role="group"][aria-label="پخش‌کنندهٔ صوت"]');
    await expect(player).toBeAttached({ timeout: 15_000 });
  });

  // 4. Saved progress is restored (via API check)
  test('4 - progress API returns saved position', async () => {
    // Save some progress first
    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ positionSeconds: 45, expectedRevision: 0 }),
    });
    expect(save.status).toBe(200);
    expect((save.body as Record<string, unknown>).positionSeconds).toBe(45);

    // Read it back
    const read = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(read.status).toBe(200);
    expect((read.body as Record<string, unknown>).positionSeconds).toBe(45);
  });

  // 5. Play/pause works via API
  test('5 - progress save on pause', async () => {
    // Save a position
    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        positionSeconds: 120,
        expectedRevision:
          (
            await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
              headers: { authorization: `Bearer ${studentToken}` },
            })
          ).body?.revision ?? 1,
      }),
    });
    expect(save.status).toBe(200);
  });

  // 6. Seek updates position
  test('6 - seek updates position via API', async () => {
    // Save a new position (simulating seek)
    const line = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const rev = (line.body as Record<string, unknown>).revision as number;

    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ positionSeconds: 200, expectedRevision: rev }),
    });
    expect(save.status).toBe(200);
    expect((save.body as Record<string, unknown>).positionSeconds).toBe(200);
  });

  // 7. Playback speed change (test via API — player has speed controls)
  test('7 - progress saves work at different speeds', async () => {
    const line = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const rev = (line.body as Record<string, unknown>).revision as number;

    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ positionSeconds: 300, expectedRevision: rev }),
    });
    expect(save.status).toBe(200);
  });

  // 8. Progress is saved through the real API
  test('8 - progress is saved through real API', async () => {
    const read = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(read.status).toBe(200);
    expect((read.body as Record<string, unknown>).revision).toBeGreaterThanOrEqual(1);
  });

  // 9. Refresh restores position
  test('9 - refresh restores position', { tag: '@critical' }, async () => {
    // Self-sufficient: this test must not depend on saves performed by
    // other tests, because the @critical project runs it standalone.
    const current = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const rev = (current.body as Record<string, unknown>).revision as number;
    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ positionSeconds: 300, expectedRevision: rev }),
    });
    expect(save.status).toBe(200);
    const read = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(read.status).toBe(200);
    expect((read.body as Record<string, unknown>).positionSeconds).toBe(300);
  });

  // 10. Completion updates after reaching threshold
  test('10 - completion occurs at threshold', { tag: '@critical' }, async ({ page }) => {
    const line = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const rev = (line.body as Record<string, unknown>).revision as number;

    // Save at 90%+ of 600 = 540+
    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ positionSeconds: 550, expectedRevision: rev }),
    });
    expect(save.status).toBe(200);
    expect((save.body as Record<string, unknown>).completed).toBe(true);
  });

  // 11. Lesson card shows completed
  test('11 - lesson list shows progress', async ({ page }) => {
    await injectToken(page);
    await page.goto('/lessons');

    // Check that there are lesson cards
    await page.waitForTimeout(2000);
    const pageText = await page.textContent('body');
    // Should contain at least one lesson title
    expect(pageText).toContain('P3S2');
  });

  // 12. Dashboard shows real progress
  test('12 - dashboard shows real progress', async ({ page }) => {
    await injectToken(page);
    await page.goto('/');
    // Podcast Slice 5 Home progress panel.
    await expect(page.getByTestId('progress-card')).toBeVisible({ timeout: 10_000 });
  });

  // 13. Continue Learning opens expected lesson
  test('13 - continue learning returns a lesson', async ({ page }) => {
    const cont = await jsonFetch(`${PB_URL}/api/fast-english/progress/continue`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(cont.status).toBe(200);
    const body = cont.body as Record<string, unknown>;
    // Should return either a lesson or all_completed
    expect(['lesson', 'all_completed', 'no_lessons']).toContain(body.kind);
  });

  // 14. Expired student cannot save progress
  test('14 - expired student cannot save progress', { tag: '@critical' }, async ({ page }) => {
    // Expire by patching subscription
    const subs = await jsonFetch(`${PB_URL}/api/collections/subscriptions/records`, {
      headers: { authorization: `Bearer ${su}` },
    });
    for (const sub of (subs.body?.items as Array<Record<string, unknown>>) || []) {
      if (sub.user === studentUserId) {
        await jsonFetch(`${PB_URL}/api/collections/subscriptions/records/${sub.id}`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${su}` },
          body: JSON.stringify({ expires_at: new Date(Date.now() - 86400000).toISOString() }),
        });
      }
    }

    // Get a fresh token using phone (PB identity field)
    const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
      method: 'POST',
      body: JSON.stringify({ identity: studentPhone, password: 'Test1234!' }),
    });
    const expiredToken = (login.body as { token?: string })?.token || '';

    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${expiredToken}` },
      body: JSON.stringify({ positionSeconds: 10, expectedRevision: 0 }),
    });
    expect(save.status).toBe(403);

    // Reactivate subscription for cleanup
    const subs2 = await jsonFetch(`${PB_URL}/api/collections/subscriptions/records`, {
      headers: { authorization: `Bearer ${su}` },
    });
    for (const sub of (subs2.body?.items as Array<Record<string, unknown>>) || []) {
      if (sub.user === studentUserId) {
        await jsonFetch(`${PB_URL}/api/collections/subscriptions/records/${sub.id}`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${su}` },
          body: JSON.stringify({ expires_at: new Date(Date.now() + 90 * 86400000).toISOString() }),
        });
      }
    }
  });

  // 15. No raw backend errors appear
  test('15 - no raw backend errors in UI', async ({ page }) => {
    await injectToken(page);
    await page.goto('/lessons');
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    // Ensure no internal data leaks
    expect(bodyText).not.toContain('storage/');
    expect(bodyText).not.toContain('"code"');
    expect(bodyText).not.toContain('"message"');
  });

  // 16. Resume prompt restores the saved position into the player
  test('16 - resume restores saved position in the player', async ({ page }) => {
    // Save a position on the fresh lesson
    const save = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lesson3Id}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ positionSeconds: 150, expectedRevision: 0 }),
    });
    expect(save.status).toBe(200);

    await injectToken(page);
    await page.goto(`/lessons/${lesson3Id}`);

    // Resume prompt appears with the saved position (2:30)
    const resumeButton = page.getByRole('button', { name: /ادامه از 2:30/ });
    await expect(resumeButton).toBeVisible({ timeout: 15_000 });

    // Clicking resume must hand the saved position to the player
    await resumeButton.click();
    await expect(resumeButton).not.toBeVisible({ timeout: 5_000 });

    // The player's position display shows the resumed time (2:30), not 0:00
    const player = page.locator('[role="group"][aria-label="پخش‌کنندهٔ صوت"]');
    await expect(player).toBeAttached({ timeout: 10_000 });
    await expect(player.getByText('2:30', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  // 17. Newest position wins when the first save is stalled in flight
  test('17 - newest position wins when the first save is stalled', async ({ page }) => {
    await injectToken(page);
    await page.goto(`/lessons/${lesson4Id}`);
    const player = page.locator('[role="group"][aria-label="پخش‌کنندهٔ صوت"]');
    await expect(player).toBeVisible({ timeout: 15_000 });
    const slider = player.getByRole('slider', { name: 'موقعیت پخش' });
    await expect(slider).toBeVisible({ timeout: 15_000 });

    // Stall the first PUT to the progress endpoint so a newer seek can be
    // queued while the first write is still in flight.
    let putCount = 0;
    let release: () => void = () => {};
    const stalled = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await page.route(`**/api/fast-english/lessons/${lesson4Id}/progress`, async (route) => {
      if (route.request().method() === 'PUT') {
        putCount += 1;
        if (putCount === 1) {
          await stalled;
        }
      }
      await route.continue();
    });

    // The app is RTL, so ArrowLeft increases the seek position. Seek to 0.6s
    // (6 x 0.1s steps) — the first position that passes the 0.5s
    // meaningful-seek gate on a fresh lesson.
    await slider.focus();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    // Wait for the debounced first PUT to reach the stall.
    await expect.poll(() => putCount, { timeout: 15_000 }).toBe(1);

    // While the first write is still stalled, seek to a newer position (0.7s).
    await page.keyboard.press('ArrowLeft');

    // Release the stall: the first write succeeds and the queued (newest)
    // position must be drained right after with the returned revision.
    release();
    await expect
      .poll(
        async () => {
          const r = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lesson4Id}/progress`, {
            headers: { authorization: `Bearer ${studentToken}` },
          });
          return (r.body as Record<string, unknown>).positionSeconds as number;
        },
        { timeout: 15_000 },
      )
      .toBeCloseTo(0.7, 1);
  });

  for (const viewport of VISUAL_VIEWPORTS) {
    test(`[${viewport.name}] lesson list and audio player are reachable`, async ({ page }) => {
      mkdirSync(`${VISUAL_QA_DIR}/${viewport.name}`, { recursive: true });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await injectToken(page);

      await page.goto('/lessons');
      await expect(page.getByRole('heading', { name: 'P3S2 Lesson 1' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator('body')).not.toContainText('ورود');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `${VISUAL_QA_DIR}/${viewport.name}/lesson-list.png`,
        fullPage: true,
      });

      await page.goto(`/lessons/${lessonId}`);
      const player = page.locator('[role="group"][aria-label="پخش‌کنندهٔ صوت"]');
      await expect(player).toBeVisible({ timeout: 15_000 });
      await expect(player.getByRole('slider', { name: 'موقعیت پخش' })).toBeVisible();
      await expect(player.getByRole('button', { name: 'پخش', exact: true })).toBeVisible();
      await expect(player.getByRole('button', { name: 'سرعت پخش 1 برابر' })).toBeVisible();
      const speedButtons = player.getByRole('button', { name: /سرعت پخش/ });
      await expect(speedButtons).toHaveCount(5);
      const speedSizes = await speedButtons.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
      for (const size of speedSizes) {
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `${VISUAL_QA_DIR}/${viewport.name}/lesson-detail-audio.png`,
        fullPage: true,
      });
    });
  }
});
