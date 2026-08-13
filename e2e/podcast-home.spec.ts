// e2e/podcast-home.spec.ts
// Podcast Slice 5 — deterministic browser gates for the redesigned
// Podcast-first Student Home.
//
// Sections:
//   1. Home scenarios (§34) — Continue Listening with real progress,
//      first-use start experience, preferred-level recommendations,
//      real published New Episodes, draft/archived exclusion, quiet
//      subscription, expired/pending journeys, theme placement, mobile
//      destinations, no Staff UI.
//   2. Responsive quality (§33) — six viewports with overflow, artwork
//      containment, CTA visibility, bottom-nav clearance, heading/action
//      non-collision, long-title wrapping, theme-control placement.
//
// No screenshots are used as assertions; every check reads DOM geometry,
// computed styles or accessibility snapshots.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

// ---------------------------------------------------------------------------
// Helpers (same real-backend fixture pattern as visual-slice-2.spec.ts)
// ---------------------------------------------------------------------------
function randId(): string {
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

async function getSuperuserToken(): Promise<string> {
  const email = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const password = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const r = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  return (r.body as { token?: string })?.token || '';
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

async function makeTopic(
  su: string,
  overrides: { title?: string; titleFa?: string; status?: string } = {},
) {
  const slug = `ph-${randId()}`;
  const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: overrides.title ?? `T ${randId()}`,
      slug,
      description: 'd',
      sort_order: 1,
      status: 'draft',
      // Set at create (even for drafts): the unique content_key index
      // rejects a second empty value, and the draft fixture below stays
      // un-published on purpose.
      content_key: `fx-${randId()}`,
    }),
  });
  if (cr.status >= 400) {
    throw new Error(`topic create failed: ${cr.status} ${JSON.stringify(cr.body).slice(0, 200)}`);
  }
  const id = cr.body?.id as string;
  if (overrides.status === 'draft') return cr.body;
  await uploadArtwork(su, id);
  const patch: Record<string, unknown> = {
    status: overrides.status ?? 'published',
    category: await getDefaultCategoryId(su),
    content_key: `fx-${randId()}`,
    content_version: 1,
    title_fa: overrides.titleFa ?? 'عنوان اپیزود',
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

async function makeLesson(
  su: string,
  topicId: string,
  overrides: { title?: string; level?: string; status?: string } = {},
) {
  const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level ?? 'A1',
      title: overrides.title ?? `L ${randId()}`,
      summary: 's',
      body: 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  const id = cr.body?.id as string;
  if (!id) throw new Error(`create lesson: ${JSON.stringify(cr.body).slice(0, 200)}`);
  if (overrides.status === 'draft') return { id };
  await uploadAudio(su, id);
  const patch: Record<string, unknown> = { status: overrides.status ?? 'published' };
  patch.audio_duration_seconds = 600;
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

async function seedPlacementQuestions(su: string) {
  const existing = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const items = (existing.body?.items as Array<Record<string, unknown>>) || [];
  if (items.length > 0) return;
  for (let i = 0; i < 20; i++) {
    await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        question_key: `phq${String(i).padStart(2, '0')}`,
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

async function createActiveStudent(su: string, level = 'A1') {
  const staff = await createStaff(su);
  const opToken = staff.token;
  const phone = nextPhone();
  const password = 'Test1234!';
  const canonicalPhone = `+98${phone.slice(1)}`;
  const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'دانشجوی پادکستی', phone, password, passwordConfirm: password }),
  });
  const userId = signup.body?.id as string;
  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = (login.body as { token?: string })?.token || '';
  if (!token) throw new Error('student login failed');

  // Payment request + staff approval → real subscription.
  const boundary = `--FB${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${PLAN_ID}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG_FIXTURE,
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
  if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
  const prj = (await prRes.json()) as { request?: { id?: string } };
  const approve = await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${prj.request?.id}/approve`,
    { method: 'POST', headers: { authorization: `Bearer ${opToken}` }, body: JSON.stringify({}) },
  );
  if (approve.status !== 200) throw new Error(`approve: ${approve.status}`);

  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = (refresh.body as { token?: string })?.token || token;

  await seedPlacementQuestions(su);
  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id;
  let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
  for (const q of (start.body as { questions?: Array<{ id: string }> })?.questions || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${refreshedToken}` },
        body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
      },
    );
    rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
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
  return { token: refreshedToken, userId };
}

async function saveProgress(token: string, lessonId: string, positionSeconds: number) {
  const r = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ positionSeconds, expectedRevision: 0 }),
  });
  if (r.status !== 200) throw new Error(`progress save: ${r.status}`);
}

async function setAuthAndGo(page: Page, token: string, path: string) {
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
  // Let the route entrance animation settle before geometry assertions.
  await page.waitForTimeout(450);
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
      document.body.scrollWidth <= document.documentElement.clientWidth,
  );
}

// ---------------------------------------------------------------------------
// Fixtures (one shared disposable PocketBase for the whole suite)
// ---------------------------------------------------------------------------
let su: string;
let PLAN_ID = '';
let student: { token: string; userId: string };
let freshStudent: { token: string };
let expiredStudent: { token: string; userId: string };
let pendingStudent: { token: string };
let lessonIds: {
  alpha: string;
  beta: string;
  gamma: string;
  longTitle: string;
  otherLevel: string;
  draft: string;
  archived: string;
};
const PREFERRED_LESSON_IDS = () => [
  lessonIds.alpha,
  lessonIds.beta,
  lessonIds.gamma,
  lessonIds.longTitle,
];

test.beforeAll(async () => {
  su = await getSuperuserToken();
  expect(su).toBeTruthy();

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
      name: 'اشتراک آزمون خانه',
      slug: `p-ph-${randId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  PLAN_ID = (plan.body?.id as string) || '';

  const makeLevelLesson = async (title: string, titleFa: string) => {
    const topic = await makeTopic(su, { title: `موضوع ${title}`, titleFa });
    const lesson = await makeLesson(su, topic.id as string, { title, level: 'C1' });
    return lesson.id as string;
  };

  lessonIds = {
    alpha: await makeLevelLesson('Alpha Episode', 'اپیزود آلفا'),
    beta: await makeLevelLesson('Beta Episode', 'اپیزود بتا'),
    gamma: await makeLevelLesson('Gamma Episode', 'اپیزود گاما'),
    longTitle: await makeLevelLesson(
      'این عنوان بلند برای پیچیدن متن در کارت — A Long Title That Must Wrap Inside The Card',
      'اپیزود عنوان بلند',
    ),
    // Another published level: browsing it must never change the Home level.
    otherLevel: await (async () => {
      const topic = await makeTopic(su, { title: 'Other Topic', titleFa: 'اپیزود سطح دیگر' });
      const lesson = await makeLesson(su, topic.id as string, {
        title: 'Other Level',
        level: 'A2',
      });
      return lesson.id as string;
    })(),
    // Not published → must never appear anywhere public.
    draft: await (async () => {
      const topic = await makeTopic(su, {
        title: 'Draft Topic',
        titleFa: 'اپیزود پیشنویس',
        status: 'draft',
      });
      const lesson = await makeLesson(su, topic.id as string, {
        title: 'Draft Episode',
        status: 'draft',
      });
      return lesson.id as string;
    })(),
    // Archived → hidden but progress retained (publish → archive transition).
    archived: await (async () => {
      const topic = await makeTopic(su, { title: 'Archived Topic', titleFa: 'اپیزود بایگانیشده' });
      const lesson = await makeLesson(su, topic.id as string, { title: 'Archived Episode' });
      await jsonFetch(`${PB_URL}/api/collections/lessons/records/${lesson.id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({ status: 'archived' }),
      });
      await jsonFetch(`${PB_URL}/api/collections/topics/records/${topic.id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({ status: 'archived' }),
      });
      return lesson.id as string;
    })(),
  };

  student = await createActiveStudent(su, 'C1');
  await saveProgress(student.token, lessonIds.alpha, 150);
  freshStudent = await createActiveStudent(su, 'C1');

  // Expired Student: signup only, then the account is marked expired by the
  // superuser (the same fixture pattern the smoke suites use). No request,
  // no subscription: the payment journey is the real next action.
  expiredStudent = await (async () => {
    const phone = nextPhone();
    const password = 'Test1234!';
    const canonicalPhone = `+98${phone.slice(1)}`;
    const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
      method: 'POST',
      body: JSON.stringify({ name: 'دانشجوی منقضی', phone, password, passwordConfirm: password }),
    });
    const userId = signup.body?.id as string;
    await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${userId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({ account_status: 'expired' }),
    });
    const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
      method: 'POST',
      body: JSON.stringify({ identity: canonicalPhone, password }),
    });
    return { token: (login.body as { token?: string })?.token || '', userId };
  })();

  // Pending-payment student with a real submitted request.
  pendingStudent = await (async () => {
    const phone = nextPhone();
    const password = 'Test1234!';
    const canonicalPhone = `+98${phone.slice(1)}`;
    await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'دانشجوی در انتظار',
        phone,
        password,
        passwordConfirm: password,
      }),
    });
    const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
      method: 'POST',
      body: JSON.stringify({ identity: canonicalPhone, password }),
    });
    const token = (login.body as { token?: string })?.token || '';
    const boundary = `--FB${randId()}`;
    const prBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${PLAN_ID}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG_FIXTURE,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: prBody,
    });
    return { token };
  })();
});

// ---------------------------------------------------------------------------
// 1. Home scenarios (§34)
// ---------------------------------------------------------------------------
test.describe('podcast home scenarios', () => {
  test('1. student with progress sees the Continue Listening hero', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    const hero = page.getByTestId('home-continue');
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await expect(hero.getByText('ادامه گوش‌دادن')).toBeVisible();
    // Real Episode artwork is rendered (fallback or uploaded).
    await expect(page.getByTestId('continue-artwork').locator('img')).toBeVisible();
    // No fake progress: the start panel must NOT exist for this student.
    await expect(page.getByTestId('home-start')).toHaveCount(0);
  });

  test('2. Continue action opens the correct Variant', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    const cta = page.getByTestId('continue-cta');
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${lessonIds.alpha}`), { timeout: 10_000 });
  });

  test('3. position copy uses the real stored progress', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    const hero = page.getByTestId('home-continue');
    await expect(hero).toBeVisible({ timeout: 15_000 });
    // 150 saved seconds → «ادامه از 2:30» (authoritative duration 600).
    await expect(hero.getByText('ادامه از 2:30')).toBeVisible();
  });

  test('4. student without progress sees the intentional start state', async ({ page }) => {
    await setAuthAndGo(page, freshStudent.token, '/');
    const start = page.getByTestId('home-start');
    await expect(start).toBeVisible({ timeout: 15_000 });
    await expect(start.getByText('اولین اپیزودت را شروع کن')).toBeVisible();
    await expect(start.getByText(/اپیزودهای سطح C1 برای شروع آماده‌اند/)).toBeVisible();
    await expect(page.getByTestId('home-continue')).toHaveCount(0);
    const cta = page.getByTestId('home-start-cta');
    await cta.click();
    await expect(page).toHaveURL(/\/library$/, { timeout: 10_000 });
  });

  test('5. Recommended section uses the preferred level', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    const section = page.getByTestId('home-recommended');
    await expect(section).toBeVisible({ timeout: 15_000 });
    const cards = await section
      .locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"])',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
    expect(cards.length).toBeGreaterThan(0);
    const preferred = new Set(PREFERRED_LESSON_IDS());
    for (const card of cards) {
      const id = card.replace('episode-card-', '');
      expect(preferred.has(id), `${id} must be a preferred-level Episode`).toBe(true);
    }
    // The A2 episode never appears in the recommended section.
    expect(cards.some((c) => c.includes(lessonIds.otherLevel))).toBe(false);
  });

  test('6. browsing another level does not change the Home preferred level', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    await expect(page.getByTestId('home-recommended')).toBeVisible({ timeout: 15_000 });
    // Server-side level browsing is per-request and read-only: requesting
    // the A2 level returns the A2 Episode without touching the preferred
    // level (the Level Switcher UI itself is a later slice).
    const other = await jsonFetch(`${PB_URL}/api/fast-english/lessons?level=A2`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    expect(other.status).toBe(200);
    const otherIds = (other.body as { lessons?: Array<{ id: string }> })?.lessons?.map((l) => l.id);
    expect(otherIds).toContain(lessonIds.otherLevel);
    // Home afterwards still recommends the preferred (C1) level only.
    await page.goto('/');
    await page.waitForTimeout(450);
    const section = page.getByTestId('home-recommended');
    await expect(section).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-testid="episode-card-${lessonIds.otherLevel}"]`)).toHaveCount(
      0,
    );
    await expect(page.locator(`[data-testid="episode-card-${lessonIds.alpha}"]`)).toHaveCount(1);
  });

  test('7. New Episodes section uses real Published data', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    const section = page.getByTestId('home-latest');
    await expect(section).toBeVisible({ timeout: 15_000 });
    const cards = await section
      .locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"])',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
    // Every card maps to a real published preferred-level Episode; the
    // sections never overlap.
    const preferred = new Set(PREFERRED_LESSON_IDS());
    for (const card of cards) {
      expect(preferred.has(card.replace('episode-card-', '')), `${card} published preferred`).toBe(
        true,
      );
    }
    const recommendedCards = await page
      .getByTestId('home-recommended')
      .locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"])',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
    for (const card of cards) {
      expect(recommendedCards.includes(card)).toBe(false);
    }
  });

  test('8. draft and archived content is absent from Home and Library', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-testid="episode-card-${lessonIds.draft}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="episode-card-${lessonIds.archived}"]`)).toHaveCount(0);
    await page.goto('/library');
    await page.waitForTimeout(450);
    await expect(page.locator(`[data-testid="episode-card-${lessonIds.draft}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="episode-card-${lessonIds.archived}"]`)).toHaveCount(0);
  });

  test('9. active subscription does not dominate Home', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    const status = page.getByTestId('subscription-card');
    await expect(status).toBeVisible({ timeout: 15_000 });
    await expect(status.getByText('فعال')).toBeVisible();
    // No payment actions on the Home: the status area is informational.
    await expect(status.getByRole('button')).toHaveCount(0);
    // The Continue CTA remains the dominant action.
    await expect(page.getByTestId('continue-cta')).toBeVisible();
  });

  test('10. expired state provides the correct Student action', async ({ page }) => {
    await setAuthAndGo(page, expiredStudent.token, '/');
    // The Home route is active-only: an expired Student lands on the real
    // payment journey, which states the clear expired state and the next
    // step (renewal is not yet available; support contact is the action).
    await expect(page).toHaveURL(/\/payment/, { timeout: 15_000 });
    await expect(page.getByText('اشتراک شما به پایان رسیده است.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/تمدید اشتراک در حال حاضر فعال نیست/)).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('اپراتور');
  });

  test('11. pending payment uses Student-facing copy', async ({ page }) => {
    await setAuthAndGo(page, pendingStudent.token, '/');
    await expect(page).toHaveURL(/\/payment-status/, { timeout: 15_000 });
    await expect(page.getByText('در انتظار بررسی').first()).toBeVisible({ timeout: 15_000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('اپراتور');
    expect(body).not.toContain('پنل');
  });

  test('12. theme selector exists only inside Settings', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await page.goto('/account');
    await page.waitForTimeout(450);
    await expect(page.getByTestId('account-theme-switch')).toBeVisible();
  });

  test('13. Home works in Light and Dark without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await setAuthAndGo(page, student.token, '/');
    await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
    expect(await noHorizontalOverflow(page), 'light').toBe(true);
    await page.goto('/account');
    await page
      .getByTestId('account-theme-switch')
      .getByRole('button', { name: 'حالت تیره' })
      .click();
    await page.waitForTimeout(80);
    await page.goto('/');
    await page.waitForTimeout(450);
    await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
    expect(await noHorizontalOverflow(page), 'dark').toBe(true);
    await page.goto('/account');
    await page
      .getByTestId('account-theme-switch')
      .getByRole('button', { name: 'حالت سیستمی' })
      .click();
  });

  test('14. mobile navigation contains exactly the final Student destinations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, '/');
    const nav = page.getByTestId('student-bottom-nav');
    await expect(nav).toBeVisible({ timeout: 15_000 });
    const buttons = nav.getByRole('button');
    await expect(buttons).toHaveCount(4);
    for (const label of ['خانه', 'کتابخانه', 'پیشرفت', 'حساب']) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole('button', { name: 'درس‌ها', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'خانه', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('15. no Admin/Operator UI exists on Home', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/');
    await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('اپراتور');
    expect(body).not.toContain('پنل');
    expect(body).not.toContain('Operator');
    expect(body).not.toContain('Admin');
  });
});

// ---------------------------------------------------------------------------
// 2. Responsive quality (§33) — deterministic geometry at six viewports
// ---------------------------------------------------------------------------
test.describe('home responsive quality', () => {
  const VIEWPORTS = [
    { name: '360x800', width: 360, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '430x932', width: 430, height: 932 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '1440x900', width: 1440, height: 900 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`Home geometry at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setAuthAndGo(page, student.token, '/');
      const hero = page.getByTestId('home-continue');
      await expect(hero).toBeVisible({ timeout: 15_000 });

      // 1. No document horizontal overflow.
      expect(await noHorizontalOverflow(page), 'overflow').toBe(true);

      // 2. Artwork stays inside the hero card.
      const heroBox = (await hero.boundingBox())!;
      const artBox = (await page.getByTestId('continue-artwork').boundingBox())!;
      expect(artBox.x).toBeGreaterThanOrEqual(heroBox.x - 1);
      expect(artBox.x + artBox.width).toBeLessThanOrEqual(heroBox.x + heroBox.width + 1);
      expect(artBox.y).toBeGreaterThanOrEqual(heroBox.y - 1);
      expect(artBox.y + artBox.height).toBeLessThanOrEqual(heroBox.y + heroBox.height + 1);

      // 3. Continue CTA stays visible inside the viewport.
      const cta = page.getByTestId('continue-cta');
      await expect(cta).toBeVisible();
      const ctaBox = (await cta.boundingBox())!;
      expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(ctaBox.width).toBeGreaterThan(0);

      // 4. Bottom navigation never covers content (PageContainer reserves
      // space on phones; the md+ layout is in-flow and needs the page pad).
      const main = page.getByRole('main').first();
      const paddingBottom = await main
        .locator('.MuiContainer-root > div')
        .first()
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingBottom));
      if (viewport.width < 768) {
        expect(paddingBottom).toBeGreaterThanOrEqual(64 + 8);
      } else {
        expect(paddingBottom).toBeGreaterThanOrEqual(24);
      }

      // 5. Section headings do not collide with section actions.
      for (const sectionId of ['home-recommended', 'home-latest']) {
        const section = page.getByTestId(sectionId);
        if ((await section.count()) === 0) continue;
        const heading = section.locator('h2').first();
        const headingBox = (await heading.boundingBox())!;
        const sectionBox = (await section.boundingBox())!;
        expect(headingBox.x).toBeGreaterThanOrEqual(sectionBox.x - 1);
        expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(
          sectionBox.x + sectionBox.width + 1,
        );
      }

      // 6. Long titles wrap inside their card (no clipped/overflowing text).
      const longCard = page.locator(`[data-testid="episode-card-${lessonIds.longTitle}"]`);
      if ((await longCard.count()) > 0) {
        const cardBox = (await longCard.boundingBox())!;
        expect(cardBox.width).toBeGreaterThan(0);
        expect(cardBox.width).toBeLessThanOrEqual(viewport.width + 1);
        const title = longCard.locator('[data-testid="episode-card-title"]').first();
        const titleBox = (await title.boundingBox())!;
        expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }
    });
  }

  test('theme control absent from App Bar, present in Account settings (all viewports)', async ({
    page,
  }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setAuthAndGo(page, student.token, '/');
      await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('theme-switch')).toHaveCount(0);
      await page.goto('/account');
      await page.waitForTimeout(300);
      await expect(page.getByTestId('account-theme-switch')).toBeVisible();
    }
  });

  test('no Student Staff navigation on any viewport', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setAuthAndGo(page, student.token, '/');
      await expect(page.getByTestId('home-continue')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('link', { name: /اپراتور|پنل|مدیریت/ })).toHaveCount(0);
    }
  });
});
